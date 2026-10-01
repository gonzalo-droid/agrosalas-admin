import { z } from 'zod'

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})

export type PageParams = z.infer<typeof pageSchema>

export const offsetOf = (params: PageParams) => (params.page - 1) * params.pageSize

export const paginated = <T>(items: T[], total: number, params: PageParams) => ({
  items,
  total,
  page: params.page,
  pageSize: params.pageSize,
})
