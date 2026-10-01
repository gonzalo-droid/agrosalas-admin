'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { controlClass } from '@/components/field'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Paginator } from '@/components/paginator'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, unwrap } from '@/lib/api'
import { useAreas, usePositions } from '@/lib/catalogs'
import { correctedPage } from '@/lib/pagination'
import { cn } from '@/lib/utils'
import { useDebouncedValue } from '@/lib/debounced-value'
import { useMe } from '@/lib/me'

const INITIAL_FILTERS = { search: '', areaId: '', employmentType: '', status: 'active' }

export default function WorkersPage() {
  const { data: me } = useMe()
  const { data: areas } = useAreas()
  const { data: positions } = usePositions()
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [paging, setPaging] = useState({ page: 1, pageSize: 25 })

  // The input shows what is typed instantly; the query uses the debounced text.
  const debouncedSearch = useDebouncedValue(filters.search)
  const queryFilters = { ...filters, search: debouncedSearch }

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['workers', queryFilters, paging],
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(
        api.v1.workers.$get({
          query: {
            page: String(paging.page),
            pageSize: String(paging.pageSize),
            // Only the filters with a value are sent.
            ...Object.fromEntries(Object.entries(queryFilters).filter(([, v]) => v.trim() !== '')),
          },
        }),
      ),
  })

  // If the page is past the end (e.g. because there are fewer workers than before), go to the last one.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  function filter(field: keyof typeof INITIAL_FILTERS, value: string) {
    setFilters((f) => ({ ...f, [field]: value }))
    setPaging((p) => ({ ...p, page: 1 }))
  }

  const canCreate = me?.role === 'admin' || me?.role === 'accounting'
  const nameOf = (list: { id: string; name: string }[] | undefined, id: string | null) =>
    list?.find((x) => x.id === id)?.name ?? '–'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trabajadores</h1>
        {canCreate && (
          <Link href="/workers/new" className={buttonVariants({ size: 'lg' })}>
            Nuevo trabajador
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem]">
        <Input
          aria-label="Buscar por nombre o DNI"
          placeholder="Buscar por nombre o DNI"
          className="h-9"
          value={filters.search}
          onChange={(e) => filter('search', e.target.value)}
        />
        <select aria-label="Área" className={controlClass} value={filters.areaId} onChange={(e) => filter('areaId', e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas?.items.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select aria-label="Modalidad" className={controlClass} value={filters.employmentType} onChange={(e) => filter('employmentType', e.target.value)}>
          <option value="">Toda modalidad</option>
          <option value="temporary">Temporal</option>
          <option value="contract">Contrato</option>
        </select>
        <select aria-label="Estado" className={controlClass} value={filters.status} onChange={(e) => filter('status', e.target.value)}>
          <option value="active">Activos</option>
          <option value="terminated">Cesados</option>
          <option value="">Todos</option>
        </select>
      </div>

      {/* While the new page arrives, the previous one stays visible, dimmed. */}
      <div
        aria-busy={isPlaceholderData}
        className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5}>
                  <ErrorWithRetry error={error} onRetry={refetch} />
                </TableCell>
              </TableRow>
            )}
            {data?.total === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Ningún trabajador coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((w) => (
              <TableRow key={w.id}>
                <TableCell>
                  <Link href={`/workers/${w.id}`} className="font-medium text-primary">
                    {w.lastName}, {w.firstName}
                  </Link>
                  <span className={`block text-xs ${w.dni ? 'text-muted-foreground' : 'font-semibold text-amber-800'}`}>
                    {w.dni ? `DNI ${w.dni}` : 'DNI pendiente'}
                  </span>
                </TableCell>
                <TableCell>{nameOf(areas?.items, w.areaId)}</TableCell>
                <TableCell>{nameOf(positions?.items, w.positionId)}</TableCell>
                <TableCell>{w.employmentType === 'contract' ? 'Contrato' : 'Temporal'}</TableCell>
                <TableCell>
                  <Badge variant={w.status === 'active' ? 'secondary' : 'outline'}>{w.status === 'active' ? 'Activo' : 'Cesado'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {data && <Paginator page={paging.page} pageSize={paging.pageSize} total={data.total} onChange={setPaging} />}
    </div>
  )
}
