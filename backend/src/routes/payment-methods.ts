import { and, asc, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { workerPaymentMethods } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'
import { findWorker } from './workers'

const text = (max: number) => z.string().trim().max(max).nullable().optional()

const paymentMethodInput = z.object({
  type: z.enum(['yape', 'plin', 'bank_account']),
  number: z.string().trim().min(6).max(30),
  bank: text(40),
  cci: text(30),
  holderName: z.string().trim().min(2).max(80),
  isPrimary: z.boolean().optional(),
})
const updatePaymentMethod = withAtLeastOneField(paymentMethodInput.partial())
const paymentMethodIds = z.object({ id: z.uuid(), methodId: z.uuid() })

// Mounted at /v1/workers, next to workersRoutes.
export const paymentMethodsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .post(
      '/:id/payment-methods',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', paymentMethodInput),
      async (c) => {
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        const row = await db.transaction(async (tx) => {
          await findWorker(tx, c.get('user'), id)
          const [{ total }] = await tx
            .select({ total: count() })
            .from(workerPaymentMethods)
            .where(eq(workerPaymentMethods.workerId, id))
          // The first method becomes the primary one even if not requested.
          const isPrimary = total === 0 || input.isPrimary === true
          if (isPrimary) {
            await tx
              .update(workerPaymentMethods)
              .set({ isPrimary: false })
              .where(eq(workerPaymentMethods.workerId, id))
          }
          const [created] = await tx
            .insert(workerPaymentMethods)
            .values({ ...input, workerId: id, isPrimary })
            .returning()
          await recordAudit(tx, c.get('user').id, 'create', 'worker_payment_methods', created.id, null, created)
          return created
        })
        return c.json(row, 201)
      },
    )
    .patch(
      '/:id/payment-methods/:methodId',
      requireRole('admin', 'accounting'),
      validate('param', paymentMethodIds),
      validate('json', updatePaymentMethod),
      async (c) => {
        const { id, methodId } = c.req.valid('param')
        const input = c.req.valid('json')
        if (input.isPrimary === false) {
          throw new ApiError(400, 'validation', 'Marca otro método como principal en lugar de quitar este', 'isPrimary')
        }
        const row = await db.transaction(async (tx) => {
          const [before] = await tx
            .select()
            .from(workerPaymentMethods)
            .where(and(eq(workerPaymentMethods.id, methodId), eq(workerPaymentMethods.workerId, id)))
          if (!before) throw notFound('El método de pago')
          if (input.isPrimary) {
            await tx
              .update(workerPaymentMethods)
              .set({ isPrimary: false })
              .where(and(eq(workerPaymentMethods.workerId, id), ne(workerPaymentMethods.id, methodId)))
          }
          const [after] = await tx
            .update(workerPaymentMethods)
            .set(input)
            .where(eq(workerPaymentMethods.id, methodId))
            .returning()
          await recordAudit(tx, c.get('user').id, 'update', 'worker_payment_methods', methodId, before, after)
          return after
        })
        return c.json(row)
      },
    )
    .delete(
      '/:id/payment-methods/:methodId',
      requireRole('admin', 'accounting'),
      validate('param', paymentMethodIds),
      async (c) => {
        const { id, methodId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const [removed] = await tx
            .delete(workerPaymentMethods)
            .where(and(eq(workerPaymentMethods.id, methodId), eq(workerPaymentMethods.workerId, id)))
            .returning()
          if (!removed) throw notFound('El método de pago')
          if (removed.isPrimary) {
            // If the primary one is removed, the oldest of the remaining ones becomes the primary.
            const [next] = await tx
              .select()
              .from(workerPaymentMethods)
              .where(eq(workerPaymentMethods.workerId, id))
              .orderBy(asc(workerPaymentMethods.createdAt))
              .limit(1)
            if (next) {
              await tx
                .update(workerPaymentMethods)
                .set({ isPrimary: true })
                .where(eq(workerPaymentMethods.id, next.id))
            }
          }
          await recordAudit(tx, c.get('user').id, 'delete', 'worker_payment_methods', methodId, removed, null)
        })
        return c.json({ ok: true })
      },
    )
