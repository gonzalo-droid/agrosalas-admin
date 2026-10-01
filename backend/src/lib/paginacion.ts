import { z } from 'zod'

export const esquemaPagina = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(25),
})

export type Pagina = z.infer<typeof esquemaPagina>

export const desplazamiento = (p: Pagina) => (p.pagina - 1) * p.tamano

export const paginado = <T>(datos: T[], total: number, p: Pagina) => ({
  datos,
  total,
  pagina: p.pagina,
  tamano: p.tamano,
})
