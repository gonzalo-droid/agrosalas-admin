import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaId: string
let newId: string

beforeAll(async () => {
  t = await createTestApp()
  areaId = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
})

describe('users', () => {
  it('only the administrator can enter /v1/usuarios', async () => {
    for (const role of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await t.request(role, 'GET', '/v1/usuarios')).status).toBe(403)
    }
  })

  it('creates the user in the login provider and in the database, with their areas', async () => {
    const r = await t.request('admin', 'POST', '/v1/usuarios', {
      correo: 'coordinator@example.test',
      clave: 'clave-segura-1',
      nombre: 'Pedro Coordinador',
      rol: 'coordinador',
      areaIds: [areaId],
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ correo: 'coordinator@example.test', rol: 'coordinador', areaIds: [areaId] })
    expect(r.json.clave).toBeUndefined()
    expect(t.createdInAuth).toEqual([{ id: r.json.id, email: 'coordinator@example.test' }])
    newId = r.json.id
  })

  it('does not call the login provider if the email already exists', async () => {
    const r = await t.request('admin', 'POST', '/v1/usuarios', {
      correo: 'coordinator@example.test',
      clave: 'clave-segura-2',
      nombre: 'Repetido',
      rol: 'gerencia',
    })
    expect(r.status).toBe(409)
    expect(t.createdInAuth).toHaveLength(1)
  })

  it('requires a password of at least 8 characters', async () => {
    const r = await t.request('admin', 'POST', '/v1/usuarios', {
      correo: 'other@example.test',
      clave: 'corta',
      nombre: 'Otro',
      rol: 'gerencia',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('clave')
  })

  it('lists the users with their areas', async () => {
    const { json } = await t.request('admin', 'GET', '/v1/usuarios')
    expect(json.datos).toHaveLength(5)
    expect(json.datos.find((u: { id: string }) => u.id === newId).areaIds).toEqual([areaId])
  })

  it('edits role, areas and status', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/usuarios/${newId}`, { rol: 'contabilidad', areaIds: [], activo: false })
    expect(r.json).toMatchObject({ rol: 'contabilidad', areaIds: [], activo: false })
  })

  it('the administrator cannot remove their own access', async () => {
    expect((await t.request('admin', 'PATCH', `/v1/usuarios/${USERS.admin}`, { activo: false })).status).toBe(400)
    expect((await t.request('admin', 'PATCH', `/v1/usuarios/${USERS.admin}`, { rol: 'gerencia' })).status).toBe(400)
    expect((await t.request('admin', 'PATCH', `/v1/usuarios/${USERS.admin}`, { nombre: 'Lucía Paredes' })).status).toBe(200)
  })

  it('changes only the areas without touching anything else', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/usuarios/${newId}`, { areaIds: [areaId] })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ rol: 'contabilidad', activo: false, areaIds: [areaId] })
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/usuarios/${newId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('does not create the login account if an area does not exist', async () => {
    const before = t.createdInAuth.length
    const r = await t.request('admin', 'POST', '/v1/usuarios', {
      correo: 'orphan@example.test',
      clave: 'clave-segura-3',
      nombre: 'Sin Área',
      rol: 'coordinador',
      areaIds: ['00000000-0000-4000-8000-00000000ffff'],
    })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('referencia_invalida')
    expect(r.json.error.campo).toBe('areaIds')
    expect(t.createdInAuth.length).toBe(before)
  })

  it('deletes the login account if the insert in the database fails', async () => {
    const r = await t.request('admin', 'POST', '/v1/usuarios', {
      correo: 'conflict@example.test',
      clave: 'clave-segura-4',
      nombre: 'Conflict',
      rol: 'gerencia',
    })
    expect(r.status).toBe(409)
    expect(t.deletedInAuth).toEqual([USERS.admin])
    expect((await t.request('admin', 'GET', '/v1/me')).status).toBe(200)
  })
})
