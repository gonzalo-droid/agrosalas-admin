import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
let production: string
let warehouse: string
// A second app with the same data plus a campaign, a contract payroll and payments (by-campaign, by-worker).
let campaignApp: App
let campaignIds: Awaited<ReturnType<typeof seed>>

// Every full record is 620 minutes at 6.25 per hour: 480 regular, 140 overtime, 6823 cents.
const FULL_DAY = { regularMinutes: 480, overtimeMinutes: 140, cents: 6823 }
const COST_ROUTES = ['weekly', 'monthly', 'by-area', 'by-campaign', 'by-worker'] as const

type App = Awaited<ReturnType<typeof createTestApp>>

const createWorker = async (app: App, firstName: string, lastName: string, dni: string, positionId: string, areaId?: string) =>
  (await app.request('admin', 'POST', '/v1/workers', { firstName, lastName, dni, employmentType: 'temporary', areaId, positionId }))
    .json.id as string

const createPayroll = async (app: App, name: string, startDate: string, endDate: string, workerIds: string[], campaignId?: string) =>
  (await app.request('admin', 'POST', '/v1/payrolls', { name, type: 'weekly', startDate, endDate, campaignId, workers: { workerIds } }))
    .json.id as string

const fullDay = async (app: App, payrollId: string, workerId: string, date: string) => {
  for (const [mark, hour] of [
    ['clockIn1', '12:10'],
    ['clockOut1', '18:00'],
    ['clockIn2', '19:00'],
    ['clockOut2', '23:30'],
  ] as const) {
    const { status } = await app.request('admin', 'POST', '/v1/attendance/clock', {
      payrollId,
      workerId,
      date,
      mark,
      at: `${date}T${hour}:00Z`,
    })
    expect(status).toBeLessThan(300)
  }
}

