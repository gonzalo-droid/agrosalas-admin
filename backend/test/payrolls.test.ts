import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, userAreas } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaProduction: string
let areaStorage: string
let w1: string
let w2: string
let w3: string
let w4: string
let groupId: string
let campaignId: string
let otherCampaignId: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'

async function createWorker(firstName: string, lastName: string, dni: string, employmentType: string, areaId: string, positionId: string) {
  const r = await t.request('admin', 'POST', '/v1/workers', { firstName, lastName, dni, employmentType, areaId, positionId })
  return r.json.id as string
}

const weekly = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  type: 'weekly',
  startDate: '2026-10-05',
  endDate: '2026-10-11',
  ...extra,
})

const workerIdsOf = (json: { workers: { id: string }[] }) => json.workers.map((w) => w.id).sort()

beforeAll(async () => {
  t = await createTestApp()
  areaProduction = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  areaStorage = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
  const positionId = (
    await t.request('admin', 'POST', '/v1/positions', {
      name: 'Operario',
      payType: 'hourly',
      hourlyRate: 6.25,
      overtimeRate: 7.8125,
    })
  ).json.id
  w1 = await createWorker('Ana', 'Zapata', '70000001', 'temporary', areaProduction, positionId)
  w2 = await createWorker('Beto', 'Alvarez', '70000002', 'temporary', areaProduction, positionId)
  w3 = await createWorker('Carla', 'Mendoza', '70000003', 'temporary', areaStorage, positionId)
  w4 = await createWorker('Diego', 'Barrios', '70000004', 'contract', areaProduction, positionId)
  groupId = (await t.request('admin', 'POST', '/v1/groups', { name: 'Turno noche' })).json.id
  await t.request('admin', 'POST', `/v1/groups/${groupId}/members`, { workerIds: [w1, w3] })
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: areaProduction })
  campaignId = (await t.request('admin', 'POST', '/v1/campaigns', { name: 'Contenedor Chile' })).json.id
  otherCampaignId = (await t.request('admin', 'POST', '/v1/campaigns', { name: 'Contenedor Perú' })).json.id
})

describe('payrolls: create', () => {
  it('the administrator creates a weekly payroll with workers and it is audited', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Semana 41', { workers: { workerIds: [w1, w2] } }))
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ name: 'Semana 41', type: 'weekly', status: 'open', workerCount: 2, campaignId: null })

    const rows = await t.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, r.json.id)))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
  })

  it('creates a payroll without workers', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Semana vacía'))
    expect(r.status).toBe(201)
    expect(r.json.workerCount).toBe(0)
  })

  it('accounting can create; management and the coordinator get 403 forbidden', async () => {
    expect((await t.request('accounting', 'POST', '/v1/payrolls', weekly('Hecha por contabilidad'))).status).toBe(201)
    for (const role of ['management', 'coordinator'] as const) {
      const r = await t.request(role, 'POST', '/v1/payrolls', weekly('No debe crearse'))
      expect(r.status).toBe(403)
      expect(r.json.error.code).toBe('forbidden')
    }
  })

  it('rejects an end date before the start date', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Fechas mal', { startDate: '2026-10-11', endDate: '2026-10-05' }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatchObject({
      code: 'validation',
      field: 'endDate',
      message: 'La fecha de fin no puede ser anterior a la de inicio',
    })
  })

  it('creates with the members of a group', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Desde grupo', { workers: { groupId } }))
    expect(r.status).toBe(201)
    expect(r.json.workerCount).toBe(2)
    const detail = await t.request('admin', 'GET', `/v1/payrolls/${r.json.id}`)
    expect(workerIdsOf(detail.json)).toEqual([w1, w3].sort())
  })

  it('creates with all the active temporary workers and leaves out the contract ones', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Todos los temporales', { workers: { allActiveTemporary: true } }))
    expect(r.status).toBe(201)
    const detail = await t.request('admin', 'GET', `/v1/payrolls/${r.json.id}`)
    expect(workerIdsOf(detail.json)).toEqual([w1, w2, w3].sort())
    expect(workerIdsOf(detail.json)).not.toContain(w4)
  })

  it('rejects workers with two sources at once', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Dos fuentes', { workers: { workerIds: [w1], groupId } }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatchObject({ code: 'validation', message: 'Indica una sola forma de agregar trabajadores' })
  })

  it('rejects a worker id that does not exist', async () => {
    const r = await t.request('admin', 'POST', '/v1/payrolls', weekly('Sin trabajador', { workers: { workerIds: [MISSING_ID] } }))
    expect(r.status).toBe(400)
    expect(r.json.error).toMatchObject({
      code: 'invalid_reference',
      message: 'Uno de los trabajadores indicados no existe',
    })
  })

  it('rejects a group or a payroll that does not exist, or a campaign that does not exist', async () => {
    const group = await t.request('admin', 'POST', '/v1/payrolls', weekly('Grupo falso', { workers: { groupId: MISSING_ID } }))
    expect(group.status).toBe(400)
    expect(group.json.error).toMatchObject({ code: 'invalid_reference', message: 'El grupo indicado no existe' })

    const payroll = await t.request('admin', 'POST', '/v1/payrolls', weekly('Planilla falsa', { workers: { payrollId: MISSING_ID } }))
    expect(payroll.status).toBe(400)
    expect(payroll.json.error).toMatchObject({ code: 'invalid_reference', message: 'La planilla indicada no existe' })

    const campaign = await t.request('admin', 'POST', '/v1/payrolls', weekly('Campaña falsa', { campaignId: MISSING_ID }))
    expect(campaign.status).toBe(400)
    expect(campaign.json.error.code).toBe('invalid_reference')
  })

  it('does not leave a payroll behind when the workers are invalid', async () => {
    await t.request('admin', 'POST', '/v1/payrolls', weekly('Planilla fantasma', { workers: { workerIds: [MISSING_ID] } }))
    const { json } = await t.request('admin', 'GET', '/v1/payrolls?search=fantasma')
    expect(json.total).toBe(0)
  })
})

