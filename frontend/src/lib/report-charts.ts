import { formatCents } from './format'
import { periodLabel } from './report-view'
import { workerName } from './worker-view'

export type ChartColor = 'primary' | 'amber' | 'muted'
export type ChartSeries = { key: string; label: string; color: ChartColor }
// `label` is the full text (tooltip, screen reader); `tick` is an optional short text for the axis.
export type ChartRow = { label: string; tick?: string; [key: string]: string | number | undefined }
export type ChartData = { rows: ChartRow[]; series: ChartSeries[] }

const PAID_AND_PENDING: ChartSeries[] = [
  { key: 'paid', label: 'Pagado', color: 'primary' },
  { key: 'pending', label: 'Pendiente', color: 'amber' },
]

const axisNumber = new Intl.NumberFormat('es-PE', { maximumFractionDigits: 0 })

// The chart draws soles, not cents: 6823 → 68.23.
export const soles = (cents: number): number => cents / 100

// A money tick of the axis: whole soles, so it stays on one line. "S/ 3,200"; a negative is "S/ -200" like formatSoles.
export const axisSoles = (amount: number): string => `S/ ${axisNumber.format(Math.round(amount) + 0)}`

// A balance in favour of the company (negative pending) is drawn as zero; the table says the exact amount.
const pendingSoles = (pendingCents: number): number => soles(Math.max(0, pendingCents))

// One bar per week or month: the attendance and the items (which can be negative, a discount) stacked.
export function periodChart(
  items: (({ weekStart: string; weekEnd: string } | { month: string }) & { attendanceCents: number; itemsCents: number })[],
  range: { from: string; to: string },
): ChartData {
  return {
    rows: items.map((item) => {
      const label = periodLabel(item, range)
      const row: ChartRow = { label, attendance: soles(item.attendanceCents), items: soles(item.itemsCents) }
      // A week starts its label with the first day it shows ("dd/mm"); that is the short text for the axis.
      if ('weekStart' in item) row.tick = label.slice(0, 5)
      return row
    }),
    series: [
      { key: 'attendance', label: 'Asistencia', color: 'primary' },
      { key: 'items', label: 'Conceptos', color: 'amber' },
    ],
  }
}

// One bar per area, and the items of the payrolls (they belong to no area) as one more bar when there are any.
export function areaChart(data: { items: { areaName: string; attendanceCents: number }[]; itemsCents: number }): ChartData {
  const rows: ChartRow[] = data.items.map((item) => ({ label: item.areaName, amount: soles(item.attendanceCents) }))
  if (data.itemsCents !== 0) rows.push({ label: 'Conceptos (sin área)', amount: soles(data.itemsCents) })
  return { rows, series: [{ key: 'amount', label: 'Monto', color: 'primary' }] }
}

export function campaignChart(items: { name: string; paidCents: number; pendingCents: number }[]): ChartData {
  return {
    rows: items.map((item) => ({ label: item.name, paid: soles(item.paidCents), pending: pendingSoles(item.pendingCents) })),
    series: PAID_AND_PENDING,
  }
}

// The workers with the highest total (a tie goes by last name, then first name); the rest is one "Otros (N)" bar.
export function workerChart(
  items: { firstName: string; lastName: string; paidCents: number; pendingCents: number; totalCents: number }[],
  limit = 10,
): ChartData {
  const sorted = [...items].sort((a, b) => b.totalCents - a.totalCents || a.lastName.localeCompare(b.lastName, 'es') || a.firstName.localeCompare(b.firstName, 'es'))
  const rows: ChartRow[] = sorted.slice(0, limit).map((item) => ({ label: workerName(item), paid: soles(item.paidCents), pending: pendingSoles(item.pendingCents) }))
  const rest = sorted.slice(limit)
  if (rest.length > 0) {
    rows.push({
      label: `Otros (${rest.length})`,
      paid: soles(rest.reduce((sum, item) => sum + item.paidCents, 0)),
      pending: soles(rest.reduce((sum, item) => sum + Math.max(0, item.pendingCents), 0)),
    })
  }
  return { rows, series: PAID_AND_PENDING }
}

// Pixels of the chart: vertical bars have a fixed height, horizontal ones one row each so the names do not crowd.
export const chartHeight = (data: ChartData, layout: 'vertical' | 'horizontal'): number =>
  layout === 'vertical' ? 260 : Math.max(160, 36 * data.rows.length + 60)

// Nothing to draw: no bars, or every value of every series is 0.
export const isEmptyChart = (data: ChartData): boolean => data.rows.every((row) => data.series.every((series) => row[series.key] === 0))

const SUMMARY_ROWS = 12

// The text a screen reader gets for the chart: "Título: Fila 1: Serie S/ 1.00, Serie S/ 2.00; Fila 2: …".
export function chartSummary(title: string, data: ChartData): string {
  const rows = data.rows.slice(0, SUMMARY_ROWS).map((row) => `${row.label}: ${data.series.map((series) => `${series.label} ${formatCents(Math.round(Number(row[series.key]) * 100))}`).join(', ')}`)
  const more = data.rows.length - rows.length
  return `${title}: ${rows.join('; ')}${more > 0 ? `; y ${more} más` : ''}`
}
