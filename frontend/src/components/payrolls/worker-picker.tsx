'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Input } from '@/components/ui/input'
import { api, unwrap, type ResponseBody } from '@/lib/api'
import { useDebouncedValue } from '@/lib/debounced-value'

export type Worker = Pick<ResponseBody<typeof api.v1.workers.$get>['items'][number], 'id' | 'firstName' | 'lastName' | 'dni'>

const MIN_LETTERS = 2
const nameOf = (w: Worker) => `${w.lastName}, ${w.firstName}`

// Searches active workers by name or DNI and keeps the list of the chosen ones.
// `excludeIds` are workers that must not be offered (e.g. the ones already in a payroll).
export function WorkerPicker({
  value,
  onChange,
  excludeIds = [],
}: {
  value: Worker[]
  onChange: (workers: Worker[]) => void
  excludeIds?: string[]
}) {
  const [search, setSearch] = useState('')
  const text = search.trim()
  const debounced = useDebouncedValue(text)
  const enabled = debounced.length >= MIN_LETTERS

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ['workers', 'search', debounced],
    enabled,
    queryFn: () => unwrap(api.v1.workers.$get({ query: { search: debounced, status: 'active', pageSize: '8' } })),
  })

  const taken = new Set([...value.map((w) => w.id), ...excludeIds])
  const results = data?.items.filter((w) => !taken.has(w.id)) ?? []
  // The text typed is ahead of the text searched: what is shown belongs to an older search.
  const searching = text !== debounced || isFetching

  let status: React.ReactNode = null
  if (text.length < MIN_LETTERS) status = <p className="text-sm text-muted-foreground">Escribe al menos 2 letras</p>
  else if (searching) status = <p className="text-sm text-muted-foreground">Buscando…</p>
  else if (error) status = <ErrorWithRetry error={error} onRetry={refetch} />
  else if (results.length === 0) status = <p className="text-sm text-muted-foreground">Sin resultados</p>

  return (
    <div className="space-y-3">
      <Input
        aria-label="Buscar trabajador por nombre o DNI"
        placeholder="Buscar trabajador por nombre o DNI"
        className="h-10"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {status}
      {!status && (
        <ul className="divide-y rounded-lg border">
          {results.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => onChange([...value, w])}
              >
                <span>
                  <span className="font-medium">{nameOf(w)}</span>
                  <span className="block text-xs text-muted-foreground">{w.dni ? `DNI ${w.dni}` : 'DNI pendiente'}</span>
                </span>
                <span className="text-primary">Agregar</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Trabajadores elegidos">
          {value.map((w) => (
            <li key={w.id} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm text-secondary-foreground">
              {nameOf(w)}
              <button
                type="button"
                aria-label={`Quitar a ${nameOf(w)}`}
                className="flex size-7 items-center justify-center rounded-full hover:bg-background focus-visible:outline-2 focus-visible:outline-ring"
                onClick={() => onChange(value.filter((x) => x.id !== w.id))}
              >
                <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