// The data of the cost reports: payroll A (28/09 to 04/10) and B (05/10 to 11/10), three temporary workers.
// With `campaign` the two weekly payrolls belong to "Contenedor Chile", and a monthly payroll C of October
// without campaign adds a contract worker with the automatic salary (150000) and two payments.
async function seed(app: App, campaign = false) {
  const production = (await app.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id as string
  const warehouse = (await app.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id as string
  const position = (
    await app.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id as string
  await app.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
  const w1 = await createWorker(app, 'Rosa', 'Quispe', '72000001', position, production)
  const w2 = await createWorker(app, 'Beto', 'Huamán', '72000002', position, warehouse)
  const w3 = await createWorker(app, 'Luis', 'Rojas', '72000003', position)
  const campaignId = campaign ? ((await app.request('admin', 'POST', '/v1/campaigns', { name: 'Contenedor Chile' })).json.id as string) : undefined
  const payrollA = await createPayroll(app, 'Semana 40', '2026-09-28', '2026-10-04', [w1, w2, w3], campaignId)
  const payrollB = await createPayroll(app, 'Semana 41', '2026-10-05', '2026-10-11', [w1, w2, w3], campaignId)

  await fullDay(app, payrollA, w1, '2026-10-02')
  await fullDay(app, payrollB, w1, '2026-10-06')
  await fullDay(app, payrollB, w2, '2026-10-06')
  const absence = await app.request('admin', 'POST', '/v1/attendance', { payrollId: payrollB, workerId: w3, date: '2026-10-07', type: 'absence' })
  expect(absence.status).toBe(201)

  const item = async (payrollId: string, workerId: string, type: string, amountCents: number) =>
    expect((await app.request('admin', 'POST', '/v1/payroll-items', { payrollId, workerId, type, amountCents })).status).toBe(201)
  await item(payrollA, w1, 'bonus', 2000)
  await item(payrollB, w2, 'deduction', 500)

  if (!campaign) return { production, warehouse, w1, w2, w3 }

  const pay = async (payrollId: string, workerId: string, amountCents: number) =>
    expect(
      (await app.request('admin', 'POST', '/v1/payments', { payrollId, workerId, date: '2026-10-05', amountCents, method: 'cash' })).status,
    ).toBe(201)
  await pay(payrollA, w1, 3000)
  // More than the worker's total on purpose: the pending amount of that row is negative.
  await pay(payrollB, w2, 9999)

  const salaried = (await app.request('admin', 'POST', '/v1/positions', { name: 'Jefe de planta', payType: 'monthly', monthlySalary: 1500 })).json.id
  const w4 = (
    await app.request('admin', 'POST', '/v1/workers', {
      firstName: 'Ana',
      lastName: 'Zegarra',
      dni: '72000004',
      employmentType: 'contract',
      positionId: salaried,
    })
  ).json.id as string
  const payrollC = await app.request('admin', 'POST', '/v1/payrolls', {
    name: 'Octubre 2026',
    type: 'monthly',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    workers: { workerIds: [w4] },
  })
  expect(payrollC.status).toBe(201)
  return { production, warehouse, w1, w2, w3, w4, payrollA, payrollB, payrollC: payrollC.json.id as string }
}

const get = (path: string, role: 'admin' | 'management' | 'coordinator' = 'admin', app: App = t) =>
  app.request(role, 'GET', `/v1/reports/costs/${path}`)

beforeAll(async () => {
  t = await createTestApp()
  ;({ production, warehouse } = await seed(t))
  campaignApp = await createTestApp()
  campaignIds = await seed(campaignApp, true)
})

describe('weekly cost report', () => {
  it('has one row per week; the items count in the week their payroll starts, and only when that day is in the range', async () => {
    const { status, json } = await get('weekly?from=2026-10-01&to=2026-10-11')
    expect(status).toBe(200)
    expect(json.items).toEqual([
      {
        weekStart: '2026-09-28',
        weekEnd: '2026-10-04',
        regularMinutes: 480,
        overtimeMinutes: 140,
        attendanceCents: 6823,
        // Payroll A starts on 28 September, before the range: its bonus does not count.
        itemsCents: 0,
        totalCents: 6823,
      },
      {
        weekStart: '2026-10-05',
        weekEnd: '2026-10-11',
        regularMinutes: 960,
        overtimeMinutes: 280,
        attendanceCents: 13646,
        itemsCents: -500,
        totalCents: 13146,
      },
    ])
    expect(json.totals).toEqual({ regularMinutes: 1440, overtimeMinutes: 420, attendanceCents: 20469, itemsCents: -500, totalCents: 19969 })
  })

  it('counts the bonus of payroll A once the range includes its first day', async () => {
    const { json } = await get('weekly?from=2026-09-28&to=2026-10-11')
    expect(json.items[0]).toMatchObject({ weekStart: '2026-09-28', attendanceCents: 6823, itemsCents: 2000, totalCents: 8823 })
    expect(json.items[1]).toMatchObject({ weekStart: '2026-10-05', itemsCents: -500, totalCents: 13146 })
    expect(json.totals).toMatchObject({ itemsCents: 1500, totalCents: 21969 })
  })

  it('cuts the attendance by date and the items by the start of their payroll', async () => {
    const { json } = await get('weekly?from=2026-10-06&to=2026-10-06')
    // Only the two records of 06/10, not the one of 02/10. Payroll B starts on 05/10, outside the range: its -500 does not count.
    expect(json.items).toEqual([
      {
        weekStart: '2026-10-05',
        weekEnd: '2026-10-11',
        regularMinutes: 960,
        overtimeMinutes: 280,
        attendanceCents: 13646,
        itemsCents: 0,
        totalCents: 13646,
      },
    ])
  })

  it('keeps the weeks without movement as rows in zero', async () => {
    const { json } = await get('weekly?from=2026-10-12&to=2026-10-18')
    expect(json.items).toEqual([
      { weekStart: '2026-10-12', weekEnd: '2026-10-18', regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 },
    ])
  })
})

describe('monthly cost report', () => {
  it('has one row per month, also the ones without movement', async () => {
    const { status, json } = await get('monthly?from=2026-09-01&to=2026-10-31')
    expect(status).toBe(200)
    expect(json.items).toEqual([
      { month: '2026-09', regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 2000, totalCents: 2000 },
      { month: '2026-10', regularMinutes: 1440, overtimeMinutes: 420, attendanceCents: 20469, itemsCents: -500, totalCents: 19969 },
    ])
    expect(json.totals).toEqual({ regularMinutes: 1440, overtimeMinutes: 420, attendanceCents: 20469, itemsCents: 1500, totalCents: 21969 })
  })
})

describe('by-area cost report', () => {
  it('groups by area in name order, "Sin área" last, and does not count an absence as a worked day', async () => {
    const { status, json } = await get('by-area?from=2026-09-28&to=2026-10-11')
    expect(status).toBe(200)
    expect(json.items).toEqual([
      { areaId: warehouse, areaName: 'Almacén', workedDays: 1, ...pick(FULL_DAY, 1) },
      { areaId: production, areaName: 'Producción', workedDays: 2, ...pick(FULL_DAY, 2) },
      { areaId: null, areaName: 'Sin área', workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0 },
    ])
    expect(json.itemsCents).toBe(1500)
    expect(json.totals).toEqual({
      workedDays: 3,
      regularMinutes: 1440,
      overtimeMinutes: 420,
      attendanceCents: 20469,
      itemsCents: 1500,
      totalCents: 3 * 6823 + 1500,
    })
  })

  it('has no rows and zero totals when nothing happened in the range', async () => {
    const { json } = await get('by-area?from=2026-12-01&to=2026-12-31')
    expect(json.items).toEqual([])
    expect(json.totals).toEqual({ workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 })
  })
})

describe('by-campaign cost report', () => {
  const route = (query: string) => get(`by-campaign?${query}`, 'admin', campaignApp)

  it('groups the payrolls of the range by campaign, the contract staff after, with their money and workers', async () => {
    const { status, json } = await route('from=2026-09-28&to=2026-10-31')
    expect(status).toBe(200)
    const chileTotal = 3 * 6823 + 2000 - 500
    expect(json.items).toHaveLength(2)
    expect(json.items[0]).toMatchObject({
      key: expect.any(String),
      name: 'Contenedor Chile',
      payrollCount: 2,
      people: 3,
      workedDays: 3,
      regularMinutes: 1440,
      overtimeMinutes: 420,
      totalCents: chileTotal,
      paidCents: 12999,
      pendingCents: chileTotal - 12999,
    })
    expect(json.items[0].payrolls).toEqual([
      { id: campaignIds.payrollA, name: 'Semana 40', startDate: '2026-09-28', endDate: '2026-10-04', status: 'open', totalCents: 8823, paidCents: 3000, pendingCents: 5823 },
      { id: campaignIds.payrollB, name: 'Semana 41', startDate: '2026-10-05', endDate: '2026-10-11', status: 'open', totalCents: 13146, paidCents: 9999, pendingCents: 3147 },
    ])
    // By last name: Huamán (w2), Quispe (w1), Rojas (w3).
    expect(json.items[0].workers.map((w: { workerId: string }) => w.workerId)).toEqual([campaignIds.w2, campaignIds.w1, campaignIds.w3])
    expect(json.items[0].workers[0]).toMatchObject({
      lastName: 'Huamán',
      dni: '72000002',
      workedDays: 1,
      attendanceCents: 6823,
      itemsCents: -500,
      totalCents: 6323,
      paidCents: 9999,
      pendingCents: -3676,
    })
    expect(json.items[1]).toMatchObject({
      key: 'contract',
      campaignId: null,
      name: 'Personal con contrato',
      payrollCount: 1,
      people: 1,
      workedDays: 0,
      totalCents: 150000,
      paidCents: 0,
      pendingCents: 150000,
    })
    expect(json.totals).toEqual({
      payrollCount: 3,
      people: 4,
      workedDays: 3,
      regularMinutes: 1440,
      overtimeMinutes: 420,
      totalCents: chileTotal + 150000,
      paidCents: 12999,
      pendingCents: chileTotal + 150000 - 12999,
    })
  })

  it('leaves out the payrolls that start before the range, with all their money (attendance, items and payments)', async () => {
    const { json } = await route('from=2026-10-05&to=2026-10-31')
    // The contract payroll C starts on 01/10, so it is out too.
    expect(json.items).toHaveLength(1)
    expect(json.items[0]).toMatchObject({ name: 'Contenedor Chile', payrollCount: 1, people: 3, totalCents: 13146, paidCents: 9999 })
    expect(json.items[0].payrolls.map((p: { id: string }) => p.id)).toEqual([campaignIds.payrollB])
    expect(json.totals).toMatchObject({ payrollCount: 1, people: 3, totalCents: 13146, paidCents: 9999, pendingCents: 3147 })
  })

  it('has no rows and zero totals when no payroll starts in the range', async () => {
    const { json } = await route('from=2026-12-01&to=2026-12-31')
    expect(json.items).toEqual([])
    expect(json.totals).toEqual({ payrollCount: 0, people: 0, workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, totalCents: 0, paidCents: 0, pendingCents: 0 })
  })
})

describe('by-worker cost report', () => {
  it('has one row per worker by last name, with days, minutes, money and a negative pending amount when overpaid', async () => {
    const { status, json } = await get('by-worker?from=2026-09-28&to=2026-10-31', 'admin', campaignApp)
    expect(status).toBe(200)
    expect(json.items).toEqual([
      {
        workerId: campaignIds.w2, firstName: 'Beto', lastName: 'Huamán', dni: '72000002',
        workedDays: 1, regularMinutes: 480, overtimeMinutes: 140, attendanceCents: 6823, itemsCents: -500,
        totalCents: 6323, paidCents: 9999, pendingCents: -3676,
      },
      {
        workerId: campaignIds.w1, firstName: 'Rosa', lastName: 'Quispe', dni: '72000001',
        workedDays: 2, regularMinutes: 960, overtimeMinutes: 280, attendanceCents: 13646, itemsCents: 2000,
        totalCents: 15646, paidCents: 3000, pendingCents: 12646,
      },
      {
        workerId: campaignIds.w3, firstName: 'Luis', lastName: 'Rojas', dni: '72000003',
        workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0,
        totalCents: 0, paidCents: 0, pendingCents: 0,
      },
      {
        workerId: campaignIds.w4, firstName: 'Ana', lastName: 'Zegarra', dni: '72000004',
        workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 150000,
        totalCents: 150000, paidCents: 0, pendingCents: 150000,
      },
    ])
    expect(json.totals).toEqual({
      people: 4,
      workedDays: 3,
      regularMinutes: 1440,
      overtimeMinutes: 420,
      attendanceCents: 20469,
      itemsCents: 151500,
      totalCents: 171969,
      paidCents: 12999,
      pendingCents: 158970,
    })
  })

  it('has no rows and zero totals when no payroll starts in the range', async () => {
    const { json } = await get('by-worker?from=2026-12-01&to=2026-12-31', 'admin', campaignApp)
    expect(json.items).toEqual([])
    expect(json.totals).toEqual({ people: 0, workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 })
  })
})

describe('range validation', () => {
  it('rejects an end before the start, with the field "to"', async () => {
    for (const route of COST_ROUTES) {
      const { status, json } = await get(`${route}?from=2026-10-11&to=2026-10-01`)
      expect(status).toBe(400)
      expect(json.error).toEqual({ code: 'validation', message: 'La fecha de fin no puede ser anterior a la de inicio', field: 'to' })
    }
  })

  it('accepts a range of 366 days and rejects one of 367', async () => {
    expect((await get('monthly?from=2026-01-01&to=2027-01-01')).status).toBe(200)
    const { status, json } = await get('monthly?from=2026-01-01&to=2027-01-02')
    expect(status).toBe(400)
    expect(json.error).toEqual({ code: 'validation', message: 'El rango no puede pasar de un año', field: 'to' })
  })

  it('rejects a missing or malformed date', async () => {
    const missing = await get('weekly?to=2026-10-11')
    expect(missing.status).toBe(400)
    expect(missing.json.error.field).toBe('from')
    expect((await get('weekly?from=2026-10-01&to=11-10-2026')).status).toBe(400)
  })
})

describe('permissions', () => {
  it('the coordinator gets 403 and management reads', async () => {
    for (const route of COST_ROUTES) {
      const query = `${route}?from=2026-10-01&to=2026-10-11`
      expect((await get(query, 'coordinator')).status).toBe(403)
      expect((await get(query, 'management')).status).toBe(200)
    }
  })

  it('needs a session', async () => {
    expect((await t.request(null, 'GET', '/v1/reports/costs/weekly?from=2026-10-01&to=2026-10-11')).status).toBe(401)
  })
})

function pick(day: typeof FULL_DAY, days: number) {
  return { regularMinutes: day.regularMinutes * days, overtimeMinutes: day.overtimeMinutes * days, attendanceCents: day.cents * days }
}
