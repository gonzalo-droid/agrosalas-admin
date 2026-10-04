import { and, eq, sql } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import {
  attendanceRecords, auditLog, campaigns, payrollItems, payrollWorkers, payrolls, payments, workers,
} from '../../src/db/schema.js'
import { loadSheets } from '../../scripts/import-excel/load.js'
import { REVIEW_TEXT, type ParsedDay, type ParsedSheet, type ParsedWorker } from '../../scripts/import-excel/parse-sheet.js'
import { createTestApp, USERS } from '../helpers.js'

const day = (date: string, amountCents: number, overrides: Partial<ParsedDay> = {}): ParsedDay => ({
  date,
  marks: { clockIn1: 450, clockOut1: 720, clockIn2: 780, clockOut2: 990 },
  workedMinutes: 480,
  regularMinutes: 480,
  overtimeMinutes: 0,
  amountCents,
  reasons: [],
  ...overrides,
})

const worker = (name: string, days: ParsedDay[], overrides: Partial<ParsedWorker> = {}): ParsedWorker => ({
  row: 24,
  rawName: name,
  name,
  days,
  amountWithoutHoursCents: 0,
  totalCents: days.reduce((sum, d) => sum + d.amountCents, 0),
  paidCents: 0,
  warnings: [],
  ...overrides,
})

const sheetOne = (): ParsedSheet => ({
  sheet: '13 al 19 1era sem',
  campaign: 'Contenedor Chile',
  startDate: '2026-04-13',
  endDate: '2026-04-19',
  hourlyRate: 6.2517,
  overtimeRate: 7.8146,
  excelTotalCents: 35000,
  workers: [
    worker(
      'QUISPE MAMANI, LUIS',
      [
        day('2026-04-13', 5001),
        // Two reasons, and a mark that is null: the null must stay null.
        day('2026-04-14', 4999, {
          marks: { clockIn1: 450, clockOut1: 990, clockIn2: null, clockOut2: null },
          workedMinutes: 540,
          regularMinutes: 480,
          overtimeMinutes: 60,
          reasons: ['formula', 'too_long'],
        }),
      ],
      { totalCents: 10000, paidCents: 10000 },
    ),
    worker('PEREZ ROJAS, ANA', [day('2026-04-13', 5000)], { paidCents: 2000 }),
    worker('PEREZ LUNA, ANA', [], { amountWithoutHoursCents: 20000, totalCents: 20000 }),
    // No data on the sheet: neither created as a worker nor added as a member.
    worker('SIN DATOS, NADIE', [], { totalCents: 0 }),
  ],
})

const sheetTwo = (): ParsedSheet => ({
  sheet: 'ETI 5 AL 10 Junio',
  campaign: 'Etiquetado junio',
  startDate: '2026-06-05',
  endDate: '2026-06-10',
  hourlyRate: 6.2517,
  overtimeRate: 7.8146,
  excelTotalCents: 4000,
  workers: [worker('QUISPE MAMANI, LUIS', [day('2026-06-05', 4000)], { paidCents: 1500 })],
})

type TestApp = Awaited<ReturnType<typeof createTestApp>>

// A worker that already exists without DNI (in lower case, with extra spaces and an accent) and one that has a DNI.
async function seed(t: TestApp) {
  await t.db.insert(campaigns).values({ name: 'Contenedor Chile' })
  const [existing] = await t.db
    .insert(workers)
    .values({ lastName: 'quispe  mamaní', firstName: ' luis', employmentType: 'contract' })
    .returning()
  await t.db.insert(workers).values({ lastName: 'Chávez León', firstName: 'María', dni: '12345678', employmentType: 'contract' })
  return existing!
}

const counts = async (t: TestApp) => ({
  campaigns: (await t.db.select().from(campaigns)).length,
  workers: (await t.db.select().from(workers)).length,
  payrolls: (await t.db.select().from(payrolls)).length,
  members: (await t.db.select().from(payrollWorkers)).length,
  records: (await t.db.select().from(attendanceRecords)).length,
  items: (await t.db.select().from(payrollItems)).length,
  payments: (await t.db.select().from(payments)).length,
  audit: (await t.db.select().from(auditLog)).length,
})