describe('payrolls: add and remove workers', () => {
  it('copies the workers of another payroll; repeating the call adds nobody', async () => {
    const source = await t.request('admin', 'POST', '/v1/payrolls', weekly('Origen', { workers: { workerIds: [w1, w2] } }))
    const target = await t.request('admin', 'POST', '/v1/payrolls', weekly('Destino'))

    const first = await t.request('accounting', 'POST', `/v1/payrolls/${target.json.id}/workers`, { payrollId: source.json.id })
    expect(first.status).toBe(200)
    expect(first.json).toEqual({ added: 2, workerCount: 2 })

    const again = await t.request('accounting', 'POST', `/v1/payrolls/${target.json.id}/workers`, { payrollId: source.json.id })
    expect(again.json).toEqual({ added: 0, workerCount: 2 })
  })

  it('adding workers is audited as an update of the payroll', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Auditoría de altas'))
    await t.request('admin', 'POST', `/v1/payrolls/${p.json.id}/workers`, { workerIds: [w4] })
    const rows = await t.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, p.json.id), eq(auditLog.action, 'update')))
    expect(rows).toHaveLength(1)
    expect(rows[0].after).toEqual({ added: [w4] })
  })

  it('adding nobody writes no audit row, and the audit lists only the workers actually added', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Altas repetidas', { workers: { workerIds: [w1] } }))
    const updates = () =>
      t.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, p.json.id), eq(auditLog.action, 'update')))
    const none = await t.request('admin', 'POST', `/v1/payrolls/${p.json.id}/workers`, { workerIds: [w1] })
    expect(none.json).toEqual({ added: 0, workerCount: 1 })
    expect(await updates()).toHaveLength(0)

    const some = await t.request('admin', 'POST', `/v1/payrolls/${p.json.id}/workers`, { workerIds: [w1, w2] })
    expect(some.json).toEqual({ added: 1, workerCount: 2 })
    const rows = await updates()
    expect(rows).toHaveLength(1)
    expect(rows[0].after).toEqual({ added: [w2] })
  })

  it('only the administrator and accounting add workers; a missing payroll answers 404', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Permisos de altas'))
    for (const role of ['management', 'coordinator'] as const) {
      expect((await t.request(role, 'POST', `/v1/payrolls/${p.json.id}/workers`, { workerIds: [w1] })).status).toBe(403)
    }
    const missing = await t.request('admin', 'POST', `/v1/payrolls/${MISSING_ID}/workers`, { workerIds: [w1] })
    expect(missing.status).toBe(404)
    expect(missing.json.error).toMatchObject({ code: 'not_found', message: 'La planilla no existe' })
  })

  it('removes a worker who has no records, audits it, and answers 404 for someone who is not in the payroll', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Bajas', { workers: { workerIds: [w1, w2] } }))
    const removed = await t.request('admin', 'DELETE', `/v1/payrolls/${p.json.id}/workers/${w1}`)
    expect(removed.status).toBe(200)
    expect(removed.json).toEqual({ ok: true })

    const detail = await t.request('admin', 'GET', `/v1/payrolls/${p.json.id}`)
    expect(workerIdsOf(detail.json)).toEqual([w2])

    const rows = await t.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, p.json.id), eq(auditLog.action, 'update')))
    expect(rows.map((row) => row.before)).toContainEqual({ removed: w1 })

    const again = await t.request('admin', 'DELETE', `/v1/payrolls/${p.json.id}/workers/${w1}`)
    expect(again.status).toBe(404)
    expect(again.json.error).toMatchObject({ code: 'not_found', message: 'El trabajador no está en la planilla' })
  })

  it('the coordinator cannot remove workers', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Bajas vetadas', { workers: { workerIds: [w1] } }))
    expect((await t.request('coordinator', 'DELETE', `/v1/payrolls/${p.json.id}/workers/${w1}`)).status).toBe(403)
  })
})

