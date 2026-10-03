import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, payrolls, userAreas } from '../src/db/schema.js'
import { createTestApp, USERS } from './helpers.js'

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

describe('attendance: full records, edits, deletion and bulk marks', () => {
  type Role = 'admin' | 'accounting' | 'management' | 'coordinator'
  // Its own payroll, in November, so that none of the records above gets in the way.
  let full: string
  // A worker that only the tests that need a free day use.
  let spare: string

  const post = (role: Role, body: Record<string, unknown>) =>
    t.request(role, 'POST', '/v1/attendance', { payrollId: full, ...body })
  const patch = (role: Role, id: string, body: Record<string, unknown>) =>
    t.request(role, 'PATCH', `/v1/attendance/${id}`, body)
  const remove = (role: Role, id: string) => t.request(role, 'DELETE', `/v1/attendance/${id}`)
  const bulk = (role: Role, body: Record<string, unknown>) =>
    t.request(role, 'POST', '/v1/attendance/bulk', { payrollId: full, ...body })
  // The spec example: 07:10 to 13:00 and 14:00 to 18:30 in Lima.
  const SPEC_DAY = { clockIn1: '07:10', clockOut1: '13:00', clockIn2: '14:00', clockOut2: '18:30' }

  beforeAll(async () => {
    spare = await createWorker('Zeta', 'Lopez', '70000008', 'temporary', areaProduction)
    const r = await t.request('admin', 'POST', '/v1/payrolls', {
      name: 'Semana completa',
      type: 'weekly',
      startDate: '2026-11-02',
      endDate: '2026-11-08',
      workers: { workerIds: [temp, noRate, staff, other, spare] },
    })
    full = r.json.id
  })

  describe('POST /v1/attendance', () => {
    it('an absence is created without hours and with zero minutes and amount', async () => {
      const r = await post('admin', { workerId: temp, date: '2026-11-02', type: 'absence', note: 'Sin aviso' })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({
        workerId: temp,
        payrollId: full,
        date: '2026-11-02',
        type: 'absence',
        clockIn1: null,
        clockOut1: null,
        clockIn2: null,
        clockOut2: null,
        workedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        amountCents: 0,
        note: 'Sin aviso',
        hourlyRate: 6.25,
        areaId: areaProduction,
        recordedBy: USERS.admin,
      })
      const rows = await auditRows(r.json.id)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
    })

    it('the four hours of the spec example are stored as Lima instants and give 620 / 480 / 140 / 6823', async () => {
      const r = await post('accounting', { workerId: temp, date: '2026-11-03', ...SPEC_DAY })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({
        type: 'worked',
        clockIn1: '2026-11-03T12:10:00.000Z',
        clockOut1: '2026-11-03T18:00:00.000Z',
        clockIn2: '2026-11-03T19:00:00.000Z',
        clockOut2: '2026-11-03T23:30:00.000Z',
        workedMinutes: 620,
        regularMinutes: 480,
        overtimeMinutes: 140,
        overtimeEdited: false,
        amountCents: 6823,
        recordedBy: USERS.accounting,
      })
    })

    it('without type or hours it is a worked day with nothing counted yet', async () => {
      const r = await post('admin', { workerId: staff, date: '2026-11-08' })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({ type: 'worked', clockIn1: null, workedMinutes: 0, amountCents: 0, needsReview: false })
    })

    it('a night shift stores the exit on the next day', async () => {
      const r = await post('admin', { workerId: other, date: '2026-11-04', clockIn1: '19:00', clockOut1: '04:00' })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({
        date: '2026-11-04',
        clockIn1: '2026-11-05T00:00:00.000Z',
        clockOut1: '2026-11-05T09:00:00.000Z',
        workedMinutes: 540,
      })
    })

    it('a second record of the same worker and day answers 409 duplicate; one from another payroll answers other_payroll', async () => {
      const absence = await post('admin', { workerId: noRate, date: '2026-11-04', type: 'absence' })
      expect(absence.status).toBe(201)
      // Only a worked day of a temporary worker without a rate is flagged by itself.
      expect(absence.json.needsReview).toBe(false)
      const again = await post('admin', { workerId: noRate, date: '2026-11-04', clockIn1: '07:00' })
      expect(again.status).toBe(409)
      expect(again.json.error).toMatchObject({
        code: 'duplicate',
        message: 'Ya existe un registro de ese trabajador ese día',
      })
      // temp already has a record on 2026-10-05 in the payroll of that week.
      const elsewhere = await t.request('admin', 'POST', '/v1/attendance', {
        payrollId: week2,
        workerId: temp,
        date: '2026-10-05',
        clockIn1: '07:00',
      })
      expect(elsewhere.status).toBe(409)
      expect(elsewhere.json.error.code).toBe('other_payroll')
    })

    it('hours with a type that is not worked, or with a gap, or lasting more than a day, answer 400', async () => {
      const leave = await post('admin', { workerId: staff, date: '2026-11-03', type: 'leave', clockIn1: '07:00' })
      expect(leave.status).toBe(400)
      expect(leave.json.error).toMatchObject({ code: 'validation', message: 'Una falta o un permiso no lleva horas' })

      const gap = await post('admin', { workerId: noRate, date: '2026-11-02', clockIn1: '07:00', clockIn2: '14:00' })
      expect(gap.status).toBe(400)
      expect(gap.json.error).toMatchObject({
        code: 'validation',
        message: 'Completa las marcas en orden',
        field: 'clockOut1',
      })
      const noFirst = await post('admin', { workerId: noRate, date: '2026-11-02', clockOut1: '15:00' })
      expect(noFirst.json.error).toMatchObject({ message: 'Completa las marcas en orden', field: 'clockIn1' })

      // 19:00, then 04:00 of the next day, then 03:00: the last one would be two days after the first.
      const tooLong = await post('admin', {
        workerId: noRate,
        date: '2026-11-02',
        clockIn1: '19:00',
        clockOut1: '04:00',
        clockIn2: '03:00',
      })
      expect(tooLong.status).toBe(400)
      expect(tooLong.json.error).toMatchObject({ code: 'validation', message: 'El registro no puede durar más de un día' })

      const badTime = await post('admin', { workerId: noRate, date: '2026-11-02', clockIn1: '7:00' })
      expect(badTime.status).toBe(400)
      expect(badTime.json.error).toMatchObject({ code: 'validation', field: 'clockIn1' })
      // None of them left a record behind.
      const day = await t.request('admin', 'GET', `/v1/attendance?payrollId=${full}&date=2026-11-02`)
      const noRateDay = day.json.items.find((i: { worker: { id: string } }) => i.worker.id === noRate)
      expect(noRateDay.record).toBeNull()
    })

    it('applies the preconditions of a clock mark', async () => {
      const outside = await post('admin', { workerId: temp, date: '2026-11-09' })
      expect(outside.status).toBe(400)
      expect(outside.json.error).toMatchObject({ code: 'validation', field: 'date' })
      const notIn = await t.request('admin', 'POST', '/v1/attendance', { payrollId: week2, workerId: noRate, date: '2026-10-07' })
      expect(notIn.status).toBe(400)
      expect(notIn.json.error.code).toBe('not_in_payroll')
      expect((await post('admin', { workerId: MISSING_ID, date: '2026-11-03' })).status).toBe(404)
      expect((await t.request('admin', 'POST', '/v1/attendance', { payrollId: MISSING_ID, workerId: temp, date: '2026-11-03' })).status).toBe(404)
    })

    it('the administrator can send the rates and the review flag; a record without a rate needs review', async () => {
      const r = await post('admin', {
        workerId: staff,
        date: '2026-11-07',
        ...SPEC_DAY,
        hourlyRate: 10,
        overtimeRate: 12.5,
        needsReview: true,
      })
      expect(r.status).toBe(201)
      // A contract worker is not paid by the day, whatever the rates say.
      expect(r.json).toMatchObject({ hourlyRate: 10, overtimeRate: 12.5, needsReview: true, amountCents: 0, workedMinutes: 620 })
      const noRateRecord = await post('admin', { workerId: noRate, date: '2026-11-05', clockIn1: '07:00' })
      expect(noRateRecord.json).toMatchObject({ hourlyRate: 0, needsReview: true })
      // An explicit value wins over the automatic rule, in both directions.
      const unflagged = await post('accounting', { workerId: spare, date: '2026-11-08', clockIn1: '07:00', needsReview: false })
      expect(unflagged.json).toMatchObject({ hourlyRate: 0, needsReview: false })
      const flaggedAbsence = await post('admin', { workerId: spare, date: '2026-11-07', type: 'absence', needsReview: true })
      expect(flaggedAbsence.json.needsReview).toBe(true)
      expect((await remove('admin', flaggedAbsence.json.id)).status).toBe(200)
    })
  })

  describe('PATCH /v1/attendance/:id', () => {
    it('setting the overtime by hand marks it as edited; null goes back to the suggested one', async () => {
      const created = await post('admin', { workerId: other, date: '2026-11-05', ...SPEC_DAY })
      expect(created.json).toMatchObject({ overtimeMinutes: 140, overtimeEdited: false })
      const id = created.json.id

      const byHand = await patch('admin', id, { overtimeMinutes: 0 })
      expect(byHand.status).toBe(200)
      expect(byHand.json).toMatchObject({
        overtimeEdited: true,
        workedMinutes: 620,
        regularMinutes: 620,
        overtimeMinutes: 0,
        amountCents: 6458,
        // The hours that were not sent keep their value.
        clockIn1: '2026-11-05T12:10:00.000Z',
        clockOut2: '2026-11-05T23:30:00.000Z',
      })

      const suggested = await patch('admin', id, { overtimeMinutes: null })
      expect(suggested.json).toMatchObject({ overtimeEdited: false, regularMinutes: 480, overtimeMinutes: 140, amountCents: 6823 })
    })

    it('overtime above the worked minutes is rejected and nothing is saved', async () => {
      const created = await post('admin', { workerId: other, date: '2026-11-02', clockIn1: '07:00', clockOut1: '12:00' })
      const r = await patch('admin', created.json.id, { overtimeMinutes: 1000 })
      expect(r.status).toBe(400)
      expect(r.json.error).toMatchObject({
        code: 'validation',
        message: 'Las horas extra no pueden superar las horas trabajadas',
        field: 'overtimeMinutes',
      })
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((x: { id: string }) => x.id === created.json.id)).toEqual(created.json)
    })

    it('editing one hour keeps the others, and the new rates recalculate the amount and are audited', async () => {
      const created = await post('admin', { workerId: noRate, date: '2026-11-03', clockIn1: '07:10', clockOut1: '13:00', clockIn2: '14:00' })
      expect(created.json).toMatchObject({ workedMinutes: 350, amountCents: 0 })
      const id = created.json.id

      const hours = await patch('accounting', id, { clockOut2: '18:30' })
      expect(hours.status).toBe(200)
      expect(hours.json).toMatchObject({
        clockIn1: '2026-11-03T12:10:00.000Z',
        clockOut1: '2026-11-03T18:00:00.000Z',
        clockIn2: '2026-11-03T19:00:00.000Z',
        clockOut2: '2026-11-03T23:30:00.000Z',
        workedMinutes: 620,
      })

      const rates = await patch('admin', id, { hourlyRate: 10, overtimeRate: 12.5 })
      expect(rates.status).toBe(200)
      // 480 min × 10 ÷ 60 = 80.00 and 140 min × 12.5 ÷ 60 = 29.17.
      expect(rates.json).toMatchObject({ hourlyRate: 10, overtimeRate: 12.5, amountCents: 10917 })
      const updates = (await auditRows(id)).filter((row) => row.action === 'update')
      expect(updates).toHaveLength(2)
      const last = updates.find((row) => (row.after as { hourlyRate: number }).hourlyRate === 10)
      expect(last?.before).toMatchObject({ hourlyRate: 0, amountCents: 0 })
      expect(last?.after).toMatchObject({ hourlyRate: 10, overtimeRate: 12.5, amountCents: 10917 })
    })

    it('a time earlier than the one before it moves to the next day when it is edited', async () => {
      const created = await post('admin', { workerId: staff, date: '2026-11-04', clockIn1: '19:00' })
      const r = await patch('admin', created.json.id, { clockOut1: '04:00' })
      expect(r.json).toMatchObject({ clockOut1: '2026-11-05T09:00:00.000Z', workedMinutes: 540 })
    })

    it('editing one hour keeps the stored instant of the others: a 24-hour stretch is not collapsed', async () => {
      // Exactly 24 hours between the entry and the exit: both have the same wall-clock time in Lima.
      const created = await clock('admin', other, '2026-11-03', 'clockIn1', '2026-11-03T12:00:00Z', full)
      expect(created.status).toBe(201)
      const out = await clock('admin', other, '2026-11-03', 'clockOut1', '2026-11-04T12:00:00Z', full)
      expect(out.json).toMatchObject({ workedMinutes: 1440, amountCents: 17500 })
      const id = created.json.id

      for (const body of [{ note: 'x', clockIn1: '07:00' }, { clockOut2: null }]) {
        const r = await patch('admin', id, body)
        expect(r.status).toBe(200)
        expect(r.json).toMatchObject({
          clockIn1: '2026-11-03T12:00:00.000Z',
          clockOut1: '2026-11-04T12:00:00.000Z',
          workedMinutes: 1440,
          amountCents: 17500,
        })
      }
    })

    it('on a night shift, editing only the exit keeps the entry and editing only the entry keeps the exit', async () => {
      const created = await post('admin', { workerId: spare, date: '2026-11-03', clockIn1: '19:00', clockOut1: '04:00' })
      expect(created.json).toMatchObject({ clockOut1: '2026-11-04T09:00:00.000Z', workedMinutes: 540 })
      const id = created.json.id

      const exit = await patch('admin', id, { clockOut1: '05:00' })
      expect(exit.json).toMatchObject({
        clockIn1: '2026-11-04T00:00:00.000Z',
        clockOut1: '2026-11-04T10:00:00.000Z',
        workedMinutes: 600,
      })
      // The stored exit (05:00 of the next day) is not moved when only the entry changes.
      const entry = await patch('admin', id, { clockIn1: '20:00' })
      expect(entry.json).toMatchObject({
        clockIn1: '2026-11-04T01:00:00.000Z',
        clockOut1: '2026-11-04T10:00:00.000Z',
        workedMinutes: 540,
      })
    })

    it('an entry edited to a time after the stored exit of the same day answers 400 on the exit and saves nothing', async () => {
      const created = await post('admin', { workerId: spare, date: '2026-11-07', clockIn1: '08:00', clockOut1: '12:00' })
      const id = created.json.id
      const r = await patch('admin', id, { clockIn1: '13:00' })
      expect(r.status).toBe(400)
      expect(r.json.error).toMatchObject({
        code: 'validation',
        message: 'La hora no puede ser anterior a la marca previa',
        field: 'clockOut1',
      })
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((x: { id: string }) => x.id === id)).toEqual(created.json)
    })

    it('a worked day turned into an absence loses its hours and its amount', async () => {
      const created = await post('admin', { workerId: staff, date: '2026-11-02', ...SPEC_DAY })
      expect(created.json.workedMinutes).toBe(620)
      const r = await patch('admin', created.json.id, { type: 'absence' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({
        type: 'absence',
        clockIn1: null,
        clockOut1: null,
        clockIn2: null,
        clockOut2: null,
        workedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        overtimeEdited: false,
        amountCents: 0,
      })
      // An absence cannot be given hours again without saying it is worked.
      const withHours = await patch('admin', created.json.id, { clockIn1: '07:00' })
      expect(withHours.status).toBe(400)
      expect(withHours.json.error.message).toBe('Una falta o un permiso no lleva horas')
      const worked = await patch('admin', created.json.id, { type: 'worked', clockIn1: '07:00', clockOut1: '15:00' })
      expect(worked.json).toMatchObject({ type: 'worked', workedMinutes: 480 })
    })

    it('a hand-set overtime is kept by a later clock mark', async () => {
      const created = await post('admin', { workerId: other, date: '2026-11-07', clockIn1: '07:00', clockOut1: '12:00' })
      const id = created.json.id
      const set = await patch('admin', id, { overtimeMinutes: 30 })
      expect(set.json).toMatchObject({ overtimeEdited: true, overtimeMinutes: 30, regularMinutes: 270 })
      expect((await clock('admin', other, '2026-11-07', 'clockIn2', '2026-11-07T18:00:00Z', full)).status).toBe(200)
      const last = await clock('admin', other, '2026-11-07', 'clockOut2', '2026-11-08T01:00:00Z', full)
      expect(last.status).toBe(200)
      // 300 + 420 = 720 worked: the suggested overtime would be 240, the one set by hand stays.
      expect(last.json).toMatchObject({ workedMinutes: 720, overtimeEdited: true, overtimeMinutes: 30, regularMinutes: 690 })
    })

    it('rejects the same errors as POST: gaps, hours on an absence, a stretch of more than a day', async () => {
      const created = await post('admin', { workerId: temp, date: '2026-11-05', clockIn1: '07:00', clockOut1: '12:00' })
      const id = created.json.id
      const gap = await patch('admin', id, { clockOut1: null, clockIn2: '14:00' })
      expect(gap.status).toBe(400)
      expect(gap.json.error).toMatchObject({ message: 'Completa las marcas en orden', field: 'clockOut1' })
      const noFirst = await patch('admin', id, { clockIn1: null })
      expect(noFirst.json.error).toMatchObject({ message: 'Completa las marcas en orden', field: 'clockIn1' })
      const tooLong = await patch('admin', id, { clockIn2: '01:00', clockOut2: '00:00' })
      expect(tooLong.status).toBe(400)
      expect(tooLong.json.error.message).toBe('El registro no puede durar más de un día')
      const absence = await patch('admin', id, { type: 'leave', clockOut1: '13:00' })
      expect(absence.status).toBe(400)
      expect(absence.json.error.message).toBe('Una falta o un permiso no lleva horas')
      // Nothing was saved.
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((r: { id: string }) => r.id === id)).toMatchObject({ type: 'worked', workedMinutes: 300 })
    })

    it('an empty body, a bad value or an unknown record answers 400 or 404', async () => {
      const created = await post('admin', { workerId: spare, date: '2026-11-02', type: 'absence' })
      expect((await patch('admin', created.json.id, {})).status).toBe(400)
      expect((await patch('admin', created.json.id, { hourlyRate: -1 })).status).toBe(400)
      expect((await patch('admin', created.json.id, { hourlyRate: 100000 })).status).toBe(400)
      expect((await patch('admin', created.json.id, { overtimeMinutes: 1.5 })).status).toBe(400)
      const missing = await patch('admin', MISSING_ID, { note: 'x' })
      expect(missing.status).toBe(404)
      expect(missing.json.error).toMatchObject({ code: 'not_found', message: 'El registro no existe' })
      expect((await patch('admin', 'not-an-id', { note: 'x' })).status).toBe(400)
    })
  })

  describe('permissions', () => {
    it('the coordinator corrects the hours of their area without receiving money', async () => {
      const created = await post('admin', { workerId: temp, date: '2026-11-06', clockIn1: '07:00' })
      const id = created.json.id
      const r = await patch('coordinator', id, { clockOut1: '16:00', note: 'Salió tarde' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ workedMinutes: 540, note: 'Salió tarde', hourlyRate: null, overtimeRate: null, amountCents: null })
      // The amount is calculated on the server all the same.
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((x: { id: string }) => x.id === id).amountCents).toBe(5781)

      const own = await post('coordinator', { workerId: staff, date: '2026-11-06', clockIn1: '07:00', clockOut1: '15:00' })
      expect(own.status).toBe(201)
      expect(own.json).toMatchObject({ workedMinutes: 480, hourlyRate: null, overtimeRate: null, amountCents: null, recordedBy: USERS.coordinator })
    })

    it('the coordinator who sends rates or the review flag gets 403 and nothing is saved', async () => {
      const created = await post('admin', { workerId: noRate, date: '2026-11-06', clockIn1: '07:00' })
      const id = created.json.id
      for (const body of [{ hourlyRate: 10 }, { overtimeRate: 12 }, { needsReview: false }]) {
        const r = await patch('coordinator', id, { clockOut1: '12:00', ...body })
        expect(r.status).toBe(403)
        expect(r.json.error).toMatchObject({ code: 'forbidden', message: 'Tu rol no permite cambiar tarifas' })
      }
      const post403 = await post('coordinator', { workerId: noRate, date: '2026-11-07', hourlyRate: 10 })
      expect(post403.status).toBe(403)
      expect(post403.json.error).toMatchObject({ code: 'forbidden', message: 'Tu rol no permite cambiar tarifas' })
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((r: { id: string }) => r.id === id)).toMatchObject({ clockOut1: null, hourlyRate: 0, needsReview: true })
      expect(detail.json.records.some((r: { workerId: string; date: string }) => r.workerId === noRate && r.date === '2026-11-07')).toBe(false)
    })

    it('the coordinator does not reach a record, or a worker, of another area', async () => {
      const created = await post('admin', { workerId: other, date: '2026-11-06', clockIn1: '07:00' })
      const id = created.json.id
      const edit = await patch('coordinator', id, { clockOut1: '12:00' })
      expect(edit.status).toBe(404)
      expect(edit.json.error).toMatchObject({ code: 'not_found', message: 'El registro no existe' })
      expect((await remove('coordinator', id)).status).toBe(404)
      expect((await post('coordinator', { workerId: other, date: '2026-11-03' })).status).toBe(404)
      // The record is still there.
      const detail = await t.request('admin', 'GET', `/v1/payrolls/${full}`)
      expect(detail.json.records.find((r: { id: string }) => r.id === id)).toMatchObject({ clockOut1: null })
    })

    it('management cannot create, edit or delete', async () => {
      const created = await post('admin', { workerId: spare, date: '2026-11-05', type: 'absence' })
      const denied = [
        await post('management', { workerId: staff, date: '2026-11-03' }),
        await patch('management', created.json.id, { note: 'x' }),
        await remove('management', created.json.id),
        await bulk('management', { date: '2026-11-03', mark: 'clockIn1', workerIds: [staff] }),
      ]
      for (const r of denied) {
        expect(r.status).toBe(403)
        expect(r.json.error.code).toBe('forbidden')
      }
    })
  })

  describe('DELETE /v1/attendance/:id', () => {
    it('removes the record and audits the deleted one; a second delete or an unknown id answers 404', async () => {
      const created = await post('admin', { workerId: noRate, date: '2026-11-07', ...SPEC_DAY })
      const id = created.json.id
      const r = await remove('accounting', id)
      expect(r.status).toBe(200)
      expect(r.json).toEqual({ ok: true })
      const rows = await auditRows(id)
      expect(rows.map((row) => row.action).sort()).toEqual(['create', 'delete'])
      const deleted = rows.find((row) => row.action === 'delete')
      expect(deleted?.before).toMatchObject({ id, workerId: noRate, date: '2026-11-07', workedMinutes: 620 })
      expect(deleted?.userId).toBe(USERS.accounting)

      expect((await remove('admin', id)).status).toBe(404)
      const missing = await remove('admin', MISSING_ID)
      expect(missing.status).toBe(404)
      expect(missing.json.error.message).toBe('El registro no existe')
      expect((await remove('admin', 'not-an-id')).status).toBe(400)
      // The day can be recorded again.
      expect((await post('admin', { workerId: noRate, date: '2026-11-07', type: 'absence' })).status).toBe(201)
    })
  })

  describe('POST /v1/attendance/bulk', () => {
    const CLOCK_IN = { mark: 'clockIn1', at: '2026-11-08T12:00:00Z' }

    it('marks every worker it can and reports the ones it cannot, in the order requested', async () => {
      const r = await bulk('admin', { date: '2026-11-08', ...CLOCK_IN, workerIds: [temp, other, MISSING_ID] })
      expect(r.status).toBe(200)
      expect(r.json.results).toHaveLength(3)
      expect(r.json.results[0]).toMatchObject({
        workerId: temp,
        ok: true,
        record: { workerId: temp, date: '2026-11-08', clockIn1: '2026-11-08T12:00:00.000Z', hourlyRate: 6.25 },
      })
      expect(r.json.results[1]).toMatchObject({ workerId: other, ok: true, record: { workerId: other } })
      expect(r.json.results[2]).toEqual({
        workerId: MISSING_ID,
        ok: false,
        code: 'not_found',
        message: 'El trabajador no existe',
      })
      const day = await t.request('admin', 'GET', `/v1/attendance?payrollId=${full}&date=2026-11-08`)
      const marked = day.json.items.filter((i: { record: unknown }) => i.record !== null).map((i: { worker: { id: string } }) => i.worker.id)
      // The unknown id left nothing behind; noRate was not asked for.
      expect(marked).toContain(temp)
      expect(marked).toContain(other)
      expect(marked).not.toContain(noRate)
    })

    it('a worker that fails does not stop the others: a repeated mark and a worker outside the payroll', async () => {
      const outsider = await createWorker('Eva', 'Quispe', '70000009', 'temporary', areaProduction)
      const r = await bulk('accounting', { date: '2026-11-03', ...CLOCK_IN, at: '2026-11-03T12:00:00Z', workerIds: [temp, outsider, noRate, staff] })
      expect(r.status).toBe(200)
      const byWorker = Object.fromEntries(r.json.results.map((x: { workerId: string }) => [x.workerId, x]))
      // temp already has the full day of the 3rd: its mark is answered as it is.
      expect(byWorker[temp]).toMatchObject({ ok: true, record: { clockIn1: '2026-11-03T12:10:00.000Z' } })
      expect(byWorker[outsider]).toMatchObject({ ok: false, code: 'not_in_payroll', message: 'El trabajador no está en esta planilla' })
      // noRate was edited into a full day on the 3rd as well.
      expect(byWorker[noRate].ok).toBe(true)
      expect(r.json.results.map((x: { workerId: string }) => x.workerId)).toEqual([temp, outsider, noRate, staff])
    })

    it('a worker with an absence that day answers not_worked and the others are marked', async () => {
      // temp has an absence on 2026-11-02; noRate has no record that day.
      const r = await bulk('admin', { date: '2026-11-02', mark: 'clockIn1', at: '2026-11-02T12:00:00Z', workerIds: [temp, noRate] })
      expect(r.status).toBe(200)
      expect(r.json.results[0]).toMatchObject({ workerId: temp, ok: false, code: 'not_worked' })
      expect(r.json.results[1]).toMatchObject({ workerId: noRate, ok: true, record: { clockIn1: '2026-11-02T12:00:00.000Z' } })
    })

    it('the same worker twice gets two results, both ok, with one record and one mark', async () => {
      const r = await bulk('admin', { date: '2026-11-06', mark: 'clockIn1', at: '2026-11-06T12:00:00Z', workerIds: [spare, spare] })
      expect(r.status).toBe(200)
      expect(r.json.results).toHaveLength(2)
      expect(r.json.results.every((x: { workerId: string; ok: boolean }) => x.workerId === spare && x.ok)).toBe(true)
      expect(r.json.results[1].record).toEqual(r.json.results[0].record)
      expect(await auditRows(r.json.results[0].record.id)).toHaveLength(1)
    })

    it('for the coordinator it leaves out the workers of other areas and sends no money', async () => {
      const r = await bulk('coordinator', { date: '2026-11-07', mark: 'clockIn1', at: '2026-11-07T13:00:00Z', workerIds: [temp, other] })
      expect(r.status).toBe(200)
      expect(r.json.results[0]).toMatchObject({
        workerId: temp,
        ok: true,
        record: { workerId: temp, hourlyRate: null, overtimeRate: null, amountCents: null },
      })
      expect(r.json.results[1]).toMatchObject({ workerId: other, ok: false, code: 'not_found' })
      expect(r.json.results[1].record).toBeUndefined()
    })

    it('repeating it answers ok for the ones that already had the mark and changes nothing', async () => {
      const body = { date: '2026-11-04', mark: 'clockIn1', workerIds: [temp, spare] }
      const first = await bulk('admin', { ...body, at: '2026-11-04T12:00:00Z' })
      expect(first.json.results.every((x: { ok: boolean }) => x.ok)).toBe(true)
      const second = await bulk('admin', { ...body, at: '2026-11-04T12:30:00Z' })
      expect(second.status).toBe(200)
      expect(second.json.results).toEqual(first.json.results)
      for (const result of first.json.results) expect(await auditRows(result.record.id)).toHaveLength(1)
    })

    it('uses the injected clock without at, and validates the body', async () => {
      t.setNow(new Date('2026-11-05T13:15:00Z'))
      try {
        const r = await bulk('admin', { date: '2026-11-05', mark: 'clockIn1', workerIds: [staff] })
        expect(r.json.results[0].record.clockIn1).toBe('2026-11-05T13:15:00.000Z')
      } finally {
        t.setNow(DEFAULT_NOW)
      }
      expect((await bulk('admin', { date: '2026-11-05', mark: 'clockIn1', workerIds: [] })).status).toBe(400)
      expect((await bulk('admin', { date: '2026-11-05', mark: 'clockIn1', workerIds: Array(301).fill(temp) })).status).toBe(400)
      expect((await bulk('admin', { date: '2026-11-05', mark: 'lunch', workerIds: [temp] })).status).toBe(400)
      expect((await bulk('admin', { date: '2026-11-05', mark: 'clockIn1', workerIds: ['x'] })).status).toBe(400)
    })
  })
})

