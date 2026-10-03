import { and, asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware.js'
import { payrollItems, payrolls } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, notFound } from '../lib/errors.js'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate.js'
import { findOpenPayroll, findPayrollMember } from '../payroll/open-payroll.js'
import type { AppEnv, Dependencies } from '../types.js'

const amountCents = z.number().int().min(1).max(99_999_999)
// A note that is blank after trimming is stored as null, like the note of a payment.
const note = z
  .string()
  .trim()
  .max(300)
  .transform((value) => value || null)
  .nullable()
const itemFilters = z.object({ payrollId: z.uuid(), workerId: z.uuid().optional() })
const itemInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  type: z.enum(['salary', 'bonus', 'piecework', 'deduction']),
  amountCents,
  note: note.optional(),
})
const itemUpdate = withAtLeastOneField(z.object({ amountCents, note }).partial())

const duplicateSalary = () =>
  new ApiError(409, 'duplicate', 'El trabajador ya tiene un sueldo en esta planilla', 'type')

export const payrollItemsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', requireRole('admin', 'accounting', 'management'), validate('query', itemFilters), async (c) => {
      const { payrollId, workerId } = c.req.valid('query')
      // Reading works on a closed payroll too, so this does not use findOpenPayroll.
      const [payroll] = await db.select({ id: payrolls.id }).from(payrolls).where(eq(payrolls.id, payrollId))
      if (!payroll) throw notFound('La planilla')
      const items = await db
        .select()
        .from(payrollItems)
        .where(and(eq(payrollItems.payrollId, payrollId), workerId ? eq(payrollItems.workerId, workerId) : undefined))
        .orderBy(asc(payrollItems.createdAt), asc(payrollItems.id))
      return c.json({ items })
    })
    .post('/', requireRole('admin', 'accounting'), validate('json', itemInput), async (c) => {
      const input = c.req.valid('json')
      const userId = c.get('user').id
      const row = await db.transaction(async (tx) => {
        await findOpenPayroll(tx, input.payrollId, 'share')
        await findPayrollMember(tx, input.payrollId, input.workerId)
        if (input.type === 'salary') {
          const [existing] = await tx
            .select({ id: payrollItems.id })
            .from(payrollItems)
            .where(
              and(
                eq(payrollItems.payrollId, input.payrollId),
                eq(payrollItems.workerId, input.workerId),
                eq(payrollItems.type, 'salary'),
              ),
            )
          if (existing) throw duplicateSalary()
        }
        const [created] = await tx
          .insert(payrollItems)
          .values({ ...input, recordedBy: userId })
          .returning()
        await recordAudit(tx, userId, 'create', 'payroll_items', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch(
      '/:id',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', itemUpdate),
      async (c) => {
        const { id } = c.req.valid('param')
        const changes = c.req.valid('json')
        const row = await db.transaction(async (tx) => {
          const [before] = await tx.select().from(payrollItems).where(eq(payrollItems.id, id)).for('update')
          if (!before) throw notFound('El concepto')
          await findOpenPayroll(tx, before.payrollId, 'share')
          // Values equal to the stored ones: nothing to write and nothing to audit.
          if (Object.entries(changes).every(([key, value]) => before[key as keyof typeof before] === value)) return before
          const [after] = await tx.update(payrollItems).set(changes).where(eq(payrollItems.id, id)).returning()
          await recordAudit(tx, c.get('user').id, 'update', 'payroll_items', id, before, after)
          return after
        })
        return c.json(row)
      },
    )
    .delete('/:id', requireRole('admin', 'accounting'), validate('param', idSchema), async (c) => {
      const { id } = c.req.valid('param')
      await db.transaction(async (tx) => {
        const [item] = await tx.select().from(payrollItems).where(eq(payrollItems.id, id)).for('update')
        if (!item) throw notFound('El concepto')
        await findOpenPayroll(tx, item.payrollId, 'share')
        await tx.delete(payrollItems).where(eq(payrollItems.id, id))
        await recordAudit(tx, c.get('user').id, 'delete', 'payroll_items', id, item, null)
      })
      return c.json({ ok: true })
    })
