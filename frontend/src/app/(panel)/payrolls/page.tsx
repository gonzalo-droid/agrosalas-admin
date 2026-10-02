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
import { useCampaigns } from '@/lib/catalogs'
import { useDebouncedValue } from '@/lib/debounced-value'
import { dateRange, formatCents } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { useMe } from '@/lib/me'
import { correctedPage } from '@/lib/pagination'
import { PAYROLL_STATUS_LABEL, PAYROLL_TYPE_LABEL, payrollDisplayStatus } from '@/lib/payroll-view'
import { cn } from '@/lib/utils'

const INITIAL_FILTERS = { search: '', from: '', to: '', campaignId: '', status: '', type: '' }

export default function PayrollsPage() {
  const { data: me } = useMe()
  const { data: campaigns } = useCampaigns()
  const [filters, setFilters] = useState(INITIAL_FILTERS)
  const [paging, setPaging] = useState({ page: 1, pageSize: 25 })
  // Today in Lima, never the device's date.
  const today = limaDate(new Date())

  // The input shows what is typed instantly; the query uses the debounced text.
  const debouncedSearch = useDebouncedValue(filters.search)
  const queryFilters = { ...filters, search: debouncedSearch }

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['payrolls', queryFilters, paging],
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(
        api.v1.payrolls.$get({
          query: {
            page: String(paging.page),
            pageSize: String(paging.pageSize),
            // Only the filters with a value are sent.
            ...Object.fromEntries(Object.entries(queryFilters).filter(([, v]) => v.trim() !== '')),
          },
        }),
      ),
  })

  // If the page is past the end (e.g. because there are fewer payrolls than before), go to the last one.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  function filter(field: keyof typeof INITIAL_FILTERS, value: string) {
    setFilters((f) => ({ ...f, [field]: value }))
    setPaging((p) => ({ ...p, page: 1 }))
  }

  const canCreate = me?.role === 'admin' || me?.role === 'accounting'
  // The coordinator never receives amounts: the column is hidden by role, not by looking at the value.
  const showTotal = me != null && me.role !== 'coordinator'
  const columns = showTotal ? 6 : 5

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Planillas</h1>
        {canCreate && (
          <Link href="/payrolls/new" className={buttonVariants({ size: 'lg' })}>
            Nueva planilla
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Input
          aria-label="Buscar por nombre"
          placeholder="Buscar por nombre"
          className="h-9"
          value={filters.search}
          onChange={(e) => filter('search', e.target.value)}
        />
        <select aria-label="Campaña" className={controlClass} value={filters.campaignId} onChange={(e) => filter('campaignId', e.target.value)}>
          <option value="">Todas las campañas</option>
          {campaigns?.items.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
          <select aria-label="Estado" className={controlClass} value={filters.status} onChange={(e) => filter('status', e.target.value)}>
            <option value="">Todas</option>
            <option value="open">Abiertas</option>
            <option value="closed">Cerradas</option>
          </select>
          <select aria-label="Tipo" className={controlClass} value={filters.type} onChange={(e) => filter('type', e.target.value)}>
            <option value="">Todo tipo</option>
            <option value="weekly">Semanal</option>
            <option value="monthly">Mensual</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:col-span-2">
          <Input aria-label="Desde" type="date" className="h-9" value={filters.from} onChange={(e) => filter('from', e.target.value)} />
          <Input aria-label="Hasta" type="date" className="h-9" value={filters.to} onChange={(e) => filter('to', e.target.value)} />
        </div>
      </div>

      {/* While the new page arrives, the previous one stays visible, dimmed. */}
      <div
        aria-busy={isPlaceholderData}
        className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Planilla</TableHead>
              <TableHead>Campaña</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Personas</TableHead>
              {showTotal && <TableHead className="text-right">Total</TableHead>}
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={columns}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={columns}>
                  <ErrorWithRetry error={error} onRetry={refetch} />
                </TableCell>
              </TableRow>
            )}
            {data?.total === 0 && (
              <TableRow>
                <TableCell colSpan={columns} className="text-muted-foreground">
                  Ninguna planilla coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link href={`/payrolls/${p.id}`} className="font-medium text-primary">
                    {p.name}
                  </Link>
                  <span className="block text-xs text-muted-foreground">{dateRange(p.startDate, p.endDate)}</span>
                </TableCell>
                <TableCell>{p.campaignName ?? '–'}</TableCell>
                <TableCell>{PAYROLL_TYPE_LABEL[p.type]}</TableCell>
                <TableCell>{p.workerCount}</TableCell>
                {showTotal && <TableCell className="text-right">{formatCents(p.totalCents)}</TableCell>}
                <TableCell>
                  <Badge variant={p.status === 'closed' ? 'outline' : 'secondary'}>{PAYROLL_STATUS_LABEL[payrollDisplayStatus(p, today)]}</Badge>
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
