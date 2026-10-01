import { beforeAll, describe, expect, it } from 'vitest'
import { auditoria, usuarioAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let ids: string[]
let groupId: string
let temporaryId: string

beforeAll(async () => {
  t = await createTestApp()
  ids = []
  for (let i = 0; i < 3; i++) {
    const r = await t.request('admin', 'POST', '/v1/trabajadores', {
      nombres: `Persona ${i}`,
      apellidos: 'Prueba',
      dni: `6000000${i}`,
      modalidad: 'temporal',
    })
    ids.push(r.json.id)
  }
})

describe('worker groups', () => {
  it('the administrator creates a fixed group and a temporary one with dates', async () => {
    const fixed = await t.request('admin', 'POST', '/v1/grupos', { nombre: 'Turno noche' })
    expect(fixed.status).toBe(201)
    expect(fixed.json).toMatchObject({ temporal: false, fechaInicio: null })
    groupId = fixed.json.id

    const temporary = await t.request('admin', 'POST', '/v1/grupos', {
      nombre: 'Apoyo contenedor Chile',
      temporal: true,
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-04',
    })
    expect(temporary.json).toMatchObject({ temporal: true, fechaFin: '2026-10-04' })
    temporaryId = temporary.json.id
  })

  it('accounting adds members; repeating one neither fails nor duplicates it', async () => {
    const r = await t.request('contabilidad', 'POST', `/v1/grupos/${groupId}/miembros`, { trabajadorIds: [ids[0], ids[1]] })
    expect(r.status).toBe(200)
    await t.request('contabilidad', 'POST', `/v1/grupos/${groupId}/miembros`, { trabajadorIds: [ids[1], ids[2]] })

    const { json: group } = await t.request('admin', 'GET', `/v1/grupos/${groupId}`)
    expect(group.miembros.map((m: { id: string }) => m.id).sort()).toEqual([...ids].sort())
    expect(group.miembros[0]).toEqual({ id: ids[0], nombres: 'Persona 0', apellidos: 'Prueba', dni: '60000000' })
  })

  it('the list includes the number of members of each group', async () => {
    const { json } = await t.request('coordinador', 'GET', '/v1/grupos')
    expect(json.datos.map((g: { nombre: string; miembros: number }) => [g.nombre, g.miembros])).toEqual([
      ['Apoyo contenedor Chile', 0],
      ['Turno noche', 3],
    ])
  })

  it('removes a member and the worker record reflects their groups', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/grupos/${groupId}/miembros/${ids[0]}`)
    expect(r.status).toBe(200)
    expect((await t.request('admin', 'GET', `/v1/trabajadores/${ids[0]}`)).json.grupoIds).toEqual([])
    expect((await t.request('admin', 'GET', `/v1/trabajadores/${ids[1]}`)).json.grupoIds).toEqual([groupId])
  })

  it('only the administrator creates groups; the coordinator does not touch members', async () => {
    expect((await t.request('contabilidad', 'POST', '/v1/grupos', { nombre: 'Otro' })).status).toBe(403)
    const r = await t.request('coordinador', 'POST', `/v1/grupos/${groupId}/miembros`, { trabajadorIds: [ids[0]] })
    expect(r.status).toBe(403)
  })

  it('answers 404 when adding members to a group that does not exist', async () => {
    const r = await t.request('admin', 'POST', '/v1/grupos/00000000-0000-4000-8000-00000000ffff/miembros', {
      trabajadorIds: [ids[0]],
    })
    expect(r.status).toBe(404)
  })

  it('a partial edit does not touch the fields that are not sent', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/grupos/${temporaryId}`, { fechaFin: '2026-10-11' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({
      nombre: 'Apoyo contenedor Chile',
      temporal: true,
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-11',
    })
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/grupos/${groupId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('answers 400 if a worker to be added does not exist', async () => {
    const r = await t.request('admin', 'POST', `/v1/grupos/${groupId}/miembros`, {
      trabajadorIds: ['00000000-0000-4000-8000-00000000ffff'],
    })
    expect(r.status).toBe(400)
    expect(r.json.error).toEqual({ codigo: 'referencia_invalida', mensaje: 'Uno de los registros indicados no existe' })
  })

  it('answers 404 and does not audit when removing someone who is not in the group', async () => {
    const before = await t.db.select().from(auditoria)
    const r = await t.request('admin', 'DELETE', `/v1/grupos/${groupId}/miembros/00000000-0000-4000-8000-00000000ffff`)
    expect(r.status).toBe(404)
    expect(r.json.error.codigo).toBe('no_encontrado')
    expect(await t.db.select().from(auditoria)).toHaveLength(before.length)
  })
})

describe('coordinator scope in groups', () => {
  let mixedGroup: string
  let own: string
  let foreign: string

  beforeAll(async () => {
    const production = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
    const warehouse = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
    await t.db.insert(usuarioAreas).values({ usuarioId: USERS.coordinador, areaId: production })
    const createWorker = (areaId: string, dni: string) =>
      t.request('admin', 'POST', '/v1/trabajadores', { nombres: 'Alcance', apellidos: dni, dni, modalidad: 'temporal', areaId })
    own = (await createWorker(production, '70000001')).json.id
    foreign = (await createWorker(warehouse, '70000002')).json.id
    mixedGroup = (await t.request('admin', 'POST', '/v1/grupos', { nombre: 'Grupo mixto' })).json.id
    await t.request('admin', 'POST', `/v1/grupos/${mixedGroup}/miembros`, { trabajadorIds: [own, foreign] })
  })

  it('the administrator sees all the members', async () => {
    const { json } = await t.request('admin', 'GET', `/v1/grupos/${mixedGroup}`)
    expect(json.miembros.map((m: { id: string }) => m.id).sort()).toEqual([own, foreign].sort())
  })

  it('the coordinator only sees the members of their areas', async () => {
    const r = await t.request('coordinador', 'GET', `/v1/grupos/${mixedGroup}`)
    expect(r.status).toBe(200)
    expect(r.json.miembros.map((m: { id: string }) => m.id)).toEqual([own])
    expect(JSON.stringify(r.json)).not.toContain('70000002')
  })
})
