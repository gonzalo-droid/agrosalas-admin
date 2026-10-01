import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('areas', () => {
  it('the administrator creates and every role lists', async () => {
    const created = await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })
    expect(created.status).toBe(201)
    expect(created.json).toMatchObject({ name: 'Producción', active: true })

    const list = await t.request('coordinator', 'GET', '/v1/areas')
    expect(list.status).toBe(200)
    expect(list.json.items.map((a: { name: string }) => a.name)).toEqual(['Producción'])
  })

  it('only the administrator can create or edit', async () => {
    const r = await t.request('accounting', 'POST', '/v1/areas', { name: 'Almacén' })
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('forbidden')
  })

  it('rejects a repeated name with 409', async () => {
    const r = await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('duplicate')
  })

  it('edits, deactivates and answers 404 if it does not exist', async () => {
    const { json: area } = await t.request('admin', 'POST', '/v1/areas', { name: 'Etiquetado' })
    const edited = await t.request('admin', 'PATCH', `/v1/areas/${area.id}`, { active: false })
    expect(edited.status).toBe(200)
    expect(edited.json.active).toBe(false)

    const missing = await t.request('admin', 'PATCH', '/v1/areas/00000000-0000-4000-8000-00000000ffff', { active: false })
    expect(missing.status).toBe(404)
  })

  it('leaves creation and edit in the audit log', async () => {
    const r = await t.request('admin', 'GET', '/v1/audit-log?entity=areas')
    expect(r.json.items.map((row: { action: string }) => row.action).sort()).toEqual(['create', 'create', 'update'])
  })

  it('rejects an edit without any field with 400', async () => {
    const { json: area } = await t.request('admin', 'POST', '/v1/areas', { name: 'Mantenimiento' })
    const r = await t.request('admin', 'PATCH', `/v1/areas/${area.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
    expect('field' in r.json.error).toBe(false)
  })
})

describe('shifts', () => {
  it('creates with HH:MM times and rejects another format', async () => {
    const ok = await t.request('admin', 'POST', '/v1/shifts', { name: 'Día', startTime: '07:00', endTime: '17:00' })
    expect(ok.status).toBe(201)
    expect(ok.json.startTime).toBe('07:00:00')

    const bad = await t.request('admin', 'POST', '/v1/shifts', { name: 'Noche', startTime: '7pm', endTime: '05:00' })
    expect(bad.status).toBe(400)
    expect(bad.json.error.field).toBe('startTime')
  })
})

describe('campaigns', () => {
  it('creates with optional dates and edits', async () => {
    const created = await t.request('admin', 'POST', '/v1/campaigns', { name: 'Contenedor Chile' })
    expect(created.status).toBe(201)
    expect(created.json.startDate).toBeNull()

    const edited = await t.request('admin', 'PATCH', `/v1/campaigns/${created.json.id}`, {
      startDate: '2026-09-07',
      endDate: '2026-10-04',
    })
    expect(edited.json).toMatchObject({ startDate: '2026-09-07', endDate: '2026-10-04' })
  })
})
