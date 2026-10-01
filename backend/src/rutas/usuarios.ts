import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { areas, usuarioAreas, usuarios } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { conAlgunCampo, esquemaId, validar } from '../lib/validar'
import type { Db, Dependencias, Entorno, Tx } from '../tipos'

const rol = z.enum(['admin', 'gerencia', 'contabilidad', 'coordinador'])
const crearUsuario = z.object({
  correo: z.email(),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  nombre: z.string().trim().min(2).max(80),
  rol,
  areaIds: z.array(z.uuid()).default([]),
})
const editarUsuario = conAlgunCampo(
  z
    .object({ nombre: z.string().trim().min(2).max(80), rol, activo: z.boolean(), areaIds: z.array(z.uuid()) })
    .partial(),
)

async function areasDe(db: Db | Tx, usuarioId: string) {
  const filas = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuarioId))
  return filas.map((f) => f.areaId)
}

async function fijarAreas(tx: Tx, usuarioId: string, areaIds: string[]) {
  await tx.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuarioId))
  if (areaIds.length > 0) {
    await tx.insert(usuarioAreas).values(areaIds.map((areaId) => ({ usuarioId, areaId })))
  }
}

export const rutasUsuarios = ({ db, authAdmin }: Dependencias) =>
  new Hono<Entorno>()
    .use('*', requiereRol('admin'))
    .get('/', async (c) => {
      const filas = await db.select().from(usuarios).orderBy(asc(usuarios.nombre))
      const asignadas = await db.select().from(usuarioAreas)
      const datos = filas.map((u) => ({
        ...u,
        areaIds: asignadas.filter((a) => a.usuarioId === u.id).map((a) => a.areaId),
      }))
      return c.json({ datos })
    })
    .post('/', validar('json', crearUsuario), async (c) => {
      const { correo, clave, nombre, rol, areaIds } = c.req.valid('json')
      const [existente] = await db.select().from(usuarios).where(eq(usuarios.correo, correo))
      if (existente) throw new ErrorApi(409, 'duplicado', 'Ya existe un usuario con ese correo', 'correo')
      // Se valida antes de crear la cuenta de login, para no dejarla huérfana si el alta falla.
      if (areaIds.length > 0) {
        const existentes = await db.select({ id: areas.id }).from(areas).where(inArray(areas.id, areaIds))
        if (existentes.length !== new Set(areaIds).size) {
          throw new ErrorApi(400, 'referencia_invalida', 'Una de las áreas indicadas no existe', 'areaIds')
        }
      }
      const { id } = await authAdmin.crearUsuario(correo, clave)
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(usuarios).values({ id, correo, nombre, rol }).returning()
        await fijarAreas(tx, id, areaIds)
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'usuarios', id, null, { ...nuevo, areaIds })
        return nuevo
      })
      return c.json({ ...fila, areaIds }, 201)
    })
    .patch('/:id', validar('param', esquemaId), validar('json', editarUsuario), async (c) => {
      const { id } = c.req.valid('param')
      const { areaIds, ...datos } = c.req.valid('json')
      const yo = c.get('usuario')
      if (id === yo.id && (datos.activo === false || (datos.rol && datos.rol !== 'admin'))) {
        throw new ErrorApi(400, 'validacion', 'No puedes quitarte tu propio acceso de administrador')
      }
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(usuarios).where(eq(usuarios.id, id))
        if (!antes) throw noEncontrado('El usuario')
        const areasAntes = await areasDe(tx, id)
        // Un PATCH que solo cambia las áreas también cuenta como edición del usuario.
        const [despues] = await tx.update(usuarios).set({ ...datos, actualizadoEn: new Date() }).where(eq(usuarios.id, id)).returning()
        if (areaIds) await fijarAreas(tx, id, areaIds)
        const areasDespues = areaIds ?? areasAntes
        await registrarAuditoria(
          tx,
          yo.id,
          'editar',
          'usuarios',
          id,
          { ...antes, areaIds: areasAntes },
          { ...despues, areaIds: areasDespues },
        )
        return { ...despues, areaIds: areasDespues }
      })
      return c.json(fila)
    })
