import { and, asc, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { grupoTrabajadores, trabajadorMetodosPago, trabajadores } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { notFound } from '../lib/errors'
import { offsetOf, pageSchema, paginated } from '../lib/pagination'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Db, Dependencies, SessionUser, Tx } from '../types'

const text = (max: number) => z.string().trim().max(max).nullable().optional()
const optionalId = z.uuid().nullable().optional()

const crearTrabajador = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos'),
  nombres: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().min(1).max(80),
  telefono: text(20),
  correo: z.email().nullable().optional(),
  direccion: text(160),
  emergenciaNombre: text(80),
  emergenciaTelefono: text(20),
  areaId: optionalId,
  cargoId: optionalId,
  turnoId: optionalId,
  modalidad: z.enum(['temporal', 'contrato']),
  fechaIngreso: z.iso.date().nullable().optional(),
  notas: text(500),
})
const editarTrabajador = withAtLeastOneField(crearTrabajador.partial().extend({ estado: z.enum(['activo', 'cesado']).optional() }))

const filtros = pageSchema.extend({
  texto: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  modalidad: z.enum(['temporal', 'contrato']).optional(),
  estado: z.enum(['activo', 'cesado']).optional(),
})

// The coordinator only reaches the workers of their areas.
export function workerScope(user: SessionUser): SQL | undefined {
  if (user.rol !== 'coordinador') return undefined
  if (user.areaIds.length === 0) return eq(trabajadores.id, '00000000-0000-0000-0000-000000000000')
  return inArray(trabajadores.areaId, user.areaIds)
}

export async function findWorker(db: Db | Tx, user: SessionUser, id: string) {
  const [row] = await db
    .select()
    .from(trabajadores)
    .where(and(eq(trabajadores.id, id), workerScope(user)))
  if (!row) throw notFound('El trabajador')
  return row
}

export const workersRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', validate('query', filtros), async (c) => {
      const filters = c.req.valid('query')
      const condition = and(
        workerScope(c.get('user')),
        filters.areaId ? eq(trabajadores.areaId, filters.areaId) : undefined,
        filters.modalidad ? eq(trabajadores.modalidad, filters.modalidad) : undefined,
        filters.estado ? eq(trabajadores.estado, filters.estado) : undefined,
        filters.texto
          ? or(
              ilike(trabajadores.nombres, `%${filters.texto}%`),
              ilike(trabajadores.apellidos, `%${filters.texto}%`),
              ilike(trabajadores.dni, `%${filters.texto}%`),
            )
          : undefined,
      )
      const [{ total }] = await db.select({ total: count() }).from(trabajadores).where(condition)
      const rows = await db
        .select()
        .from(trabajadores)
        .where(condition)
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres), asc(trabajadores.id))
        .limit(filters.tamano)
        .offset(offsetOf(filters))
      return c.json(paginated(rows, total, filters))
    })
    .get('/:id', validate('param', idSchema), async (c) => {
      const user = c.get('user')
      const { id } = c.req.valid('param')
      const row = await findWorker(db, user, id)
      // Payment methods are bank details: the coordinator does not receive them.
      const paymentMethods =
        user.rol === 'coordinador'
          ? []
          : await db
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
      const memberships = await db.select().from(grupoTrabajadores).where(eq(grupoTrabajadores.trabajadorId, id))
      return c.json({ ...row, metodosPago: paymentMethods, grupoIds: memberships.map((m) => m.grupoId) })
    })
    .post('/', requireRole('admin', 'contabilidad'), validate('json', crearTrabajador), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(trabajadores).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'trabajadores', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch(
      '/:id',
      requireRole('admin', 'contabilidad'),
      validate('param', idSchema),
      validate('json', editarTrabajador),
      async (c) => {
        const { id } = c.req.valid('param')
        const row = await db.transaction(async (tx) => {
          const before = await findWorker(tx, c.get('user'), id)
          const [after] = await tx
            .update(trabajadores)
            .set(c.req.valid('json'))
            .where(eq(trabajadores.id, id))
            .returning()
          await recordAudit(tx, c.get('user').id, 'editar', 'trabajadores', id, before, after)
          return after
        })
        return c.json(row)
      },
    )
