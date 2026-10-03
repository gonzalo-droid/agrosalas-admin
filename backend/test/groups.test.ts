import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, userAreas } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
let ids: string[]
let groupId: string
let temporaryId: string

beforeAll(async () => {
  t = await createTestApp()
  ids = []
  for (let i = 0; i < 3; i++) {
    const r = await t.request('admin', 'POST', '/v1/workers', {
      firstName: `Persona ${i}`,
      lastName: 'Prueba',
      dni: `6000000${i}`,
      employmentType: 'temporary',
    })
    ids.push(r.json.id)
  }
})

describe('worker groups', () => {
  it('the administrator creates a fixed group and a temporary one with dates', async () => {
    const fixed = await t.request('admin', 'POST', '/v1/groups', { name: 'Turno noche' })
    expect(fixed.status).toBe(201)
    expect(fixed.json).toMatchObject({ temporary: false, startDate: null })
    groupId = fixed.json.id

    const temporary = await t.request('admin', 'POST', '/v1/groups', {
      name: 'Apoyo contenedor Chile',
      temporary: true,
      startDate: '2026-09-28',
      endDate: '2026-10-04',
    })
    expect(temporary.json).toMatchObject({ temporary: true, endDate: '2026-10-04' })
    temporaryId = temporary.json.id
  })

  it('accounting adds members; repeating one neither fails nor duplicates it', async () => {
    const r = await t.request('accounting', 'POST', `/v1/groups/${groupId}/members`, { workerIds: [ids[0], ids[1]] })
    expect(r.status).toBe(200)
    await t.request('accounting', 'POST', `/v1/groups/${groupId}/members`, { workerIds: [ids[1], ids[2]] })

    const { json: group } = await t.request('admin', 'GET', `/v1/groups/${groupId}`)
    expect(group.members.map((m: { id: string }) => m.id).sort()).toEqual([...ids].sort())
    expect(group.members[0]).toEqual({ id: ids[0], firstName: 'Persona 0', lastName: 'Prueba', dni: '60000000' })
  })

  it('the list includes the number of members of each group', async () => {
    const { json } = await t.request('coordinator', 'GET', '/v1/groups')
    expect(json.items.map((g: { name: string; members: number }) => [g.name, g.members])).toEqual([
      ['Apoyo contenedor Chile', 0],
      ['Turno noche', 3],
    ])
  })

  it('removes a member and the worker record reflects their groups', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/groups/${groupId}/members/${ids[0]}`)
    expect(r.status).toBe(200)
    expect((await t.request('admin', 'GET', `/v1/workers/${ids[0]}`)).json.groupIds).toEqual([])
    expect((await t.request('admin', 'GET', `/v1/workers/${ids[1]}`)).json.groupIds).toEqual([groupId])
  })

  it('only the administrator creates groups; the coordinator does not touch members', async () => {
    expect((await t.request('accounting', 'POST', '/v1/groups', { name: 'Otro' })).status).toBe(403)
    const r = await t.request('coordinator', 'POST', `/v1/groups/${groupId}/members`, { workerIds: [ids[0]] })
    expect(r.status).toBe(403)
  })

  it('answers 404 when adding members to a group that does not exist', async () => {
    const r = await t.request('admin', 'POST', '/v1/groups/00000000-0000-4000-8000-00000000ffff/members', {
      workerIds: [ids[0]],
    })
    expect(r.status).toBe(404)
  })

  it('a partial edit does not touch the fields that are not sent', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/groups/${temporaryId}`, { endDate: '2026-10-11' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({
      name: 'Apoyo contenedor Chile',
      temporary: true,
      startDate: '2026-09-28',
      endDate: '2026-10-11',
    })
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/groups/${groupId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
  })

  it('answers 400 if a worker to be added does not exist', async () => {
    const r = await t.request('admin', 'POST', `/v1/groups/${groupId}/members`, {
      workerIds: ['00000000-0000-4000-8000-00000000ffff'],
    })
    expect(r.status).toBe(400)
    expect(r.json.error).toEqual({ code: 'invalid_reference', message: 'Uno de los registros indicados no existe' })
  })

  it('answers 404 and does not audit when removing someone who is not in the group', async () => {
    const before = await t.db.select().from(auditLog)
    const r = await t.request('admin', 'DELETE', `/v1/groups/${groupId}/members/00000000-0000-4000-8000-00000000ffff`)
    expect(r.status).toBe(404)
    expect(r.json.error.code).toBe('not_found')
    expect(await t.db.select().from(auditLog)).toHaveLength(before.length)
  })
})

describe('coordinator scope in groups', () => {
  let mixedGroup: string
  let own: string
  let foreign: string

  beforeAll(async () => {
    const production = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
    const warehouse = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
    await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
    const createWorker = (areaId: string, dni: string) =>
      t.request('admin', 'POST', '/v1/workers', { firstName: 'Alcance', lastName: dni, dni, employmentType: 'temporary', areaId })
    own = (await createWorker(production, '70000001')).json.id
    foreign = (await createWorker(warehouse, '70000002')).json.id
    mixedGroup = (await t.request('admin', 'POST', '/v1/groups', { name: 'Grupo mixto' })).json.id
    await t.request('admin', 'POST', `/v1/groups/${mixedGroup}/members`, { workerIds: [own, foreign] })
  })

  it('the administrator sees all the members', async () => {
    const { json } = await t.request('admin', 'GET', `/v1/groups/${mixedGroup}`)
    expect(json.members.map((m: { id: string }) => m.id).sort()).toEqual([own, foreign].sort())
  })

  it('the coordinator only sees the members of their areas', async () => {
    const r = await t.request('coordinator', 'GET', `/v1/groups/${mixedGroup}`)
    expect(r.status).toBe(200)
    expect(r.json.members.map((m: { id: string }) => m.id)).toEqual([own])
    expect(JSON.stringify(r.json)).not.toContain('70000002')
  })
})
