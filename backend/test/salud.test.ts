import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { manejarError } from '../src/lib/errores'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('salud', () => {
  it('responde sin token', async () => {
    const r = await p.pedir(null, 'GET', '/salud')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('responde 404 en JSON cuando la ruta no existe', async () => {
    const r = await p.pedir(null, 'GET', '/no-existe')
    expect(r.status).toBe(404)
    expect(r.json.error.codigo).toBe('no_encontrado')
  })
})

describe('migraciones', () => {
  it('crean las tablas de la fase 1 con RLS activado', async () => {
    const resultado = await p.db.execute(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    )
    const filas = resultado.rows as { tablename: string; rowsecurity: boolean }[]
    expect(filas.map((f) => f.tablename)).toEqual([
      'areas',
      'auditoria',
      'campanas',
      'cargos',
      'grupo_trabajadores',
      'grupos',
      'trabajador_metodos_pago',
      'trabajadores',
      'turnos',
      'usuario_areas',
      'usuarios',
    ])
    expect(filas.every((f) => f.rowsecurity)).toBe(true)
  })
})

describe('errores inesperados', () => {
  afterEach(() => vi.restoreAllMocks())

  it('responde 500 genérico y no registra los parámetros de la consulta', async () => {
    const registro = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = new Hono()
      .get('/falla', async () => {
        await p.db.execute(sql`select * from tabla_que_no_existe where dni = ${'45871236'}`)
        return new Response()
      })
      .onError(manejarError)

    const respuesta = await app.request('/falla')
    expect(respuesta.status).toBe(500)
    expect(await respuesta.json()).toEqual({ error: { codigo: 'interno', mensaje: 'Error interno' } })
    expect(registro).toHaveBeenCalled()
    expect(JSON.stringify(registro.mock.calls)).not.toContain('45871236')
  })
})
