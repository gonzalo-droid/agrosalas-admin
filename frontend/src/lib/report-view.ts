import { formatDate } from './format'
import { isRealDate, monthOf } from './lima-time'

export type ReportTab = 'weekly' | 'monthly' | 'area' | 'campaign' | 'worker'

export const REPORT_TABS: { key: ReportTab; label: string }[] = [
  { key: 'weekly', label: 'Semana' },
  { key: 'monthly', label: 'Mes' },
  { key: 'area', label: 'Área' },
  { key: 'campaign', label: 'Campaña' },
  { key: 'worker', label: 'Trabajador' },
]

// The tab named by the address; anything unknown (or missing) is the first one.
export const reportTabFromParam = (param: string | null): ReportTab => REPORT_TABS.find((t) => t.key === param)?.key ?? 'weekly'

// The month of today: what a report shows until the person picks another range.
export function defaultRange(today: string): { from: string; to: string } {
  const { start, end } = monthOf(today)
  return { from: start, to: end }
}

// The range of the address. Each end that is missing or is not a real date falls back to its default, so a shared or
// edited link never sends the API a date it would refuse.
export function rangeFromParams(from: string | null, to: string | null, today: string): { from: string; to: string } {
  const fallback = defaultRange(today)
  return { from: from && isRealDate(from) ? from : fallback.from, to: to && isRealDate(to) ? to : fallback.to }
}

type Range = { from: string; to: string }

// The days of a period that the range covers.
const covered = (start: string, end: string, range: Range) => ({ first: start > range.from ? start : range.from, last: end < range.to ? end : range.to })

// The days the range covers of a Monday-to-Sunday week: "28/09 al 04/10/2026", or "01/10 al 04/10/2026" when the range
// starts on the 1st. One day alone is "31/10/2026". Both years are kept when the covered days cross New Year.
// The report only counts those days, so the label never claims the whole week.
export function weekLabel(start: string, end: string, range: Range): string {
  const { first, last } = covered(start, end, range)
  if (first === last) return formatDate(first)
  return `${first.slice(0, 4) === last.slice(0, 4) ? formatDate(first).slice(0, 5) : formatDate(first)} al ${formatDate(last)}`
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// "2026-10" → "Octubre 2026"; when the range cuts the month, the covered days follow: "Octubre 2026 (01/10 al 15/10)".
export function monthLabel(month: string, range: Range): string {
  const name = `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
  const { start, end } = monthOf(`${month}-01`)
  if (range.from <= start && range.to >= end) return name
  const { first, last } = covered(start, end, range)
  const day = (date: string) => formatDate(date).slice(0, 5)
  return `${name} (${first === last ? day(first) : `${day(first)} al ${day(last)}`})`
}

// The first cell of a weekly or monthly row: the screen and the sheet both use it, so they cannot differ.
export const periodLabel = (item: { weekStart: string; weekEnd: string } | { month: string }, range: Range): string =>
  'month' in item ? monthLabel(item.month, range) : weekLabel(item.weekStart, item.weekEnd, range)
