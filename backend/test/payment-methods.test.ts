import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let workerId: string
let fromOtherArea: string
let yapeId: string
let accountId: string

beforeAll(async () => {
  t = await createTestApp()
  const production = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  const warehouse = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await t.db.insert(usuarioAreas).values({ usuarioId: USERS.coordinador, areaId: production })
  const createWorker = (dni: string, areaId: string) =>
    t.request('admin', 'POST', '/v1/trabajadores', { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal', dni, areaId })
  workerId = (await createWorker('45871236', production)).json.id
  fromOtherArea = (await createWorker('40236517', warehouse)).json.id
})

describe('payment methods', () => {
  it('the first method becomes the primary one', async () => {
    const r = await t.request('contabilidad', 'POST', `/v1/trabajadores/${workerId}/metodos-pago`, {
      tipo: 'yape',
      numero: '912345678',
      titular: 'Jhon Torres',
    })
    expect(r.status).toBe(201)
    expect(r.json.principal).toBe(true)
    yapeId = r.json.id
  })

  it('a second method does not displace the primary one unless requested', async () => {
    const r = await t.request('admin', 'POST', `/v1/trabajadores/${workerId}/metodos-pago`, {
      tipo: 'cuenta_bancaria',
      numero: '191-00000000-0-00',
      banco: 'BCP',
      cci: '002-191-000000000000-00',
      titular: 'Ana Torres Quispe',
    })
    expect(r.json.principal).toBe(false)
    accountId = r.json.id
  })

  it('marking another one as primary unmarks the previous one', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/trabajadores/${workerId}/metodos-pago/${accountId}`, { principal: true })
    expect(r.json.principal).toBe(true)
    const { json: record } = await t.request('admin', 'GET', `/v1/trabajadores/${workerId}`)
    expect(record.metodosPago.map((m: { id: string; principal: boolean }) => [m.id, m.principal])).toEqual([
      [yapeId, false],
      [accountId, true],
    ])
  })

  it('does not allow leaving the worker without a primary by unmarking it', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/trabajadores/${workerId}/metodos-pago/${accountId}`, { principal: false })
    expect(r.status).toBe(400)
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/trabajadores/${workerId}/metodos-pago/${yapeId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('when the primary is removed, the oldest remaining one becomes the primary', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/trabajadores/${workerId}/metodos-pago/${accountId}`)
    expect(r.status).toBe(200)
    const { json: record } = await t.request('admin', 'GET', `/v1/trabajadores/${workerId}`)
    expect(record.metodosPago).toHaveLength(1)
    expect(record.metodosPago[0]).toMatchObject({ id: yapeId, principal: true })
  })

  it('the coordinator sees the record of their area without payment methods, and cannot add them', async () => {
    const record = await t.request('coordinador', 'GET', `/v1/trabajadores/${workerId}`)
    expect(record.status).toBe(200)
    expect(record.json.metodosPago).toEqual([])
    const r = await t.request('coordinador', 'POST', `/v1/trabajadores/${workerId}/metodos-pago`, {
      tipo: 'plin',
      numero: '999888777',
      titular: 'X Y',
    })
    expect(r.status).toBe(403)
  })

  it('the coordinator gets 404 for a worker of another area', async () => {
    const r = await t.request('coordinador', 'GET', `/v1/trabajadores/${fromOtherArea}`)
    expect(r.status).toBe(404)
  })
})
