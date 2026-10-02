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
