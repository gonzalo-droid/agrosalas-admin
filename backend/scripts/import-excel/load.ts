import { and, eq, inArray, sql } from 'drizzle-orm'
import {
  attendanceRecords, auditLog, campaigns, payrollItems, payrollWorkers, payrolls, payments, workers,
} from '../../src/db/schema'
import { limaInstant } from '../../src/payroll/time'
import type { Db, Tx } from '../../src/types'
import { aliasDni, nameKey, normalizeName, splitName, workerKey } from './names'
import { REVIEW_TEXT, type ParsedSheet, type ParsedWorker } from './parse-sheet'
import { findNegatives, negativeText } from './summary'

export type LoadCounts = { workers: number; payrolls: number; records: number; items: number; payments: number }
/** The counts, plus which Excel names went to an existing worker (and which one) and which were created. */
export type LoadResult = LoadCounts & { reused: { name: string; worker: string }[]; created: string[] }

type ExistingWorker = typeof workers.$inferSelect
type Target = { id: string; employmentType: ExistingWorker['employmentType'] }

// Rows per INSERT: keeps every statement far below the 65535-parameter limit of Postgres.
const CHUNK = 200

const chunked = <T>(rows: T[]): T[][] => {
  const parts: T[][] = []
  for (let i = 0; i < rows.length; i += CHUNK) parts.push(rows.slice(i, i + CHUNK))
  return parts
}

const money = (cents: number): string => `${cents < 0 ? '-' : ''}S/ ${(Math.abs(cents) / 100).toFixed(2)}`

/** A worker takes part in a sheet only with a day, an amount without hours or a payment (decision 6). */
const hasData = (worker: ParsedWorker): boolean =>
  worker.days.length > 0 || worker.amountWithoutHoursCents > 0 || worker.paidCents > 0

/** Minutes of the day in Lima ('HH:MM' for limaInstant); the parser guarantees [1, 1439]. */
const clock = (minutes: number | null, date: string): Date | null => {
  if (minutes === null) return null
  const hh = String(Math.floor(minutes / 60)).padStart(2, '0')
  const mm = String(minutes % 60).padStart(2, '0')
  return limaInstant(date, `${hh}:${mm}`)
}

/** Everything is checked before the first write, so a refusal leaves the database as it was. */
function validate(sheets: ParsedSheet[]) {
  const negatives = findNegatives(sheets)
  if (negatives.length > 0) {
    const first = negatives
      .slice(0, 5)
      .map((n) => `${n.sheet}, ${negativeText(n)}`)
      .join('; ')
    throw new Error(
      `Hay ${negatives.length} monto(s) o minutos negativo(s) y la base los rechaza; corrígelos en el Excel (${first}).`,
    )
  }
  for (const sheet of sheets) {
    // By matching key: two spellings that differ only in accents are the same worker.
    const seen = new Set<string>()
    for (const worker of sheet.workers.filter(hasData)) {
      const key = workerKey(worker.name)
      if (seen.has(key)) throw new Error(`Hoja ${sheet.sheet}: ${worker.name} aparece en más de una fila.`)
      seen.add(key)
    }
  }
}

const describeWorker = (worker: ExistingWorker): string =>
  `${normalizeName(`${worker.lastName}, ${worker.firstName}`)} (${worker.dni === null ? 'sin DNI' : `DNI ${worker.dni}`})`

/**
 * Matches every Excel name with data to an existing worker or marks it for creation, refusing anything ambiguous:
 * a name equal (accents aside) to a worker with DNI, a name equal to two workers without DNI, or a DNI alias with
 * no worker. Only reads; the caller writes after it.
 */
