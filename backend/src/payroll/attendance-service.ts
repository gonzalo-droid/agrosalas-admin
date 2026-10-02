import { and, eq } from 'drizzle-orm'
import { attendanceRecords, payrollWorkers, positions } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError, notFound } from '../lib/errors'
import { findWorker } from '../routes/workers'
import type { SessionUser, Tx } from '../types'
import { computeRecord, type Marks } from './calc'
import { findOpenPayroll } from './open-payroll'
import { limaDate, limaTime, marksFromTimes } from './time'

type MoneyKey = 'hourlyRate' | 'overtimeRate' | 'amountCents'
type Redacted<T> = Omit<T, MoneyKey> & Record<MoneyKey, number | null>

// The coordinator sees hours but never money: the amounts are removed on the server, not hidden on the screen.
export function redactMoney<T extends Record<MoneyKey, number>>(user: SessionUser, record: T): Redacted<T> {
  if (user.role !== 'coordinator') return record
  return { ...record, hourlyRate: null, overtimeRate: null, amountCents: null }
}

// In the order of the day: clock in, out to lunch, back from lunch, clock out.
export type Mark = 'clockIn1' | 'clockOut1' | 'clockIn2' | 'clockOut2'
export const MARKS: Mark[] = ['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2']

type AttendanceRecord = typeof attendanceRecords.$inferSelect

const DAY_MS = 24 * 60 * 60 * 1000

export const dateOutsidePayroll = () =>
  new ApiError(400, 'validation', 'La fecha no está dentro de la planilla', 'date')

const marksOf = (record: Marks): Marks => ({
  clockIn1: record.clockIn1,
  clockOut1: record.clockOut1,
  clockIn2: record.clockIn2,
  clockOut2: record.clockOut2,
})

type Worker = Awaited<ReturnType<typeof findWorker>>

// The rates come from the position only when it is paid by the hour; anything else starts at zero.
async function ratesOf(tx: Tx, worker: Worker): Promise<{ hourlyRate: number; overtimeRate: number }> {
  const [position] = worker.positionId
    ? await tx.select().from(positions).where(eq(positions.id, worker.positionId))
    : []
  if (position?.payType !== 'hourly') return { hourlyRate: 0, overtimeRate: 0 }
  return { hourlyRate: position.hourlyRate ?? 0, overtimeRate: position.overtimeRate ?? 0 }
}

// The worker is in the payroll and in the scope of the user. Shared by the clock marks and the full records.
async function findPayrollMember(tx: Tx, user: SessionUser, payrollId: string, workerId: string, date: string) {
  const payroll = await findOpenPayroll(tx, payrollId)
  if (date < payroll.startDate || date > payroll.endDate) throw dateOutsidePayroll()
  const worker = await findWorker(tx, user, workerId)
  const [member] = await tx
    .select({ workerId: payrollWorkers.workerId })
    .from(payrollWorkers)
    .where(and(eq(payrollWorkers.payrollId, payrollId), eq(payrollWorkers.workerId, workerId)))
  if (!member) throw new ApiError(400, 'not_in_payroll', 'El trabajador no está en esta planilla')
  return worker
}

const changedMeanwhile = () =>
  new ApiError(409, 'conflict', 'El registro cambió mientras se guardaba; inténtalo de nuevo')

