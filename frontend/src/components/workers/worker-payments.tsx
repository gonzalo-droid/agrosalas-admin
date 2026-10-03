'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Paginator } from '@/components/paginator'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, unwrap } from '@/lib/api'
import { useEvidenceViewer } from '@/lib/evidence-viewer'
import { formatCents, formatDate } from '@/lib/format'
import { correctedPage } from '@/lib/pagination'
import { PAYMENT_MEDIUM_LABEL } from '@/lib/payments'
import { cn } from '@/lib/utils'

// Every payment made to a worker, across payrolls. Only the roles that see money get here.
export function WorkerPayments({ workerId }: { workerId: string }) {
  const [paging, setPaging] = useState({ page: 1, pageSize: 10 })
  const evidence = useEvidenceViewer()

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['payments', { workerId }, paging],
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.v1.payments.$get({ query: { workerId, page: String(paging.page), pageSize: String(paging.pageSize) } })),
  })

  // If the page is past the end, go to the last one.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  return (
    <section aria-labelledby="worker-payments-title" className="space-y-3">
      <h2 id="worker-payments-title" className="text-lg font-semibold">
        Pagos
      </h2>
      {error && !data ? (
        <ErrorWithRetry error={error} onRetry={refetch} />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.total === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Todavía no tiene pagos.</p>
      ) : (
        <>
          <div aria-busy={isPlaceholderData} className={cn('overflow-x-auto rounded-xl border bg-background transition-opacity', isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Planilla</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Evidencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.date)}</TableCell>
                    <TableCell className="whitespace-normal">
                      <Link href={`/payrolls/${payment.payrollId}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                        {payment.payrollName}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {PAYMENT_MEDIUM_LABEL[payment.method]}
                      {payment.methodDetail && <span className="block text-xs text-muted-foreground">{payment.methodDetail}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(payment.amountCents)}</TableCell>
                    <TableCell>
                      {payment.evidencePath ? (
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-11"
                          aria-label={`Ver la evidencia del pago de ${formatCents(payment.amountCents)} de la planilla ${payment.payrollName}`}
                          disabled={evidence.opening === payment.id}
                          onClick={() => void evidence.open(payment.id)}
                        >
                          Ver
                        </Button>
                      ) : (
                        '–'
                      )}
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
