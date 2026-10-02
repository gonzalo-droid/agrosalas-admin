import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { attendanceRecords, payrolls, payrollWorkers, workers } from '../db/schema'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import {
  applyClock,
  dateOutsidePayroll,
  deleteRecord,
  redactMoney,
  saveFullRecord,
} from '../payroll/attendance-service'
import type { AppEnv, Dependencies } from '../types'
import { workerScope } from './workers'

const isoDate = z.iso.date()
const mark = z.enum(['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'])
const dayFilters = z.object({ payrollId: z.uuid(), date: isoDate, areaId: z.uuid().optional() })
const clockInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  date: isoDate,
  mark,
  at: z.iso.datetime({ offset: true }).optional(),
})
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM').nullable()
const rate = z.number().min(0).max(99999)
const recordFields = z.object({
  type: z.enum(['worked', 'absence', 'leave', 'medical_leave']),
  clockIn1: time,
  clockOut1: time,
  clockIn2: time,
  clockOut2: time,
  overtimeMinutes: z.number().int().min(0).nullable(),
  hourlyRate: rate,
  overtimeRate: rate,
  note: z.string().trim().max(300).nullable(),
  needsReview: z.boolean(),
})
const recordInput = recordFields.partial().extend({ payrollId: z.uuid(), workerId: z.uuid(), date: isoDate })
const recordUpdate = withAtLeastOneField(recordFields.partial())
const bulkClockInput = z.object({
  payrollId: z.uuid(),
  date: isoDate,
  mark,
  at: z.iso.datetime({ offset: true }).optional(),
  workerIds: z.array(z.uuid()).min(1).max(300),
})

export const attendanceRoutes = ({ db, now }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', validate('query', dayFilters), async (c) => {
      const user = c.get('user')
      const { payrollId, date, areaId } = c.req.valid('query')
      // Reading works on a closed payroll too, so this does not use findOpenPayroll.
      const [payroll] = await db.select().from(payrolls).where(eq(payrolls.id, payrollId))
      if (!payroll) throw notFound('La planilla')
      if (date < payroll.startDate || date > payroll.endDate) throw dateOutsidePayroll()

      const members = await db
        .select({
          id: workers.id,
          firstName: workers.firstName,
          lastName: workers.lastName,
          dni: workers.dni,
          areaId: workers.areaId,
        })
        .from(payrollWorkers)
        .innerJoin(workers, eq(workers.id, payrollWorkers.workerId))
        .where(and(eq(payrollWorkers.payrollId, payrollId), workerScope(user), areaId ? eq(workers.areaId, areaId) : undefined))
        .orderBy(asc(workers.lastName), asc(workers.firstName), asc(workers.id))
      // One query for the records of the whole day.
      const records =
        members.length === 0
          ? []
          : await db
              .select()
              .from(attendanceRecords)
              .where(
                and(
                  eq(attendanceRecords.payrollId, payrollId),
                  eq(attendanceRecords.date, date),
                  inArray(
                    attendanceRecords.workerId,
                    members.map((m) => m.id),
                  ),
                ),
              )
      const byWorker = new Map(records.map((record) => [record.workerId, record]))
      const items = members.map((worker) => {
        const record = byWorker.get(worker.id)
        return { worker, record: record ? redactMoney(user, record) : null }
      })
      return c.json({ items })
    })
    .post('/clock', requireRole('admin', 'accounting', 'coordinator'), validate('json', clockInput), async (c) => {
      const user = c.get('user')
      const { at, ...input } = c.req.valid('json')
      const { record, created } = await db.transaction((tx) =>
        applyClock(tx, user, { ...input, at: at ? new Date(at) : now() }),
      )
      return c.json(redactMoney(user, record), created ? 201 : 200)
    })
    .post('/', requireRole('admin', 'accounting', 'coordinator'), validate('json', recordInput), async (c) => {
      const user = c.get('user')
      const { payrollId, workerId, date, ...fields } = c.req.valid('json')
      const { record } = await db.transaction((tx) => saveFullRecord(tx, user, { payrollId, workerId, date, fields }))
      return c.json(redactMoney(user, record), 201)
    })
    // Declared before /:id so that "bulk" is never read as an id.
    .post('/bulk', requireRole('admin', 'accounting', 'coordinator'), validate('json', bulkClockInput), async (c) => {
      const user = c.get('user')
      const { workerIds, at, ...input } = c.req.valid('json')
      const instant = at ? new Date(at) : now()
      // One transaction per worker, one after the other: a failure only rolls back that worker.
      const results = []
      for (const workerId of workerIds) {
        try {
          const { record } = await db.transaction((tx) => applyClock(tx, user, { ...input, workerId, at: instant }))
          results.push({ workerId, ok: true as const, record: redactMoney(user, record) })
        } catch (error) {
          if (!(error instanceof ApiError)) throw error
          results.push({ workerId, ok: false as const, code: error.code, message: error.message })
        }
      }
      return c.json({ results })
    })
    .patch(
      '/:id',
      requireRole('admin', 'accounting', 'coordinator'),
      validate('param', idSchema),
      validate('json', recordUpdate),
      async (c) => {
        const user = c.get('user')
        const { id } = c.req.valid('param')
        const fields = c.req.valid('json')
        const { record } = await db.transaction((tx) => saveFullRecord(tx, user, { recordId: id, fields }))
        return c.json(redactMoney(user, record))
      },
    )
    .delete('/:id', requireRole('admin', 'accounting', 'coordinator'), validate('param', idSchema), async (c) => {
      const user = c.get('user')
      const { id } = c.req.valid('param')
      await db.transaction((tx) => deleteRecord(tx, user, id))
      return c.json({ ok: true })
    })
