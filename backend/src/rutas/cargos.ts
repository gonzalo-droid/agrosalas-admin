import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { cargos } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { conAlgunCampo, esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const monto = z.number().positive().max(99999).nullable().optional()

const datosCargo = z.object({
  nombre: z.string().trim().min(2).max(60),
  tipoPago: z.enum(['por_hora', 'mensual']),
  tarifaHora: monto,
  tarifaHoraExtra: monto,
  sueldoMensual: monto,
})
const editarCargo = conAlgunCampo(datosCargo.extend({ activo: z.boolean() }).partial())

type Tarifas = Pick<typeof cargos.$inferSelect, 'tipoPago' | 'tarifaHora' | 'tarifaHoraExtra' | 'sueldoMensual'>

// Un cargo por hora necesita sus dos tarifas; uno mensual, su sueldo.
function exigirTarifas(c: Tarifas) {
  if (c.tipoPago === 'por_hora' && (c.tarifaHora == null || c.tarifaHoraExtra == null)) {
    throw new ErrorApi(400, 'validacion', 'Un cargo por hora necesita tarifa normal y tarifa extra', 'tarifaHora')
  }
  if (c.tipoPago === 'mensual' && c.sueldoMensual == null) {
    throw new ErrorApi(400, 'validacion', 'Un cargo mensual necesita sueldo', 'sueldoMensual')
  }
}

export const rutasCargos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => {
      const filas = await db.select().from(cargos).orderBy(asc(cargos.nombre))
      // El coordinador no ve montos: se quitan en el servidor, no en la pantalla.
      const datos =
        c.get('usuario').rol === 'coordinador'
          ? filas.map((f) => ({ ...f, tarifaHora: null, tarifaHoraExtra: null, sueldoMensual: null }))
          : filas
      return c.json({ datos })
    })
    .post('/', requiereRol('admin'), validar('json', datosCargo), async (c) => {
      const datos = c.req.valid('json')
      exigirTarifas({
        tipoPago: datos.tipoPago,
        tarifaHora: datos.tarifaHora ?? null,
        tarifaHoraExtra: datos.tarifaHoraExtra ?? null,
        sueldoMensual: datos.sueldoMensual ?? null,
      })
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(cargos).values(datos).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'cargos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarCargo), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(cargos).where(eq(cargos.id, id))
        if (!antes) throw noEncontrado('El cargo')
        exigirTarifas({ ...antes, ...c.req.valid('json') })
        const [despues] = await tx.update(cargos).set(c.req.valid('json')).where(eq(cargos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'cargos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
