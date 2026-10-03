import { and, asc, count, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware.js'
import { groupWorkers, groups, workers } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import { notFound } from '../lib/errors.js'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate.js'
import type { AppEnv, Dependencies } from '../types.js'
import { workerScope } from './workers.js'

const name = z.string().trim().min(2).max(60)
const date = z.iso.date().nullable().optional()
const createGroup = z.object({
  name,
  temporary: z.boolean().default(false),
  startDate: date,
  endDate: date,
})
// No default values: when editing, a field that is not sent is left untouched.
const updateGroup = withAtLeastOneField(
  z.object({ name, temporary: z.boolean(), startDate: date, endDate: date, active: z.boolean() }).partial(),
)
const addMembers = z.object({ workerIds: z.array(z.uuid()).min(1).max(200) })
const memberIds = z.object({ id: z.uuid(), workerId: z.uuid() })

export const groupsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db
        .select({ ...getTableColumns(groups), members: count(groupWorkers.workerId) })
        .from(groups)
        .leftJoin(groupWorkers, eq(groupWorkers.groupId, groups.id))
        .groupBy(groups.id)
        .orderBy(asc(groups.name))
      return c.json({ items: rows })
    })
    .get('/:id', validate('param', idSchema), async (c) => {
      const { id } = c.req.valid('param')
      const [group] = await db.select().from(groups).where(eq(groups.id, id))
      if (!group) throw notFound('El grupo')
      const members = await db
        .select({
          id: workers.id,
          firstName: workers.firstName,
          lastName: workers.lastName,
          dni: workers.dni,
        })
        .from(groupWorkers)
        .innerJoin(workers, eq(workers.id, groupWorkers.workerId))
        // The coordinator only sees the members of their areas.
        .where(and(eq(groupWorkers.groupId, id), workerScope(c.get('user'))))
        .orderBy(asc(workers.lastName), asc(workers.firstName))
      return c.json({ ...group, members })
    })
    .post('/', requireRole('admin'), validate('json', createGroup), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(groups).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'create', 'groups', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', updateGroup), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(groups).where(eq(groups.id, id))
        if (!before) throw notFound('El grupo')
        const [after] = await tx.update(groups).set(c.req.valid('json')).where(eq(groups.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'update', 'groups', id, before, after)
        return after
      })
      return c.json(row)
    })
    .post(
      '/:id/members',
      requireRole('admin', 'accounting'),
      validate('param', idSchema),
      validate('json', addMembers),
      async (c) => {
        const { id } = c.req.valid('param')
        const { workerIds } = c.req.valid('json')
        await db.transaction(async (tx) => {
          const [group] = await tx.select().from(groups).where(eq(groups.id, id))
          if (!group) throw notFound('El grupo')
          await tx
            .insert(groupWorkers)
            .values(workerIds.map((workerId) => ({ groupId: id, workerId })))
            .onConflictDoNothing()
          await recordAudit(tx, c.get('user').id, 'update', 'groups', id, null, { added: workerIds })
        })
        return c.json({ ok: true })
      },
    )
    .delete(
      '/:id/members/:workerId',
      requireRole('admin', 'accounting'),
      validate('param', memberIds),
      async (c) => {
        const { id, workerId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const removed = await tx
            .delete(groupWorkers)
            .where(and(eq(groupWorkers.groupId, id), eq(groupWorkers.workerId, workerId)))
            .returning()
          // If there was nothing to remove, nothing is audited: the transaction is rolled back.
          if (removed.length === 0) throw notFound('El miembro del grupo')
          await recordAudit(tx, c.get('user').id, 'update', 'groups', id, { removed: workerId }, null)
        })
        return c.json({ ok: true })
      },
    )
