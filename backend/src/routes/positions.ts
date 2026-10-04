import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware.js'
import { positions } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import { ApiError, notFound } from '../lib/errors.js'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate.js'
import type { AppEnv, Dependencies } from '../types.js'

const amount = z.number().positive().max(99999).nullable().optional()

const positionInput = z.object({
  name: z.string().trim().min(2).max(60),
  payType: z.enum(['hourly', 'monthly']),
  hourlyRate: amount,
  overtimeRate: amount,
  monthlySalary: amount,
})
const updatePosition = withAtLeastOneField(positionInput.extend({ active: z.boolean() }).partial())

type Rates = Pick<typeof positions.$inferSelect, 'payType' | 'hourlyRate' | 'overtimeRate' | 'monthlySalary'>

// An hourly position needs both rates; a monthly one, its salary.
function requireRates(position: Rates) {
  if (position.payType === 'hourly' && (position.hourlyRate == null || position.overtimeRate == null)) {
    throw new ApiError(400, 'validation', 'Un cargo por hora necesita tarifa normal y tarifa extra', 'hourlyRate')
  }
  if (position.payType === 'monthly' && position.monthlySalary == null) {
    throw new ApiError(400, 'validation', 'Un cargo mensual necesita sueldo', 'monthlySalary')
  }
}

export const positionsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db.select().from(positions).orderBy(asc(positions.name))
      // The coordinator does not see amounts: they are removed on the server, not on screen.
      const data =
        c.get('user').role === 'coordinator'
          ? rows.map((row) => ({ ...row, hourlyRate: null, overtimeRate: null, monthlySalary: null }))
          : rows
      return c.json({ items: data })
    })
    .post('/', requireRole('admin'), validate('json', positionInput), async (c) => {
      const input = c.req.valid('json')
      requireRates({
        payType: input.payType,
        hourlyRate: input.hourlyRate ?? null,
        overtimeRate: input.overtimeRate ?? null,
        monthlySalary: input.monthlySalary ?? null,
      })
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(positions).values(input).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'positions', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', updatePosition), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(positions).where(eq(positions.id, id))
        if (!before) throw notFound('El cargo')
        requireRates({ ...before, ...c.req.valid('json') })
        const [after] = await tx.update(positions).set(c.req.valid('json')).where(eq(positions.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'update', 'positions', id, before, after)
        return after
      })
      return c.json(row)
    })
