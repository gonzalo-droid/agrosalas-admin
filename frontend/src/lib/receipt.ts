import { ATTENDANCE_TYPE_LABEL, formatHours, type AttendanceType } from './attendance'
import { limaTime } from './lima-time'

type ReceiptRecord = {
  date: string
  type: AttendanceType
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
}

const stretch = (start: string | null, end: string | null) => (start ? `${limaTime(start)}–${end ? limaTime(end) : '…'}` : null)

// One line per day of the receipt: the times in Lima, the regular and overtime hours, and the amount.
export function receiptDays(records: ReceiptRecord[]) {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const worked = r.type === 'worked'
      const label = worked
        ? [stretch(r.clockIn1, r.clockOut1), stretch(r.clockIn2, r.clockOut2)].filter(Boolean).join(' · ')
        : ATTENDANCE_TYPE_LABEL[r.type]
      const minutes = r.regularMinutes + r.overtimeMinutes
      const hours =
        minutes === 0 ? '–' : r.overtimeMinutes > 0 ? `${formatHours(r.regularMinutes)} +${formatHours(r.overtimeMinutes)}` : formatHours(r.regularMinutes)
      return { date: r.date, label, hours, amountCents: r.amountCents }
    })
}
