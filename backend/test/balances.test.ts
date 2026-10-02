import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let w1: string // Quispe: attendance, a bonus, a deduction and a payment in A; a bonus in B
let w2: string // Huamán: only a payment in A
let payrollA: string
let payrollB: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'
const TODAY = '2026-10-05T13:00:00Z'

const createWorker = async (firstName: string, lastName: string, dni: string, areaId: string, positionId: string) =>
  (await t.request('admin', 'POST', '/v1/workers', { firstName, lastName, dni, employmentType: 'temporary', areaId, positionId }))
    .json.id as string

const createPayroll = async (name: string, startDate: string, endDate: string, workerIds: string[]) =>
  (await t.request('admin', 'POST', '/v1/payrolls', { name, type: 'weekly', startDate, endDate, workers: { workerIds } })).json.id as string

beforeAll(async () => {
  t = await createTestApp()
  const area = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  const operario = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: area })
  w1 = await createWorker('Rosa', 'Quispe', '72000001', area, operario)
  w2 = await createWorker('Beto', 'Huamán', '72000002', area, operario)
  payrollA = await createPayroll('Semana 41', '2026-10-05', '2026-10-11', [w1, w2])
  payrollB = await createPayroll('Semana 39', '2026-09-21', '2026-09-27', [w1])

  // 620 minutes at 6.25 per hour: 6823 cents.
  for (const [mark, at] of [
    ['clockIn1', '2026-10-05T12:10:00Z'],
    ['clockOut1', '2026-10-05T18:00:00Z'],
    ['clockIn2', '2026-10-05T19:00:00Z'],
    ['clockOut2', '2026-10-05T23:30:00Z'],
  ]) {
    await t.request('admin', 'POST', '/v1/attendance/clock', { payrollId: payrollA, workerId: w1, date: '2026-10-05', mark, at })
  }
  const item = (payrollId: string, workerId: string, type: string, amountCents: number) =>
    t.request('admin', 'POST', '/v1/payroll-items', { payrollId, workerId, type, amountCents })
  await item(payrollA, w1, 'bonus', 2000)
  await item(payrollA, w1, 'deduction', 1000)
  await item(payrollB, w1, 'bonus', 4000)
  const pay = (workerId: string, amountCents: number) =>
    t.request('admin', 'POST', '/v1/payments', { payrollId: payrollA, workerId, date: '2026-10-05', amountCents, method: 'cash' })
  await pay(w1, 5000)
  await pay(w2, 3000)
})

describe('balances of a payroll', () => {
  it('returns one balance per worker in surname order, with the totals', async () => {
    const { status, json } = await t.request('admin', 'GET', `/v1/payrolls/${payrollA}/balances`)
    expect(status).toBe(200)
    expect(json.items.map((b: { workerId: string }) => b.workerId)).toEqual([w2, w1])
    expect(json.items[1]).toEqual({
      workerId: w1,
      attendanceCents: 6823,
      additionsCents: 2000,
      deductionsCents: 1000,
      totalCents: 7823,
      paidCents: 5000,
      pendingCents: 2823,
    })
    expect(json.items[0].pendingCents).toBe(-3000)
    expect(json.totals).toEqual({
      attendanceCents: 6823,
      additionsCents: 2000,
      deductionsCents: 1000,
      totalCents: 7823,
      paidCents: 8000,
      pendingCents: -177,
    })
  })

  it('management reads them; the coordinator gets 403; a missing payroll is 404', async () => {
    expect((await t.request('management', 'GET', `/v1/payrolls/${payrollA}/balances`)).status).toBe(200)
    expect((await t.request('coordinator', 'GET', `/v1/payrolls/${payrollA}/balances`)).status).toBe(403)
    const missing = await t.request('admin', 'GET', `/v1/payrolls/${MISSING_ID}/balances`)
    expect(missing.status).toBe(404)
    expect(missing.json.error.code).toBe('not_found')
  })
})

