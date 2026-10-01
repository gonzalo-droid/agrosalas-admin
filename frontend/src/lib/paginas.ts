export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / tamano))

// "Mostrando 26–50 de 73"
export function rangoMostrado(pagina: number, tamano: number, total: number) {
  if (total === 0) return 'Sin resultados'
  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)
  return `Mostrando ${desde}–${hasta} de ${total}`
}

// Si la página pedida quedó más allá del final (la respuesta no trae filas pero el total dice que hay),
// devuelve la última página que existe; si no hay nada que corregir, null.
export function paginaCorregida(pagina: number, tamano: number, total: number, filas: number): number | null {
  if (filas > 0 || total === 0) return null
  const ultima = totalPaginas(total, tamano)
  return pagina > ultima ? ultima : null
}
