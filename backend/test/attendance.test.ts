import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, userAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaProduction: string
let areaStorage: string
// Last names decide the order of the daily list: noRate (Alvarez), other (Barrios), staff (Mendoza), temp (Zapata).
let temp: string
let noRate: string
let staff: string
let other: string
let week: string
let week2: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'
const DEFAULT_NOW = new Date('2026-10-05T13:00:00Z')

async function createWorker(firstName: string, lastName: string, dni: string, employmentType: string, areaId: string, positionId?: string) {
  const r = await t.request('admin', 'POST', '/v1/workers', { firstName, lastName, dni, employmentType, areaId, positionId })
  return r.json.id as string
}

const createPayroll = async (name: string, workerIds: string[]) =>
  (
    await t.request('admin', 'POST', '/v1/payrolls', {
      name,
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      workers: { workerIds },
    })
  ).json.id as string

// Times are UTC instants: Lima is five hours behind, so 07:10 in Lima is 12:10Z.
const clock = (role: 'admin' | 'accounting' | 'management' | 'coordinator', workerId: string, date: string, mark: string, at?: string, payrollId = week) =>
  t.request(role, 'POST', '/v1/attendance/clock', { payrollId, workerId, date, mark, ...(at ? { at } : {}) })

const auditRows = (recordId: string) =>
  t.db.select().from(auditLog).where(and(eq(auditLog.entity, 'attendance_records'), eq(auditLog.entityId, recordId)))

beforeAll(async () => {
  t = await createTestApp()
  areaProduction = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  areaStorage = (await t.request('admin', 'POST', '/v1/areas', { name: 'Almacén' })).json.id
  const operario = (
    await t.request('admin', 'POST', '/v1/positions', {
      name: 'Operario',
      payType: 'hourly',
      hourlyRate: 6.25,
      overtimeRate: 7.8125,
    })
  ).json.id
  const supervisor = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Supervisor', payType: 'monthly', monthlySalary: 1800 })
  ).json.id
  temp = await createWorker('Ana', 'Zapata', '70000001', 'temporary', areaProduction, operario)
  noRate = await createWorker('Beto', 'Alvarez', '70000002', 'temporary', areaProduction)
  staff = await createWorker('Carla', 'Mendoza', '70000003', 'contract', areaProduction, supervisor)
  other = await createWorker('Diego', 'Barrios', '70000004', 'temporary', areaStorage, operario)
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: areaProduction })
  week = await createPayroll('Semana asistencia', [temp, noRate, staff, other])
  week2 = await createPayroll('Misma semana', [temp])
})

