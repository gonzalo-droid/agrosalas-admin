import { and, asc, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { trabajadorMetodosPago } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { idSchema, validate, withAtLeastOneField } from '../lib/validate'
import type { AppEnv, Dependencies } from '../types'
import { findWorker } from './workers'

const text = (max: number) => z.string().trim().max(max).nullable().optional()

const datosMetodo = z.object({
  tipo: z.enum(['yape', 'plin', 'cuenta_bancaria']),
  numero: z.string().trim().min(6).max(30),
  banco: text(40),
  cci: text(30),
  titular: z.string().trim().min(2).max(80),
  principal: z.boolean().optional(),
})
const editarMetodo = withAtLeastOneField(datosMetodo.partial())
const idsMetodo = z.object({ id: z.uuid(), metodoId: z.uuid() })

// Mounted at /v1/trabajadores, next to workersRoutes.
export const paymentMethodsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .post(
      '/:id/metodos-pago',
      requireRole('admin', 'contabilidad'),
      validate('param', idSchema),
      validate('json', datosMetodo),
      async (c) => {
        const { id } = c.req.valid('param')
        const input = c.req.valid('json')
        const row = await db.transaction(async (tx) => {
          await findWorker(tx, c.get('user'), id)
          const [{ total }] = await tx
            .select({ total: count() })
            .from(trabajadorMetodosPago)
            .where(eq(trabajadorMetodosPago.trabajadorId, id))
          // The first method becomes the primary one even if not requested.
          const isPrimary = total === 0 || input.principal === true
          if (isPrimary) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
          }
          const [created] = await tx
            .insert(trabajadorMetodosPago)
            .values({ ...input, trabajadorId: id, principal: isPrimary })
            .returning()
          await recordAudit(tx, c.get('user').id, 'crear', 'trabajador_metodos_pago', created.id, null, created)
          return created
        })
        return c.json(row, 201)
      },
    )
    .patch(
      '/:id/metodos-pago/:metodoId',
      requireRole('admin', 'contabilidad'),
      validate('param', idsMetodo),
      validate('json', editarMetodo),
      async (c) => {
        const { id, metodoId: methodId } = c.req.valid('param')
        const input = c.req.valid('json')
        if (input.principal === false) {
          throw new ApiError(400, 'validacion', 'Marca otro método como principal en lugar de quitar este', 'principal')
        }
        const row = await db.transaction(async (tx) => {
          const [before] = await tx
            .select()
            .from(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, methodId), eq(trabajadorMetodosPago.trabajadorId, id)))
          if (!before) throw notFound('El método de pago')
          if (input.principal) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(and(eq(trabajadorMetodosPago.trabajadorId, id), ne(trabajadorMetodosPago.id, methodId)))
          }
          const [after] = await tx
            .update(trabajadorMetodosPago)
            .set(input)
            .where(eq(trabajadorMetodosPago.id, methodId))
            .returning()
          await recordAudit(tx, c.get('user').id, 'editar', 'trabajador_metodos_pago', methodId, before, after)
          return after
        })
        return c.json(row)
      },
    )
    .delete(
      '/:id/metodos-pago/:metodoId',
      requireRole('admin', 'contabilidad'),
      validate('param', idsMetodo),
      async (c) => {
        const { id, metodoId: methodId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const [removed] = await tx
            .delete(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, methodId), eq(trabajadorMetodosPago.trabajadorId, id)))
            .returning()
          if (!removed) throw notFound('El método de pago')
          if (removed.principal) {
            // If the primary one is removed, the oldest of the remaining ones becomes the primary.
            const [next] = await tx
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
              .limit(1)
            if (next) {
              await tx
                .update(trabajadorMetodosPago)
                .set({ principal: true })
                .where(eq(trabajadorMetodosPago.id, next.id))
            }
          }
          await recordAudit(tx, c.get('user').id, 'eliminar', 'trabajador_metodos_pago', methodId, removed, null)
        })
        return c.json({ ok: true })
      },
    )
