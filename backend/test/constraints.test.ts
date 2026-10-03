import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { attendanceRecords, payments, payrollItems, payrolls } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

// These tests insert straight into the tables: the API already respects the rules, the database must too.
let t: Awaited<ReturnType<typeof createTestApp>>
let payrollId: string
let member: string
let outsider: string

const attendance = (workerId: string, extra: Partial<typeof attendanceRecords.$inferInsert> = {}) =>
  t.db.insert(attendanceRecords).values({
    workerId,
    date: '2026-10-05',
    payrollId,
    employmentType: 'temporary',
    recordedBy: USERS.admin,
    ...extra,
  })

const item = (workerId: string, extra: Partial<typeof payrollItems.$inferInsert> = {}) =>
  t.db.insert(payrollItems).values({ payrollId, workerId, type: 'bonus', amountCents: 1000, recordedBy: USERS.admin, ...extra })

const payment = (workerId: string, extra: Partial<typeof payments.$inferInsert> = {}) =>
  t.db.insert(payments).values({ payrollId, workerId, date: '2026-10-09', amountCents: 5000, method: 'cash', recordedBy: USERS.admin, ...extra })

beforeAll(async () => {
  t = await createTestApp()
  const area = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  const position = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id
  const worker = async (firstName: string, dni: string) =>
    (await t.request('admin', 'POST', '/v1/workers', { firstName, lastName: 'Prueba', dni, employmentType: 'temporary', areaId: area, positionId: position }))
      .json.id as string
  member = await worker('Ana', '70000001')
  outsider = await worker('Beto', '70000002')
  payrollId = (
    await t.request('admin', 'POST', '/v1/payrolls', {
      name: 'Semana 41',
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      workers: { workerIds: [member] },
    })
  ).json.id
})

describe('attendance records', () => {
  it('only belong to a worker of the payroll', async () => {
    await expect(attendance(outsider)).rejects.toThrow()
  })

  it('cannot hold negative minutes or amounts', async () => {
    await expect(attendance(member, { amountCents: -1 })).rejects.toThrow()
    await expect(attendance(member, { workedMinutes: -1 })).rejects.toThrow()
  })
})

describe('payroll items', () => {
  it('only belong to a worker of the payroll', async () => {
    await expect(item(outsider)).rejects.toThrow()
  })

  it('have a positive amount', async () => {
    await expect(item(member, { amountCents: 0 })).rejects.toThrow()
  })

  it('allow one salary per worker and payroll, and any number of the other types', async () => {
    await item(member, { type: 'salary', amountCents: 150000 })
    await expect(item(member, { type: 'salary', amountCents: 150000 })).rejects.toThrow()
    await item(member, { type: 'bonus' })
    await item(member, { type: 'bonus' })
  })
})

describe('payments', () => {
  it('only belong to a worker of the payroll', async () => {
    await expect(payment(outsider)).rejects.toThrow()
  })

  it('have a positive amount', async () => {
    await expect(payment(member, { amountCents: 0 })).rejects.toThrow()
  })

  it('cannot share an evidence file, but may have none', async () => {
    const evidencePath = `payrolls/${payrollId}/${member}/44444444-4444-4444-8444-444444444444.jpg`
    await payment(member, { evidencePath })
    await expect(payment(member, { evidencePath })).rejects.toThrow()
    await payment(member)
    await payment(member)
  })
})

describe('payrolls', () => {
  it('cannot end before they start', async () => {
    await expect(t.db.update(payrolls).set({ endDate: '2026-10-04' }).where(eq(payrolls.id, payrollId))).rejects.toThrow()
  })
})

describe('valid rows', () => {
  it('are accepted: a bonus and a payment of a worker of the payroll', async () => {
    await item(member, { type: 'bonus', amountCents: 2500, note: 'Puntualidad' })
    await payment(member, { amountCents: 2500, method: 'yape', methodDetail: '987654321 · Titular: Ana Prueba' })
    const stored = await t.db.select().from(payments).where(eq(payments.workerId, member))
    expect(stored.length).toBeGreaterThan(0)
  })
})
