import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { usuarios } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const editarPerfil = z.object({ nombre: z.string().trim().min(2).max(80) })

export const rutasMe = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', (c) => c.json(c.get('usuario')))
    .patch('/', validar('json', editarPerfil), async (c) => {
      const usuario = c.get('usuario')
      const { nombre } = c.req.valid('json')
      await db.transaction(async (tx) => {
        await tx.update(usuarios).set({ nombre }).where(eq(usuarios.id, usuario.id))
        await registrarAuditoria(tx, usuario.id, 'editar', 'usuarios', usuario.id, { nombre: usuario.nombre }, { nombre })
      })
      return c.json({ ...usuario, nombre })
    })
