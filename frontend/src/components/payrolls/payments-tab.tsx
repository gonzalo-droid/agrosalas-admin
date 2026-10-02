'use client'

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { workerName } from '@/components/attendance/record-dialog'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Paginator } from '@/components/paginator'
import { ItemDialog, type PayrollItem } from '@/components/payrolls/item-dialog'
import { Button, buttonVariants } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, errorMessage, unwrap, type ResponseBody } from '@/lib/api'
import { formatCents, formatDate } from '@/lib/format'
import { pendingText, signedCentsText } from '@/lib/money'
import { correctedPage } from '@/lib/pagination'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, invalidateMoney, signedItemCents } from '@/lib/payments'
import { cn } from '@/lib/utils'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>
type Payment = ResponseBody<typeof api.v1.payments.$get>['items'][number]

const PENDING_CLASS = 'text-amber-700 dark:text-amber-300'
// Buttons inside a table row: 44 px tall, so a thumb can hit them.
const ROW_BUTTON = 'h-11'
const BOX = 'overflow-x-auto rounded-xl border bg-background'

type ItemDialogState = { open: boolean; item: PayrollItem | null }

// Balances of each worker, the payroll items and the payments of a payroll. Only the roles that see money get here.
export function PaymentsTab({ payroll, canPay, onPay }: { payroll: Payroll; canPay: boolean; onPay: (workerId: string) => void }) {
  const names = new Map(payroll.workers.map((w) => [w.id, workerName(w)]))
  const nameOf = (workerId: string) => names.get(workerId) ?? '–'

  return (
    <div className="space-y-8">
      <Balances payroll={payroll} canPay={canPay} onPay={onPay} nameOf={nameOf} />
      <Items payroll={payroll} canPay={canPay} nameOf={nameOf} />
      <Payments payroll={payroll} canPay={canPay} />
    </div>
  )
}

