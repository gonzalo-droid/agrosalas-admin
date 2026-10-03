import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { users } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import { validate } from '../lib/validate.js'
import type { AppEnv, Dependencies } from '../types.js'

const updateProfile = z.object({ name: z.string().trim().min(2).max(80) })

export const meRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', (c) => c.json(c.get('user')))
    .patch('/', validate('json', updateProfile), async (c) => {
      const user = c.get('user')
      const { name } = c.req.valid('json')
      await db.transaction(async (tx) => {
        await tx.update(users).set({ name }).where(eq(users.id, user.id))
        await recordAudit(tx, user.id, 'update', 'users', user.id, { name: user.name }, { name })
      })
      return c.json({ ...user, name })
    })
