'use client'

import { Button } from '@/components/ui/button'
import { rangoMostrado, totalPaginas } from '@/lib/paginas'
import { claseControl } from './campo'

const TAMANOS = [10, 25, 50]

export function Paginador({
  pagina,
  tamano,
  total,
  alCambiar,
}: {
  pagina: number
  tamano: number
  total: number
  alCambiar: (cambio: { pagina: number; tamano: number }) => void
}) {
  const paginas = totalPaginas(total, tamano)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{rangoMostrado(pagina, tamano, total)}</p>
      <nav aria-label="Paginación" className="flex items-center gap-2">
        <label htmlFor="filas-por-pagina" className="text-muted-foreground">
          Filas por página
        </label>
        <select
          id="filas-por-pagina"
          className={`${claseControl} w-20`}
          value={tamano}
          onChange={(e) => alCambiar({ pagina: 1, tamano: Number(e.target.value) })}
        >
          {TAMANOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button variant="outline" size="lg" disabled={pagina <= 1} onClick={() => alCambiar({ pagina: pagina - 1, tamano })}>
          Anterior
        </Button>
        <span aria-current="page" className="px-1 tabular-nums">
          {pagina} de {paginas}
        </span>
        <Button variant="outline" size="lg" disabled={pagina >= paginas} onClick={() => alCambiar({ pagina: pagina + 1, tamano })}>
          Siguiente
        </Button>
      </nav>
    </div>
  )
}
