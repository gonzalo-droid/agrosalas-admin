import { z } from 'zod'

export const pageSchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(25),
})

export type PageParams = z.infer<typeof pageSchema>

export const offsetOf = (page: PageParams) => (page.pagina - 1) * page.tamano

export const paginated = <T>(items: T[], total: number, page: PageParams) => ({
  datos: items,
  total,
  pagina: page.pagina,
  tamano: page.tamano,
})
