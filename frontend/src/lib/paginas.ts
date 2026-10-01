export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / tamano))

// "Mostrando 26–50 de 73"
export function rangoMostrado(pagina: number, tamano: number, total: number) {
  if (total === 0) return 'Sin resultados'
  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)
  return `Mostrando ${desde}–${hasta} de ${total}`
}
