import { asc, eq, inArray } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { areas, usuarioAreas, usuarios } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Db, Dependencies, Tx } from '../types'

const role = z.enum(['admin', 'gerencia', 'contabilidad', 'coordinador'])
const crearUsuario = z.object({
  correo: z.email(),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  nombre: z.string().trim().min(2).max(80),
  rol: role,
  areaIds: z.array(z.uuid()).default([]),
})
const editarUsuario = withAtLeastOneField(
  z
    .object({ nombre: z.string().trim().min(2).max(80), rol: role, activo: z.boolean(), areaIds: z.array(z.uuid()) })
    .partial(),
)

async function areasOf(db: Db | Tx, userId: string) {
  const rows = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, userId))
  return rows.map((row) => row.areaId)
}

async function setAreas(tx: Tx, userId: string, areaIds: string[]) {
  await tx.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, userId))
  if (areaIds.length > 0) {
    await tx.insert(usuarioAreas).values(areaIds.map((areaId) => ({ usuarioId: userId, areaId })))
  }
}

export const usersRoutes = ({ db, authAdmin }: Dependencies) =>
  new Hono<AppEnv>()
    .use('*', requireRole('admin'))
    .get('/', async (c) => {
      const rows = await db.select().from(usuarios).orderBy(asc(usuarios.nombre))
      const assigned = await db.select().from(usuarioAreas)
      const data = rows.map((user) => ({
        ...user,
        areaIds: assigned.filter((a) => a.usuarioId === user.id).map((a) => a.areaId),
      }))
      return c.json({ datos: data })
    })
    .post('/', validate('json', crearUsuario), async (c) => {
      const { correo: email, clave: password, nombre: name, rol: userRole, areaIds } = c.req.valid('json')
      const [existing] = await db.select().from(usuarios).where(eq(usuarios.correo, email))
      if (existing) throw new ApiError(409, 'duplicado', 'Ya existe un usuario con ese correo', 'correo')
      // Validated before creating the login account, so it is not left orphaned if the insert fails.
      if (areaIds.length > 0) {
        const existingAreas = await db.select({ id: areas.id }).from(areas).where(inArray(areas.id, areaIds))
        if (existingAreas.length !== new Set(areaIds).size) {
          throw new ApiError(400, 'referencia_invalida', 'Una de las áreas indicadas no existe', 'areaIds')
        }
      }
      const { id } = await authAdmin.createUser(email, password)
      try {
        const row = await db.transaction(async (tx) => {
          const [created] = await tx.insert(usuarios).values({ id, correo: email, nombre: name, rol: userRole }).returning()
          await setAreas(tx, id, areaIds)
          await recordAudit(tx, c.get('user').id, 'crear', 'usuarios', id, null, { ...created, areaIds })
          return created
        })
        return c.json({ ...row, areaIds }, 201)
      } catch (error) {
        // A login account without a row in usuarios is useless and would block the email, so it is deleted.
        try {
          await authAdmin.deleteUser(id)
        } catch (cleanupError) {
          console.error('Could not delete the orphaned login account', id, cleanupError)
        }
        throw error
      }
    })
    .patch('/:id', validate('param', idSchema), validate('json', editarUsuario), async (c) => {
      const { id } = c.req.valid('param')
      const { areaIds, ...data } = c.req.valid('json')
      const me = c.get('user')
      if (id === me.id && (data.activo === false || (data.rol && data.rol !== 'admin'))) {
        throw new ApiError(400, 'validacion', 'No puedes quitarte tu propio acceso de administrador')
      }
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(usuarios).where(eq(usuarios.id, id))
        if (!before) throw notFound('El usuario')
        const areasBefore = await areasOf(tx, id)
        // A PATCH that only changes the areas also counts as an edit of the user.
        const [after] = await tx.update(usuarios).set({ ...data, actualizadoEn: new Date() }).where(eq(usuarios.id, id)).returning()
        if (areaIds) await setAreas(tx, id, areaIds)
        const areasAfter = areaIds ?? areasBefore
        await recordAudit(
          tx,
          me.id,
          'editar',
          'usuarios',
          id,
          { ...before, areaIds: areasBefore },
          { ...after, areaIds: areasAfter },
        )
        return { ...after, areaIds: areasAfter }
      })
      return c.json(row)
    })
