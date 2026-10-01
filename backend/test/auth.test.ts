import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditoria, usuarios } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('authentication', () => {
  it('rejects a request without a token', async () => {
    const r = await t.request(null, 'GET', '/v1/me')
    expect(r.status).toBe(401)
    expect(r.json.error.codigo).toBe('no_autenticado')
  })

  it('rejects an invalid token', async () => {
    const r = await t.app.request('/v1/me', { headers: { Authorization: 'Bearer fake' } })
    expect(r.status).toBe(401)
  })

  it('rejects a deactivated user', async () => {
    await t.db.update(usuarios).set({ activo: false }).where(eq(usuarios.id, USERS.gerencia))
    const r = await t.request('gerencia', 'GET', '/v1/me')
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_acceso')
    await t.db.update(usuarios).set({ activo: true }).where(eq(usuarios.id, USERS.gerencia))
  })
})

describe('/v1/me', () => {
  it('returns the user with their role and areas', async () => {
    const r = await t.request('admin', 'GET', '/v1/me')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({
      id: USERS.admin,
      correo: 'admin@example.test',
      nombre: 'Usuario admin',
      rol: 'admin',
      areaIds: [],
    })
  })

  it('changes the name and records it in the audit log', async () => {
    const r = await t.request('contabilidad', 'PATCH', '/v1/me', { nombre: 'Rosa Contadora' })
    expect(r.status).toBe(200)
    expect(r.json.nombre).toBe('Rosa Contadora')
    const rows = await t.db.select().from(auditoria).where(eq(auditoria.entidadId, USERS.contabilidad))
    expect(rows).toHaveLength(1)
    expect(rows[0].accion).toBe('editar')
    expect(rows[0].despues).toEqual({ nombre: 'Rosa Contadora' })
  })

  it('validates the name with the API error format', async () => {
    const r = await t.request('admin', 'PATCH', '/v1/me', { nombre: 'x' })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.campo).toBe('nombre')
    expect(r.json.error.mensaje).toBe('Demasiado pequeño: se esperaba que texto tuviera >=2 caracteres')
  })

  it('answers with the API error format when the body is not JSON', async () => {
    const r = await t.app.request('/v1/me', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer admin', 'Content-Type': 'application/json' },
      body: '{not-json',
    })
    expect(r.status).toBe(400)
    expect(await r.json()).toEqual({
      error: { codigo: 'solicitud_invalida', mensaje: 'La solicitud no es válida' },
    })
  })
})
