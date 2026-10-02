import { formatHours, type AttendanceType } from './attendance'

// What the grid needs from an attendance record.
export type GridRecord = {
  workerId: string
  date: string
  type: AttendanceType
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  // null for the coordinator, who never receives money.
  amountCents: number | null
}

export type Totals = { regularMinutes: number; overtimeMinutes: number; amountCents: number | null }

const ZERO: Totals = { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }

// An amount that is missing (null) makes the whole sum unknown: it is never shown as zero.
const add = (totals: Totals, record: GridRecord): Totals => ({
  regularMinutes: totals.regularMinutes + record.regularMinutes,
  overtimeMinutes: totals.overtimeMinutes + record.overtimeMinutes,
  amountCents: totals.amountCents === null || record.amountCents === null ? null : totals.amountCents + record.amountCents,
})

// Workers in rows, dates in columns, with the totals of each row, each column and the whole payroll.
export function buildGrid<W extends { id: string }, R extends GridRecord>(workers: W[], dates: string[], records: R[]) {
  const byCell = new Map(records.map((record) => [`${record.workerId}|${record.date}`, record]))
  const rows = workers.map((worker) => {
    const cells = dates.map((date) => byCell.get(`${worker.id}|${date}`) ?? null)
    return { worker, cells, totals: cells.reduce<Totals>((totals, cell) => (cell ? add(totals, cell) : totals), ZERO) }
  })
  const dayTotals = dates.map((_, column) =>
    rows.reduce<Totals>((totals, row) => {
      const cell = row.cells[column]
      return cell ? add(totals, cell) : totals
    }, ZERO),
  )
  const total = rows.reduce<Totals>(
    (totals, row) => ({
      regularMinutes: totals.regularMinutes + row.totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes + row.totals.overtimeMinutes,
      amountCents: totals.amountCents === null || row.totals.amountCents === null ? null : totals.amountCents + row.totals.amountCents,
    }),
    ZERO,
  )
  return { rows, dayTotals, total }
}

const NOT_WORKED: Record<Exclude<AttendanceType, 'worked'>, string> = { absence: 'F', leave: 'P', medical_leave: 'DM' }

// Text of a cell: "8:00 +2:20" (regular and overtime hours), "…" for a day in progress, "F", "P" or "DM".
export function cellLabel(record: GridRecord | null): string {
  if (!record) return ''
  if (record.type !== 'worked') return NOT_WORKED[record.type]
  if (record.workedMinutes === 0) return '…'
  const regular = formatHours(record.regularMinutes)
  return record.overtimeMinutes > 0 ? `${regular} +${formatHours(record.overtimeMinutes)}` : regular
}
