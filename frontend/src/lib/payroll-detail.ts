import { ATTENDANCE_TYPE_LABEL, formatHours, hasOpenStretch } from './attendance'
import { formatDate } from './format'
import { weekdayOf } from './lima-time'
import { cellLabel, type GridRecord, type Totals } from './payroll-grid'

// What a grid cell needs from a record: the amounts of the grid plus the marks and the review flag.
export type DetailRecord = GridRecord & {
  needsReview: boolean
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
}

// "2026-10-05" → "lun 05": the header of a day column.
export const dayHeader = (date: string): string => `${weekdayOf(date)} ${date.slice(8, 10)}`

// A worked day with a stretch that has started and not ended: the label of the cell shows only the closed stretches.
export const isInProgress = (record: DetailRecord | null): boolean => hasOpenStretch(record)

// What the cell shows: the grid label, with a "…" after the hours of a day in progress.
export function cellText(record: DetailRecord | null): string {
  const label = cellLabel(record)
  return isInProgress(record) && label !== '…' ? `${label}…` : label
}

// The full name of the cell for a screen reader: "Pérez, Ana, lun 05/10: 8:00 +2:20".
export function cellAriaLabel(workerName: string, date: string, record: DetailRecord | null): string {
  const day = `${weekdayOf(date)} ${formatDate(date).slice(0, 5)}`
  if (!record) return `${workerName}, ${day}: sin registro`
  const label = record.type === 'worked' ? cellLabel(record) : ATTENDANCE_TYPE_LABEL[record.type]
  const notes = [isInProgress(record) ? 'en curso' : null, record.needsReview ? 'por revisar' : null].filter(Boolean)
  // A day with no closed stretch has "…" as its label: "en curso" says it better, or "sin horas" when nothing is open.
  const said = label === '…' ? (isInProgress(record) ? null : 'sin horas') : label
  return `${workerName}, ${day}: ${[said, ...notes].filter(Boolean).join(', ')}`
}

export type CellTone = 'empty' | 'worked' | 'overtime' | 'absence' | 'other'

export function cellTone(record: DetailRecord | null): CellTone {
  if (!record) return 'empty'
  if (record.type === 'worked') return record.overtimeMinutes > 0 ? 'overtime' : 'worked'
  return record.type === 'absence' ? 'absence' : 'other'
}

// A total with worked time. Its amount can still be 0 (contract staff are not paid by the day).
export const hasMinutes = (totals: Totals): boolean => totals.regularMinutes > 0 || totals.overtimeMinutes > 0

// "32:00 +2:20", or a dash when nothing was worked.
export function totalsText(totals: Totals): string {
  if (!hasMinutes(totals)) return '–'
  const regular = formatHours(totals.regularMinutes)
  return totals.overtimeMinutes > 0 ? `${regular} +${formatHours(totals.overtimeMinutes)}` : regular
}

// `datesBetween` stops at 62 days: the payroll is longer when the last date shown is before its end.
export const isRangeTruncated = (dates: string[], endDate: string): boolean => dates.length > 0 && dates[dates.length - 1] < endDate

export function daysRecordedByWorker(records: { workerId: string }[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const { workerId } of records) counts.set(workerId, (counts.get(workerId) ?? 0) + 1)
  return counts
}

export type PayrollChanges = { name?: string; startDate?: string; endDate?: string; campaignId?: string | null }

// Only what differs from the stored payroll: the API requires at least one field, so nothing changed = nothing to send.
export function payrollChanges(
  payroll: { name: string; startDate: string; endDate: string; campaignId: string | null },
  form: { name: string; startDate: string; endDate: string; campaignId: string }, // campaignId '' = "Sin campaña"
): PayrollChanges {
  const changes: PayrollChanges = {}
  const name = form.name.trim()
  if (name !== payroll.name) changes.name = name
  if (form.startDate !== payroll.startDate) changes.startDate = form.startDate
  if (form.endDate !== payroll.endDate) changes.endDate = form.endDate
  const campaignId = form.campaignId === '' ? null : form.campaignId
  if (campaignId !== payroll.campaignId) changes.campaignId = campaignId
  return changes
}

export const addedMessage = (added: number): string => (added === 0 ? 'Ya estaban todos' : `${added} ${added === 1 ? 'agregado' : 'agregados'}`)

export type PayrollTab = 'attendance' | 'workers'
export const tabFromParam = (param: string | null): PayrollTab => (param === 'workers' ? 'workers' : 'attendance')