async function matchWorkers(tx: Tx, sheets: ParsedSheet[]) {
  const existing = await tx.select().from(workers)
  const byDni = new Map(existing.filter((w) => w.dni !== null).map((w) => [w.dni!, w]))
  const byKey = new Map<string, ExistingWorker[]>()
  for (const worker of existing) {
    const key = nameKey(worker.lastName, worker.firstName)
    byKey.set(key, [...(byKey.get(key) ?? []), worker])
  }

  // One entry per matching key, with the first spelling and the first raw name met.
  const names = new Map<string, { name: string; rawName: string }>()
  for (const worker of sheets.flatMap((sheet) => sheet.workers.filter(hasData))) {
    const key = workerKey(worker.name)
    if (!names.has(key)) names.set(key, { name: worker.name, rawName: normalizeName(worker.rawName) })
  }

  const targets = new Map<string, Target>()
  const reused: LoadResult['reused'] = []
  const toCreate: string[] = []
  const problems: string[] = []
  for (const [key, { name, rawName }] of names) {
    const dni = aliasDni(name)
    if (dni !== null) {
      const worker = byDni.get(dni)
      if (!worker) problems.push(`${rawName}: no hay ningún trabajador con DNI ${dni} (alias "${name}")`)
      else {
        targets.set(key, worker)
        reused.push({ name, worker: describeWorker(worker) })
      }
      continue
    }
    const matches = byKey.get(key) ?? []
    const withDni = matches.filter((w) => w.dni !== null)
    const withoutDni = matches.filter((w) => w.dni === null)
    for (const worker of withDni) {
      problems.push(
        `${name} coincide con ${worker.lastName}, ${worker.firstName} (DNI ${worker.dni}): agrega un alias "dni:${worker.dni}" o cambia el nombre`,
      )
    }
    if (withDni.length > 0) continue
    if (withoutDni.length > 1) {
      const list = withoutDni.map((w) => normalizeName(`${w.lastName}, ${w.firstName}`)).join('; ')
      problems.push(`${name} coincide con ${withoutDni.length} trabajadores sin DNI (${list}): deja uno solo o cambia el nombre`)
    } else if (withoutDni.length === 1) {
      targets.set(key, withoutDni[0]!)
      reused.push({ name, worker: describeWorker(withoutDni[0]!) })
    } else {
      toCreate.push(name)
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `No se puede cargar: estos nombres del Excel no se pueden emparejar sin dudas con los trabajadores existentes:\n${problems
        .map((problem) => `- ${problem}`)
        .join('\n')}`,
    )
  }
  return { targets, reused, toCreate }
}

const dateText = (iso: string): string => iso.split('-').reverse().join('/')

/** A reused worker that already has a record on one of the imported dates would break the (worker, date) index. */
async function checkAttendanceClashes(tx: Tx, sheets: ParsedSheet[], targets: Map<string, Target>) {
  const ids = [...new Set([...targets.values()].map((target) => target.id))]
  if (ids.length === 0) return
  const taken = new Set(
    (
      await tx
        .select({ workerId: attendanceRecords.workerId, date: attendanceRecords.date })
        .from(attendanceRecords)
        .where(inArray(attendanceRecords.workerId, ids))
    ).map((row) => `${row.workerId} ${row.date}`),
  )
  const clashes: string[] = []
  for (const worker of sheets.flatMap((sheet) => sheet.workers.filter(hasData))) {
    const target = targets.get(workerKey(worker.name))
    if (!target) continue
    for (const day of worker.days) {
      if (taken.has(`${target.id} ${day.date}`)) clashes.push(`- ${worker.name}: ya tiene asistencia el ${dateText(day.date)}`)
    }
  }
  if (clashes.length > 0) {
    throw new Error(`No se puede cargar: hay trabajadores con asistencia ya registrada en esas fechas:\n${clashes.join('\n')}`)
  }
}

