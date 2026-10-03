import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let w1: string // in the payroll, with a record, a bonus and a payment
let w2: string // temporary, outside the payroll
let payroll: string
let recordId: string
let itemId: string
let paymentId: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'
const NOW = '2026-10-05T13:00:00.000Z'

const auditRows = (entity: string, entityId: string) =>
  t.db.select().from(auditLog).where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))

const close = (role: 'admin' | 'accounting' | 'management' | 'coordinator', body: unknown = {}, id = payroll) =>
  t.request(role, 'POST', `/v1/payrolls/${id}/close`, body)
const reopen = (role: 'admin' | 'accounting' | 'management' | 'coordinator', id = payroll) =>
  t.request(role, 'POST', `/v1/payrolls/${id}/reopen`)

async function createWorker(firstName: string, lastName: string, dni: string, areaId: string, positionId: string) {
  const r = await t.request('admin', 'POST', '/v1/workers', {
    firstName,
    lastName,
    dni,
    employmentType: 'temporary',
    areaId,
    positionId,
  })
  return r.json.id as string
}

beforeAll(async () => {
  t = await createTestApp()
  const area = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id as string
  const operario = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id as string
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: area })
  w1 = await createWorker('Rosa', 'Quispe', '72000001', area, operario)
  w2 = await createWorker('Beto', 'Alvarez', '72000002', area, operario)
  payroll = (
    await t.request('admin', 'POST', '/v1/payrolls', {
      name: 'Semana 41',
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      workers: { workerIds: [w1] },
    })
  ).json.id
  // The spec example day: 6823 cents.
  const record = await t.request('admin', 'POST', '/v1/attendance', {
    payrollId: payroll,
    workerId: w1,
    date: '2026-10-05',
    type: 'worked',
    clockIn1: '07:10',
    clockOut1: '13:00',
    clockIn2: '14:00',
    clockOut2: '18:30',
  })
  expect(record.json.amountCents).toBe(6823)
  recordId = record.json.id
  const item = await t.request('admin', 'POST', '/v1/payroll-items', { payrollId: payroll, workerId: w1, type: 'bonus', amountCents: 2000 })
  itemId = item.json.id
  const payment = await t.request('admin', 'POST', '/v1/payments', {
    payrollId: payroll,
    workerId: w1,
    date: '2026-10-05',
    amountCents: 5000,
    method: 'cash',
  })
  paymentId = payment.json.id
})

