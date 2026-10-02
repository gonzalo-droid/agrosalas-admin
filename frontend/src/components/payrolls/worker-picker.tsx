'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Input } from '@/components/ui/input'
import { api, unwrap, type ResponseBody } from '@/lib/api'
import { useDebouncedValue } from '@/lib/debounced-value'
import { hasMoreResults, MIN_LETTERS, MORE_RESULTS_TEXT, SEARCH_STATUS_TEXT, searchStatus } from '@/lib/worker-search'

export type Worker = Pick<ResponseBody<typeof api.v1.workers.$get>['items'][number], 'id' | 'firstName' | 'lastName' | 'dni'>

const PAGE_SIZE = 8
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
    // The page size is part of the key: the group screen searches the same text with another size.
    queryKey: ['workers', 'search', debounced, PAGE_SIZE],
    enabled,
    queryFn: () => unwrap(api.v1.workers.$get({ query: { search: debounced, status: 'active', pageSize: String(PAGE_SIZE) } })),
  })

  const taken = new Set([...value.map((w) => w.id), ...excludeIds])
  const results = data?.items.filter((w) => !taken.has(w.id)) ?? []
  // The text typed is ahead of the text searched: what is shown belongs to an older search.
  const searching = text !== debounced || isFetching

  const kind = searchStatus({ textLength: text.length, searching, failed: error !== null, found: data?.items.length ?? 0, offered: results.length })
  let status: React.ReactNode = null
  if (kind === 'failed') status = error && <ErrorWithRetry error={error} onRetry={refetch} />
  else if (kind) status = <p className="text-sm text-muted-foreground">{SEARCH_STATUS_TEXT[kind]}</p>
  const more = data !== undefined && kind !== 'short' && kind !== 'searching' && kind !== 'failed' && hasMoreResults(data.total, data.items.length)

  return (
    <div className="space-y-3">
      <Input
        aria-label="Buscar trabajador por nombre o DNI"
        placeholder="Buscar trabajador por nombre o DNI"
        className="h-10"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        // The picker lives inside a form: Enter (or "Ir" on a phone keyboard) would submit it, creating an empty payroll
        // or adding and closing the dialog. Choosing a worker is done with its button.
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault()
        }}
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
      {more && <p className="text-xs text-muted-foreground">{MORE_RESULTS_TEXT}</p>}

      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Trabajadores elegidos">
          {value.map((w) => (
            <li key={w.id} className="flex items-center gap-1 rounded-full bg-secondary py-1 pl-3 pr-1 text-sm text-secondary-foreground">
              {nameOf(w)}
              <button
                type="button"
                aria-label={`Quitar a ${nameOf(w)}`}
                className="flex size-7 items-center justify-center rounded-full hover:bg-background focus-visible:outline-2 focus-visible:outline-ring max-sm:size-11"
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
