import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
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