describe('closing a payroll', () => {
  it('only the administrator and accounting close, and only the administrator reopens', async () => {
    for (const role of ['management', 'coordinator'] as const) {
      const r = await close(role)
      expect(r.status).toBe(403)
      expect(r.json.error.code).toBe('forbidden')
    }
    for (const role of ['accounting', 'management', 'coordinator'] as const) {
      const r = await reopen(role)
      expect(r.status).toBe(403)
      expect(r.json.error.code).toBe('forbidden')
    }
  })

  it('a pending balance asks for confirmation and the payroll stays open', async () => {
    const r = await close('admin', {})
    expect(r.status).toBe(409)
    expect(r.json.error).toMatchObject({
      code: 'pending_balances',
      message: 'Hay trabajadores con saldo pendiente; confirma el cierre',
    })
    const balances = await t.request('admin', 'GET', `/v1/payrolls/${payroll}/balances`)
    expect(balances.json.items[0].pendingCents).toBe(3823)
    expect((await t.request('admin', 'GET', `/v1/payrolls/${payroll}`)).json.status).toBe('open')
  })

  it('reopening an open payroll is not_closed', async () => {
    const r = await reopen('admin')
    expect(r.status).toBe(409)
    expect(r.json.error).toMatchObject({ code: 'not_closed', message: 'La planilla no está cerrada' })
  })

  it('accounting closes it with the confirmation, and it is audited', async () => {
    const r = await close('accounting', { confirmPending: true })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id: payroll, status: 'closed', closedBy: USERS.accounting, closedAt: NOW })
    const updates = (await auditRows('payrolls', payroll)).filter((row) => row.action === 'update')
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ userId: USERS.accounting })
    expect(updates[0].before).toMatchObject({ status: 'open', closedBy: null })
    expect(updates[0].after).toMatchObject({ status: 'closed', closedBy: USERS.accounting })
  })

  it('closing it again is payroll_closed', async () => {
    const r = await close('admin', { confirmPending: true })
    expect(r.status).toBe(409)
    expect(r.json.error).toMatchObject({ code: 'payroll_closed', message: 'La planilla está cerrada' })
  })

  describe('a closed payroll rejects every write', () => {
    const writes: [string, () => ReturnType<typeof t.request>][] = [
      ['POST /v1/attendance/clock', () =>
        t.request('admin', 'POST', '/v1/attendance/clock', { payrollId: payroll, workerId: w1, date: '2026-10-06', mark: 'clockIn1' })],
      ['POST /v1/attendance', () =>
        t.request('admin', 'POST', '/v1/attendance', { payrollId: payroll, workerId: w1, date: '2026-10-06', type: 'absence' })],
      ['PATCH /v1/attendance/:record', () => t.request('admin', 'PATCH', `/v1/attendance/${recordId}`, { note: 'Cambio' })],
      ['DELETE /v1/attendance/:record', () => t.request('admin', 'DELETE', `/v1/attendance/${recordId}`)],
      ['PATCH /v1/payrolls/:id', () => t.request('admin', 'PATCH', `/v1/payrolls/${payroll}`, { name: 'Otro nombre' })],
      ['POST /v1/payrolls/:id/workers', () =>
        t.request('admin', 'POST', `/v1/payrolls/${payroll}/workers`, { workerIds: [w2] })],
      ['DELETE /v1/payrolls/:id/workers/:w1', () => t.request('admin', 'DELETE', `/v1/payrolls/${payroll}/workers/${w1}`)],
      ['POST /v1/payroll-items', () =>
        t.request('admin', 'POST', '/v1/payroll-items', { payrollId: payroll, workerId: w1, type: 'bonus', amountCents: 100 })],
      ['PATCH /v1/payroll-items/:item', () => t.request('admin', 'PATCH', `/v1/payroll-items/${itemId}`, { amountCents: 2500 })],
      ['DELETE /v1/payroll-items/:item', () => t.request('admin', 'DELETE', `/v1/payroll-items/${itemId}`)],
      ['POST /v1/payments', () =>
        t.request('admin', 'POST', '/v1/payments', { payrollId: payroll, workerId: w1, date: '2026-10-05', amountCents: 100, method: 'cash' })],
      ['DELETE /v1/payments/:payment', () => t.request('admin', 'DELETE', `/v1/payments/${paymentId}`)],
      ['POST /v1/evidence/upload-url', () =>
        t.request('admin', 'POST', '/v1/evidence/upload-url', {
          payrollId: payroll,
          workerId: w1,
          contentType: 'image/jpeg',
          sizeBytes: 300_000,
        })],
    ]

    it.each(writes)('%s answers 409 payroll_closed', async (_name, send) => {
      const r = await send()
      expect(r.status).toBe(409)
      expect(r.json.error.code).toBe('payroll_closed')
    })

    it('the bulk clock answers 200 with payroll_closed for the worker', async () => {
      const r = await t.request('admin', 'POST', '/v1/attendance/bulk', {
        payrollId: payroll,
        date: '2026-10-06',
        mark: 'clockIn1',
        workerIds: [w1],
      })
      expect(r.status).toBe(200)
      expect(r.json.results[0]).toMatchObject({ workerId: w1, ok: false, code: 'payroll_closed' })
    })
  })

  it('the reads of a closed payroll still answer 200', async () => {
    const paths = [
      `/v1/payrolls/${payroll}`,
      `/v1/payrolls/${payroll}/balances`,
      `/v1/payrolls/${payroll}/workers/${w1}`,
      `/v1/attendance?payrollId=${payroll}&date=2026-10-05`,
      `/v1/payroll-items?payrollId=${payroll}`,
      `/v1/payments?payrollId=${payroll}`,
    ]
    for (const path of paths) {
      const r = await t.request('admin', 'GET', path)
      expect(r.status, path).toBe(200)
    }
  })

  it('the administrator reopens it, it is audited, and a new payment is accepted again', async () => {
    const r = await reopen('admin')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ id: payroll, status: 'open', closedBy: null, closedAt: null })
    const updates = (await auditRows('payrolls', payroll)).filter((row) => row.action === 'update')
    expect(updates).toHaveLength(2)
    const last = updates.find((row) => (row.after as { status: string }).status === 'open')
    expect(last).toMatchObject({ userId: USERS.admin })
    expect(last?.before).toMatchObject({ status: 'closed', closedBy: USERS.accounting })

    const payment = await t.request('admin', 'POST', '/v1/payments', {
      payrollId: payroll,
      workerId: w1,
      date: '2026-10-05',
      amountCents: 100,
      method: 'cash',
    })
    expect(payment.status).toBe(201)
  })

  it('with nothing pending, it closes without asking for confirmation', async () => {
    const balances = await t.request('admin', 'GET', `/v1/payrolls/${payroll}/balances`)
    const pending = balances.json.items[0].pendingCents as number
    expect(pending).toBe(3723)
    const payment = await t.request('admin', 'POST', '/v1/payments', {
      payrollId: payroll,
      workerId: w1,
      date: '2026-10-05',
      amountCents: pending,
      method: 'cash',
    })
    expect(payment.status).toBe(201)
    const r = await close('admin', {})
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ status: 'closed', closedBy: USERS.admin, closedAt: NOW })
  })

  it('a payroll that does not exist is 404 on close and on reopen', async () => {
    expect((await close('admin', {}, MISSING_ID)).status).toBe(404)
    expect((await reopen('admin', MISSING_ID)).status).toBe(404)
  })
})
