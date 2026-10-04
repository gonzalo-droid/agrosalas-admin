import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { handleError } from '../src/lib/errors.js'
import { createTestApp } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('health', () => {
  it('answers without a token', async () => {
    const r = await t.request(null, 'GET', '/health')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('answers 404 as JSON when the route does not exist', async () => {
    const r = await t.request(null, 'GET', '/does-not-exist')
    expect(r.status).toBe(404)
    expect(r.json.error.code).toBe('not_found')
  })
})

describe('migrations', () => {
  it('create every table with RLS enabled', async () => {
    const result = await t.db.execute(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    )
    const rows = result.rows as { tablename: string; rowsecurity: boolean }[]
    expect(rows.map((row) => row.tablename)).toEqual([
      'areas',
      'attendance_records',
      'audit_log',
      'campaigns',
      'group_workers',
      'groups',
      'payments',
      'payroll_items',
      'payroll_workers',
      'payrolls',
      'positions',
      'shifts',
      'user_areas',
      'users',
      'worker_payment_methods',
      'workers',
    ])
    expect(rows.every((row) => row.rowsecurity)).toBe(true)
  })
})

describe('unexpected errors', () => {
  afterEach(() => vi.restoreAllMocks())

  it('answers a generic 500 and does not log the query parameters', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
    const app = new Hono()
      .get('/fails', async () => {
        await t.db.execute(sql`select * from table_that_does_not_exist where dni = ${'45871236'}`)
        return new Response()
      })
      .onError(handleError)

    const response = await app.request('/fails')
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: { code: 'internal', message: 'Error interno' } })
    expect(logged).toHaveBeenCalled()
    expect(JSON.stringify(logged.mock.calls)).not.toContain('45871236')
  })
})
