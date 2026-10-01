import { and, asc, count, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { grupoTrabajadores, grupos, trabajadores } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { conAlgunCampo, esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const nombre = z.string().trim().min(2).max(60)
const fecha = z.iso.date().nullable().optional()
const crearGrupo = z.object({
  nombre,
  temporal: z.boolean().default(false),
  fechaInicio: fecha,
  fechaFin: fecha,
})
// Sin valores por defecto: al editar, un campo que no se manda no se toca.
const editarGrupo = conAlgunCampo(
  z.object({ nombre, temporal: z.boolean(), fechaInicio: fecha, fechaFin: fecha, activo: z.boolean() }).partial(),
)
const agregarMiembros = z.object({ trabajadorIds: z.array(z.uuid()).min(1).max(200) })
const idsMiembro = z.object({ id: z.uuid(), trabajadorId: z.uuid() })

export const rutasGrupos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => {
      const datos = await db
        .select({ ...getTableColumns(grupos), miembros: count(grupoTrabajadores.trabajadorId) })
        .from(grupos)
        .leftJoin(grupoTrabajadores, eq(grupoTrabajadores.grupoId, grupos.id))
        .groupBy(grupos.id)
        .orderBy(asc(grupos.nombre))
      return c.json({ datos })
    })
    .get('/:id', validar('param', esquemaId), async (c) => {
      const { id } = c.req.valid('param')
      const [grupo] = await db.select().from(grupos).where(eq(grupos.id, id))
      if (!grupo) throw noEncontrado('El grupo')
      const miembros = await db
        .select({
          id: trabajadores.id,
          nombres: trabajadores.nombres,
          apellidos: trabajadores.apellidos,
          dni: trabajadores.dni,
        })
        .from(grupoTrabajadores)
        .innerJoin(trabajadores, eq(trabajadores.id, grupoTrabajadores.trabajadorId))
        .where(eq(grupoTrabajadores.grupoId, id))
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres))
      return c.json({ ...grupo, miembros })
    })
    .post('/', requiereRol('admin'), validar('json', crearGrupo), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(grupos).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'grupos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarGrupo), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(grupos).where(eq(grupos.id, id))
        if (!antes) throw noEncontrado('El grupo')
        const [despues] = await tx.update(grupos).set(c.req.valid('json')).where(eq(grupos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
    .post(
      '/:id/miembros',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', agregarMiembros),
      async (c) => {
        const { id } = c.req.valid('param')
        const { trabajadorIds } = c.req.valid('json')
        await db.transaction(async (tx) => {
          const [grupo] = await tx.select().from(grupos).where(eq(grupos.id, id))
          if (!grupo) throw noEncontrado('El grupo')
          await tx
            .insert(grupoTrabajadores)
            .values(trabajadorIds.map((trabajadorId) => ({ grupoId: id, trabajadorId })))
            .onConflictDoNothing()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, null, { agregados: trabajadorIds })
        })
        return c.json({ ok: true })
      },
    )
    .delete(
      '/:id/miembros/:trabajadorId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMiembro),
      async (c) => {
        const { id, trabajadorId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          await tx
            .delete(grupoTrabajadores)
            .where(and(eq(grupoTrabajadores.grupoId, id), eq(grupoTrabajadores.trabajadorId, trabajadorId)))
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, { quitado: trabajadorId }, null)
        })
        return c.json({ ok: true })
      },
    )
