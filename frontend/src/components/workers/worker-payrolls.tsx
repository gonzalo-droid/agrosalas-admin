'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Paginator } from '@/components/paginator'
import { buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, unwrap } from '@/lib/api'
import { dateRange, formatCents } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { pendingText } from '@/lib/money'
import { correctedPage } from '@/lib/pagination'
import { PAYROLL_STATUS_LABEL, payrollDisplayStatus } from '@/lib/payroll-view'
import { cn } from '@/lib/utils'

const PENDING_CLASS = 'text-amber-700 dark:text-amber-300'

// The payrolls a worker is in, with what they earned, were paid and are owed in each. Only the roles that see money get here.
export function WorkerPayrolls({ workerId }: { workerId: string }) {
  const [paging, setPaging] = useState({ page: 1, pageSize: 10 })
  const today = limaDate(new Date())

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['workers', workerId, 'payrolls', paging],
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.v1.workers[':id'].payrolls.$get({ param: { id: workerId }, query: { page: String(paging.page), pageSize: String(paging.pageSize) } })),
  })

  // If the page is past the end, go to the last one.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  return (
    <section aria-labelledby="worker-payrolls-title" className="space-y-3">
      <h2 id="worker-payrolls-title" className="text-lg font-semibold">
        Planillas
      </h2>
      {error && !data ? (
        <ErrorWithRetry error={error} onRetry={refetch} />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.total === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Todavía no está en ninguna planilla.</p>
      ) : (
        <>
          <div aria-busy={isPlaceholderData} className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Planilla</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Pagado</TableHead>
                  <TableHead className="text-right">Pendiente</TableHead>
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.payrollId}>
                    <TableCell className="whitespace-normal">
                      <Link href={`/payrolls/${row.payrollId}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                        {row.name}
                      </Link>
                      <span className="block text-xs text-muted-foreground">{dateRange(row.startDate, row.endDate)}</span>
                    </TableCell>
                    <TableCell>{PAYROLL_STATUS_LABEL[payrollDisplayStatus(row, today)]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(row.totalCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(row.paidCents)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', row.pendingCents > 0 && PENDING_CLASS)}>{pendingText(row.pendingCents)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Link
                          href={`/payrolls/${row.payrollId}/receipt/${workerId}`}
                          aria-label={`Recibo de la planilla ${row.name}`}
                          className={buttonVariants({ variant: 'outline', size: 'lg', className: 'h-11' })}
                        >
                          Recibo
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <Paginator page={paging.page} pageSize={paging.pageSize} total={data.total} onChange={setPaging} />
        </>
      )}
    </section>
  )
}