function Balances({ payroll, canPay, onPay, nameOf }: { payroll: Payroll; canPay: boolean; onPay: (workerId: string) => void; nameOf: (workerId: string) => string }) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['payrolls', payroll.id, 'balances'],
    queryFn: () => unwrap(api.v1.payrolls[':id'].balances.$get({ param: { id: payroll.id } })),
  })

  return (
    <section aria-labelledby="balances-title" className="space-y-3">
      <h2 id="balances-title" className="text-lg font-semibold">
        Saldos
      </h2>
      {error && !data ? (
        <ErrorWithRetry error={error} onRetry={refetch} />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Esta planilla todavía no tiene trabajadores.</p>
      ) : (
        <div className={BOX}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead className="text-right">Asistencia</TableHead>
                <TableHead className="text-right">Conceptos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagado</TableHead>
                <TableHead className="text-right">Pendiente</TableHead>
                <TableHead>
                  <span className="sr-only">Acciones</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((b) => {
                const name = nameOf(b.workerId)
                return (
                  <TableRow key={b.workerId}>
                    <TableCell className="font-medium">{name}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(b.attendanceCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{signedCentsText(b.additionsCents - b.deductionsCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(b.totalCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(b.paidCents)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', b.pendingCents > 0 && PENDING_CLASS)}>{pendingText(b.pendingCents)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        {canPay && (
                          <Button size="lg" className={ROW_BUTTON} aria-label={`Pagar a ${name}`} onClick={() => onPay(b.workerId)}>
                            Pagar
                          </Button>
                        )}
                        <Link
                          href={`/payrolls/${payroll.id}/receipt/${b.workerId}`}
                          aria-label={`Recibo de ${name}`}
                          className={buttonVariants({ variant: 'outline', size: 'lg', className: ROW_BUTTON })}
                        >
                          Recibo
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Totales</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(data.totals.attendanceCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{signedCentsText(data.totals.additionsCents - data.totals.deductionsCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(data.totals.totalCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(data.totals.paidCents)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', data.totals.pendingCents > 0 && PENDING_CLASS)}>{pendingText(data.totals.pendingCents)}</TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </section>
  )
}

function Items({ payroll, canPay, nameOf }: { payroll: Payroll; canPay: boolean; nameOf: (workerId: string) => string }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<ItemDialogState | null>(null)
  const [removeError, setRemoveError] = useState<string | null>(null)

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['payroll-items', payroll.id],
    queryFn: () => unwrap(api.v1['payroll-items'].$get({ query: { payrollId: payroll.id } })),
  })

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.v1['payroll-items'][':id'].$delete({ param: { id } })),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      toast.success('Concepto eliminado')
      invalidateMoney(queryClient)
    },
    onError: (e) => setRemoveError(errorMessage(e)),
  })

  function confirmRemove(item: PayrollItem) {
    if (window.confirm(`¿Eliminar el concepto ${ITEM_TYPE_LABEL[item.type]} de ${nameOf(item.workerId)}?`)) remove.mutate(item.id)
  }

  return (
    <section aria-labelledby="items-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="items-title" className="text-lg font-semibold">
          Conceptos
        </h2>
        {canPay && (
          <Button size="lg" className={ROW_BUTTON} onClick={() => setDialog({ open: true, item: null })}>
            Agregar concepto
          </Button>
        )}
      </div>

      {removeError && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {error && !data ? (
        <ErrorWithRetry error={error} onRetry={refetch} />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.items.length === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Sin conceptos en esta planilla.</p>
      ) : (
        <div className={BOX}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Trabajador</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">Monto</TableHead>
                <TableHead>Nota</TableHead>
                {canPay && (
                  <TableHead>
                    <span className="sr-only">Acciones</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => {
                const label = `${ITEM_TYPE_LABEL[item.type]} de ${nameOf(item.workerId)}`
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{nameOf(item.workerId)}</TableCell>
                    <TableCell>{ITEM_TYPE_LABEL[item.type]}</TableCell>
                    <TableCell className="text-right tabular-nums">{signedCentsText(signedItemCents(item.type, item.amountCents))}</TableCell>
                    <TableCell className="max-w-64 whitespace-normal break-words text-muted-foreground">{item.note ?? '–'}</TableCell>
                    {canPay && (
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="lg" className={ROW_BUTTON} aria-label={`Editar concepto ${label}`} onClick={() => setDialog({ open: true, item })}>
                            Editar
                          </Button>
                          <Button
                            variant="destructive"
                            size="lg"
                            className={ROW_BUTTON}
                            aria-label={`Eliminar concepto ${label}`}
                            disabled={remove.isPending}
                            onClick={() => confirmRemove(item)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {canPay && dialog && (
        <ItemDialog payroll={payroll} item={dialog.item} open={dialog.open} onOpenChange={(open) => setDialog((d) => d && { ...d, open })} />
      )}
    </section>
  )
}

function Payments({ payroll, canPay }: { payroll: Payroll; canPay: boolean }) {
  const queryClient = useQueryClient()
  const [paging, setPaging] = useState({ page: 1, pageSize: 25 })
  const [removeError, setRemoveError] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['payments', { payrollId: payroll.id }, paging],
    placeholderData: keepPreviousData,
    queryFn: () => unwrap(api.v1.payments.$get({ query: { payrollId: payroll.id, page: String(paging.page), pageSize: String(paging.pageSize) } })),
  })

  // If the page is past the end (e.g. after deleting the last payment of it), go to the last one.
  const corrected = data && !isPlaceholderData ? correctedPage(paging.page, paging.pageSize, data.total, data.items.length) : null
  if (corrected !== null) setPaging((p) => ({ ...p, page: corrected }))

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(api.v1.payments[':id'].$delete({ param: { id } })),
    onMutate: () => setRemoveError(null),
    onSuccess: () => {
      toast.success('Pago eliminado')
      invalidateMoney(queryClient)
    },
    onError: (e) => setRemoveError(errorMessage(e)),
  })

  const nameOfPayment = (p: Payment) => workerName({ firstName: p.workerFirstName, lastName: p.workerLastName })

  function confirmRemove(payment: Payment) {
    if (window.confirm(`¿Eliminar el pago de ${formatCents(payment.amountCents)} a ${nameOfPayment(payment)}? La evidencia se conserva.`)) remove.mutate(payment.id)
  }

  // The tab is opened inside the click, before the request: a window opened after waiting is taken for a pop-up and blocked.
  async function openEvidence(paymentId: string) {
    const tab = window.open('', '_blank')
    setOpening(paymentId)
    try {
      const { url } = await unwrap(api.v1.evidence['read-url'].$get({ query: { paymentId } }))
      if (tab) {
        tab.opener = null
        tab.location.href = url
      } else {
        toast.error('El navegador bloqueó la ventana. Permite las ventanas emergentes para ver la evidencia.')
      }
    } catch (e) {
      tab?.close()
      toast.error(errorMessage(e))
    } finally {
      setOpening(null)
    }
  }

  return (
    <section aria-labelledby="payments-title" className="space-y-3">
      <h2 id="payments-title" className="text-lg font-semibold">
        Pagos
      </h2>

      {removeError && (
        <p role="alert" className="text-sm text-destructive">
          {removeError}
        </p>
      )}

      {error && !data ? (
        <ErrorWithRetry error={error} onRetry={refetch} />
      ) : isPending ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : data.total === 0 ? (
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">Todavía no hay pagos en esta planilla.</p>
      ) : (
        <>
          {/* While the new page arrives, the previous one stays visible, dimmed. */}
          <div aria-busy={isPlaceholderData} className={cn(BOX, 'transition-opacity', isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Trabajador</TableHead>
                  <TableHead>Medio</TableHead>
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead>Evidencia</TableHead>
                  {canPay && (
                    <TableHead>
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((payment) => {
                  const name = nameOfPayment(payment)
                  const description = `pago de ${formatCents(payment.amountCents)} a ${name}`
                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{formatDate(payment.date)}</TableCell>
                      <TableCell className="font-medium">{name}</TableCell>
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
                            className={ROW_BUTTON}
                            aria-label={`Ver la evidencia del ${description}`}
                            disabled={opening === payment.id}
                            onClick={() => void openEvidence(payment.id)}
                          >
                            Ver
                          </Button>
                        ) : (
                          '–'
                        )}
                      </TableCell>
                      {canPay && (
                        <TableCell>
                          <div className="flex justify-end">
                            <Button
                              variant="destructive"
                              size="lg"
                              className={ROW_BUTTON}
                              aria-label={`Eliminar el ${description}`}
                              disabled={remove.isPending}
                              onClick={() => confirmRemove(payment)}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          <Paginator page={paging.page} pageSize={paging.pageSize} total={data.total} onChange={setPaging} />
        </>
      )}
    </section>
  )
}
