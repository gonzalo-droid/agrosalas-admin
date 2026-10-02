import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, positions, userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaProduction: string
let w1: string // temporary, Operario
let w2: string // contract, Supervisor (monthly, 1800)
let w3: string // contract, Asistente (monthly, no salary)
let w4: string // temporary, Operario, in no payroll
let weekly: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'

async function createWorker(firstName: string, lastName: string, dni: string, employmentType: string, positionId: string) {
  const r = await t.request('admin', 'POST', '/v1/workers', {
    firstName,
    lastName,
    dni,
    employmentType,
    areaId: areaProduction,
    positionId,
  })
  return r.json.id as string
}

const createPayroll = async (name: string, type: 'weekly' | 'monthly', startDate: string, endDate: string, workerIds: string[]) =>
  (
    await t.request('admin', 'POST', '/v1/payrolls', {
      name,
      type,
      startDate,
      endDate,
      // The API needs at least one worker in `workers`, so an empty payroll omits it.
      ...(workerIds.length > 0 ? { workers: { workerIds } } : {}),
    })
  ).json.id as string

const auditRows = (entity: string, entityId: string) =>
  t.db.select().from(auditLog).where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))

const createItem = (role: 'admin' | 'accounting' | 'management' | 'coordinator', body: Record<string, unknown>) =>
  t.request(role, 'POST', '/v1/payroll-items', body)

const itemsOf = async (payrollId: string, query = '') =>
  (await t.request('admin', 'GET', `/v1/payroll-items?payrollId=${payrollId}${query}`)).json.items as { id: string; workerId: string; type: string }[]

beforeAll(async () => {
  t = await createTestApp()
  areaProduction = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  const operario = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id
  const supervisor = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Supervisor', payType: 'monthly', monthlySalary: 1800 })
  ).json.id
  // The API refuses a monthly position without a salary, so the assistant is created with one and cleared directly.
  const assistant = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Asistente', payType: 'monthly', monthlySalary: 1500 })
  ).json.id
  await t.db.update(positions).set({ monthlySalary: null }).where(eq(positions.id, assistant))
  w1 = await createWorker('Ana', 'Zapata', '71000001', 'temporary', operario)
  w2 = await createWorker('Carla', 'Mendoza', '71000002', 'contract', supervisor)
  w3 = await createWorker('Elena', 'Quispe', '71000003', 'contract', assistant)
  w4 = await createWorker('Diego', 'Barrios', '71000004', 'temporary', operario)
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: areaProduction })
  weekly = await createPayroll('Semana conceptos', 'weekly', '2026-10-05', '2026-10-11', [w1, w2])
})

describe('payroll items: create and permissions', () => {
  it('admin creates a bonus and it is audited', async () => {
    const r = await createItem('admin', { payrollId: weekly, workerId: w1, type: 'bonus', amountCents: 2000 })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ payrollId: weekly, workerId: w1, type: 'bonus', amountCents: 2000, recordedBy: USERS.admin })
    const rows = await auditRows('payroll_items', r.json.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
  })

  it('accounting can create; management and coordinator cannot; the coordinator cannot read either', async () => {
    const body = { payrollId: weekly, workerId: w1, type: 'bonus', amountCents: 500 }
    expect((await createItem('accounting', body)).status).toBe(201)
    for (const role of ['management', 'coordinator'] as const) {
      const r = await createItem(role, body)
      expect(r.status).toBe(403)
      expect(r.json.error.code).toBe('forbidden')
    }
    const read = await t.request('coordinator', 'GET', `/v1/payroll-items?payrollId=${weekly}`)
    expect(read.status).toBe(403)
    expect(read.json.error.code).toBe('forbidden')
    expect((await t.request('management', 'GET', `/v1/payroll-items?payrollId=${weekly}`)).status).toBe(200)
  })

  it('an amount of 0, a negative one or a decimal is rejected', async () => {
    for (const amountCents of [0, -5, 10.5]) {
      const r = await createItem('admin', { payrollId: weekly, workerId: w1, type: 'bonus', amountCents })
      expect(r.status).toBe(400)
      expect(r.json.error).toMatchObject({ code: 'validation', field: 'amountCents' })
    }
  })

  it('a worker outside the payroll answers 400 not_in_payroll and a missing payroll 404', async () => {
    const outside = await createItem('admin', { payrollId: weekly, workerId: w4, type: 'bonus', amountCents: 1000 })
    expect(outside.status).toBe(400)
    expect(outside.json.error.code).toBe('not_in_payroll')
    const missing = await createItem('admin', { payrollId: MISSING_ID, workerId: w1, type: 'bonus', amountCents: 1000 })
    expect(missing.status).toBe(404)
    expect(missing.json.error.code).toBe('not_found')
  })

  it('a second salary of the same worker answers 409 duplicate, but two deductions are accepted', async () => {
    const first = await createItem('admin', { payrollId: weekly, workerId: w1, type: 'salary', amountCents: 100000 })
    expect(first.status).toBe(201)
    const second = await createItem('admin', { payrollId: weekly, workerId: w1, type: 'salary', amountCents: 90000 })
    expect(second.status).toBe(409)
    expect(second.json.error).toMatchObject({
      code: 'duplicate',
      message: 'El trabajador ya tiene un sueldo en esta planilla',
      field: 'type',
    })
    for (const amountCents of [300, 400]) {
      expect((await createItem('admin', { payrollId: weekly, workerId: w1, type: 'deduction', amountCents })).status).toBe(201)
    }
  })
})

