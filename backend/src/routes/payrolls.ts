import { and, asc, count, desc, eq, getTableColumns, gt, gte, ilike, inArray, lt, lte, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import {
  attendanceRecords, campaigns, groups, groupWorkers, payrolls, payrollWorkers, workers,
} from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { offsetOf, pageSchema, paginated } from '../lib/pagination'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import { redactMoney } from '../payroll/attendance-service'
import { findOpenPayroll } from '../payroll/open-payroll'
import type { AppEnv, Db, Dependencies, Tx } from '../types'
import { workerScope } from './workers'

const isoDate = z.iso.date()
const payrollFields = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['weekly', 'monthly']),
  startDate: isoDate,
  endDate: isoDate,
  campaignId: z.uuid().nullable().optional(),
})
const workerSource = z
  .object({
    workerIds: z.array(z.uuid()).min(1).max(500),
    groupId: z.uuid(),
    payrollId: z.uuid(),
    allActiveTemporary: z.literal(true),
  })
  .partial()
  .refine((source) => Object.keys(source).length === 1, { message: 'Indica una sola forma de agregar trabajadores' })
const END_BEFORE_START = 'La fecha de fin no puede ser anterior a la de inicio'
const payrollInput = payrollFields
  .extend({ workers: workerSource.optional() })
  .refine((p) => p.endDate >= p.startDate, { message: END_BEFORE_START, path: ['endDate'] })
const payrollUpdate = withAtLeastOneField(payrollFields.omit({ type: true }).partial())
const payrollFilters = pageSchema.extend({
  search: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  campaignId: z.uuid().optional(),
  status: z.enum(['open', 'closed']).optional(),
  type: z.enum(['weekly', 'monthly']).optional(),
})
const memberIds = z.object({ id: z.uuid(), workerId: z.uuid() })

type WorkerSource = z.infer<typeof workerSource>

async function resolveWorkerIds(tx: Db | Tx, source: WorkerSource): Promise<string[]> {
  if (source.workerIds) {
    const ids = [...new Set(source.workerIds)]
    const found = await tx.select({ id: workers.id }).from(workers).where(inArray(workers.id, ids))
    if (found.length !== ids.length) {
      throw new ApiError(400, 'invalid_reference', 'Uno de los trabajadores indicados no existe')
    }
    return ids
  }
  if (source.groupId) {
    const [group] = await tx.select({ id: groups.id }).from(groups).where(eq(groups.id, source.groupId))
    if (!group) throw new ApiError(400, 'invalid_reference', 'El grupo indicado no existe')
    const rows = await tx
      .select({ workerId: groupWorkers.workerId })
      .from(groupWorkers)
      .where(eq(groupWorkers.groupId, source.groupId))
    return rows.map((row) => row.workerId)
  }
  if (source.payrollId) {
    const [payroll] = await tx.select({ id: payrolls.id }).from(payrolls).where(eq(payrolls.id, source.payrollId))
    if (!payroll) throw new ApiError(400, 'invalid_reference', 'La planilla indicada no existe')
    const rows = await tx
      .select({ workerId: payrollWorkers.workerId })
      .from(payrollWorkers)
      .where(eq(payrollWorkers.payrollId, source.payrollId))
    return rows.map((row) => row.workerId)
  }
  const rows = await tx
    .select({ id: workers.id })
    .from(workers)
    .where(and(eq(workers.employmentType, 'temporary'), eq(workers.status, 'active')))
  return rows.map((row) => row.id)
}

// Returns the ids of the workers actually added: the ones already in the payroll are ignored.
async function addWorkers(tx: Db | Tx, payrollId: string, workerIds: string[]): Promise<string[]> {
  if (workerIds.length === 0) return []
  const inserted = await tx
    .insert(payrollWorkers)
    .values(workerIds.map((workerId) => ({ payrollId, workerId })))
    .onConflictDoNothing()
    .returning({ workerId: payrollWorkers.workerId })
  return inserted.map((row) => row.workerId)
}

