import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { areas, userAreas, users } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Db, Dependencies, Tx } from '../types'

const role = z.enum(['admin', 'management', 'accounting', 'coordinator'])
const createUser = z.object({
  email: z.email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  name: z.string().trim().min(2).max(80),
  role,
  areaIds: z.array(z.uuid()).default([]),
})
const updateUser = withAtLeastOneField(
  z
    .object({ name: z.string().trim().min(2).max(80), role, active: z.boolean(), areaIds: z.array(z.uuid()) })
    .partial(),
)

async function areasOf(db: Db | Tx, userId: string) {
  const rows = await db.select().from(userAreas).where(eq(userAreas.userId, userId))
  return rows.map((row) => row.areaId)
}

async function setAreas(tx: Tx, userId: string, areaIds: string[]) {
  await tx.delete(userAreas).where(eq(userAreas.userId, userId))
  if (areaIds.length > 0) {
    await tx.insert(userAreas).values(areaIds.map((areaId) => ({ userId, areaId })))
  }
}

export const usersRoutes = ({ db, authAdmin }: Dependencies) =>
  new Hono<AppEnv>()
    .use('*', requireRole('admin'))
    .get('/', async (c) => {
      const rows = await db.select().from(users).orderBy(asc(users.name))
      const assigned = await db.select().from(userAreas)
      const data = rows.map((user) => ({
        ...user,
        areaIds: assigned.filter((a) => a.userId === user.id).map((a) => a.areaId),
      }))
      return c.json({ items: data })
    })
    .post('/', validate('json', createUser), async (c) => {
      const { email, password, name, role: userRole, areaIds } = c.req.valid('json')
      const [existing] = await db.select().from(users).where(eq(users.email, email))
      if (existing) throw new ApiError(409, 'duplicate', 'Ya existe un usuario con ese correo', 'email')
      // Validated before creating the login account, so it is not left orphaned if the insert fails.
      if (areaIds.length > 0) {
        const existingAreas = await db.select({ id: areas.id }).from(areas).where(inArray(areas.id, areaIds))
        if (existingAreas.length !== new Set(areaIds).size) {
          throw new ApiError(400, 'invalid_reference', 'Una de las áreas indicadas no existe', 'areaIds')
        }
      }
      const { id } = await authAdmin.createUser(email, password)
      try {
        const row = await db.transaction(async (tx) => {
          const [created] = await tx.insert(users).values({ id, email, name, role: userRole }).returning()
          await setAreas(tx, id, areaIds)
          await recordAudit(tx, c.get('user').id, 'create', 'users', id, null, { ...created, areaIds })
          return created
        })
        return c.json({ ...row, areaIds }, 201)
      } catch (error) {
        // A login account without a row in users is useless and would block the email, so it is deleted.
        try {
          await authAdmin.deleteUser(id)
        } catch (cleanupError) {
          console.error('Could not delete the orphaned login account', id, cleanupError)
        }
        throw error
      }
    })
    .patch('/:id', validate('param', idSchema), validate('json', updateUser), async (c) => {
      const { id } = c.req.valid('param')
      const { areaIds, ...data } = c.req.valid('json')
      const me = c.get('user')
      if (id === me.id && (data.active === false || (data.role && data.role !== 'admin'))) {
        throw new ApiError(400, 'validation', 'No puedes quitarte tu propio acceso de administrador')
      }
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(users).where(eq(users.id, id))
        if (!before) throw notFound('El usuario')
        const areasBefore = await areasOf(tx, id)
        // A PATCH that only changes the areas also counts as an edit of the user.
        const [after] = await tx.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning()
        if (areaIds) await setAreas(tx, id, areaIds)
        const areasAfter = areaIds ?? areasBefore
        await recordAudit(
          tx,
          me.id,
          'update',
          'users',
          id,
          { ...before, areaIds: areasBefore },
          { ...after, areaIds: areasAfter },
        )
        return { ...after, areaIds: areasAfter }
      })
      return c.json(row)
    })
