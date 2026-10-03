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

// "28/09 al 04/10/2026"; a week that crosses New Year keeps both years: "28/12/2026 al 03/01/2027".
export function weekLabel(start: string, end: string): string {
  const first = start.slice(0, 4) === end.slice(0, 4) ? formatDate(start).slice(0, 5) : formatDate(start)
  return `${first} al ${formatDate(end)}`
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// "2026-10" → "Octubre 2026"
export const monthLabel = (month: string): string => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
