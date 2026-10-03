import { count, desc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { requireRole } from '../auth/middleware.js'
import { payrolls, payrollWorkers } from '../db/schema.js'
import { offsetOf, pageSchema, paginated } from '../lib/pagination.js'
import { idSchema, validate } from '../lib/validate.js'
import { payrollBalances } from '../payroll/balance-service.js'
import type { AppEnv, Dependencies } from '../types.js'
import { findWorker } from './workers.js'

// Mounted at /v1/workers, next to workersRoutes.
export const workerHistoryRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>().get(
    '/:id/payrolls',
    requireRole('admin', 'accounting', 'management'),
    validate('param', idSchema),
    validate('query', pageSchema),
    async (c) => {
      const { id } = c.req.valid('param')
      const page = c.req.valid('query')
      await findWorker(db, c.get('user'), id)
      const [{ total }] = await db.select({ total: count() }).from(payrollWorkers).where(eq(payrollWorkers.workerId, id))
      const rows = await db
        .select({
          payrollId: payrolls.id,
          name: payrolls.name,
          type: payrolls.type,
          startDate: payrolls.startDate,
          endDate: payrolls.endDate,
          status: payrolls.status,
        })
        .from(payrollWorkers)
        .innerJoin(payrolls, eq(payrolls.id, payrollWorkers.payrollId))
        .where(eq(payrollWorkers.workerId, id))
        .orderBy(desc(payrolls.startDate), payrolls.id)
        .limit(page.pageSize)
        .offset(offsetOf(page))
      // One balance per payroll of the page: the page is small and each call reads only this worker.
      const items = await Promise.all(
        rows.map(async (row) => {
          const [balance] = await payrollBalances(db, row.payrollId, [id])
          return { ...row, totalCents: balance.totalCents, paidCents: balance.paidCents, pendingCents: balance.pendingCents }
        }),
      )
      return c.json(paginated(items, total, page))
    },
  )
