import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let production: string
let warehouse: string

// Every full record is 620 minutes at 6.25 per hour: 480 regular, 140 overtime, 6823 cents.
const FULL_DAY = { regularMinutes: 480, overtimeMinutes: 140, cents: 6823 }
const COST_ROUTES = ['weekly', 'monthly', 'by-area'] as const

const createWorker = async (firstName: string, lastName: string, dni: string, positionId: string, areaId?: string) =>
  (await t.request('admin', 'POST', '/v1/workers', { firstName, lastName, dni, employmentType: 'temporary', areaId, positionId }))
    .json.id as string

const createPayroll = async (name: string, startDate: string, endDate: string, workerIds: string[]) =>
  (await t.request('admin', 'POST', '/v1/payrolls', { name, type: 'weekly', startDate, endDate, workers: { workerIds } })).json.id as string

const fullDay = async (payrollId: string, workerId: string, date: string) => {
  for (const [mark, hour] of [
    ['clockIn1', '12:10'],
    ['clockOut1', '18:00'],
    ['clockIn2', '19:00'],
    ['clockOut2', '23:30'],
  ] as const) {
    const { status } = await t.request('admin', 'POST', '/v1/attendance/clock', {
      payrollId,
      workerId,
      date,
      mark,
      at: `${date}T${hour}:00Z`,
    })
    expect(status).toBeLessThan(300)
  }
}

const get = (path: string, role: 'admin' | 'management' | 'coordinator' = 'admin') => t.request(role, 'GET', `/v1/reports/costs/${path}`)

beforeAll(async () => {
  t = await createTestApp()
  production = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  warehouse = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
  const position = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: production })
  const w1 = await createWorker('Rosa', 'Quispe', '72000001', position, production)
  const w2 = await createWorker('Beto', 'Huamán', '72000002', position, warehouse)
  const w3 = await createWorker('Luis', 'Rojas', '72000003', position)
  const payrollA = await createPayroll('Semana 40', '2026-09-28', '2026-10-04', [w1, w2, w3])
  const payrollB = await createPayroll('Semana 41', '2026-10-05', '2026-10-11', [w1, w2, w3])

  await fullDay(payrollA, w1, '2026-10-02')
  await fullDay(payrollB, w1, '2026-10-06')
  await fullDay(payrollB, w2, '2026-10-06')
  const absence = await t.request('admin', 'POST', '/v1/attendance', { payrollId: payrollB, workerId: w3, date: '2026-10-07', type: 'absence' })
  expect(absence.status).toBe(201)

  const item = async (payrollId: string, workerId: string, type: string, amountCents: number) =>
    expect((await t.request('admin', 'POST', '/v1/payroll-items', { payrollId, workerId, type, amountCents })).status).toBe(201)
  await item(payrollA, w1, 'bonus', 2000)
  await item(payrollB, w2, 'deduction', 500)
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
