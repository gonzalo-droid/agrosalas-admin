import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { usuarioAreas, usuarios } from '../db/schema'
import { ApiError } from '../lib/errors'
import type { AppEnv, Dependencies, Role } from '../types'

export const authenticate = ({ db, verifyToken }: Dependencies) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const header = c.req.header('Authorization') ?? ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    const identity = token ? await verifyToken(token) : null
    if (!identity) throw new ApiError(401, 'no_autenticado', 'Inicia sesión para continuar')

    const [user] = await db.select().from(usuarios).where(eq(usuarios.id, identity.sub))
    if (!user || !user.activo) throw new ApiError(403, 'sin_acceso', 'Tu usuario no tiene acceso al panel')

    const rows = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, user.id))
    c.set('user', {
      id: user.id,
      correo: user.correo,
      nombre: user.nombre,
      rol: user.rol,
      areaIds: rows.map((row) => row.areaId),
    })
    await next()
  })

export const requireRole = (...roles: Role[]) =>
  createMiddleware<AppEnv>(async (c, next) => {
    if (!roles.includes(c.get('user').rol)) {
      throw new ApiError(403, 'sin_permiso', 'Tu rol no permite esta acción')
    }
    await next()
  })