describe('payroll list totals', () => {
  const rowOf = (json: { items: { id: string }[] }, id: string) => json.items.find((row) => row.id === id)

  it('adds the items, the payments and the pending amount to every row', async () => {
    const { json } = await t.request('admin', 'GET', '/v1/payrolls')
    expect(rowOf(json, payrollA)).toMatchObject({ totalCents: 7823, paidCents: 8000, pendingCents: -177 })
    expect(rowOf(json, payrollB)).toMatchObject({ totalCents: 4000, paidCents: 0, pendingCents: 4000 })
  })

  it('the coordinator receives null amounts', async () => {
    const { status, json } = await t.request('coordinator', 'GET', '/v1/payrolls')
    expect(status).toBe(200)
    expect(rowOf(json, payrollA)).toMatchObject({ totalCents: null, paidCents: null, pendingCents: null })
    expect(rowOf(json, payrollB)).toMatchObject({ totalCents: null, paidCents: null, pendingCents: null })
  })
})

describe('summary', () => {
  it('adds the pending amount of the open payrolls, counts those to pay and sums the payments of the month', async () => {
    const { status, json } = await t.request('admin', 'GET', '/v1/payrolls/summary')
    expect(status).toBe(200)
    expect(json).toEqual({ pendingCents: 3823, toPayCount: 1, paidThisMonthCents: 8000 })
  })

  it('follows the clock', async () => {
    t.setNow(new Date('2026-11-02T13:00:00Z'))
    try {
      const { json } = await t.request('admin', 'GET', '/v1/payrolls/summary')
      expect(json.toPayCount).toBe(2)
      expect(json.paidThisMonthCents).toBe(0)
    } finally {
      t.setNow(new Date(TODAY))
    }
  })

  it('management reads it; the coordinator gets 403', async () => {
    expect((await t.request('management', 'GET', '/v1/payrolls/summary')).status).toBe(200)
    expect((await t.request('coordinator', 'GET', '/v1/payrolls/summary')).status).toBe(403)
  })
})

describe('receipt of a worker in a payroll', () => {
  it('returns the payroll, the worker, the movements and the balance', async () => {
    const { status, json } = await t.request('accounting', 'GET', `/v1/payrolls/${payrollA}/workers/${w1}`)
    expect(status).toBe(200)
    expect(json.payroll).toMatchObject({ id: payrollA, name: 'Semana 41', type: 'weekly', status: 'open' })
    expect(json.worker).toMatchObject({ id: w1, firstName: 'Rosa', lastName: 'Quispe', positionName: 'Operario' })
    expect(json.records).toHaveLength(1)
    expect(json.items).toHaveLength(2)
    expect(json.payments).toHaveLength(1)
    expect(json.balance).toMatchObject({ workerId: w1, pendingCents: 2823 })
    expect(Array.isArray(json.paymentMethods)).toBe(true)
  })

  it('answers 404 for a worker outside the payroll or a missing payroll, and 403 for the coordinator', async () => {
    const outside = await t.request('admin', 'GET', `/v1/payrolls/${payrollB}/workers/${w2}`)
    expect(outside.status).toBe(404)
    expect(outside.json.error.message).toBe('El trabajador no está en la planilla')
    expect((await t.request('admin', 'GET', `/v1/payrolls/${MISSING_ID}/workers/${w1}`)).status).toBe(404)
    expect((await t.request('coordinator', 'GET', `/v1/payrolls/${payrollA}/workers/${w1}`)).status).toBe(403)
  })
})

describe('payroll history of a worker', () => {
  it('lists the payrolls of the worker, the latest first, with their amounts', async () => {
    const { status, json } = await t.request('admin', 'GET', `/v1/workers/${w1}/payrolls`)
    expect(status).toBe(200)
    expect(json.total).toBe(2)
    expect(json.items).toHaveLength(2)
    expect(json.items[0]).toEqual({
      payrollId: payrollA,
      name: 'Semana 41',
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      status: 'open',
      totalCents: 7823,
      paidCents: 5000,
      pendingCents: 2823,
    })
    expect(json.items[1]).toMatchObject({ payrollId: payrollB, totalCents: 4000, paidCents: 0, pendingCents: 4000 })
  })

  it('paginates', async () => {
    const { json } = await t.request('admin', 'GET', `/v1/workers/${w1}/payrolls?pageSize=1`)
    expect(json.items).toHaveLength(1)
    expect(json.total).toBe(2)
  })

  it('answers 404 for a missing worker and 403 for the coordinator', async () => {
    expect((await t.request('admin', 'GET', `/v1/workers/${MISSING_ID}/payrolls`)).status).toBe(404)
    expect((await t.request('coordinator', 'GET', `/v1/workers/${w1}/payrolls`)).status).toBe(403)
  })
})
