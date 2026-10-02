import { and, asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { attendanceRecords, payrolls, payrollWorkers, workers } from '../db/schema'
import { notFound } from '../lib/errors'
import { validate } from '../lib/validate'
import { applyClock, dateOutsidePayroll, redactMoney } from '../payroll/attendance-service'
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
