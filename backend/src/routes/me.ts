import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { usuarios } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { validate } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'

const editarPerfil = z.object({ nombre: z.string().trim().min(2).max(80) })

export const meRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', (c) => c.json(c.get('user')))
    .patch('/', validate('json', editarPerfil), async (c) => {
      const user = c.get('user')
      const { nombre: name } = c.req.valid('json')
      await db.transaction(async (tx) => {
        await tx.update(usuarios).set({ nombre: name }).where(eq(usuarios.id, user.id))
        await recordAudit(tx, user.id, 'editar', 'usuarios', user.id, { nombre: user.nombre }, { nombre: name })
      })
      return c.json({ ...user, nombre: name })
    })