/** Re-reads the attendance, concepts and payments of an imported payroll; any difference throws and rolls back. */
async function checkSums(tx: Tx, sheet: ParsedSheet, payrollId: string) {
  const members = sheet.workers.filter(hasData)
  const expected = {
    amounts: members.reduce((sum, w) => sum + w.amountWithoutHoursCents + w.days.reduce((s, d) => s + d.amountCents, 0), 0),
    paid: members.reduce((sum, w) => sum + w.paidCents, 0),
  }
  // sum() of integers is a bigint, which some drivers return as text.
  const sumOf = async (table: typeof attendanceRecords | typeof payrollItems | typeof payments): Promise<number> => {
    const [row] = await tx
      .select({ total: sql`coalesce(sum(${table.amountCents}), 0)`.mapWith(Number) })
      .from(table)
      .where(eq(table.payrollId, payrollId))
    return row?.total ?? 0
  }
  const amounts = (await sumOf(attendanceRecords)) + (await sumOf(payrollItems))
  const paid = await sumOf(payments)
  const problems = [
    amounts !== expected.amounts
      ? `asistencia y conceptos ${money(amounts)} en la base y ${money(expected.amounts)} en el Excel`
      : null,
    paid !== expected.paid ? `pagos ${money(paid)} en la base y ${money(expected.paid)} en el Excel` : null,
  ].filter((problem) => problem !== null)
  if (problems.length > 0) throw new Error(`La planilla ${sheet.sheet} no cuadra después de insertar: ${problems.join('; ')}.`)
}

/**
 * Writes the parsed sheets in one transaction: after the checks that only read, campaigns, workers, then per sheet the
 * payroll, its members, the attendance, the concepts, the payments and the closing; the sums are re-read before the
 * commit. Any failure rolls everything back.
 */
