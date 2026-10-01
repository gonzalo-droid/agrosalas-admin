import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { auditoria, usuarios } from '../db/schema'
import { desplazamiento, esquemaPagina, paginado } from '../lib/paginacion'
import { validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const filtros = esquemaPagina.extend({ entidad: z.string().trim().min(1).optional() })

export const rutasAuditoria = ({ db }: Dependencias) =>
  new Hono<Entorno>().get('/', requiereRol('admin'), validar('query', filtros), async (c) => {
    const f = c.req.valid('query')
    const condicion = f.entidad ? eq(auditoria.entidad, f.entidad) : undefined
    const [{ total }] = await db.select({ total: count() }).from(auditoria).where(condicion)
    const datos = await db
      .select({ ...getTableColumns(auditoria), usuarioNombre: usuarios.nombre })
      .from(auditoria)
      .innerJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(condicion)
      .orderBy(desc(auditoria.creadoEn))
      .limit(f.tamano)
      .offset(desplazamiento(f))
    return c.json(paginado(datos, total, f))
  })
