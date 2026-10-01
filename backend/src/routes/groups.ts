import { and, asc, count, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { grupoTrabajadores, grupos, trabajadores } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'
import { workerScope } from './workers'

const name = z.string().trim().min(2).max(60)
const date = z.iso.date().nullable().optional()
const crearGrupo = z.object({
  nombre: name,
  temporal: z.boolean().default(false),
  fechaInicio: date,
  fechaFin: date,
})
// No default values: when editing, a field that is not sent is left untouched.
const editarGrupo = withAtLeastOneField(
  z.object({ nombre: name, temporal: z.boolean(), fechaInicio: date, fechaFin: date, activo: z.boolean() }).partial(),
)
const agregarMiembros = z.object({ trabajadorIds: z.array(z.uuid()).min(1).max(200) })
const idsMiembro = z.object({ id: z.uuid(), trabajadorId: z.uuid() })

export const groupsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/', async (c) => {
      const rows = await db
        .select({ ...getTableColumns(grupos), miembros: count(grupoTrabajadores.trabajadorId) })
        .from(grupos)
        .leftJoin(grupoTrabajadores, eq(grupoTrabajadores.grupoId, grupos.id))
        .groupBy(grupos.id)
        .orderBy(asc(grupos.nombre))
      return c.json({ datos: rows })
    })
    .get('/:id', validate('param', idSchema), async (c) => {
      const { id } = c.req.valid('param')
      const [group] = await db.select().from(grupos).where(eq(grupos.id, id))
      if (!group) throw notFound('El grupo')
      const members = await db
        .select({
          id: trabajadores.id,
          nombres: trabajadores.nombres,
          apellidos: trabajadores.apellidos,
          dni: trabajadores.dni,
        })
        .from(grupoTrabajadores)
        .innerJoin(trabajadores, eq(trabajadores.id, grupoTrabajadores.trabajadorId))
        // The coordinator only sees the members of their areas.
        .where(and(eq(grupoTrabajadores.grupoId, id), workerScope(c.get('user'))))
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres))
      return c.json({ ...group, miembros: members })
    })
    .post('/', requireRole('admin'), validate('json', crearGrupo), async (c) => {
      const row = await db.transaction(async (tx) => {
        const [created] = await tx.insert(grupos).values(c.req.valid('json')).returning()
        await recordAudit(tx, c.get('user').id, 'crear', 'grupos', created.id, null, created)
        return created
      })
      return c.json(row, 201)
    })
    .patch('/:id', requireRole('admin'), validate('param', idSchema), validate('json', editarGrupo), async (c) => {
      const { id } = c.req.valid('param')
      const row = await db.transaction(async (tx) => {
        const [before] = await tx.select().from(grupos).where(eq(grupos.id, id))
        if (!before) throw notFound('El grupo')
        const [after] = await tx.update(grupos).set(c.req.valid('json')).where(eq(grupos.id, id)).returning()
        await recordAudit(tx, c.get('user').id, 'editar', 'grupos', id, before, after)
        return after
      })
      return c.json(row)
    })
    .post(
      '/:id/miembros',
      requireRole('admin', 'contabilidad'),
      validate('param', idSchema),
      validate('json', agregarMiembros),
      async (c) => {
        const { id } = c.req.valid('param')
        const { trabajadorIds: workerIds } = c.req.valid('json')
        await db.transaction(async (tx) => {
          const [group] = await tx.select().from(grupos).where(eq(grupos.id, id))
          if (!group) throw notFound('El grupo')
          await tx
            .insert(grupoTrabajadores)
            .values(workerIds.map((trabajadorId) => ({ grupoId: id, trabajadorId })))
            .onConflictDoNothing()
          await recordAudit(tx, c.get('user').id, 'editar', 'grupos', id, null, { agregados: workerIds })
        })
        return c.json({ ok: true })
      },
    )
    .delete(
      '/:id/miembros/:trabajadorId',
      requireRole('admin', 'contabilidad'),
      validate('param', idsMiembro),
      async (c) => {
        const { id, trabajadorId: workerId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const removed = await tx
            .delete(grupoTrabajadores)
            .where(and(eq(grupoTrabajadores.grupoId, id), eq(grupoTrabajadores.trabajadorId, workerId)))
            .returning()
          // If there was nothing to remove, nothing is audited: the transaction is rolled back.
          if (removed.length === 0) throw notFound('El miembro del grupo')
          await recordAudit(tx, c.get('user').id, 'editar', 'grupos', id, { quitado: workerId }, null)
        })
        return c.json({ ok: true })
      },
    )