const SPEC_DAY_FIXES = { clockIn1: '07:10', clockOut1: '13:00', clockIn2: '14:00', clockOut2: '18:30' }

describe('attendance: edit path fixes of the final review', () => {
  type Role = 'admin' | 'accounting' | 'management' | 'coordinator'
  let fixes: string
  let paid: string
  let unpaid: string
  let paidSecond: string

  const post = (role: Role, body: Record<string, unknown>) =>
    t.request(role, 'POST', '/v1/attendance', { payrollId: fixes, ...body })
  const patch = (role: Role, id: string, body: Record<string, unknown>) =>
    t.request(role, 'PATCH', `/v1/attendance/${id}`, body)
  const at = (role: Role, workerId: string, date: string, mark: string, instant?: string) =>
    clock(role, workerId, date, mark, instant, fixes)
  const detail = async (id: string) =>
    (await t.request('admin', 'GET', `/v1/payrolls/${fixes}`)).json.records.find((r: { id: string }) => r.id === id)

  beforeAll(async () => {
    const position = (
      await t.request('admin', 'POST', '/v1/positions', {
        name: 'Operario revisión final',
        payType: 'hourly',
        hourlyRate: 6.25,
        overtimeRate: 7.8125,
      })
    ).json.id
    paid = await createWorker('Hugo', 'Ibarra', '70000011', 'temporary', areaProduction, position)
    paidSecond = await createWorker('Irma', 'Jara', '70000012', 'temporary', areaProduction, position)
    unpaid = await createWorker('Julio', 'Kuno', '70000013', 'temporary', areaProduction)
    fixes = (
      await t.request('admin', 'POST', '/v1/payrolls', {
        name: 'Revisión final',
        type: 'weekly',
        startDate: '2026-12-07',
        endDate: '2026-12-13',
        workers: { workerIds: [paid, paidSecond, unpaid] },
      })
    ).json.id
  })

  describe('clock marks are stored by the minute', () => {
    it('a mark with seconds is stored at the start of its minute, whatever its source', async () => {
      const first = await at('admin', paid, '2026-12-07', 'clockIn1', '2026-12-07T12:10:45Z')
      expect(first.json.clockIn1).toBe('2026-12-07T12:10:00.000Z')
      const second = await at('admin', paid, '2026-12-07', 'clockOut1', '2026-12-07T18:00:59.999Z')
      expect(second.json.clockOut1).toBe('2026-12-07T18:00:00.000Z')
      const bulk = await t.request('admin', 'POST', '/v1/attendance/bulk', {
        payrollId: fixes,
        date: '2026-12-07',
        mark: 'clockIn1',
        at: '2026-12-07T12:20:30Z',
        workerIds: [paidSecond],
      })
      expect(bulk.json.results[0].record.clockIn1).toBe('2026-12-07T12:20:00.000Z')
      t.setNow(new Date('2026-12-08T12:05:40Z'))
      try {
        const injected = await at('admin', paid, '2026-12-08', 'clockIn1')
        expect(injected.json.clockIn1).toBe('2026-12-08T12:05:00.000Z')
      } finally {
        t.setNow(DEFAULT_NOW)
      }
    })

    it('editing the exit to the same minute as the stored clock-in gives zero minutes, not a whole day', async () => {
      const first = await at('admin', paid, '2026-12-09', 'clockIn1', '2026-12-09T12:10:45Z')
      const r = await patch('admin', first.json.id, { clockOut1: '07:10' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ workedMinutes: 0, amountCents: 0 })
      expect(first.json.clockIn1).toBe('2026-12-09T12:10:00.000Z')
      expect(r.json.clockOut1).toBe('2026-12-09T12:10:00.000Z')
    })

    it('an entry edited to the minute of the stored exit is accepted', async () => {
      await at('admin', paid, '2026-12-10', 'clockIn1', '2026-12-10T12:00:00Z')
      const out = await at('admin', paid, '2026-12-10', 'clockOut1', '2026-12-10T18:00:20Z')
      const r = await patch('admin', out.json.id, { clockIn2: '13:00' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ clockIn2: '2026-12-10T18:00:00.000Z', workedMinutes: 360 })
      expect(out.json.clockOut1).toBe('2026-12-10T18:00:00.000Z')
    })
  })

  describe('needsReview on edit', () => {
    it('an absence turned into a worked day of a temporary worker without a rate is flagged; an explicit value wins', async () => {
      const created = await post('admin', { workerId: unpaid, date: '2026-12-07', type: 'absence' })
      expect(created.json.needsReview).toBe(false)
      const r = await patch('coordinator', created.json.id, { type: 'worked', clockIn1: '07:00', clockOut1: '15:00' })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ workedMinutes: 480, needsReview: true })
      expect(await detail(created.json.id)).toMatchObject({ amountCents: 0, needsReview: true })
      // The flag is never cleared by itself, and an explicit value from accounting wins over the rule.
      expect((await patch('coordinator', created.json.id, { note: 'x' })).json.needsReview).toBe(true)
      const cleared = await patch('accounting', created.json.id, { needsReview: false })
      expect(cleared.json.needsReview).toBe(false)
    })
  })

  describe('overtime above the hours worked', () => {
    it('a POST that sends overtime above the worked minutes answers 400 and saves nothing', async () => {
      const r = await post('admin', { workerId: paid, date: '2026-12-11', clockIn1: '07:00', overtimeMinutes: 120 })
      expect(r.status).toBe(400)
      expect(r.json.error).toMatchObject({
        code: 'validation',
        message: 'Las horas extra no pueden superar las horas trabajadas',
        field: 'overtimeMinutes',
      })
      const day = await t.request('admin', 'GET', `/v1/attendance?payrollId=${fixes}&date=2026-12-11`)
      expect(day.json.items.find((i: { worker: { id: string } }) => i.worker.id === paid).record).toBeNull()
    })

    it('overtime equal to the worked minutes is accepted', async () => {
      const r = await post('admin', { workerId: paid, date: '2026-12-11', clockIn1: '07:00', clockOut1: '09:00', overtimeMinutes: 120 })
      expect(r.status).toBe(201)
      expect(r.json).toMatchObject({ workedMinutes: 120, overtimeMinutes: 120, overtimeEdited: true })
    })

    it('a hand-set overtime that no longer fits the hours is dropped when the day is edited', async () => {
      const created = await post('admin', { workerId: paidSecond, date: '2026-12-09', ...SPEC_DAY_FIXES })
      const fixed = await patch('admin', created.json.id, { overtimeMinutes: 100 })
      expect(fixed.json).toMatchObject({ workedMinutes: 620, overtimeMinutes: 100, overtimeEdited: true })
      const r = await patch('admin', created.json.id, { clockOut1: '08:10', clockIn2: null, clockOut2: null })
      expect(r.status).toBe(200)
      expect(r.json).toMatchObject({ workedMinutes: 60, overtimeMinutes: 0, regularMinutes: 60, overtimeEdited: false })
    })

    it('a hand-set overtime of zero is kept by a later clock mark', async () => {
      const created = await post('admin', { workerId: paidSecond, date: '2026-12-10', clockIn1: '07:00', clockOut1: '12:00' })
      const fixed = await patch('admin', created.json.id, { overtimeMinutes: 0 })
      expect(fixed.json).toMatchObject({ overtimeEdited: true, overtimeMinutes: 0 })
      await at('admin', paidSecond, '2026-12-10', 'clockIn2', '2026-12-10T18:00:00Z')
      const last = await at('admin', paidSecond, '2026-12-10', 'clockOut2', '2026-12-11T01:00:00Z')
      expect(last.json).toMatchObject({ workedMinutes: 720, overtimeEdited: true, overtimeMinutes: 0, regularMinutes: 720 })
    })
  })
})

