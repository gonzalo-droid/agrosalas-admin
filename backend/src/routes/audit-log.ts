import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { auditoria, usuarios } from '../db/schema'
import { offsetOf, pageSchema, paginated } from '../lib/pagination'
import { validate } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const filtros = pageSchema.extend({ entidad: z.string().trim().min(1).optional() })

export const auditLogRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>().get('/', requireRole('admin'), validate('query', filtros), async (c) => {
    const filters = c.req.valid('query')
    const condition = filters.entidad ? eq(auditoria.entidad, filters.entidad) : undefined
    const [{ total }] = await db.select({ total: count() }).from(auditoria).where(condition)
    const rows = await db
      .select({ ...getTableColumns(auditoria), usuarioNombre: usuarios.nombre })
      .from(auditoria)
      .innerJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(condition)
      .orderBy(desc(auditoria.creadoEn), desc(auditoria.id))
      .limit(filters.tamano)
      .offset(offsetOf(filters))
    return c.json(paginated(rows, total, filters))
  })
