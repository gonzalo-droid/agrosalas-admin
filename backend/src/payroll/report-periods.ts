const DAY_MS = 24 * 60 * 60 * 1000
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const daysInRange = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS) + 1

// Weeks run from Monday to Sunday, like the payrolls.
export function weekStart(date: string): string {
  const ms = utc(date)
  const fromMonday = (new Date(ms).getUTCDay() + 6) % 7
  return iso(ms - fromMonday * DAY_MS)
}

export function weeksInRange(from: string, to: string): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = []
  for (let ms = utc(weekStart(from)); ms <= utc(to); ms += 7 * DAY_MS) {
    weeks.push({ start: iso(ms), end: iso(ms + 6 * DAY_MS) })
  }
  return weeks
}

export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = []
  let [year, month] = from.split('-').map(Number)
  const last = to.slice(0, 7)
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.push(key)
    if (key >= last) return months
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
}

export type DayTotals = { date: string; regularMinutes: number; overtimeMinutes: number; cents: number }
export type PeriodTotals = { regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number; totalCents: number }

// One row per period, in the order given, also the ones that add up to nothing. Amounts outside the periods are ignored.
export function sumByPeriod(
  periods: string[],
  periodOf: (date: string) => string,
  attendance: DayTotals[],
  items: { date: string; cents: number }[],
): (PeriodTotals & { period: string })[] {
  const rows = new Map(periods.map((period) => [period, { period, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 }]))
  for (const day of attendance) {
    const row = rows.get(periodOf(day.date))
    if (!row) continue
    row.regularMinutes += day.regularMinutes
    row.overtimeMinutes += day.overtimeMinutes
    row.attendanceCents += day.cents
  }
  for (const item of items) {
    const row = rows.get(periodOf(item.date))
    if (row) row.itemsCents += item.cents
  }
  for (const row of rows.values()) row.totalCents = row.attendanceCents + row.itemsCents
  return [...rows.values()]
}
