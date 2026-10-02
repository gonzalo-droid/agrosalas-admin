// Lima has no daylight saving time: it is always five hours behind UTC. The device's time zone is never used.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const inLima = (instant: Date) => new Date(instant.getTime() - LIMA_OFFSET_MS).toISOString()
const utcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`)

// 'YYYY-MM-DD' of an instant, in Lima.
export const limaDate = (instant: Date): string => inLima(instant).slice(0, 10)

// 'HH:MM' in Lima of a mark as the API sends it (an ISO instant); '' when there is no mark.
export const limaTime = (iso: string | null | undefined): string => (iso ? inLima(new Date(iso)).slice(11, 16) : '')

// True only for a real calendar date written 'YYYY-MM-DD'. Checked before any helper below is called with text from the
// outside (e.g. the address): month 13 or day 00 make Date.parse return NaN, and 2026-02-30 would roll over to March.
export function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const time = Date.parse(`${value}T00:00:00Z`)
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value
}

export const addDays = (date: string, days: number): string => new Date(utcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10)

// How many days after the record date a mark falls: 0 the same day, 1 the next one (night shift).
export const dayOffset = (recordDate: string, iso: string): number =>
  Math.round((utcMidnight(limaDate(new Date(iso))) - utcMidnight(recordDate)) / DAY_MS)

// Every date from start to end, both included. Capped at 62 days: a payroll is a week or a month.
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  for (let date = start; date <= end && dates.length < 62; date = addDays(date, 1)) dates.push(date)
  return dates
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const weekdayOf = (date: string): string => WEEKDAYS[new Date(utcMidnight(date)).getUTCDay()]

// Monday = 1 … Sunday = 7.
const isoDay = (date: string) => new Date(utcMidnight(date)).getUTCDay() || 7

// The Monday-to-Sunday week that contains the date.
export function weekOf(date: string): { start: string; end: string } {
  const start = addDays(date, 1 - isoDay(date))
  return { start, end: addDays(start, 6) }
}

// The whole month that contains the date.
export function monthOf(date: string): { start: string; end: string } {
  const [year, month] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = date.slice(0, 7)
  return { start: `${prefix}-01`, end: `${prefix}-${String(lastDay).padStart(2, '0')}` }
}

// ISO week number: the week belongs to the year of its Thursday.
export function isoWeek(date: string): number {
  const thursday = new Date(utcMidnight(addDays(date, 4 - isoDay(date))))
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7)
}
