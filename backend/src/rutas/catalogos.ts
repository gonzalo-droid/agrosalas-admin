import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { areas, campanas, turnos } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const nombre = z.string().trim().min(2).max(60)
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM')
const fecha = z.string().date().nullable().optional()

const crearArea = z.object({ nombre })
const editarArea = crearArea.extend({ activo: z.boolean() }).partial()

export const rutasAreas = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(areas).orderBy(asc(areas.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearArea), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nueva] = await tx.insert(areas).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'areas', nueva.id, null, nueva)
        return nueva
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarArea), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(areas).where(eq(areas.id, id))
        if (!antes) throw noEncontrado('El área')
        const [despues] = await tx.update(areas).set(c.req.valid('json')).where(eq(areas.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'areas', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })

const crearTurno = z.object({ nombre, horaInicio: hora, horaFin: hora })
const editarTurno = crearTurno.extend({ activo: z.boolean() }).partial()

export const rutasTurnos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(turnos).orderBy(asc(turnos.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearTurno), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(turnos).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'turnos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarTurno), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(turnos).where(eq(turnos.id, id))
        if (!antes) throw noEncontrado('El turno')
        const [despues] = await tx.update(turnos).set(c.req.valid('json')).where(eq(turnos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'turnos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })

const crearCampana = z.object({ nombre, fechaInicio: fecha, fechaFin: fecha })
const editarCampana = crearCampana.extend({ activo: z.boolean() }).partial()

export const rutasCampanas = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(campanas).orderBy(asc(campanas.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearCampana), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nueva] = await tx.insert(campanas).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'campanas', nueva.id, null, nueva)
        return nueva
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarCampana), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(campanas).where(eq(campanas.id, id))
        if (!antes) throw noEncontrado('La campaña')
        const [despues] = await tx.update(campanas).set(c.req.valid('json')).where(eq(campanas.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'campanas', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
