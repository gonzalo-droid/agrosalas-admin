import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { usuarioAreas, usuarios } from '../db/schema'
import { ErrorApi } from '../lib/errores'
import type { Dependencias, Entorno, Rol } from '../tipos'

export const autenticar = ({ db, verificarToken }: Dependencias) =>
  createMiddleware<Entorno>(async (c, next) => {
    const cabecera = c.req.header('Authorization') ?? ''
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
    const identidad = token ? await verificarToken(token) : null
    if (!identidad) throw new ErrorApi(401, 'no_autenticado', 'Inicia sesión para continuar')

    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, identidad.sub))
    if (!usuario || !usuario.activo) throw new ErrorApi(403, 'sin_acceso', 'Tu usuario no tiene acceso al panel')

    const filas = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuario.id))
    c.set('usuario', {
      id: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.rol,
      areaIds: filas.map((f) => f.areaId),
    })
    await next()
  })

export const requiereRol = (...roles: Rol[]) =>
  createMiddleware<Entorno>(async (c, next) => {
    if (!roles.includes(c.get('usuario').rol)) {
      throw new ErrorApi(403, 'sin_permiso', 'Tu rol no permite esta acción')
    }
    await next()
  })