export async function loadSheets(db: Db, userId: string, sheets: ParsedSheet[]): Promise<LoadResult> {
  validate(sheets)

  return db.transaction(async (tx) => {
    // The audit rows of the whole load go in few batches at the end instead of one INSERT per row.
    const audit: (typeof auditLog.$inferInsert)[] = []
    const record = (action: 'create' | 'update', entity: string, entityId: string, before: unknown, after: unknown) =>
      audit.push({ userId, action, entity, entityId, before, after })

    // 1. A sheet is loaded only once.
    const names = sheets.map((sheet) => sheet.sheet)
    const imported = await tx
      .selectDistinct({ name: payrolls.name })
      .from(payrolls)
      .innerJoin(attendanceRecords, eq(attendanceRecords.payrollId, payrolls.id))
      .where(and(inArray(payrolls.name, names), eq(attendanceRecords.source, 'excel')))
    const importedNames = new Set(imported.map((row) => row.name))
    const again = names.find((name) => importedNames.has(name))
    if (again !== undefined) throw new Error(`La hoja ${again} ya se importó`)

    // 2. Every Excel name to an existing worker or to a new one; a refusal here comes before any write.
    const { targets, reused, toCreate } = await matchWorkers(tx, sheets)
    await checkAttendanceClashes(tx, sheets, targets)

    // 3. Campaigns: the existing ones by name, the missing ones created active.
    const campaignIds = new Map((await tx.select({ id: campaigns.id, name: campaigns.name }).from(campaigns)).map((c) => [c.name, c.id]))
    for (const name of new Set(sheets.map((sheet) => sheet.campaign))) {
      if (campaignIds.has(name)) continue
      const [created] = await tx.insert(campaigns).values({ name, active: true }).returning()
      campaignIds.set(name, created!.id)
      record('create', 'campaigns', created!.id, null, created)
    }

    // 4. The new workers, mapped back by the name each returned row holds (never by its position).
    for (const part of chunked(toCreate)) {
      const rows = await tx
        .insert(workers)
        .values(
          part.map((name) => {
            const { lastName, firstName } = splitName(name)
            return {
              lastName, firstName, employmentType: 'temporary' as const, status: 'active' as const, notes: 'Migrado del Excel: falta DNI',
            }
          }),
        )
        .returning()
      for (const row of rows) {
        targets.set(nameKey(row.lastName, row.firstName), row)
        record('create', 'workers', row.id, null, row)
      }
    }
    const targetOf = (name: string): Target => {
      const target = targets.get(workerKey(name))
      if (!target) throw new Error(`No se encontró el trabajador de ${name} después de crearlo.`)
      return target
    }

    // 5. Payrolls, one per sheet.
    const counts: LoadCounts = { workers: toCreate.length, payrolls: 0, records: 0, items: 0, payments: 0 }
    const loaded: { sheet: ParsedSheet; payrollId: string }[] = []
    for (const sheet of sheets) {
      const [payroll] = await tx
        .insert(payrolls)
        .values({
          name: sheet.sheet,
          type: 'weekly',
          startDate: sheet.startDate,
          endDate: sheet.endDate,
          campaignId: campaignIds.get(sheet.campaign)!,
          createdBy: userId,
        })
        .returning()
      record('create', 'payrolls', payroll!.id, null, payroll)
      loaded.push({ sheet, payrollId: payroll!.id })
      counts.payrolls++

      const members = sheet.workers.filter(hasData)
      // Members first: records, concepts and payments point at them with a composite foreign key.
      for (const part of chunked(members)) {
        await tx.insert(payrollWorkers).values(part.map((member) => ({ payrollId: payroll!.id, workerId: targetOf(member.name).id })))
      }

      const recordRows = members.flatMap((member) =>
        member.days.map((d) => ({
          workerId: targetOf(member.name).id,
          // The worker's own type: a reused worker may be on contract; a created one is temporary.
          employmentType: targetOf(member.name).employmentType,
          date: d.date,
          payrollId: payroll!.id,
          type: 'worked' as const,
          clockIn1: clock(d.marks.clockIn1, d.date),
          clockOut1: clock(d.marks.clockOut1, d.date),
          clockIn2: clock(d.marks.clockIn2, d.date),
          clockOut2: clock(d.marks.clockOut2, d.date),
          workedMinutes: d.workedMinutes,
          regularMinutes: d.regularMinutes,
          overtimeMinutes: d.overtimeMinutes,
          // The Excel amount is kept as it is; it is not recalculated from the rates.
          hourlyRate: sheet.hourlyRate,
          overtimeRate: sheet.overtimeRate,
          amountCents: d.amountCents,
          areaId: null,
          note: d.reasons.length > 0 ? d.reasons.map((reason) => REVIEW_TEXT[reason]).join('; ') : null,
          recordedBy: userId,
          source: 'excel',
          needsReview: d.reasons.length > 0,
        })),
      )
      for (const part of chunked(recordRows)) {
        for (const row of await tx.insert(attendanceRecords).values(part).returning()) record('create', 'attendance_records', row.id, null, row)
      }
      counts.records += recordRows.length

      const itemRows = members
        .filter((member) => member.amountWithoutHoursCents > 0)
        .map((member) => ({
          payrollId: payroll!.id,
          workerId: targetOf(member.name).id,
          type: 'bonus' as const,
          amountCents: member.amountWithoutHoursCents,
          note: 'Monto del Excel sin horas',
          recordedBy: userId,
        }))
      for (const part of chunked(itemRows)) {
        for (const row of await tx.insert(payrollItems).values(part).returning()) record('create', 'payroll_items', row.id, null, row)
      }
      counts.items += itemRows.length

      // The Excel does not say when or how it was paid: the last day of the period, in cash (decision 8).
      const paymentRows = members
        .filter((member) => member.paidCents > 0)
        .map((member) => ({
          payrollId: payroll!.id,
          workerId: targetOf(member.name).id,
          date: sheet.endDate,
          amountCents: member.paidCents,
          method: 'cash' as const,
          methodDetail: 'Migrado del Excel',
          note: 'migrado',
          recordedBy: userId,
        }))
      for (const part of chunked(paymentRows)) {
        for (const row of await tx.insert(payments).values(part).returning()) record('create', 'payments', row.id, null, row)
      }
      counts.payments += paymentRows.length

      // Closed at the end so that history is not edited by mistake; an administrator can reopen it.
      const [closed] = await tx
        .update(payrolls)
        .set({ status: 'closed', closedBy: userId, closedAt: new Date() })
        .where(eq(payrolls.id, payroll!.id))
        .returning()
      record('update', 'payrolls', payroll!.id, payroll, closed)
    }

    // 6. Before committing, what the database holds for each payroll must be what the Excel says.
    for (const { sheet, payrollId } of loaded) await checkSums(tx, sheet, payrollId)

    // 7. Audit.
    for (const part of chunked(audit)) await tx.insert(auditLog).values(part)
    return { ...counts, reused, created: toCreate }
  })
}
