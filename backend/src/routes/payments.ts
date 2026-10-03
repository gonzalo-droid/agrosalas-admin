import { and, count, desc, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { payments, payrolls, workerPaymentMethods, workers } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { offsetOf, pageSchema, paginated } from '../lib/pagination'
import { idSchema, validate } from '../lib/validate'
import { isEvidencePathOf } from '../payroll/evidence'
import { findOpenPayroll, findPayrollMember } from '../payroll/open-payroll'
import { describeMethod, MEDIUM_OF } from '../payroll/payment-method'
import { addDays, limaDate } from '../payroll/time'
import type { AppEnv, Dependencies } from '../types'

const paymentFilters = pageSchema
  .extend({ payrollId: z.uuid().optional(), workerId: z.uuid().optional() })
  .refine((f) => f.payrollId !== undefined || f.workerId !== undefined, { message: 'Indica la planilla o el trabajador' })
const paymentInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  date: z.iso.date(),
  amountCents: z.number().int().min(1).max(99_999_999),
  method: z.enum(['yape', 'plin', 'transfer', 'cash']),
  // Only a way to ask for the copy of a registered method: it is not stored.
  paymentMethodId: z.uuid().optional(),
  methodDetail: z.string().trim().max(160).nullable().optional(),
  evidencePath: z.string().max(200).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
})

// A payment can precede its payroll by a few days (an advance), but not by much: that is a typing mistake.
const MAX_DAYS_BEFORE_PAYROLL = 31

const invalid = (message: string, field: string) => new ApiError(400, 'validation', message, field)

export const paymentsRoutes = ({ db, now }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', requireRole('admin', 'accounting', 'management'), validate('query', paymentFilters), async (c) => {
      const { payrollId, workerId, ...page } = c.req.valid('query')
      const where = and(payrollId ? eq(payments.payrollId, payrollId) : undefined, workerId ? eq(payments.workerId, workerId) : undefined)
      const [{ total }] = await db.select({ total: count() }).from(payments).where(where)
      const items = await db
        .select({
          ...getTableColumns(payments),
          workerFirstName: workers.firstName,
          workerLastName: workers.lastName,
          payrollName: payrolls.name,
        })
        .from(payments)
        .innerJoin(workers, eq(workers.id, payments.workerId))
        .innerJoin(payrolls, eq(payrolls.id, payments.payrollId))
        .where(where)
        .orderBy(desc(payments.date), desc(payments.createdAt), payments.id)
        .limit(page.pageSize)
        .offset(offsetOf(page))
      return c.json(paginated(items, total, page))
    })
    .post('/', requireRole('admin', 'accounting'), validate('json', paymentInput), async (c) => {
      const { paymentMethodId, ...input } = c.req.valid('json')
      const userId = c.get('user').id
      const row = await db.transaction(async (tx) => {
        const payroll = await findOpenPayroll(tx, input.payrollId, 'share')
        await findPayrollMember(tx, input.payrollId, input.workerId)
        if (input.date > limaDate(now())) throw invalid('La fecha del pago no puede ser futura', 'date')
        if (input.date < addDays(payroll.startDate, -MAX_DAYS_BEFORE_PAYROLL)) {
          throw invalid('La fecha del pago es muy anterior a la planilla', 'date')
        }

        let methodDetail = input.methodDetail || null
        if (paymentMethodId) {
          const [method] = await tx.select().from(workerPaymentMethods).where(eq(workerPaymentMethods.id, paymentMethodId))
          if (!method || method.workerId !== input.workerId) {
            throw new ApiError(400, 'invalid_reference', 'El método de pago no es de ese trabajador', 'paymentMethodId')
          }
          if (MEDIUM_OF[method.type] !== input.method) {
            throw invalid('El medio no coincide con el método de pago elegido', 'method')
          }
          // The copy keeps the history of the payment when the method is edited later.
          methodDetail = describeMethod(method)
        }

        const evidencePath = input.evidencePath ?? null
        if (evidencePath !== null) {
          // z.uuid() accepts uppercase, but the folders of the bucket are lowercase.
          if (!isEvidencePathOf(evidencePath, input.payrollId.toLowerCase(), input.workerId.toLowerCase())) {
            throw invalid('La evidencia no corresponde a este pago', 'evidencePath')
          }
          // The unique index is the last defense; this check gives the person a clear message.
          const [used] = await tx.select({ id: payments.id }).from(payments).where(eq(payments.evidencePath, evidencePath))
          if (used) throw new ApiError(409, 'duplicate', 'Esa evidencia ya está en otro pago', 'evidencePath')
        }

        const [created] = await tx
          .insert(payments)
          .values({ ...input, methodDetail, evidencePath, note: input.note || null, recordedBy: userId })
          .returning()
        await recordAudit(tx, userId, 'create', 'payments', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .delete('/:id', requireRole('admin', 'accounting'), validate('param', idSchema), async (c) => {
      const { id } = c.req.valid('param')
      await db.transaction(async (tx) => {
        const [payment] = await tx.select().from(payments).where(eq(payments.id, id)).for('update')
        if (!payment) throw notFound('El pago')
        await findOpenPayroll(tx, payment.payrollId, 'share')
        await tx.delete(payments).where(eq(payments.id, id))
        // The evidence file stays in the bucket: it is the proof of a payment that was made.
        await recordAudit(tx, c.get('user').id, 'delete', 'payments', id, payment, null)
      })
      return c.json({ ok: true })
    })