async function countWorkers(db: Db | Tx, payrollId: string): Promise<number> {
  const [{ total }] = await db.select({ total: count() }).from(payrollWorkers).where(eq(payrollWorkers.payrollId, payrollId))
  return total
}

export const payrollsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', validate('query', payrollFilters), async (c) => {
      const user = c.get('user')
      const filters = c.req.valid('query')
      const condition = and(
        filters.search ? ilike(payrolls.name, `%${filters.search}%`) : undefined,
        // The period crosses the range when it ends on or after `from` and starts on or before `to`.
        filters.from ? gte(payrolls.endDate, filters.from) : undefined,
        filters.to ? lte(payrolls.startDate, filters.to) : undefined,
        filters.campaignId ? eq(payrolls.campaignId, filters.campaignId) : undefined,
        filters.status ? eq(payrolls.status, filters.status) : undefined,
        filters.type ? eq(payrolls.type, filters.type) : undefined,
      )
      const [{ total }] = await db.select({ total: count() }).from(payrolls).where(condition)
      // Correlated subqueries: two joins at once would multiply the rows.
      const rows = await db
        .select({
          id: payrolls.id,
          name: payrolls.name,
          type: payrolls.type,
          startDate: payrolls.startDate,
          endDate: payrolls.endDate,
          campaignId: payrolls.campaignId,
          campaignName: campaigns.name,
          status: payrolls.status,
          workerCount: sql<number>`(select count(*) from ${payrollWorkers} where ${payrollWorkers.payrollId} = ${payrolls.id})::int`.mapWith(Number),
          totalCents: sql<number>`(select coalesce(sum(${attendanceRecords.amountCents}), 0) from ${attendanceRecords} where ${attendanceRecords.payrollId} = ${payrolls.id})::bigint`.mapWith(Number),
          createdAt: payrolls.createdAt,
        })
        .from(payrolls)
        .leftJoin(campaigns, eq(campaigns.id, payrolls.campaignId))
        .where(condition)
        .orderBy(desc(payrolls.startDate), asc(payrolls.id))
        .limit(filters.pageSize)
        .offset(offsetOf(filters))
      // The coordinator never receives amounts.
      const items = rows.map((row) => ({ ...row, totalCents: user.role === 'coordinator' ? null : row.totalCents }))
      return c.json(paginated(items, total, filters))
    })
    .post('/', requireRole('admin', 'accounting'), validate('json', payrollInput), async (c) => {
      const { workers: source, ...fields } = c.req.valid('json')
      const row = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(payrolls)
          .values({ ...fields, createdBy: c.get('user').id })
          .returning()
        const workerIds = source ? await resolveWorkerIds(tx, source) : []
        await addWorkers(tx, created.id, workerIds)
        await recordAudit(tx, c.get('user').id, 'create', 'payrolls', created.id, null, created)
        return { ...created, workerCount: await countWorkers(tx, created.id) }
      })
      return c.json(row, 201)
    })
    .get('/:id', validate('param', idSchema), async (c) => {
      const user = c.get('user')
      const { id } = c.req.valid('param')
      const [payroll] = await db
        .select({ ...getTableColumns(payrolls), campaignName: campaigns.name })
        .from(payrolls)
        .leftJoin(campaigns, eq(campaigns.id, payrolls.campaignId))
        .where(eq(payrolls.id, id))
      if (!payroll) throw notFound('La planilla')
      const members = await db
        .select({
          id: workers.id,
          firstName: workers.firstName,
          lastName: workers.lastName,
          dni: workers.dni,
          areaId: workers.areaId,
          positionId: workers.positionId,
          employmentType: workers.employmentType,
          status: workers.status,
        })
        .from(payrollWorkers)
        .innerJoin(workers, eq(workers.id, payrollWorkers.workerId))
        // The coordinator only sees the workers of their areas.
        .where(and(eq(payrollWorkers.payrollId, id), workerScope(user)))
        .orderBy(asc(workers.lastName), asc(workers.firstName), asc(workers.id))
      const records =
        members.length === 0
          ? []
          : await db
              .select()
              .from(attendanceRecords)
              .where(
                and(
                  eq(attendanceRecords.payrollId, id),
                  inArray(
                    attendanceRecords.workerId,
                    members.map((m) => m.id),
                  ),
                ),
              )
              .orderBy(asc(attendanceRecords.date), asc(attendanceRecords.workerId))
      return c.json({ ...payroll, workers: members, records: records.map((record) => redactMoney(user, record)) })
    })
    .patch(
      '/:id',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', payrollUpdate),
      async (c) => {
        const { id } = c.req.valid('param')
        const changes = c.req.valid('json')
        const row = await db.transaction(async (tx) => {
          const before = await findOpenPayroll(tx, id)
          // When only one of the dates is sent, it is compared with the stored one.
          const startDate = changes.startDate ?? before.startDate
          const endDate = changes.endDate ?? before.endDate
          if (endDate < startDate) {
            throw new ApiError(400, 'validation', END_BEFORE_START, 'endDate')
          }
          if (changes.startDate !== undefined || changes.endDate !== undefined) {
            const [outside] = await tx
              .select({ id: attendanceRecords.id })
              .from(attendanceRecords)
              .where(
                and(
                  eq(attendanceRecords.payrollId, id),
                  or(lt(attendanceRecords.date, startDate), gt(attendanceRecords.date, endDate)),
                ),
              )
              .limit(1)
            if (outside) {
              throw new ApiError(409, 'records_outside_range', 'Hay registros de asistencia fuera de las fechas nuevas')
            }
          }
          // Values equal to the stored ones: nothing to write and nothing to audit.
          if (Object.entries(changes).every(([key, value]) => before[key as keyof typeof before] === value)) return before
          const [after] = await tx.update(payrolls).set(changes).where(eq(payrolls.id, id)).returning()
          await recordAudit(tx, c.get('user').id, 'update', 'payrolls', id, before, after)
          return after
        })
        return c.json(row)
      },
    )
    .post(
      '/:id/workers',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', workerSource),
      async (c) => {
        const { id } = c.req.valid('param')
        const source = c.req.valid('json')
        const result = await db.transaction(async (tx) => {
          await findOpenPayroll(tx, id)
          const workerIds = await resolveWorkerIds(tx, source)
          const added = await addWorkers(tx, id, workerIds)
          if (added.length > 0) await recordAudit(tx, c.get('user').id, 'update', 'payrolls', id, null, { added })
          return { added: added.length, workerCount: await countWorkers(tx, id) }
        })
        return c.json(result)
      },
    )
    .delete(
      '/:id/workers/:workerId',
      requireRole('admin', 'accounting'),
      validate('param', memberIds),
      async (c) => {
        const { id, workerId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          await findOpenPayroll(tx, id)
          const [record] = await tx
            .select({ id: attendanceRecords.id })
            .from(attendanceRecords)
            .where(and(eq(attendanceRecords.payrollId, id), eq(attendanceRecords.workerId, workerId)))
            .limit(1)
          if (record) {
            throw new ApiError(
              409,
              'has_records',
              'El trabajador tiene registros en esta planilla; elimínalos primero',
            )
          }
          const removed = await tx
            .delete(payrollWorkers)
            .where(and(eq(payrollWorkers.payrollId, id), eq(payrollWorkers.workerId, workerId)))
            .returning()
          // If there was nothing to remove, nothing is audited: the transaction is rolled back.
          if (removed.length === 0) throw new ApiError(404, 'not_found', 'El trabajador no está en la planilla')
          await recordAudit(tx, c.get('user').id, 'update', 'payrolls', id, { removed: workerId }, null)
        })
        return c.json({ ok: true })
      },
    )
