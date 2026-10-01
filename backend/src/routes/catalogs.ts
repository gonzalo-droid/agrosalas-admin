import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { areas, campaigns, shifts } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const name = z.string().trim().min(2).max(60)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM')
const date = z.iso.date().nullable().optional()

const createArea = z.object({ name })
const updateArea = withAtLeastOneField(createArea.extend({ active: z.boolean() }).partial())

export const areasRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ items: await db.select().from(areas).orderBy(asc(areas.name)) }))
    .post('/', requireRole('admin'), validate('json', createArea), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(areas).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'areas', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', updateArea), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(areas).where(eq(areas.id, id))
        if (!before) throw notFound('El área')
        const [after] = await tx.update(areas).set(c.req.valid('json')).where(eq(areas.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'update', 'areas', id, before, after)
        return after
      })
      return c.json(row)
    })

const createShift = z.object({ name, startTime: time, endTime: time })
const updateShift = withAtLeastOneField(createShift.extend({ active: z.boolean() }).partial())

export const shiftsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ items: await db.select().from(shifts).orderBy(asc(shifts.name)) }))
    .post('/', requireRole('admin'), validate('json', createShift), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(shifts).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'shifts', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', updateShift), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(shifts).where(eq(shifts.id, id))
        if (!before) throw notFound('El turno')
        const [after] = await tx.update(shifts).set(c.req.valid('json')).where(eq(shifts.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'update', 'shifts', id, before, after)
        return after
      })
      return c.json(row)
    })

const createCampaign = z.object({ name, startDate: date, endDate: date })
const updateCampaign = withAtLeastOneField(createCampaign.extend({ active: z.boolean() }).partial())

export const campaignsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ items: await db.select().from(campaigns).orderBy(asc(campaigns.name)) }))
    .post('/', requireRole('admin'), validate('json', createCampaign), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(campaigns).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'campaigns', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', updateCampaign), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(campaigns).where(eq(campaigns.id, id))
        if (!before) throw notFound('La campaña')
        const [after] = await tx.update(campaigns).set(c.req.valid('json')).where(eq(campaigns.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'update', 'campaigns', id, before, after)
        return after
      })
      return c.json(row)
    })
