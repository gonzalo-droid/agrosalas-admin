import { and, asc, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { trabajadorMetodosPago } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { conAlgunCampo, esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'
import { buscarTrabajador } from './trabajadores'

const texto = (max: number) => z.string().trim().max(max).nullable().optional()

const datosMetodo = z.object({
  tipo: z.enum(['yape', 'plin', 'cuenta_bancaria']),
  numero: z.string().trim().min(6).max(30),
  banco: texto(40),
  cci: texto(30),
  titular: z.string().trim().min(2).max(80),
  principal: z.boolean().optional(),
})
const editarMetodo = conAlgunCampo(datosMetodo.partial())
const idsMetodo = z.object({ id: z.uuid(), metodoId: z.uuid() })

// Se monta en /v1/trabajadores, junto a rutasTrabajadores.
export const rutasMetodosPago = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .post(
      '/:id/metodos-pago',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', datosMetodo),
      async (c) => {
        const { id } = c.req.valid('param')
        const datos = c.req.valid('json')
        const fila = await db.transaction(async (tx) => {
          await buscarTrabajador(tx, c.get('usuario'), id)
          const [{ total }] = await tx
            .select({ total: count() })
            .from(trabajadorMetodosPago)
            .where(eq(trabajadorMetodosPago.trabajadorId, id))
          // El primer método queda como principal aunque no se pida.
          const principal = total === 0 || datos.principal === true
          if (principal) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
          }
          const [nuevo] = await tx
            .insert(trabajadorMetodosPago)
            .values({ ...datos, trabajadorId: id, principal })
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'trabajador_metodos_pago', nuevo.id, null, nuevo)
          return nuevo
        })
        return c.json(fila, 201)
      },
    )
    .patch(
      '/:id/metodos-pago/:metodoId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMetodo),
      validar('json', editarMetodo),
      async (c) => {
        const { id, metodoId } = c.req.valid('param')
        const datos = c.req.valid('json')
        if (datos.principal === false) {
          throw new ErrorApi(400, 'validacion', 'Marca otro método como principal en lugar de quitar este', 'principal')
        }
        const fila = await db.transaction(async (tx) => {
          const [antes] = await tx
            .select()
            .from(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, metodoId), eq(trabajadorMetodosPago.trabajadorId, id)))
          if (!antes) throw noEncontrado('El método de pago')
          if (datos.principal) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(and(eq(trabajadorMetodosPago.trabajadorId, id), ne(trabajadorMetodosPago.id, metodoId)))
          }
          const [despues] = await tx
            .update(trabajadorMetodosPago)
            .set(datos)
            .where(eq(trabajadorMetodosPago.id, metodoId))
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'trabajador_metodos_pago', metodoId, antes, despues)
          return despues
        })
        return c.json(fila)
      },
    )
    .delete(
      '/:id/metodos-pago/:metodoId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMetodo),
      async (c) => {
        const { id, metodoId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const [antes] = await tx
            .delete(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, metodoId), eq(trabajadorMetodosPago.trabajadorId, id)))
            .returning()
          if (!antes) throw noEncontrado('El método de pago')
          if (antes.principal) {
            // Si se quita el principal, el más antiguo de los que quedan pasa a serlo.
            const [siguiente] = await tx
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
              .limit(1)
            if (siguiente) {
              await tx
                .update(trabajadorMetodosPago)
                .set({ principal: true })
                .where(eq(trabajadorMetodosPago.id, siguiente.id))
            }
          }
          await registrarAuditoria(tx, c.get('usuario').id, 'eliminar', 'trabajador_metodos_pago', metodoId, antes, null)
        })
        return c.json({ ok: true })
      },
    )