describe('payrolls: list', () => {
  let ids: Record<string, string>

  beforeAll(async () => {
    const make = async (name: string, body: Record<string, unknown>) =>
      (await t.request('admin', 'POST', '/v1/payrolls', { name, type: 'weekly', ...body })).json.id as string
    ids = {
      october: await make('Lista octubre', { startDate: '2026-10-05', endDate: '2026-10-11', campaignId, workers: { workerIds: [w1, w2, w3, w4] } }),
      september: await make('Lista septiembre', { startDate: '2026-09-28', endDate: '2026-10-04' }),
      monthly: await make('Lista mensual', { type: 'monthly', startDate: '2026-11-01', endDate: '2026-11-30' }),
    }
  })

  const namesOf = (json: { items: { name: string }[] }) => json.items.map((p) => p.name)

  it('returns the page envelope ordered by start date descending', async () => {
    const { status, json } = await t.request('admin', 'GET', '/v1/payrolls?search=Lista')
    expect(status).toBe(200)
    expect(json).toMatchObject({ total: 3, page: 1, pageSize: 25 })
    expect(namesOf(json)).toEqual(['Lista mensual', 'Lista octubre', 'Lista septiembre'])
  })

  it('each row carries the campaign name, the worker count and a numeric total', async () => {
    const { json } = await t.request('admin', 'GET', '/v1/payrolls?search=Lista octubre')
    expect(json.items).toHaveLength(1)
    expect(json.items[0]).toMatchObject({
      id: ids.october,
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      campaignId,
      campaignName: 'Contenedor Chile',
      status: 'open',
      workerCount: 4,
      totalCents: 0,
    })
    expect(typeof json.items[0].workerCount).toBe('number')
    expect(typeof json.items[0].totalCents).toBe('number')
    // Nothing paid yet: everything that is owed is still pending.
    expect(json.items[0].paidCents).toBe(0)
    expect(json.items[0].pendingCents).toBe(json.items[0].totalCents)
    expect(json.items[0].createdAt).toEqual(expect.any(String))
  })

  it('filters by search, by type and by campaign', async () => {
    expect(namesOf((await t.request('admin', 'GET', '/v1/payrolls?search=septiembre')).json)).toEqual(['Lista septiembre'])
    expect(namesOf((await t.request('admin', 'GET', '/v1/payrolls?type=monthly')).json)).toEqual(['Lista mensual'])
    expect(namesOf((await t.request('admin', 'GET', `/v1/payrolls?campaignId=${campaignId}`)).json)).toEqual(['Lista octubre'])
    expect((await t.request('admin', 'GET', `/v1/payrolls?campaignId=${otherCampaignId}`)).json.total).toBe(0)
  })

  it('filters by status', async () => {
    expect((await t.request('admin', 'GET', '/v1/payrolls?status=closed')).json.total).toBe(0)
    expect((await t.request('admin', 'GET', '/v1/payrolls?status=open&search=Lista')).json.total).toBe(3)
  })

  it('filters by a date range that crosses the period of the payroll', async () => {
    const inside = await t.request('admin', 'GET', '/v1/payrolls?search=octubre&from=2026-10-10&to=2026-10-20')
    expect(namesOf(inside.json)).toEqual(['Lista octubre'])
    const after = await t.request('admin', 'GET', '/v1/payrolls?search=octubre&from=2026-10-12')
    expect(after.json.total).toBe(0)
    const before = await t.request('admin', 'GET', '/v1/payrolls?search=octubre&to=2026-10-04')
    expect(before.json.total).toBe(0)
  })

  it('paginates', async () => {
    const { json } = await t.request('admin', 'GET', '/v1/payrolls?search=Lista&page=2&pageSize=2')
    expect(json).toMatchObject({ total: 3, page: 2, pageSize: 2 })
    expect(namesOf(json)).toEqual(['Lista septiembre'])
  })

  it('management sees a numeric total; the coordinator sees null', async () => {
    const management = await t.request('management', 'GET', '/v1/payrolls?search=Lista octubre')
    expect(management.json.items[0].totalCents).toBe(0)
    const coordinator = await t.request('coordinator', 'GET', '/v1/payrolls?search=Lista octubre')
    expect(coordinator.status).toBe(200)
    expect(coordinator.json.items[0].totalCents).toBeNull()
    expect(coordinator.json.items[0].workerCount).toBe(4)
  })
})

