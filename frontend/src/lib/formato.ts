const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 7.8125 → "S/ 7.81"; null → "–"
export const formatoSoles = (monto: number | null | undefined) => (monto == null ? '–' : `S/ ${soles.format(monto)}`)

// Hora extra propuesta: la normal más 25 %, con cuatro decimales como máximo.
export const horaExtraPropuesta = (tarifaHora: number) => Math.round(tarifaHora * 1.25 * 10000) / 10000

// "2026-10-04" → "04/10/2026"; sin fecha → "—". Se trabaja con el texto, nunca con new Date(),
// para que la zona horaria del navegador no mueva el día.
export function formatoFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const partes = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : iso
}

// Rango de fechas con los extremos que haya: "04/10/2026 a 10/10/2026", "desde …", "hasta …" o "".
export function rangoFechas(inicio: string | null | undefined, fin: string | null | undefined): string {
  if (inicio && fin) return `${formatoFecha(inicio)} a ${formatoFecha(fin)}`
  if (inicio) return `desde ${formatoFecha(inicio)}`
  if (fin) return `hasta ${formatoFecha(fin)}`
  return ''
}