describe('loadSheets', () => {
  it('creates the missing campaign, reuses the existing one and the worker without DNI, accents aside', async () => {
    const t = await createTestApp()
    const existing = await seed(t)

    const result = await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])

    const allCampaigns = await t.db.select().from(campaigns)
    expect(allCampaigns.map((c) => c.name).sort()).toEqual(['Contenedor Chile', 'Etiquetado junio'])
    expect(allCampaigns.every((c) => c.active)).toBe(true)

    const all = await t.db.select().from(workers)
    // The seeded two, plus PEREZ ROJAS and PEREZ LUNA. QUISPE MAMANI is the seeded "quispe  mamaní", reused.
    expect(all.filter((w) => w.id === existing.id)).toHaveLength(1)
    expect(all).toHaveLength(4)
    expect(result.workers).toBe(2)
    expect(all.some((w) => w.lastName === 'Sin Datos')).toBe(false)
    expect(result.reused).toEqual([{ name: 'QUISPE MAMANI, LUIS', worker: 'QUISPE MAMANÍ, LUIS (sin DNI)' }])
    expect(result.created).toEqual(['PEREZ ROJAS, ANA', 'PEREZ LUNA, ANA'])

    const ana = all.find((w) => w.lastName === 'Perez Luna')!
    expect(ana).toMatchObject({
      firstName: 'Ana', dni: null, employmentType: 'temporary', status: 'active', notes: 'Migrado del Excel: falta DNI',
    })
    expect(all.find((w) => w.lastName === 'Perez Rojas')).toMatchObject({ firstName: 'Ana', dni: null })
  })

  it('refuses a name equal to a worker with DNI, accents aside, and writes nothing', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const sheet = sheetTwo()
    sheet.workers.push(worker('CHAVEZ LEON, MARIA', [day('2026-06-06', 100)]))

    await expect(loadSheets(t.db, USERS.admin, [sheet])).rejects.toThrow(
      'CHAVEZ LEON, MARIA coincide con Chávez León, María (DNI 12345678): agrega un alias "dni:12345678" o cambia el nombre',
    )
    expect(await counts(t)).toEqual(before)
  })

  it('attaches a name aliased to a DNI to that worker', async () => {
    const t = await createTestApp()
    await seed(t)
    const [maria] = await t.db.select().from(workers).where(eq(workers.dni, '12345678'))
    const sheet = sheetTwo()
    sheet.workers.push(worker('dni:12345678', [day('2026-06-06', 100)], { rawName: 'CHAVEZ L., MARIA' }))

    const result = await loadSheets(t.db, USERS.admin, [sheet])

    expect(result.workers).toBe(0)
    expect(result.reused).toContainEqual({ name: 'dni:12345678', worker: 'CHÁVEZ LEÓN, MARÍA (DNI 12345678)' })
    const records = await t.db.select().from(attendanceRecords).where(eq(attendanceRecords.workerId, maria!.id))
    expect(records.map((r) => r.date)).toEqual(['2026-06-06'])
  })

  it('refuses a DNI alias that matches no worker', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const sheet = sheetTwo()
    sheet.workers.push(worker('dni:87654321', [day('2026-06-06', 100)], { rawName: 'CHAVEZ L., MARIA' }))

    await expect(loadSheets(t.db, USERS.admin, [sheet])).rejects.toThrow(
      'CHAVEZ L., MARIA: no hay ningún trabajador con DNI 87654321 (alias "dni:87654321")',
    )
    expect(await counts(t)).toEqual(before)
  })

  it('refuses a name that matches two workers without DNI, and writes nothing', async () => {
    const t = await createTestApp()
    await seed(t)
    await t.db.insert(workers).values({ lastName: 'QUISPE MAMANI', firstName: 'LUIS', employmentType: 'temporary' })
    const before = await counts(t)

    await expect(loadSheets(t.db, USERS.admin, [sheetTwo()])).rejects.toThrow(
      'QUISPE MAMANI, LUIS coincide con 2 trabajadores sin DNI (QUISPE MAMANÍ, LUIS; QUISPE MAMANI, LUIS): deja uno solo o cambia el nombre',
    )
    expect(await counts(t)).toEqual(before)
  })

  it('creates one worker for two spellings that differ only in accents, and maps every new worker by its own name', async () => {
    const t = await createTestApp()
    await seed(t)
    const one = sheetOne()
    one.workers.push(worker('ROJAS DIAZ, PEDRO', [day('2026-04-15', 300)]))
    const two = sheetTwo()
    two.workers.push(worker('PÉREZ ROJAS, ANA', [day('2026-06-06', 200)]))

    const result = await loadSheets(t.db, USERS.admin, [one, two])

    expect(result.created).toEqual(['PEREZ ROJAS, ANA', 'PEREZ LUNA, ANA', 'ROJAS DIAZ, PEDRO'])
    const all = await t.db.select().from(workers)
    const ana = all.filter((w) => w.lastName === 'Perez Rojas')
    expect(ana).toHaveLength(1)
    const pedro = all.find((w) => w.lastName === 'Rojas Diaz')!
    const dates = async (workerId: string) =>
      (await t.db.select().from(attendanceRecords).where(eq(attendanceRecords.workerId, workerId))).map((r) => r.date).sort()
    expect(await dates(ana[0]!.id)).toEqual(['2026-04-13', '2026-06-06'])
    expect(await dates(pedro.id)).toEqual(['2026-04-15'])
  })

  it('loads closed payrolls with their campaign, dates and only members with data', async () => {
    const t = await createTestApp()
    await seed(t)
    const result = await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    expect(result.payrolls).toBe(2)

    const [first] = await t.db.select().from(payrolls).where(eq(payrolls.name, '13 al 19 1era sem'))
    const [chile] = await t.db.select().from(campaigns).where(eq(campaigns.name, 'Contenedor Chile'))
    expect(first).toMatchObject({
      type: 'weekly', startDate: '2026-04-13', endDate: '2026-04-19', campaignId: chile!.id,
      status: 'closed', createdBy: USERS.admin, closedBy: USERS.admin,
    })
    expect(first!.closedAt).toBeInstanceOf(Date)

    const members = await t.db.select().from(payrollWorkers).where(eq(payrollWorkers.payrollId, first!.id))
    expect(members).toHaveLength(3)
    const [second] = await t.db.select().from(payrolls).where(eq(payrolls.name, 'ETI 5 AL 10 Junio'))
    expect(await t.db.select().from(payrollWorkers).where(eq(payrollWorkers.payrollId, second!.id))).toHaveLength(1)
  })

  it('loads each day with the Excel amount, the marks as Lima instants and the review note', async () => {
    const t = await createTestApp()
    const existing = await seed(t)
    const result = await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    expect(result.records).toBe(4)

    const [payroll] = await t.db.select().from(payrolls).where(eq(payrolls.name, '13 al 19 1era sem'))
    const records = await t.db
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.payrollId, payroll!.id), eq(attendanceRecords.workerId, existing.id)))
    const byDate = new Map(records.map((r) => [r.date, r]))

    const clean = byDate.get('2026-04-13')!
    // The reused worker keeps their own employment type; a created one is temporary.
    expect(clean).toMatchObject({
      type: 'worked', employmentType: 'contract', areaId: null, source: 'excel', needsReview: false, note: null,
      workedMinutes: 480, regularMinutes: 480, overtimeMinutes: 0, amountCents: 5001,
      hourlyRate: 6.2517, overtimeRate: 7.8146, recordedBy: USERS.admin,
    })
    // 07:30, 12:00, 13:00 and 16:30 in Lima are 12:30, 17:00, 18:00 and 21:30 UTC.
    expect(clean.clockIn1).toEqual(new Date('2026-04-13T12:30:00Z'))
    expect(clean.clockOut1).toEqual(new Date('2026-04-13T17:00:00Z'))
    expect(clean.clockIn2).toEqual(new Date('2026-04-13T18:00:00Z'))
    expect(clean.clockOut2).toEqual(new Date('2026-04-13T21:30:00Z'))

    const flagged = byDate.get('2026-04-14')!
    expect(flagged).toMatchObject({ needsReview: true, amountCents: 4999, overtimeMinutes: 60, clockIn2: null, clockOut2: null })
    expect(flagged.note).toBe(`${REVIEW_TEXT.formula}; ${REVIEW_TEXT.too_long}`)
    expect(flagged.clockOut1).toEqual(new Date('2026-04-14T21:30:00Z'))

    const [ana] = await t.db.select().from(workers).where(eq(workers.lastName, 'Perez Rojas'))
    const [anaRecord] = await t.db.select().from(attendanceRecords).where(eq(attendanceRecords.workerId, ana!.id))
    expect(anaRecord!.employmentType).toBe('temporary')
  })

  it('turns an amount without hours into a bonus and a paid amount into a cash payment on the last day', async () => {
    const t = await createTestApp()
    await seed(t)
    const result = await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    expect(result.items).toBe(1)
    expect(result.payments).toBe(3)

    const items = await t.db.select().from(payrollItems)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ type: 'bonus', amountCents: 20000, note: 'Monto del Excel sin horas', recordedBy: USERS.admin })

    const [payroll] = await t.db.select().from(payrolls).where(eq(payrolls.name, '13 al 19 1era sem'))
    const paid = await t.db.select().from(payments).where(eq(payments.payrollId, payroll!.id))
    expect(paid.map((p) => p.amountCents).sort((a, b) => a - b)).toEqual([2000, 10000])
    for (const payment of paid) {
      expect(payment).toMatchObject({
        date: '2026-04-19', method: 'cash', methodDetail: 'Migrado del Excel', note: 'migrado', recordedBy: USERS.admin,
      })
    }
  })

  it('gives balances equal to the Excel amounts plus the concepts, with paid and pending right', async () => {
    const t = await createTestApp()
    await seed(t)
    await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    const [payroll] = await t.db.select().from(payrolls).where(eq(payrolls.name, '13 al 19 1era sem'))

    const { status, json } = await t.request('admin', 'GET', `/v1/payrolls/${payroll!.id}/balances`)

    expect(status).toBe(200)
    // 5001 + 4999 + 5000 from the days, 20000 from the concept; 10000 + 2000 paid.
    expect(json.totals).toMatchObject({
      attendanceCents: 15000, additionsCents: 20000, deductionsCents: 0, totalCents: 35000, paidCents: 12000, pendingCents: 23000,
    })
    expect(json.items).toHaveLength(3)
  })

  it('audits a create for every created row and an update for each closing, with the user', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const result = await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    const after = await counts(t)

    const rows = (await t.db.select().from(auditLog)).slice(before.audit)
    expect(rows.every((r) => r.userId === USERS.admin)).toBe(true)
    const creates = (entity: string) => rows.filter((r) => r.action === 'create' && r.entity === entity)
    expect(creates('campaigns')).toHaveLength(1)
    expect(creates('workers')).toHaveLength(result.workers)
    expect(creates('payrolls')).toHaveLength(2)
    expect(creates('attendance_records')).toHaveLength(result.records)
    expect(creates('payroll_items')).toHaveLength(result.items)
    expect(creates('payments')).toHaveLength(result.payments)
    const updates = rows.filter((r) => r.action === 'update')
    expect(updates.map((r) => r.entity)).toEqual(['payrolls', 'payrolls'])
    expect(updates[0]).toMatchObject({ before: expect.objectContaining({ status: 'open' }), after: expect.objectContaining({ status: 'closed' }) })
    expect(rows).toHaveLength(after.audit - before.audit)

    const [payroll] = await t.db.select().from(payrolls).where(eq(payrolls.name, '13 al 19 1era sem'))
    expect(creates('payrolls').map((r) => r.entityId)).toContain(payroll!.id)
  })

  it('refuses a second run and changes nothing', async () => {
    const t = await createTestApp()
    await seed(t)
    await loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])
    const loaded = await counts(t)

    await expect(loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])).rejects.toThrow(
      'La hoja 13 al 19 1era sem ya se importó',
    )
    expect(await counts(t)).toEqual(loaded)
  })

  it('writes nothing when only one of the sheets was already imported', async () => {
    const t = await createTestApp()
    await seed(t)
    await loadSheets(t.db, USERS.admin, [sheetTwo()])
    const loaded = await counts(t)

    await expect(loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])).rejects.toThrow(
      'La hoja ETI 5 AL 10 Junio ya se importó',
    )
    expect(await counts(t)).toEqual(loaded)
  })

  it('does not count a payroll with the same name that holds no Excel records as imported', async () => {
    const t = await createTestApp()
    await seed(t)
    await t.db.insert(payrolls).values({
      name: 'ETI 5 AL 10 Junio', type: 'weekly', startDate: '2026-06-05', endDate: '2026-06-10', createdBy: USERS.admin,
    })

    await expect(loadSheets(t.db, USERS.admin, [sheetTwo()])).resolves.toMatchObject({ payrolls: 1 })
  })

  it('refuses negative amounts before writing anything', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const sheet = sheetOne()
    sheet.workers[1]!.days[0]!.amountCents = -100

    await expect(loadSheets(t.db, USERS.admin, [sheet, sheetTwo()])).rejects.toThrow(/negativo/)
    expect(await counts(t)).toEqual(before)
  })

  it('refuses negative minutes before writing anything', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const sheet = sheetOne()
    sheet.workers[1]!.days[0]!.overtimeMinutes = -60

    await expect(loadSheets(t.db, USERS.admin, [sheet, sheetTwo()])).rejects.toThrow(
      /negativo.*PEREZ ROJAS, ANA, día 13\/04\/2026, minutos extra: -60 min/,
    )
    expect(await counts(t)).toEqual(before)
  })

  it('refuses a reused worker who already has attendance on one of the dates, listing each clash', async () => {
    const t = await createTestApp()
    const existing = await seed(t)
    const [payroll] = await t.db
      .insert(payrolls)
      .values({ name: 'Junio panel', type: 'weekly', startDate: '2026-06-01', endDate: '2026-06-07', createdBy: USERS.admin })
      .returning()
    await t.db.insert(payrollWorkers).values({ payrollId: payroll!.id, workerId: existing.id })
    await t.db.insert(attendanceRecords).values(
      ['2026-06-05', '2026-06-06'].map((date) => ({
        workerId: existing.id, date, payrollId: payroll!.id, employmentType: 'contract' as const, recordedBy: USERS.admin,
      })),
    )
    const before = await counts(t)
    const sheet = sheetTwo()
    sheet.workers[0]!.days.push(day('2026-06-06', 100))

    const failure = loadSheets(t.db, USERS.admin, [sheet])
    await expect(failure).rejects.toThrow('QUISPE MAMANI, LUIS: ya tiene asistencia el 05/06/2026')
    await expect(failure).rejects.toThrow('QUISPE MAMANI, LUIS: ya tiene asistencia el 06/06/2026')
    expect(await counts(t)).toEqual(before)
  })

  it('re-reads the sums of each payroll before committing and rolls back when they differ from the Excel', async () => {
    const t = await createTestApp()
    await seed(t)
    // A trigger that changes every payment on its way in stands for any write that does not keep the Excel amount.
    await t.db.execute(sql`
      create function bump_payment() returns trigger language plpgsql as $$
      begin new.amount_cents := new.amount_cents + 1; return new; end $$`)
    await t.db.execute(sql`create trigger bump_payment before insert on payments for each row execute function bump_payment()`)
    const before = await counts(t)

    await expect(loadSheets(t.db, USERS.admin, [sheetOne(), sheetTwo()])).rejects.toThrow(
      'La planilla 13 al 19 1era sem no cuadra después de insertar: pagos S/ 120.02 en la base y S/ 120.00 en el Excel',
    )
    expect(await counts(t)).toEqual(before)
  })

  it('rolls everything back when a row fails halfway', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    // Two days of the same date for one worker break the unique (worker, date) index once the payroll exists.
    const sheet = sheetTwo()
    sheet.workers[0]!.days.push(day('2026-06-05', 100))

    await expect(loadSheets(t.db, USERS.admin, [sheetOne(), sheet])).rejects.toThrow()
    expect(await counts(t)).toEqual(before)
  })

  it('refuses two spellings of one name in the same sheet, accents aside', async () => {
    const t = await createTestApp()
    await seed(t)
    const sheet = sheetTwo()
    sheet.workers.push(worker('QUISPE MAMANÍ, LUIS', [day('2026-06-06', 100)]))

    await expect(loadSheets(t.db, USERS.admin, [sheet])).rejects.toThrow(
      'Hoja ETI 5 AL 10 Junio: QUISPE MAMANÍ, LUIS aparece en más de una fila',
    )
  })

  it('refuses a worker written in two rows of the same sheet, before writing anything', async () => {
    const t = await createTestApp()
    await seed(t)
    const before = await counts(t)
    const sheet = sheetTwo()
    sheet.workers.push(worker('QUISPE MAMANI, LUIS', [day('2026-06-06', 100)]))

    await expect(loadSheets(t.db, USERS.admin, [sheet])).rejects.toThrow(
      'Hoja ETI 5 AL 10 Junio: QUISPE MAMANI, LUIS aparece en más de una fila',
    )
    expect(await counts(t)).toEqual(before)
  })
})
