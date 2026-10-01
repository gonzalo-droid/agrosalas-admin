'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { controlClass } from '@/components/field'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Paginator } from '@/components/paginator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, unwrap } from '@/lib/api'
import { ENTITY_LABEL, summarizeChange } from '@/lib/audit-log'
import { correctedPage } from '@/lib/pagination'
import { cn } from '@/lib/utils'

const ENTITIES = Object.keys(ENTITY_LABEL)
const entityLabel = (entity: string) => ENTITY_LABEL[entity] ?? entity
const ACTION_LABEL = { create: 'Creó', update: 'Editó', delete: 'Eliminó' } as const
const dateTime = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

export default function AuditLogPage() {
  const [entity, setEntity] = useState('')
  const [paging, setPaging] = useState({ page: 1, pageSize: 25 })

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['audit-log', entity, paging],
    placeholderData: keepPreviousData,
    queryFn: () =>
      unwrap(
        api.v1['audit-log'].$get({
          query: { page: String(paging.page), pageSize: String(paging.pageSize), ...(entity ? { entity } : {}) },
        }),
      ),
  })

  // If the page is past the end, go to the last one that exists.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">Auditoría</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="entity-filter" className="text-muted-foreground">
            Tabla
          </label>
          <select
            id="entity-filter"
            className={`${controlClass} w-56`}
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value)
              setPaging((p) => ({ ...p, page: 1 }))
            }}
          >
            <option value="">Todas</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {entityLabel(e)}
              </option>
            ))}
          </select>
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
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Cambio</TableHead>
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
                  No hay cambios registrados.
                </TableCell>
              </TableRow>
            )}
            {data?.items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap">{dateTime.format(new Date(row.createdAt))}</TableCell>
                <TableCell>{row.userName}</TableCell>
                <TableCell>{ACTION_LABEL[row.action]}</TableCell>
                <TableCell>{entityLabel(row.entity)}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={summarizeChange(row.action, row.before, row.after)}>
                  {summarizeChange(row.action, row.before, row.after)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginator page={paging.page} pageSize={paging.pageSize} total={data?.total ?? 0} onChange={setPaging} />
    </section>
  )
}
