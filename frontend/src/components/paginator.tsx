'use client'

import { Button } from '@/components/ui/button'
import { shownRange, totalPages } from '@/lib/pagination'
import { controlClass } from './field'

const PAGE_SIZES = [10, 25, 50]

export function Paginator({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number
  pageSize: number
  total: number
  onChange: (change: { page: number; pageSize: number }) => void
}) {
  const pages = totalPages(total, pageSize)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{shownRange(page, pageSize, total)}</p>
      <nav aria-label="Paginación" className="flex items-center gap-2">
        <label htmlFor="rows-per-page" className="text-muted-foreground">
          Filas por página
        </label>
        <select
          id="rows-per-page"
          className={`${controlClass} w-20`}
          value={pageSize}
          onChange={(e) => onChange({ page: 1, pageSize: Number(e.target.value) })}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <Button variant="outline" size="lg" disabled={page <= 1} onClick={() => onChange({ page: page - 1, pageSize })}>
          Anterior
        </Button>
        <span className="px-1 tabular-nums">
          {page} de {pages}
        </span>
        <Button variant="outline" size="lg" disabled={page >= pages} onClick={() => onChange({ page: page + 1, pageSize })}>
          Siguiente
        </Button>
      </nav>
    </div>
  )
}
