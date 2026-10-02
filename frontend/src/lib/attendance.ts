import { ApiClientError, errorMessage } from './api'
import { limaTime } from './lima-time'

// The four marks of a day, in the order they happen.
export const MARKS = ['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'] as const
export type Mark = (typeof MARKS)[number]

// Text of the button that sets each mark.
export const MARK_ACTION: Record<Mark, string> = {
  clockIn1: 'Marcar ingreso',
  clockOut1: 'Salida a refrigerio',
  clockIn2: 'Regreso',
  clockOut2: 'Marcar salida',
}

// Name of each mark as a field of the record.
export const MARK_LABEL: Record<Mark, string> = {
  clockIn1: 'Ingreso',
  clockOut1: 'Salida a refrigerio',
  clockIn2: 'Regreso',
  clockOut2: 'Salida',
}

export const ATTENDANCE_TYPE_LABEL = {
  worked: 'Trabajado',
  absence: 'Falta',
  leave: 'Permiso',
  medical_leave: 'Descanso médico',
} as const
export type AttendanceType = keyof typeof ATTENDANCE_TYPE_LABEL

type Marks = Record<Mark, string | null>

// The next step of the day: the first mark without a time. None when the day is complete or was not worked.
export function nextMark(record: (Marks & { type: AttendanceType }) | null): Mark | null {
  if (!record) return 'clockIn1'
  if (record.type !== 'worked') return null
  return MARKS.find((mark) => record[mark] === null) ?? null
}

// True when a stretch has its start and not its end. The backend pays two stretches (clockIn1–clockOut1 and
// clockIn2–clockOut2); the second one is optional, so a day with one closed stretch is complete, not open.
export function hasOpenStretch(record: (Marks & { type: AttendanceType }) | null): boolean {
  if (!record || record.type !== 'worked') return false
  return (record.clockIn1 !== null && record.clockOut1 === null) || (record.clockIn2 !== null && record.clockOut2 === null)
}

// Puts the records an answer carried into a cached list of the day: it replaces the record of the workers they belong to
// and leaves every other item as it was (the same object).
export function applyRecords<I extends { worker: { id: string }; record: { workerId: string } | null }>(
  list: { items: I[] },
  records: NonNullable<I['record']>[],
): { items: I[] } & typeof list {
  const byWorker = new Map(records.map((record) => [record.workerId, record]))
  return { ...list, items: list.items.map((item) => (byWorker.has(item.worker.id) ? { ...item, record: byWorker.get(item.worker.id)! } : item)) }
}

// Address of the daily attendance screen. The date travels only when it is not today: the plain address always means
// "today", also when the screen stays open past midnight.
export function attendanceHref({ date, today, payrollId }: { date: string; today: string; payrollId?: string }): string {
  const query = new URLSearchParams()
  if (date !== today) query.set('date', date)
  if (payrollId) query.set('payrollId', payrollId)
  const text = query.toString()
  return text ? `/attendance?${text}` : '/attendance'
}

// Text of the toast when a mark could not be saved: the message with its final period, and the hint to tap again only
// when tapping again can work (the connection failed, or the record changed under the request).
export function markErrorText(error: unknown): string {
  const message = errorMessage(error)
  const sentence = /[.!?…]$/.test(message) ? message : `${message}.`
  const canTapAgain = error instanceof ApiClientError && (error.code === 'network_error' || error.code === 'conflict')
  return canTapAgain ? `${sentence} Vuelve a tocar el botón.` : sentence
}

// 620 → "10 h 20 min"; 480 → "8 h"; 45 → "45 min".
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// 620 → "10:20": the short form for the grid.
export const formatHours = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

const stretch = (from: string | null, to: string | null) => (from ? `${limaTime(from)} – ${to ? limaTime(to) : '…'}` : '')

// "07:10 – 13:00 · 14:00 – 18:30", in Lima time; an open stretch ends in "…".
export const marksSummary = (record: Marks): string =>
  [stretch(record.clockIn1, record.clockOut1), stretch(record.clockIn2, record.clockOut2)].filter(Boolean).join(' · ')
