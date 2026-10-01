import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaId: string
let newId: string

beforeAll(async () => {
  t = await createTestApp()
  areaId = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
})

describe('users', () => {
  it('only the administrator can enter /v1/users', async () => {
    for (const role of ['management', 'accounting', 'coordinator'] as const) {
      expect((await t.request(role, 'GET', '/v1/users')).status).toBe(403)
    }
  })

  it('creates the user in the login provider and in the database, with their areas', async () => {
    const r = await t.request('admin', 'POST', '/v1/users', {
      email: 'pedro@example.test',
      password: 'clave-segura-1',
      name: 'Pedro Coordinador',
      role: 'coordinator',
      areaIds: [areaId],
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ email: 'pedro@example.test', role: 'coordinator', areaIds: [areaId] })
    expect(r.json.password).toBeUndefined()
    expect(t.createdInAuth).toEqual([{ id: r.json.id, email: 'pedro@example.test' }])
    newId = r.json.id
  })

  it('does not call the login provider if the email already exists', async () => {
    const r = await t.request('admin', 'POST', '/v1/users', {
      email: 'pedro@example.test',
      password: 'clave-segura-2',
      name: 'Repetido',
      role: 'management',
    })
    expect(r.status).toBe(409)
    expect(t.createdInAuth).toHaveLength(1)
  })

  it('requires a password of at least 8 characters', async () => {
    const r = await t.request('admin', 'POST', '/v1/users', {
      email: 'other@example.test',
      password: 'corta',
      name: 'Otro',
      role: 'management',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.field).toBe('password')
  })

  it('lists the users with their areas', async () => {
    const { json } = await t.request('admin', 'GET', '/v1/users')
    expect(json.items).toHaveLength(5)
    expect(json.items.find((u: { id: string }) => u.id === newId).areaIds).toEqual([areaId])
  })

  it('edits role, areas and status', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/users/${newId}`, { role: 'accounting', areaIds: [], active: false })
    expect(r.json).toMatchObject({ role: 'accounting', areaIds: [], active: false })
  })

  it('the administrator cannot remove their own access', async () => {
    expect((await t.request('admin', 'PATCH', `/v1/users/${USERS.admin}`, { active: false })).status).toBe(400)
    expect((await t.request('admin', 'PATCH', `/v1/users/${USERS.admin}`, { role: 'management' })).status).toBe(400)
    expect((await t.request('admin', 'PATCH', `/v1/users/${USERS.admin}`, { name: 'Lucía Paredes' })).status).toBe(200)
  })

  it('changes only the areas without touching anything else', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/users/${newId}`, { areaIds: [areaId] })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ role: 'accounting', active: false, areaIds: [areaId] })
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/users/${newId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
  })

  it('does not create the login account if an area does not exist', async () => {
    const before = t.createdInAuth.length
    const r = await t.request('admin', 'POST', '/v1/users', {
      email: 'orphan@example.test',
      password: 'clave-segura-3',
      name: 'Sin Área',
      role: 'coordinator',
      areaIds: ['00000000-0000-4000-8000-00000000ffff'],
    })
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('invalid_reference')
    expect(r.json.error.field).toBe('areaIds')
    expect(t.createdInAuth.length).toBe(before)
  })

  it('deletes the login account if the insert in the database fails', async () => {
    const r = await t.request('admin', 'POST', '/v1/users', {
      email: 'conflict@example.test',
      password: 'clave-segura-4',
      name: 'Conflict',
      role: 'management',
    })
    expect(r.status).toBe(409)
    expect(t.deletedInAuth).toEqual([USERS.admin])
    expect((await t.request('admin', 'GET', '/v1/me')).status).toBe(200)
  })
})
