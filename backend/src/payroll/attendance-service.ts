import { and, eq } from 'drizzle-orm'
import { attendanceRecords, payrollWorkers, positions } from '../db/schema'
import { recordAudit } from '../lib/audit'
import { ApiError } from '../lib/errors'
import { findOpenPayroll } from '../routes/payrolls'
import { findWorker } from '../routes/workers'
import type { SessionUser, Tx } from '../types'
import { computeRecord, type Marks } from './calc'
import { limaDate } from './time'

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

// Puts one clock mark on the record of a worker and a date, creating the record on the first clock-in.
// Marking is idempotent: a mark that already has a time is answered as it is, without writing.
export async function applyClock(
  tx: Tx,
  user: SessionUser,
  input: { payrollId: string; workerId: string; date: string; mark: Mark; at: Date },
): Promise<{ record: AttendanceRecord; created: boolean }> {
  const { payrollId, workerId, date, mark, at } = input
  const payroll = await findOpenPayroll(tx, payrollId)
  if (date < payroll.startDate || date > payroll.endDate) throw dateOutsidePayroll()
  const worker = await findWorker(tx, user, workerId)
  const [member] = await tx
    .select({ workerId: payrollWorkers.workerId })
    .from(payrollWorkers)
    .where(and(eq(payrollWorkers.payrollId, payrollId), eq(payrollWorkers.workerId, workerId)))
  if (!member) throw new ApiError(400, 'not_in_payroll', 'El trabajador no está en esta planilla')

  // Locked, so that two marks of the same record at once are applied one after the other.
  const [existing] = await tx
    .select()
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workerId, workerId), eq(attendanceRecords.date, date)))
    .for('update')
  if (existing) {
    if (existing.payrollId !== payrollId) {
      throw new ApiError(409, 'other_payroll', 'El trabajador ya tiene un registro ese día en otra planilla')
    }
    if (existing.type !== 'worked') {
      throw new ApiError(409, 'not_worked', 'Ese día está marcado como falta o permiso; edita el registro')
    }
    if (existing[mark]) return { record: existing, created: false }
  }

  const position = MARKS.indexOf(mark)
  const previous = position === 0 ? null : (existing?.[MARKS[position - 1]] ?? null)
  if (position > 0 && !previous) throw new ApiError(409, 'out_of_order', 'Falta la marca anterior')

  if (position === 0) {
    if (limaDate(at) !== date) {
      throw new ApiError(400, 'validation', 'La hora de ingreso no corresponde a ese día', 'at')
    }
  } else {
    if (at.getTime() < previous!.getTime()) {
      throw new ApiError(400, 'validation', 'La hora no puede ser anterior a la marca previa', 'at')
    }
    // The first clock-in is there: a later mark cannot exist without it.
    if (at.getTime() - existing!.clockIn1!.getTime() > DAY_MS) {
      throw new ApiError(400, 'validation', 'La hora está a más de un día del ingreso', 'at')
    }
  }

  if (!existing) {
    // The rates come from the position only when it is paid by the hour; anything else starts at zero.
    const [workerPosition] = worker.positionId
      ? await tx.select().from(positions).where(eq(positions.id, worker.positionId))
      : []
    const hourly = workerPosition?.payType === 'hourly'
    const hourlyRate = hourly ? (workerPosition.hourlyRate ?? 0) : 0
    const overtimeRate = hourly ? (workerPosition.overtimeRate ?? 0) : 0
    const marks: Marks = { clockIn1: at, clockOut1: null, clockIn2: null, clockOut2: null }
    const totals = computeRecord({
      type: 'worked',
      marks,
      employmentType: worker.employmentType,
      hourlyRate,
      overtimeRate,
      overtimeMinutes: null,
    })
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
        // A temporary worker without a rate is paid nothing until accounting sets one.
        needsReview: worker.employmentType === 'temporary' && hourlyRate === 0 && overtimeRate === 0,
      })
      .returning()
    await recordAudit(tx, user.id, 'create', 'attendance_records', record.id, null, record)
    return { record, created: true }
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
