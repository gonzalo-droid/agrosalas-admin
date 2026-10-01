import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let production: string
let warehouse: string

const base = { firstName: 'Ana', lastName: 'Torres Quispe', employmentType: 'temporary' }

beforeAll(async () => {
  t = await createTestApp()
  production = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  warehouse = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
})

describe('create and edit workers', () => {
  it('accounting creates with DNI and name; everything else is optional', async () => {
    const r = await t.request('accounting', 'POST', '/v1/workers', { ...base, dni: '45871236', areaId: production })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ dni: '45871236', status: 'active', phone: null })
  })

  it('requires an 8-digit DNI when creating', async () => {
    const missing = await t.request('admin', 'POST', '/v1/workers', base)
    expect(missing.status).toBe(400)
    expect(missing.json.error.field).toBe('dni')
    const short = await t.request('admin', 'POST', '/v1/workers', { ...base, dni: '123' })
    expect(short.json.error.message).toBe('El DNI debe tener 8 dígitos')
  })

  it('rejects a repeated DNI with 409', async () => {
    const r = await t.request('admin', 'POST', '/v1/workers', { ...base, firstName: 'Otra', dni: '45871236' })
    expect(r.status).toBe(409)
  })

  it('management and coordinator cannot create', async () => {
    for (const role of ['management', 'coordinator'] as const) {
      const r = await t.request(role, 'POST', '/v1/workers', { ...base, dni: '11112222' })
      expect(r.status).toBe(403)
    }
  })

  it('edits, terminates and leaves the before and after in the audit log', async () => {
    const { json: worker } = await t.request('admin', 'POST', '/v1/workers', {
      ...base,
      firstName: 'José',
      lastName: 'Chávez Rojas',
      dni: '40236517',
      areaId: warehouse,
    })
    const r = await t.request('accounting', 'PATCH', `/v1/workers/${worker.id}`, { status: 'terminated', phone: '987654321' })
    expect(r.json).toMatchObject({ status: 'terminated', phone: '987654321' })

    const audit = await t.request('admin', 'GET', '/v1/audit-log?entity=workers')
    const edit = audit.json.items.find((row: { action: string }) => row.action === 'update')
    expect(edit.before.status).toBe('active')
    expect(edit.after.status).toBe('terminated')
    expect(edit.userName).toBe('User accounting')
  })

  it('rejects an edit without any field', async () => {
    const id = (await t.request('admin', 'GET', '/v1/workers?search=torres')).json.items[0].id
    const r = await t.request('admin', 'PATCH', `/v1/workers/${id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
  })

  it('answers 400 if the given area does not exist', async () => {
    const r = await t.request('admin', 'POST', '/v1/workers', {
      firstName: 'Sin',
      lastName: 'Área',
      employmentType: 'temporary',
      dni: '99998888',
      areaId: '00000000-0000-4000-8000-00000000ffff',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('invalid_reference')
  })
})

describe('list workers', () => {
  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      await t.request('admin', 'POST', '/v1/workers', {
        firstName: `Persona ${i}`,
        lastName: `Apellido ${i}`,
        dni: `7000000${i}`,
        employmentType: i === 0 ? 'contract' : 'temporary',
        areaId: i < 3 ? production : warehouse,
      })
    }
  })

  it('paginates and returns the total', async () => {
    const r = await t.request('admin', 'GET', '/v1/workers?page=2&pageSize=3')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 7, page: 2, pageSize: 3 })
    expect(r.json.items).toHaveLength(3)
  })

  it('sorts by last name', async () => {
    const r = await t.request('admin', 'GET', '/v1/workers?pageSize=100')
    const lastNames = r.json.items.map((w: { lastName: string }) => w.lastName)
    expect(lastNames).toEqual([...lastNames].sort((a, b) => a.localeCompare(b)))
  })

  it('filters by text (name, last name or DNI), area, employment type and status', async () => {
    expect((await t.request('admin', 'GET', '/v1/workers?search=torres')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', '/v1/workers?search=4023')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', `/v1/workers?areaId=${warehouse}`)).json.total).toBe(3)
    expect((await t.request('admin', 'GET', '/v1/workers?employmentType=contract')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', '/v1/workers?status=terminated')).json.total).toBe(1)
  })

  it('rejects a page size greater than 100', async () => {
    const r = await t.request('admin', 'GET', '/v1/workers?pageSize=500')
    expect(r.status).toBe(400)
    expect(r.json.error.field).toBe('pageSize')
  })

  it('the coordinator only sees the workers of their areas', async () => {
    const r = await t.request('coordinator', 'GET', '/v1/workers?pageSize=100')
    expect(r.json.total).toBe(4)
    expect(r.json.items.every((w: { areaId: string }) => w.areaId === production)).toBe(true)
  })

  it('a coordinator without areas sees nobody', async () => {
    await t.db.delete(userAreas).where(eq(userAreas.userId, USERS.coordinator))
    expect((await t.request('coordinator', 'GET', '/v1/workers')).json.total).toBe(0)
    await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
  })
})
