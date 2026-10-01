import { and, asc, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { grupoTrabajadores, trabajadorMetodosPago, trabajadores } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { desplazamiento, esquemaPagina, paginado } from '../lib/paginacion'
import { conAlgunCampo, esquemaId, validar } from '../lib/validar'
import type { Db, Dependencias, Entorno, Tx, UsuarioSesion } from '../tipos'

const texto = (max: number) => z.string().trim().max(max).nullable().optional()
const idOpcional = z.uuid().nullable().optional()

const crearTrabajador = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos'),
  nombres: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().min(1).max(80),
  telefono: texto(20),
  correo: z.email().nullable().optional(),
  direccion: texto(160),
  emergenciaNombre: texto(80),
  emergenciaTelefono: texto(20),
  areaId: idOpcional,
  cargoId: idOpcional,
  turnoId: idOpcional,
  modalidad: z.enum(['temporal', 'contrato']),
  fechaIngreso: z.iso.date().nullable().optional(),
  notas: texto(500),
})
const editarTrabajador = conAlgunCampo(crearTrabajador.partial().extend({ estado: z.enum(['activo', 'cesado']).optional() }))

const filtros = esquemaPagina.extend({
  texto: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  modalidad: z.enum(['temporal', 'contrato']).optional(),
  estado: z.enum(['activo', 'cesado']).optional(),
})

// El coordinador solo alcanza a los trabajadores de sus áreas.
export function alcance(usuario: UsuarioSesion): SQL | undefined {
  if (usuario.rol !== 'coordinador') return undefined
  if (usuario.areaIds.length === 0) return eq(trabajadores.id, '00000000-0000-0000-0000-000000000000')
  return inArray(trabajadores.areaId, usuario.areaIds)
}

export async function buscarTrabajador(db: Db | Tx, usuario: UsuarioSesion, id: string) {
  const [fila] = await db
    .select()
    .from(trabajadores)
    .where(and(eq(trabajadores.id, id), alcance(usuario)))
  if (!fila) throw noEncontrado('El trabajador')
  return fila
}

export const rutasTrabajadores = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', validar('query', filtros), async (c) => {
      const f = c.req.valid('query')
      const condicion = and(
        alcance(c.get('usuario')),
        f.areaId ? eq(trabajadores.areaId, f.areaId) : undefined,
        f.modalidad ? eq(trabajadores.modalidad, f.modalidad) : undefined,
        f.estado ? eq(trabajadores.estado, f.estado) : undefined,
        f.texto
          ? or(
              ilike(trabajadores.nombres, `%${f.texto}%`),
              ilike(trabajadores.apellidos, `%${f.texto}%`),
              ilike(trabajadores.dni, `%${f.texto}%`),
            )
          : undefined,
      )
      const [{ total }] = await db.select({ total: count() }).from(trabajadores).where(condicion)
      const datos = await db
        .select()
        .from(trabajadores)
        .where(condicion)
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres), asc(trabajadores.id))
        .limit(f.tamano)
        .offset(desplazamiento(f))
      return c.json(paginado(datos, total, f))
    })
    .get('/:id', validar('param', esquemaId), async (c) => {
      const usuario = c.get('usuario')
      const { id } = c.req.valid('param')
      const fila = await buscarTrabajador(db, usuario, id)
      // Los métodos de pago son datos bancarios: el coordinador no los recibe.
      const metodosPago =
        usuario.rol === 'coordinador'
          ? []
          : await db
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
      const grupos = await db.select().from(grupoTrabajadores).where(eq(grupoTrabajadores.trabajadorId, id))
      return c.json({ ...fila, metodosPago, grupoIds: grupos.map((g) => g.grupoId) })
    })
    .post('/', requiereRol('admin', 'contabilidad'), validar('json', crearTrabajador), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(trabajadores).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'trabajadores', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch(
      '/:id',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', editarTrabajador),
      async (c) => {
        const { id } = c.req.valid('param')
        const fila = await db.transaction(async (tx) => {
          const antes = await buscarTrabajador(tx, c.get('usuario'), id)
          const [despues] = await tx
            .update(trabajadores)
            .set(c.req.valid('json'))
            .where(eq(trabajadores.id, id))
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'trabajadores', id, antes, despues)
          return despues
        })
        return c.json(fila)
      },
    )
