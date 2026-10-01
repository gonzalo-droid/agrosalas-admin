import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { areas, campanas, turnos } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const name = z.string().trim().min(2).max(60)
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM')
const date = z.iso.date().nullable().optional()

const crearArea = z.object({ nombre: name })
const editarArea = withAtLeastOneField(crearArea.extend({ activo: z.boolean() }).partial())

export const areasRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ datos: await db.select().from(areas).orderBy(asc(areas.nombre)) }))
    .post('/', requireRole('admin'), validate('json', crearArea), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(areas).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'areas', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', editarArea), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(areas).where(eq(areas.id, id))
        if (!before) throw notFound('El área')
        const [after] = await tx.update(areas).set(c.req.valid('json')).where(eq(areas.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'editar', 'areas', id, before, after)
        return after
      })
      return c.json(row)
    })

const crearTurno = z.object({ nombre: name, horaInicio: time, horaFin: time })
const editarTurno = withAtLeastOneField(crearTurno.extend({ activo: z.boolean() }).partial())

export const shiftsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ datos: await db.select().from(turnos).orderBy(asc(turnos.nombre)) }))
    .post('/', requireRole('admin'), validate('json', crearTurno), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(turnos).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'turnos', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', editarTurno), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(turnos).where(eq(turnos.id, id))
        if (!before) throw notFound('El turno')
        const [after] = await tx.update(turnos).set(c.req.valid('json')).where(eq(turnos.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'editar', 'turnos', id, before, after)
        return after
      })
      return c.json(row)
    })

const crearCampana = z.object({ nombre: name, fechaInicio: date, fechaFin: date })
const editarCampana = withAtLeastOneField(crearCampana.extend({ activo: z.boolean() }).partial())

export const campaignsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => c.json({ datos: await db.select().from(campanas).orderBy(asc(campanas.nombre)) }))
    .post('/', requireRole('admin'), validate('json', crearCampana), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(campanas).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'campanas', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', editarCampana), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(campanas).where(eq(campanas.id, id))
        if (!before) throw notFound('La campaña')
        const [after] = await tx.update(campanas).set(c.req.valid('json')).where(eq(campanas.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'editar', 'campanas', id, before, after)
        return after
      })
      return c.json(row)
    })