// Puts one clock mark on the record of a worker and a date, creating the record on the first clock-in.
// Marking is idempotent: a mark that already has a time is answered as it is, without writing.
export async function applyClock(
  tx: Tx,
  user: SessionUser,
  input: { payrollId: string; workerId: string; date: string; mark: Mark; at: Date },
): Promise<{ record: AttendanceRecord; created: boolean }> {
  const { payrollId, workerId, date, mark, at } = input
  const worker = await findPayrollMember(tx, user, payrollId, workerId, date)

  const position = MARKS.indexOf(mark)
  const [existing] = await lockRecord(tx, workerId, date)
  if (existing) return markExisting(tx, user, existing, { payrollId, mark, at })

  // No record yet: only a first clock-in can start one.
  if (position > 0) throw new ApiError(409, 'out_of_order', 'Falta la marca anterior')
  if (limaDate(at) !== date) {
    throw new ApiError(400, 'validation', 'La hora de ingreso no corresponde a ese día', 'at')
  }

  const { hourlyRate, overtimeRate } = await ratesOf(tx, worker)
  const marks: Marks = { clockIn1: at, clockOut1: null, clockIn2: null, clockOut2: null }
  const totals = computeRecord({
    type: 'worked',
    marks,
    employmentType: worker.employmentType,
    hourlyRate,
    overtimeRate,
    overtimeMinutes: null,
  })
  // Two first marks at once (a double tap) both find no record. The unique index lets only one insert win;
  // the other gets nothing back and goes on as a mark on the record that the winner created.
  const [record] = await tx
    .insert(attendanceRecords)
    .values({
      workerId,
      date,
      payrollId,
      type: 'worked',
      ...marks,
      ...totals,
      hourlyRate,
      overtimeRate,
      areaId: worker.areaId,
      employmentType: worker.employmentType,
      recordedBy: user.id,
      // A temporary worker without an hourly rate is paid nothing until accounting sets one.
      needsReview: worker.employmentType === 'temporary' && hourlyRate === 0,
    })
    .onConflictDoNothing()
    .returning()
  if (record) {
    await recordAudit(tx, user.id, 'create', 'attendance_records', record.id, null, record)
    return { record, created: true }
  }
  const [raced] = await lockRecord(tx, workerId, date)
  // The winner was deleted in the meantime: the caller can simply try again.
  if (!raced) throw changedMeanwhile()
  return markExisting(tx, user, raced, { payrollId, mark, at })
}

// Reads the record of a worker and a date and locks its row, so that two marks of the same existing record
// are applied one after the other. When there is no row there is nothing to lock: the first mark is protected
// by the unique index instead (see the insert in applyClock).
const lockRecord = (tx: Tx, workerId: string, date: string) =>
  tx
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, workerId), eq(attendanceRecords.date, date)))
    .for('update')

// A mark on a record that already exists, whether it was found at the start or created by a request that won the race.
async function markExisting(
  tx: Tx,
  user: SessionUser,
  existing: AttendanceRecord,
  input: { payrollId: string; mark: Mark; at: Date },
): Promise<{ record: AttendanceRecord; created: boolean }> {
  const { payrollId, mark, at } = input
  if (existing.payrollId !== payrollId) {
    throw new ApiError(409, 'other_payroll', 'El trabajador ya tiene un registro ese día en otra planilla')
  }
  if (existing.type !== 'worked') {
    throw new ApiError(409, 'not_worked', 'Ese día está marcado como falta o permiso; edita el registro')
  }
  if (existing[mark]) return { record: existing, created: false }

  const position = MARKS.indexOf(mark)
  if (position === 0) {
    if (limaDate(at) !== existing.date) {
      throw new ApiError(400, 'validation', 'La hora de ingreso no corresponde a ese día', 'at')
    }
  } else {
    const previous = existing[MARKS[position - 1]]
    if (!previous) throw new ApiError(409, 'out_of_order', 'Falta la marca anterior')
    if (at.getTime() < previous.getTime()) {
      throw new ApiError(400, 'validation', 'La hora no puede ser anterior a la marca previa', 'at')
    }
    // Marks have no gaps, so a mark that is set after the first one implies the first is set.
    const first = existing.clockIn1 ?? previous
    if (at.getTime() - first.getTime() > DAY_MS) {
      throw new ApiError(400, 'validation', 'La hora está a más de un día del ingreso', 'at')
    }
  }

  const marks: Marks = { ...marksOf(existing), [mark]: at }
  const totals = computeRecord({
    type: 'worked',
    marks,
    employmentType: existing.employmentType,
    hourlyRate: existing.hourlyRate,
    overtimeRate: existing.overtimeRate,
    overtimeMinutes: existing.overtimeEdited ? existing.overtimeMinutes : null,
  })
  const [record] = await tx
    .update(attendanceRecords)
    .set({ [mark]: at, ...totals })
    .where(eq(attendanceRecords.id, existing.id))
    .returning()
  await recordAudit(tx, user.id, 'update', 'attendance_records', record.id, existing, record)
  return { record, created: false }
}