describe('attendance: clock marks', () => {
  it('the first clock-in creates the record with the position rates and is audited', async () => {
    const r = await clock('admin', temp, '2026-10-05', 'clockIn1', '2026-10-05T12:10:00Z')
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({
      workerId: temp,
      payrollId: week,
      date: '2026-10-05',
      type: 'worked',
      clockIn1: '2026-10-05T12:10:00.000Z',
      clockOut1: null,
      hourlyRate: 6.25,
      overtimeRate: 7.8125,
      employmentType: 'temporary',
      areaId: areaProduction,
      workedMinutes: 0,
      amountCents: 0,
      needsReview: false,
      recordedBy: USERS.admin,
    })
    const rows = await auditRows(r.json.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
  })

  it('the four marks of the spec example give 620 worked minutes, 140 of overtime and 6823 cents', async () => {
    const date = '2026-10-06'
    const first = await clock('admin', temp, date, 'clockIn1', '2026-10-06T12:10:00Z')
    expect((await clock('admin', temp, date, 'clockOut1', '2026-10-06T18:00:00Z')).status).toBe(200)
    expect((await clock('accounting', temp, date, 'clockIn2', '2026-10-06T19:00:00Z')).status).toBe(200)
    const last = await clock('admin', temp, date, 'clockOut2', '2026-10-06T23:30:00Z')
    expect(last.status).toBe(200)
    expect(last.json).toMatchObject({ workedMinutes: 620, regularMinutes: 480, overtimeMinutes: 140, amountCents: 6823 })
    const actions = (await auditRows(first.json.id)).map((row) => row.action).sort()
    expect(actions).toEqual(['create', 'update', 'update', 'update'])
  })

  it('repeating a mark that already has a time answers 200 with the same record and writes nothing', async () => {
    const first = await clock('admin', temp, '2026-10-08', 'clockIn1', '2026-10-08T12:10:00Z')
    expect(first.status).toBe(201)
    const again = await clock('admin', temp, '2026-10-08', 'clockIn1', '2026-10-08T12:40:00Z')
    expect(again.status).toBe(200)
    expect(again.json).toEqual(first.json)
    expect(await auditRows(first.json.id)).toHaveLength(1)
  })

  it('a mark without the previous one answers 409 out_of_order', async () => {
    const noRecord = await clock('admin', temp, '2026-10-09', 'clockOut1', '2026-10-09T18:00:00Z')
    expect(noRecord.status).toBe(409)
    expect(noRecord.json.error.code).toBe('out_of_order')

    const skipped = await clock('admin', other, '2026-10-09', 'clockIn1', '2026-10-09T12:00:00Z')
    expect(skipped.status).toBe(201)
    const r = await clock('admin', other, '2026-10-09', 'clockIn2', '2026-10-09T19:00:00Z')
    expect(r.status).toBe(409)
    expect(r.json.error).toMatchObject({ code: 'out_of_order', message: 'Falta la marca anterior' })
  })

  it('a clock-in that falls on another Lima day than the date answers 400 on the field at', async () => {
    const r = await clock('admin', noRate, '2026-10-05', 'clockIn1', '2026-10-06T12:00:00Z')
    expect(r.status).toBe(400)
    expect(r.json.error).toMatchObject({
      code: 'validation',
      message: 'La hora de ingreso no corresponde a ese día',
      field: 'at',
    })
  })

  it('an exit before the previous mark, or more than a day after the clock-in, answers 400', async () => {
    const date = '2026-10-10'
    expect((await clock('admin', temp, date, 'clockIn1', '2026-10-10T12:00:00Z')).status).toBe(201)
    const before = await clock('admin', temp, date, 'clockOut1', '2026-10-10T11:00:00Z')
    expect(before.status).toBe(400)
    expect(before.json.error).toMatchObject({
      code: 'validation',
      message: 'La hora no puede ser anterior a la marca previa',
      field: 'at',
    })
    const late = await clock('admin', temp, date, 'clockOut1', '2026-10-11T12:01:00Z')
    expect(late.status).toBe(400)
    expect(late.json.error).toMatchObject({
      code: 'validation',
      message: 'La hora está a más de un día del ingreso',
      field: 'at',
    })
    // Exactly 24 hours is still accepted.
    expect((await clock('admin', temp, date, 'clockOut1', '2026-10-11T12:00:00Z')).status).toBe(200)
  })

  it('a night shift keeps the date of the clock-in', async () => {
    // 19:00 of the 5th in Lima is already the 6th in UTC.
    const night = await clock('admin', staff, '2026-10-05', 'clockIn1', '2026-10-06T00:00:00Z')
    expect(night.status).toBe(201)
    expect(night.json.date).toBe('2026-10-05')
    const out = await clock('admin', staff, '2026-10-05', 'clockOut1', '2026-10-06T09:00:00Z')
    expect(out.status).toBe(200)
    expect(out.json).toMatchObject({ date: '2026-10-05', workedMinutes: 540 })
  })

  it('without at it uses the injected clock', async () => {
    t.setNow(new Date('2026-10-07T12:30:00Z'))
    try {
      const r = await clock('admin', other, '2026-10-07', 'clockIn1')
      expect(r.status).toBe(201)
      expect(r.json.clockIn1).toBe('2026-10-07T12:30:00.000Z')
    } finally {
      t.setNow(DEFAULT_NOW)
    }
  })

  it('a temporary worker without a position starts with zero rates and needs review; contract staff does not', async () => {
    const noPosition = await clock('admin', noRate, '2026-10-06', 'clockIn1', '2026-10-06T12:00:00Z')
    expect(noPosition.status).toBe(201)
    expect(noPosition.json).toMatchObject({ hourlyRate: 0, overtimeRate: 0, needsReview: true, employmentType: 'temporary' })

    const date = '2026-10-06'
    const first = await clock('admin', staff, date, 'clockIn1', '2026-10-06T12:10:00Z')
    expect(first.json).toMatchObject({ hourlyRate: 0, overtimeRate: 0, needsReview: false, employmentType: 'contract' })
    await clock('admin', staff, date, 'clockOut1', '2026-10-06T18:00:00Z')
    await clock('admin', staff, date, 'clockIn2', '2026-10-06T19:00:00Z')
    const last = await clock('admin', staff, date, 'clockOut2', '2026-10-06T23:30:00Z')
    expect(last.json).toMatchObject({ amountCents: 0, workedMinutes: 620 })
  })

  it('a date outside the payroll answers 400 on the field date; a worker who is not in it answers not_in_payroll', async () => {
    const outside = await clock('admin', temp, '2026-10-12', 'clockIn1', '2026-10-12T12:00:00Z')
    expect(outside.status).toBe(400)
    expect(outside.json.error).toMatchObject({
      code: 'validation',
      message: 'La fecha no está dentro de la planilla',
      field: 'date',
    })

    const notIn = await clock('admin', noRate, '2026-10-05', 'clockIn1', '2026-10-05T12:00:00Z', week2)
    expect(notIn.status).toBe(400)
    expect(notIn.json.error).toMatchObject({ code: 'not_in_payroll', message: 'El trabajador no está en esta planilla' })
  })

  it('a worker who already has a record that day in another payroll answers 409 other_payroll', async () => {
    const r = await clock('admin', temp, '2026-10-05', 'clockOut1', '2026-10-05T18:00:00Z', week2)
    expect(r.status).toBe(409)
    expect(r.json.error).toMatchObject({
      code: 'other_payroll',
      message: 'El trabajador ya tiene un registro ese día en otra planilla',
    })
  })

  it('an unknown payroll answers 404', async () => {
    const r = await clock('admin', temp, '2026-10-05', 'clockIn1', '2026-10-05T12:00:00Z', MISSING_ID)
    expect(r.status).toBe(404)
  })

  it('management gets 403; the coordinator marks their area without seeing money and gets 404 for another area', async () => {
    const denied = await clock('management', temp, '2026-10-11', 'clockIn1', '2026-10-11T12:00:00Z')
    expect(denied.status).toBe(403)
    expect(denied.json.error.code).toBe('forbidden')

    const own = await clock('coordinator', temp, '2026-10-11', 'clockIn1', '2026-10-11T12:00:00Z')
    expect(own.status).toBe(201)
    expect(own.json).toMatchObject({ hourlyRate: null, overtimeRate: null, amountCents: null, workedMinutes: 0 })
    expect(own.json.recordedBy).toBe(USERS.coordinator)

    const outsideArea = await clock('coordinator', other, '2026-10-11', 'clockIn1', '2026-10-11T12:00:00Z')
    expect(outsideArea.status).toBe(404)
  })

  it('validates the body', async () => {
    const r = await t.request('admin', 'POST', '/v1/attendance/clock', {
      payrollId: week,
      workerId: temp,
      date: '2026-10-05',
      mark: 'lunch',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    const noZone = await clock('admin', temp, '2026-10-05', 'clockIn1', '2026-10-05T12:00:00')
    expect(noZone.status).toBe(400)
  })
})

describe('attendance: the day list', () => {
  const list = (role: 'admin' | 'coordinator' | 'management', query: string) => t.request(role, 'GET', `/v1/attendance?${query}`)

  it('returns every worker of the payroll by last name, with the record of the day or null', async () => {
    const r = await list('admin', `payrollId=${week}&date=2026-10-06`)
    expect(r.status).toBe(200)
    expect(r.json.items.map((i: { worker: { lastName: string } }) => i.worker.lastName)).toEqual(['Alvarez', 'Barrios', 'Mendoza', 'Zapata'])
    expect(r.json.items[0].worker).toEqual({ id: noRate, firstName: 'Beto', lastName: 'Alvarez', dni: '70000002', areaId: areaProduction })
    const byWorker = Object.fromEntries(r.json.items.map((i: { worker: { id: string }; record: unknown }) => [i.worker.id, i.record]))
    expect(byWorker[other]).toBeNull()
    expect(byWorker[temp]).toMatchObject({ date: '2026-10-06', workedMinutes: 620, amountCents: 6823 })
    expect(byWorker[staff]).toMatchObject({ date: '2026-10-06', amountCents: 0 })
    expect(byWorker[noRate]).toMatchObject({ date: '2026-10-06', needsReview: true })
  })

  it('filters by area', async () => {
    const r = await list('admin', `payrollId=${week}&date=2026-10-06&areaId=${areaStorage}`)
    expect(r.status).toBe(200)
    expect(r.json.items).toHaveLength(1)
    expect(r.json.items[0].worker.id).toBe(other)
    expect(r.json.items[0].record).toBeNull()
  })

  it('shows the coordinator only the workers of their areas, without money', async () => {
    const r = await list('coordinator', `payrollId=${week}&date=2026-10-06`)
    expect(r.status).toBe(200)
    expect(r.json.items.map((i: { worker: { id: string } }) => i.worker.id)).toEqual([noRate, staff, temp])
    for (const item of r.json.items) {
      expect(item.record).toMatchObject({ hourlyRate: null, overtimeRate: null, amountCents: null })
    }
    const own = r.json.items.find((i: { worker: { id: string } }) => i.worker.id === temp)
    expect(own.record.workedMinutes).toBe(620)
  })

  it('management can read it', async () => {
    expect((await list('management', `payrollId=${week}&date=2026-10-06`)).status).toBe(200)
  })

  it('a date outside the payroll answers 400; an unknown payroll answers 404; a bad query answers 400', async () => {
    const outside = await list('admin', `payrollId=${week}&date=2026-10-12`)
    expect(outside.status).toBe(400)
    expect(outside.json.error).toMatchObject({ code: 'validation', field: 'date' })
    expect((await list('admin', `payrollId=${MISSING_ID}&date=2026-10-06`)).status).toBe(404)
    expect((await list('admin', `payrollId=${week}`)).status).toBe(400)
  })
})

describe('attendance: rules of payrolls that need records', () => {
  it('moving the start date past a record answers 409 records_outside_range', async () => {
    const r = await t.request('admin', 'PATCH', `/v1/payrolls/${week}`, { startDate: '2026-10-06' })
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('records_outside_range')
    const unchanged = await t.request('admin', 'GET', `/v1/payrolls/${week}`)
    expect(unchanged.json.startDate).toBe('2026-10-05')
  })

  it('removing a worker who has records answers 409 has_records', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/payrolls/${week}/workers/${temp}`)
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('has_records')
  })

  it('the payroll list returns the total in cents to the administrator and null to the coordinator', async () => {
    const admin = await t.request('admin', 'GET', '/v1/payrolls?search=Semana asistencia')
    expect(admin.status).toBe(200)
    const row = admin.json.items.find((p: { id: string }) => p.id === week)
    // Only two records of this payroll have an amount at this point: the spec example of the 6th (6823 cents) and
    // the 24-hour stretch of the 10th (480 min × 6.25 + 960 min × 7.8125 per hour = 17500 cents). The describes
    // that create more records come after this one, so the sum is fixed.
    expect(row.totalCents).toBe(6823 + 17500)

    const coordinator = await t.request('coordinator', 'GET', '/v1/payrolls?search=Semana asistencia')
    expect(coordinator.json.items.find((p: { id: string }) => p.id === week).totalCents).toBeNull()
  })

  it('the payroll detail returns the records with money for the administrator and without it for the coordinator', async () => {
    const admin = await t.request('admin', 'GET', `/v1/payrolls/${week}`)
    expect(admin.status).toBe(200)
    const adminRecord = admin.json.records.find((r: { workerId: string; date: string }) => r.workerId === temp && r.date === '2026-10-06')
    expect(adminRecord).toMatchObject({ hourlyRate: 6.25, overtimeRate: 7.8125, amountCents: 6823, workedMinutes: 620 })

    const coordinator = await t.request('coordinator', 'GET', `/v1/payrolls/${week}`)
    expect(coordinator.status).toBe(200)
    const coordinatorRecord = coordinator.json.records.find((r: { workerId: string; date: string }) => r.workerId === temp && r.date === '2026-10-06')
    expect(coordinatorRecord).toMatchObject({ hourlyRate: null, overtimeRate: null, amountCents: null, workedMinutes: 620 })
    // The coordinator does not get the records of workers outside their areas.
    expect(coordinator.json.records.some((r: { workerId: string }) => r.workerId === other)).toBe(false)
  })
})