describe('payrolls: detail', () => {
  let payrollId: string

  beforeAll(async () => {
    payrollId = (await t.request('admin', 'POST', '/v1/payrolls', weekly('Detalle', { workers: { workerIds: [w1, w2, w3, w4] } }))).json.id
  })

  it('returns the payroll with the workers ordered by last name and no records yet', async () => {
    const r = await t.request('admin', 'GET', `/v1/payrolls/${payrollId}`)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id: payrollId, name: 'Detalle', status: 'open', campaignName: null, records: [] })
    expect(r.json.workers.map((w: { lastName: string }) => w.lastName)).toEqual(['Alvarez', 'Barrios', 'Mendoza', 'Zapata'])
    expect(r.json.workers[0]).toEqual({
      id: w2,
      firstName: 'Beto',
      lastName: 'Alvarez',
      dni: '70000002',
      areaId: areaProduction,
      positionId: expect.any(String),
      employmentType: 'temporary',
      status: 'active',
    })
  })

  it('includes the campaign name', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Con campaña', { campaignId }))
    expect((await t.request('admin', 'GET', `/v1/payrolls/${p.json.id}`)).json.campaignName).toBe('Contenedor Chile')
  })

  it('answers 404 for an id that does not exist', async () => {
    const r = await t.request('admin', 'GET', `/v1/payrolls/${MISSING_ID}`)
    expect(r.status).toBe(404)
    expect(r.json.error.code).toBe('not_found')
  })

  it('the coordinator only sees the workers of their area', async () => {
    const r = await t.request('coordinator', 'GET', `/v1/payrolls/${payrollId}`)
    expect(r.status).toBe(200)
    expect(workerIdsOf(r.json)).toEqual([w1, w2, w4].sort())
  })

  it('management sees the four workers', async () => {
    const r = await t.request('management', 'GET', `/v1/payrolls/${payrollId}`)
    expect(workerIdsOf(r.json)).toEqual([w1, w2, w3, w4].sort())
  })
})

describe('payrolls: edit', () => {
  it('changes the name and the campaign and audits an update', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Por editar'))
    const r = await t.request('accounting', 'PATCH', `/v1/payrolls/${p.json.id}`, { name: 'Editada', campaignId })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id: p.json.id, name: 'Editada', campaignId, startDate: '2026-10-05', endDate: '2026-10-11' })

    const rows = await t.db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, p.json.id), eq(auditLog.action, 'update')))
    expect(rows).toHaveLength(1)
    expect(rows[0].before).toMatchObject({ name: 'Por editar', campaignId: null })
    expect(rows[0].after).toMatchObject({ name: 'Editada', campaignId })
  })

  it('a request whose values equal the stored ones answers 200 and writes no audit row', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Sin cambios', { campaignId }))
    const updates = () =>
      t.db
        .select()
        .from(auditLog)
        .where(and(eq(auditLog.entity, 'payrolls'), eq(auditLog.entityId, p.json.id), eq(auditLog.action, 'update')))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, {
      name: 'Sin cambios',
      campaignId,
      startDate: '2026-10-05',
    })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id: p.json.id, name: 'Sin cambios', campaignId, startDate: '2026-10-05', endDate: '2026-10-11' })
    expect(await updates()).toHaveLength(0)
    // A real change is still audited.
    await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, { name: 'Con cambios' })
    expect(await updates()).toHaveLength(1)
  })

  it('removes the campaign with null', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Con campaña a quitar', { campaignId }))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, { campaignId: null })
    expect(r.json.campaignId).toBeNull()
  })

  it('rejects an end date before the stored start date when only the end date is sent', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Fecha de fin'))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, { endDate: '2026-10-01' })
    expect(r.status).toBe(400)
    expect(r.json.error).toMatchObject({
      code: 'validation',
      field: 'endDate',
      message: 'La fecha de fin no puede ser anterior a la de inicio',
    })
  })

  it('rejects a start date after the stored end date when only the start date is sent', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Fecha de inicio'))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, { startDate: '2026-10-20' })
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
  })

  it('accepts new dates when there are no records', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Fechas nuevas'))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, { startDate: '2026-10-06', endDate: '2026-10-12' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ startDate: '2026-10-06', endDate: '2026-10-12' })
  })

  it('rejects an empty body', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Cuerpo vacío'))
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${p.json.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
  })

  it('answers 404 for a payroll that does not exist', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${MISSING_ID}`, { name: 'Nada' })
    expect(r.status).toBe(404)
  })

  it('management and the coordinator get 403 forbidden', async () => {
    const p = await t.request('admin', 'POST', '/v1/payrolls', weekly('Permisos de edición'))
    for (const role of ['management', 'coordinator'] as const) {
      const r = await t.request(role, 'PATCH', `/v1/payrolls/${p.json.id}`, { name: 'Nada' })
      expect(r.status).toBe(403)
      expect(r.json.error.code).toBe('forbidden')
    }
  })
})
