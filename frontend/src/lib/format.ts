const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 7.8125 → "S/ 7.81"; null → "–"
export const formatSoles = (amount: number | null | undefined) => (amount == null ? '–' : `S/ ${soles.format(amount)}`)

// Suggested overtime rate: the regular one plus 25 %, with four decimals at most.
export const suggestedOvertimeRate = (hourlyRate: number) => Math.round(hourlyRate * 1.25 * 10000) / 10000

// "2026-10-04" → "04/10/2026"; no date → "—". It works on the text, never with new Date(),
// so the browser's time zone does not shift the day.
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const parts = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return parts ? `${parts[3]}/${parts[2]}/${parts[1]}` : iso
}

// Date range with whichever ends exist: "04/10/2026 a 10/10/2026", "desde …", "hasta …" or "".
export function dateRange(start: string | null | undefined, end: string | null | undefined): string {
  if (start && end) return `${formatDate(start)} a ${formatDate(end)}`
  if (start) return `desde ${formatDate(start)}`
  if (end) return `hasta ${formatDate(end)}`
  return ''
}
