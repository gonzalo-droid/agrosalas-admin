import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { cargos } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const amount = z.number().positive().max(99999).nullable().optional()

const datosCargo = z.object({
  nombre: z.string().trim().min(2).max(60),
  tipoPago: z.enum(['por_hora', 'mensual']),
  tarifaHora: amount,
  tarifaHoraExtra: amount,
  sueldoMensual: amount,
})
const editarCargo = withAtLeastOneField(datosCargo.extend({ activo: z.boolean() }).partial())

type Rates = Pick<typeof cargos.$inferSelect, 'tipoPago' | 'tarifaHora' | 'tarifaHoraExtra' | 'sueldoMensual'>

// An hourly position needs both rates; a monthly one, its salary.
function requireRates(position: Rates) {
  if (position.tipoPago === 'por_hora' && (position.tarifaHora == null || position.tarifaHoraExtra == null)) {
    throw new ApiError(400, 'validacion', 'Un cargo por hora necesita tarifa normal y tarifa extra', 'tarifaHora')
  }
  if (position.tipoPago === 'mensual' && position.sueldoMensual == null) {
    throw new ApiError(400, 'validacion', 'Un cargo mensual necesita sueldo', 'sueldoMensual')
  }
}

export const positionsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db.select().from(cargos).orderBy(asc(cargos.nombre))
      // The coordinator does not see amounts: they are removed on the server, not on screen.
      const data =
        c.get('user').rol === 'coordinador'
          ? rows.map((row) => ({ ...row, tarifaHora: null, tarifaHoraExtra: null, sueldoMensual: null }))
          : rows
      return c.json({ datos: data })
    })
    .post('/', requireRole('admin'), validate('json', datosCargo), async (c) => {
      const input = c.req.valid('json')
      requireRates({
        tipoPago: input.tipoPago,
        tarifaHora: input.tarifaHora ?? null,
        tarifaHoraExtra: input.tarifaHoraExtra ?? null,
        sueldoMensual: input.sueldoMensual ?? null,
      })
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(cargos).values(input).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'cargos', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', editarCargo), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(cargos).where(eq(cargos.id, id))
        if (!before) throw notFound('El cargo')
        requireRates({ ...before, ...c.req.valid('json') })
        const [after] = await tx.update(cargos).set(c.req.valid('json')).where(eq(cargos.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'editar', 'cargos', id, before, after)
        return after
      })
      return c.json(row)
    })
