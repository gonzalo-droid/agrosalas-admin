import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let workerId: string
let fromOtherArea: string
let yapeId: string
let accountId: string

beforeAll(async () => {
  t = await createTestApp()
  const production = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  const warehouse = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
  const createWorker = (dni: string, areaId: string) =>
    t.request('admin', 'POST', '/v1/workers', { firstName: 'Ana', lastName: 'Torres Quispe', employmentType: 'temporary', dni, areaId })
  workerId = (await createWorker('45871236', production)).json.id
  fromOtherArea = (await createWorker('40236517', warehouse)).json.id
})

describe('payment methods', () => {
  it('the first method becomes the primary one', async () => {
    const r = await t.request('accounting', 'POST', `/v1/workers/${workerId}/payment-methods`, {
      type: 'yape',
      number: '912345678',
      holderName: 'Jhon Torres',
    })
    expect(r.status).toBe(201)
    expect(r.json.isPrimary).toBe(true)
    yapeId = r.json.id
  })

  it('a second method does not displace the primary one unless requested', async () => {
    const r = await t.request('admin', 'POST', `/v1/workers/${workerId}/payment-methods`, {
      type: 'bank_account',
      number: '191-00000000-0-00',
      bank: 'BCP',
      cci: '002-191-000000000000-00',
      holderName: 'Ana Torres Quispe',
    })
    expect(r.json.isPrimary).toBe(false)
    accountId = r.json.id
  })

  it('marking another one as primary unmarks the previous one', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/workers/${workerId}/payment-methods/${accountId}`, { isPrimary: true })
    expect(r.json.isPrimary).toBe(true)
    const { json: record } = await t.request('admin', 'GET', `/v1/workers/${workerId}`)
    expect(record.paymentMethods.map((m: { id: string; isPrimary: boolean }) => [m.id, m.isPrimary])).toEqual([
      [yapeId, false],
      [accountId, true],
    ])
  })

  it('does not allow leaving the worker without a primary by unmarking it', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/workers/${workerId}/payment-methods/${accountId}`, { isPrimary: false })
    expect(r.status).toBe(400)
  })

  it('rejects an edit without any field', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/workers/${workerId}/payment-methods/${yapeId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
  })

  it('when the primary is removed, the oldest remaining one becomes the primary', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/workers/${workerId}/payment-methods/${accountId}`)
    expect(r.status).toBe(200)
    const { json: record } = await t.request('admin', 'GET', `/v1/workers/${workerId}`)
    expect(record.paymentMethods).toHaveLength(1)
    expect(record.paymentMethods[0]).toMatchObject({ id: yapeId, isPrimary: true })
  })

  it('the coordinator sees the record of their area without payment methods, and cannot add them', async () => {
    const record = await t.request('coordinator', 'GET', `/v1/workers/${workerId}`)
    expect(record.status).toBe(200)
    expect(record.json.paymentMethods).toEqual([])
    const r = await t.request('coordinator', 'POST', `/v1/workers/${workerId}/payment-methods`, {
      type: 'plin',
      number: '999888777',
      holderName: 'X Y',
    })
    expect(r.status).toBe(403)
  })

  it('the coordinator gets 404 for a worker of another area', async () => {
    const r = await t.request('coordinator', 'GET', `/v1/workers/${fromOtherArea}`)
    expect(r.status).toBe(404)
  })
})