describe('payroll items: list', () => {
  it('lists the items of the payroll in creation order, filters by worker and requires the payroll', async () => {
    const payroll = await createPayroll('Semana lista', 'weekly', '2026-10-12', '2026-10-18', [w1, w2])
    const a = await createItem('admin', { payrollId: payroll, workerId: w1, type: 'bonus', amountCents: 100 })
    const b = await createItem('admin', { payrollId: payroll, workerId: w2, type: 'piecework', amountCents: 200 })
    const c = await createItem('admin', { payrollId: payroll, workerId: w1, type: 'deduction', amountCents: 300 })

    expect((await itemsOf(payroll)).map((item) => item.id)).toEqual([a.json.id, b.json.id, c.json.id])
    expect((await itemsOf(payroll, `&workerId=${w1}`)).map((item) => item.id)).toEqual([a.json.id, c.json.id])

    const noPayroll = await t.request('admin', 'GET', '/v1/payroll-items')
    expect(noPayroll.status).toBe(400)
    expect(noPayroll.json.error.code).toBe('validation')
    const missing = await t.request('admin', 'GET', `/v1/payroll-items?payrollId=${MISSING_ID}`)
    expect(missing.status).toBe(404)
    expect(missing.json.error.code).toBe('not_found')
  })
})

describe('payroll items: edit and delete', () => {
  it('PATCH changes the amount and the note and audits; the same PATCH again writes nothing', async () => {
    const created = await createItem('admin', { payrollId: weekly, workerId: w2, type: 'bonus', amountCents: 1000 })
    const id = created.json.id as string
    const patch = { amountCents: 1500, note: 'Meta de la semana' }
    const r = await t.request('accounting', 'PATCH', `/v1/payroll-items/${id}`, patch)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id, ...patch })
    expect((await auditRows('payroll_items', id)).map((row) => row.action).sort()).toEqual(['create', 'update'])

    const again = await t.request('accounting', 'PATCH', `/v1/payroll-items/${id}`, patch)
    expect(again.status).toBe(200)
    expect(again.json).toEqual(r.json)
    expect(await auditRows('payroll_items', id)).toHaveLength(2)

    const unknown = await t.request('admin', 'PATCH', `/v1/payroll-items/${id}`, { type: 'bonus' })
    expect(unknown.status).toBe(400)
    expect(unknown.json.error.code).toBe('validation')
  })

  it('DELETE removes the item and audits; a missing id answers 404', async () => {
    const created = await createItem('admin', { payrollId: weekly, workerId: w2, type: 'bonus', amountCents: 700 })
    const id = created.json.id as string
    const r = await t.request('admin', 'DELETE', `/v1/payroll-items/${id}`)
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
    expect((await itemsOf(weekly)).some((item) => item.id === id)).toBe(false)
    expect((await auditRows('payroll_items', id)).map((row) => row.action).sort()).toEqual(['create', 'delete'])

    const missing = await t.request('admin', 'DELETE', `/v1/payroll-items/${MISSING_ID}`)
    expect(missing.status).toBe(404)
    expect(missing.json.error.code).toBe('not_found')
  })
})

describe('payroll items: automatic salary of a monthly payroll', () => {
  it('creating a monthly payroll gives a salary item only to the contract worker with a monthly salary', async () => {
    const monthly = await createPayroll('Octubre', 'monthly', '2026-10-01', '2026-10-31', [w1, w2, w3])
    const items = await itemsOf(monthly)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ workerId: w2, type: 'salary', amountCents: 180000, recordedBy: USERS.admin })
    const rows = await auditRows('payroll_items', items[0].id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
  })

  it('adding the worker to another monthly payroll creates the salary once, and a weekly payroll never does', async () => {
    const empty = await createPayroll('Noviembre', 'monthly', '2026-11-01', '2026-11-30', [])
    const first = await t.request('admin', 'POST', `/v1/payrolls/${empty}/workers`, { workerIds: [w2] })
    expect(first.status).toBe(200)
    expect(first.json.added).toBe(1)
    const items = await itemsOf(empty)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ workerId: w2, type: 'salary', amountCents: 180000 })

    const again = await t.request('admin', 'POST', `/v1/payrolls/${empty}/workers`, { workerIds: [w2] })
    expect(again.json.added).toBe(0)
    expect(await itemsOf(empty)).toHaveLength(1)

    const emptyWeekly = await createPayroll('Semana vacía', 'weekly', '2026-10-19', '2026-10-25', [])
    await t.request('admin', 'POST', `/v1/payrolls/${emptyWeekly}/workers`, { workerIds: [w2] })
    expect(await itemsOf(emptyWeekly)).toHaveLength(0)
  })
})

describe('payroll items: removing a worker', () => {
  it('a worker with an item cannot be removed until the item is deleted', async () => {
    const payroll = await createPayroll('Semana quitar', 'weekly', '2026-10-26', '2026-11-01', [w1, w2])
    const item = await createItem('admin', { payrollId: payroll, workerId: w1, type: 'bonus', amountCents: 800 })
    const blocked = await t.request('admin', 'DELETE', `/v1/payrolls/${payroll}/workers/${w1}`)
    expect(blocked.status).toBe(409)
    expect(blocked.json.error).toMatchObject({
      code: 'has_records',
      message: 'El trabajador tiene conceptos o pagos en esta planilla; elimínalos primero',
    })
    expect((await t.request('admin', 'DELETE', `/v1/payroll-items/${item.json.id}`)).status).toBe(200)
    expect((await t.request('admin', 'DELETE', `/v1/payrolls/${payroll}/workers/${w1}`)).status).toBe(200)
  })
})