export type RecordFields = Partial<{
  type: 'worked' | 'absence' | 'leave' | 'medical_leave'
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
  // null = back to the suggested overtime; a number = set by hand.
  overtimeMinutes: number | null
  hourlyRate: number
  overtimeRate: number
  note: string | null
  needsReview: boolean
}>

type SaveInput = { fields: RecordFields } & (
  | { recordId: string }
  | { recordId?: undefined; payrollId: string; workerId: string; date: string }
)

// The record to edit or delete: its payroll must be open and its worker in the scope of the user.
// Whatever the user cannot reach answers as if the record did not exist.
async function loadEditable(tx: Tx, user: SessionUser, id: string): Promise<AttendanceRecord> {
  const [record] = await tx.select().from(attendanceRecords).where(eq(attendanceRecords.id, id)).for('update')
  if (!record) throw notFound('El registro')
  await findOpenPayroll(tx, record.payrollId)
  try {
    await findWorker(tx, user, record.workerId)
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) throw notFound('El registro')
    throw error
  }
  return record
}

// The marks that the hours of the body (or the stored ones) give, validated.
function resolveMarks(
  date: string,
  type: NonNullable<RecordFields['type']>,
  fields: RecordFields,
  existing: AttendanceRecord | undefined,
): Marks {
  const none: Marks = { clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null }
  if (type !== 'worked') {
    const sent = MARKS.find((mark) => fields[mark] != null)
    if (sent) throw new ApiError(400, 'validation', 'Una falta o un permiso no lleva horas', sent)
    return none
  }
  // Without hours in the body the stored marks stay exactly as they are (seconds included).
  if (!MARKS.some((mark) => fields[mark] !== undefined)) return existing ? marksOf(existing) : none

  // The hours that did not arrive are the stored ones, as 'HH:MM' of Lima, so that editing one does not move the rest.
  const times = MARKS.map((mark) => {
    if (fields[mark] !== undefined) return fields[mark]
    const stored = existing?.[mark]
    return stored ? limaTime(stored) : null
  })
  const missing = times.findIndex((time, i) => time === null && times.slice(i + 1).some((later) => later !== null))
  if (missing !== -1) throw new ApiError(400, 'validation', 'Completa las marcas en orden', MARKS[missing])

  const instants = marksFromTimes(date, times)
  const set = instants.flatMap((instant, i) => (instant ? [{ instant, mark: MARKS[i] }] : []))
  const first = set[0]
  const last = set[set.length - 1]
  if (first && last.instant.getTime() - first.instant.getTime() > DAY_MS) {
    throw new ApiError(400, 'validation', 'El registro no puede durar más de un día', last.mark)
  }
  const [clockIn1, clockOut1, clockIn2, clockOut2] = instants
  return { clockIn1, clockOut1, clockIn2, clockOut2 }
}

