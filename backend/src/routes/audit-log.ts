import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { auditLog, users } from '../db/schema'
import { offsetOf, pageSchema, paginated } from '../lib/pagination'
import { validate } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const auditFilters = pageSchema.extend({ entity: z.string().trim().min(1).optional() })

export const auditLogRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>().get('/', requireRole('admin'), validate('query', auditFilters), async (c) => {
    const filters = c.req.valid('query')
    const condition = filters.entity ? eq(auditLog.entity, filters.entity) : undefined
    const [{ total }] = await db.select({ total: count() }).from(auditLog).where(condition)
    const rows = await db
      .select({ ...getTableColumns(auditLog), userName: users.name })
      .from(auditLog)
      .innerJoin(users, eq(users.id, auditLog.userId))
      .where(condition)
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(filters.pageSize)
      .offset(offsetOf(filters))
    return c.json(paginated(rows, total, filters))
  })
