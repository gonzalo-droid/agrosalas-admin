const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 7.8125 → "S/ 7.81"; null → "–"
export const formatoSoles = (monto: number | null | undefined) => (monto == null ? '–' : `S/ ${soles.format(monto)}`)

// Hora extra propuesta: la normal más 25 %, con cuatro decimales como máximo.
export const horaExtraPropuesta = (tarifaHora: number) => Math.round(tarifaHora * 1.25 * 10000) / 10000