// Creates a record with all its fields, or edits one, and recalculates it. It is what the panel uses to correct
// a day, as opposed to applyClock, which adds one mark at a time.
export async function saveFullRecord(
  tx: Tx,
  user: SessionUser,
  input: SaveInput,
): Promise<{ record: AttendanceRecord; created: boolean }> {
  const { fields } = input
  if (user.role === 'coordinator' && (fields.hourlyRate !== undefined || fields.overtimeRate !== undefined || fields.needsReview !== undefined)) {
    throw new ApiError(403, 'forbidden', 'Tu rol no permite cambiar tarifas')
  }

  if (input.recordId !== undefined) {
    const existing = await loadEditable(tx, user, input.recordId)
    const type = fields.type ?? existing.type
    const marks = resolveMarks(existing.date, type, fields, existing)
    const hourlyRate = fields.hourlyRate ?? existing.hourlyRate
    const overtimeRate = fields.overtimeRate ?? existing.overtimeRate
    // undefined keeps what is stored; a number is set by hand; null goes back to the suggested one.
    const handSet =
      type !== 'worked'
        ? null
        : fields.overtimeMinutes !== undefined
          ? fields.overtimeMinutes
          : existing.overtimeEdited
            ? existing.overtimeMinutes
            : null
    const totals = computeRecord({
      type,
      marks,
      employmentType: existing.employmentType,
      hourlyRate,
      overtimeRate,
      overtimeMinutes: handSet,
    })
    const [record] = await tx
      .update(attendanceRecords)
      .set({
        type,
        ...marks,
        ...totals,
        overtimeEdited: handSet !== null,
        hourlyRate,
        overtimeRate,
        ...(fields.note !== undefined ? { note: fields.note } : {}),
        ...(fields.needsReview !== undefined ? { needsReview: fields.needsReview } : {}),
      })
      .where(eq(attendanceRecords.id, existing.id))
      .returning()
    await recordAudit(tx, user.id, 'update', 'attendance_records', record.id, existing, record)
    return { record, created: false }
  }

  const { payrollId, workerId, date } = input
  const worker = await findPayrollMember(tx, user, payrollId, workerId, date)
  // Only one record per worker and day, in any payroll.
  const clash = (found: AttendanceRecord) =>
    found.payrollId !== payrollId
      ? new ApiError(409, 'other_payroll', 'El trabajador ya tiene un registro ese día en otra planilla')
      : new ApiError(409, 'duplicate', 'Ya existe un registro de ese trabajador ese día')
  const [found] = await lockRecord(tx, workerId, date)
  if (found) throw clash(found)

  const type = fields.type ?? 'worked'
  const marks = resolveMarks(date, type, fields, undefined)
  const copied = await ratesOf(tx, worker)
  const hourlyRate = fields.hourlyRate ?? copied.hourlyRate
  const overtimeRate = fields.overtimeRate ?? copied.overtimeRate
  const handSet = type === 'worked' ? (fields.overtimeMinutes ?? null) : null
  const totals = computeRecord({
    type,
    marks,
    employmentType: worker.employmentType,
    hourlyRate,
    overtimeRate,
    overtimeMinutes: handSet,
  })
  // A double submit: the unique index lets one insert win and the other one answers as a duplicate.
  const [record] = await tx
    .insert(attendanceRecords)
    .values({
      workerId,
      date,
      payrollId,
      type,
      ...marks,
      ...totals,
      overtimeEdited: handSet !== null,
      hourlyRate,
      overtimeRate,
      note: fields.note ?? null,
      areaId: worker.areaId,
      employmentType: worker.employmentType,
      recordedBy: user.id,
      needsReview: fields.needsReview ?? (worker.employmentType === 'temporary' && hourlyRate === 0),
    })
    .onConflictDoNothing()
    .returning()
  if (!record) {
    const [raced] = await lockRecord(tx, workerId, date)
    throw raced ? clash(raced) : changedMeanwhile()
  }
  await recordAudit(tx, user.id, 'create', 'attendance_records', record.id, null, record)
  return { record, created: true }
}

export async function deleteRecord(tx: Tx, user: SessionUser, id: string): Promise<void> {
  const record = await loadEditable(tx, user, id)
  await tx.delete(attendanceRecords).where(eq(attendanceRecords.id, record.id))
  await recordAudit(tx, user.id, 'delete', 'attendance_records', record.id, record, null)
}