describe('attendance: audit only what changed', () => {
  it('a PATCH whose resulting record equals the stored one answers 200 and writes no audit row', async () => {
    const payrollId = await createPayroll('Sin cambios', [temp])
    const created = await t.request('admin', 'POST', '/v1/attendance', {
      payrollId,
      workerId: temp,
      date: '2026-10-07',
      clockIn1: '07:00',
      clockOut1: '15:00',
      note: 'Igual',
    })
    expect(created.status).toBe(201)
    const id = created.json.id
    const r = await t.request('admin', 'PATCH', `/v1/attendance/${id}`, {
      clockIn1: '07:00',
      clockOut1: '15:00',
      note: 'Igual',
      hourlyRate: 6.25,
      overtimeMinutes: null,
    })
    expect(r.status).toBe(200)
    expect(r.json).toEqual(created.json)
    expect(await auditRows(id)).toHaveLength(1)
    // A real change is still audited.
    expect((await t.request('admin', 'PATCH', `/v1/attendance/${id}`, { note: 'Distinto' })).status).toBe(200)
    expect(await auditRows(id)).toHaveLength(2)
  })
})

describe('attendance: a closed payroll', () => {
  it('rejects every write with 409 payroll_closed and still answers the reads', async () => {
    const payrollId = await createPayroll('Cerrada', [temp, noRate])
    const created = await t.request('admin', 'POST', '/v1/attendance', {
      payrollId,
      workerId: temp,
      date: '2026-10-09',
      clockIn1: '07:00',
    })
    expect(created.status).toBe(201)
    const recordId = created.json.id
    // There is no close endpoint in this phase: the status is set directly.
    await t.db.update(payrolls).set({ status: 'closed' }).where(eq(payrolls.id, payrollId))

    const writes = [
      await t.request('admin', 'PATCH', `/v1/payrolls/${payrollId}`, { name: 'Otro nombre' }),
      await clock('admin', temp, '2026-10-09', 'clockOut1', '2026-10-09T20:00:00Z', payrollId),
      await t.request('admin', 'POST', '/v1/attendance', { payrollId, workerId: noRate, date: '2026-10-07', type: 'absence' }),
      await t.request('admin', 'PATCH', `/v1/attendance/${recordId}`, { note: 'x' }),
      await t.request('admin', 'DELETE', `/v1/attendance/${recordId}`),
    ]
    for (const r of writes) {
      expect(r.status).toBe(409)
      expect(r.json.error).toMatchObject({ code: 'payroll_closed', message: 'La planilla está cerrada' })
    }

    const detail = await t.request('admin', 'GET', `/v1/payrolls/${payrollId}`)
    expect(detail.status).toBe(200)
    expect(detail.json).toMatchObject({ id: payrollId, name: 'Cerrada', status: 'closed' })
    expect(detail.json.records).toHaveLength(1)
    const day = await t.request('admin', 'GET', `/v1/attendance?payrollId=${payrollId}&date=2026-10-09`)
    expect(day.status).toBe(200)
  })
})
