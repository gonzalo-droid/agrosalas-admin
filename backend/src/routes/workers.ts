import { and, asc, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware.js'
import { groupWorkers, workerPaymentMethods, workers } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import { notFound } from '../lib/errors.js'
import { offsetOf, pageSchema, paginated } from '../lib/pagination.js'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate.js'
import type { AppEnv, Db, Dependencies, SessionUser, Tx } from '../types.js'

const text = (max: number) => z.string().trim().max(max).nullable().optional()
const optionalId = z.uuid().nullable().optional()

const createWorker = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos'),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  phone: text(20),
  email: z.email().nullable().optional(),
  address: text(160),
  emergencyContactName: text(80),
  emergencyContactPhone: text(20),
  areaId: optionalId,
  positionId: optionalId,
  shiftId: optionalId,
  employmentType: z.enum(['temporary', 'contract']),
  hireDate: z.iso.date().nullable().optional(),
  notes: text(500),
})
const updateWorker = withAtLeastOneField(createWorker.partial().extend({ status: z.enum(['active', 'terminated']).optional() }))

const workerFilters = pageSchema.extend({
  search: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  employmentType: z.enum(['temporary', 'contract']).optional(),
  status: z.enum(['active', 'terminated']).optional(),
})

// The coordinator only reaches the workers of their areas.
export function workerScope(user: SessionUser): SQL | undefined {
  if (user.role !== 'coordinator') return undefined
  if (user.areaIds.length === 0) return eq(workers.id, '00000000-0000-0000-0000-000000000000')
  return inArray(workers.areaId, user.areaIds)
}

export async function findWorker(db: Db | Tx, user: SessionUser, id: string) {
  const [row] = await db
    .select()
    .from(workers)
    .where(and(eq(workers.id, id), workerScope(user)))
  if (!row) throw notFound('El trabajador')
  return row
}

export const workersRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', validate('query', workerFilters), async (c) => {
      const filters = c.req.valid('query')
      const condition = and(
        workerScope(c.get('user')),
        filters.areaId ? eq(workers.areaId, filters.areaId) : undefined,
        filters.employmentType ? eq(workers.employmentType, filters.employmentType) : undefined,
        filters.status ? eq(workers.status, filters.status) : undefined,
        filters.search
          ? or(
              ilike(workers.firstName, `%${filters.search}%`),
              ilike(workers.lastName, `%${filters.search}%`),
              ilike(workers.dni, `%${filters.search}%`),
            )
          : undefined,
      )
      const [{ total }] = await db.select({ total: count() }).from(workers).where(condition)
      const rows = await db
        .select()
        .from(workers)
        .where(condition)
        .orderBy(asc(workers.lastName), asc(workers.firstName), asc(workers.id))
        .limit(filters.pageSize)
        .offset(offsetOf(filters))
      return c.json(paginated(rows, total, filters))
    })
    .get('/:id', validate('param', idSchema), async (c) => {
      const user = c.get('user')
      const { id } = c.req.valid('param')
      const row = await findWorker(db, user, id)
      // Payment methods are bank details: the coordinator does not receive them.
      const paymentMethods =
        user.role === 'coordinator'
          ? []
          : await db
              .select()
              .from(workerPaymentMethods)
              .where(eq(workerPaymentMethods.workerId, id))
              .orderBy(asc(workerPaymentMethods.createdAt))
      const memberships = await db.select().from(groupWorkers).where(eq(groupWorkers.workerId, id))
      return c.json({ ...row, paymentMethods, groupIds: memberships.map((m) => m.groupId) })
    })
    .post('/', requireRole('admin', 'accounting'), validate('json', createWorker), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(workers).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'workers', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch(
      '/:id',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', updateWorker),
      async (c) => {
        const { id } = c.req.valid('param')
        const row = await db.transaction(async (tx) => {
          const before = await findWorker(tx, c.get('user'), id)
          const [after] = await tx
            .update(workers)
            .set(c.req.valid('json'))
            .where(eq(workers.id, id))
            .returning()
          await recordAudit(tx, c.get('user').id, 'update', 'workers', id, before, after)
          return after
        })
        return c.json(row)
      },
    )
