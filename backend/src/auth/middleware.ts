import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { userAreas, users } from '../db/schema.js'
import { ApiError } from '../lib/errors.js'
import type { AppEnv, Dependencies, Role } from '../types.js'

export const authenticate = ({ db, verifyToken }: Dependencies) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const identity = token ? await verifyToken(token) : null
    if (!identity) throw new ApiError(401, 'unauthenticated', 'Inicia sesión para continuar')

    const [user] = await db.select().from(users).where(eq(users.id, identity.sub))
    if (!user || !user.active) throw new ApiError(403, 'access_denied', 'Tu usuario no tiene acceso al panel')

    const rows = await db.select().from(userAreas).where(eq(userAreas.userId, user.id))
    c.set('user', {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      areaIds: rows.map((row) => row.areaId),
    })
    await next()
  })

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get('user').role)) {
      throw new ApiError(403, 'forbidden', 'Tu rol no permite esta acción')
    }
    await next()
  })
