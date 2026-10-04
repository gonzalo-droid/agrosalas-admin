import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, users } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const r = await t.request(null, 'GET', '/v1/me')
    expect(r.status).toBe(401)
    expect(r.json.error.code).toBe('unauthenticated')
  })

  it('rejects an invalid token', async () => {
    const r = await t.app.request('/v1/me', { headers: { Authorization: 'Bearer fake' } })
    expect(r.status).toBe(401)
  })

  it('rejects a deactivated user', async () => {
    await t.db.update(users).set({ active: false }).where(eq(users.id, USERS.management))
    const r = await t.request('management', 'GET', '/v1/me')
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('access_denied')
    await t.db.update(users).set({ active: true }).where(eq(users.id, USERS.management))
  })
})

describe('/v1/me', () => {
  it('returns the user with their role and areas', async () => {
    const r = await t.request('admin', 'GET', '/v1/me')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({
      id: USERS.admin,
      email: 'admin@example.test',
      name: 'User admin',
      role: 'admin',
      areaIds: [],
    })
  })

  it('changes the name and records it in the audit log', async () => {
    const r = await t.request('accounting', 'PATCH', '/v1/me', { name: 'Rosa Contadora' })
    expect(r.status).toBe(200)
    expect(r.json.name).toBe('Rosa Contadora')
    const rows = await t.db.select().from(auditLog).where(eq(auditLog.entityId, USERS.accounting))
    expect(rows).toHaveLength(1)
    expect(rows[0].action).toBe('update')
    expect(rows[0].after).toEqual({ name: 'Rosa Contadora' })
  })

  it('validates the name with the API error format', async () => {
    const r = await t.request('admin', 'PATCH', '/v1/me', { name: 'x' })
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.field).toBe('name')
    expect(r.json.error.message).toBe('Demasiado pequeño: se esperaba que texto tuviera >=2 caracteres')
  })

  it('answers with the API error format when the body is not JSON', async () => {
    const r = await t.app.request('/v1/me', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' },
      body: '{not-json',
    })
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({
      error: { code: 'invalid_request', message: 'La solicitud no es válida' },
    })
  })
})
