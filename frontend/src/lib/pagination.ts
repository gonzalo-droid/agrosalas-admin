export const totalPages = (total: number, pageSize: number) => Math.max(1, Math.ceil(total / pageSize))

// "Mostrando 26–50 de 73"
export function shownRange(page: number, pageSize: number, total: number) {
  if (total === 0) return 'Sin resultados'
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return `Mostrando ${from}–${to} de ${total}`
}

// If the requested page is past the end (the response has no rows but the total says there are some),
// returns the last page that exists; if there is nothing to correct, null.
export function correctedPage(page: number, pageSize: number, total: number, rows: number): number | null {
  if (rows > 0 || total === 0) return null
  const last = totalPages(total, pageSize)
  return page > last ? last : null
}
