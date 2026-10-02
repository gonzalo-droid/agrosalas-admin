'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { workerName } from '@/components/attendance/record-dialog'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ApiClientError, api, unwrap, type ResponseBody } from '@/lib/api'
import { dateRange, formatCents, formatDate } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { useMe } from '@/lib/me'
import { pendingText, signedCentsText } from '@/lib/money'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, signedItemCents } from '@/lib/payments'
import { seesMoney } from '@/lib/payroll-view'
import { receiptDays } from '@/lib/receipt'

type Receipt = ResponseBody<(typeof api.v1.payrolls)[':id']['workers'][':workerId']['$get']>

const NO_ACCESS = 'No tienes acceso a este recibo.'

export default function ReceiptPage() {
  const { id, workerId } = useParams<{ id: string; workerId: string }>()
  const { data: me } = useMe()
  const showMoney = seesMoney(me?.role)

  // Only the roles that see money ask for it: the API answers 403 to the coordinator.
  const { data, error, refetch } = useQuery({
    queryKey: ['payrolls', id, 'receipt', workerId],
    enabled: showMoney,
    queryFn: () => unwrap(api.v1.payrolls[':id'].workers[':workerId'].$get({ param: { id, workerId } })),
  })

  const backLink = (
    <Link href={`/payrolls/${id}?tab=payments`} className="text-sm text-primary">
      ← Planilla
    </Link>
  )

  if (!me) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const denied = !showMoney || (error instanceof ApiClientError && error.code === 'forbidden')
  if (denied) {
    return (
      <div className="space-y-4">
        {backLink}
        <p className="rounded-xl border bg-background p-4 text-sm text-muted-foreground">{NO_ACCESS}</p>
      </div>
    )
  }
  if (error && !data) {
    return (
      <div className="space-y-4">
        {backLink}
        <ErrorWithRetry error={error} onRetry={refetch} />
      </div>
    )
  }
  if (!data) return <p className="text-sm text-muted-foreground">Cargando…</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {backLink}
        <Button size="lg" className="h-11" onClick={() => window.print()}>
          Imprimir o guardar PDF
        </Button>
      </div>
      <ReceiptSheet receipt={data} />
    </div>
  )
}

const HEADING = 'text-base font-semibold'

// The sheet that is printed: white background, black text and no shadows on paper, and a row is never split between pages.
function ReceiptSheet({ receipt }: { receipt: Receipt }) {
  const { payroll, worker, records, items, payments, balance } = receipt
  const days = receiptDays(records)
  const today = limaDate(new Date())

  return (
    <article
      aria-label="Recibo de planilla"
      className="max-w-3xl space-y-6 rounded-xl border bg-background p-4 md:p-8 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0 print:shadow-none print:[&_*]:text-black print:[&_*]:shadow-none print:[&_tr]:break-inside-avoid"
    >
      <header className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-xl font-bold">Agrosalas Perú</p>
            <h1 className="text-base">Recibo de planilla</h1>
          </div>
          <p className="text-sm text-muted-foreground">{formatDate(today)}</p>
        </div>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-semibold break-words">{payroll.name}</p>
            <p>{dateRange(payroll.startDate, payroll.endDate)}</p>
            {payroll.campaignName && <p className="text-muted-foreground">Campaña: {payroll.campaignName}</p>}
          </div>
          <div>
            <p className="font-semibold break-words">{workerName(worker)}</p>
            <p>{worker.dni ? `DNI ${worker.dni}` : 'Sin DNI'}</p>
            <p className="text-muted-foreground">{worker.positionName ?? 'Sin cargo'}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="receipt-days" className="space-y-2">
        <h2 id="receipt-days" className={HEADING}>
          Días
        </h2>
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin días registrados.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead className="text-right">Horas</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {days.map((day) => (
                <TableRow key={day.date}>
                  <TableCell>{formatDate(day.date)}</TableCell>
                  <TableCell className="whitespace-normal">{day.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{day.hours}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(day.amountCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {items.length > 0 && (
        <section aria-labelledby="receipt-items" className="space-y-2">
          <h2 id="receipt-items" className={HEADING}>
            Conceptos
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{ITEM_TYPE_LABEL[item.type]}</TableCell>
                  <TableCell className="whitespace-normal break-words">{item.note ?? '–'}</TableCell>
                  <TableCell className="text-right tabular-nums">{signedCentsText(signedItemCents(item.type, item.amountCents))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      {payments.length > 0 && (
        <section aria-labelledby="receipt-payments" className="space-y-2">
          <h2 id="receipt-payments" className={HEADING}>
            Pagos
          </h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Medio y detalle</TableHead>
                <TableHead className="text-right">Monto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{formatDate(payment.date)}</TableCell>
                  <TableCell className="whitespace-normal break-words">
                    {PAYMENT_MEDIUM_LABEL[payment.method]}
                    {payment.methodDetail && <span className="block text-xs text-muted-foreground">{payment.methodDetail}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatCents(payment.amountCents)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      )}

      <Summary balance={balance} />
    </article>
  )
}

function Summary({ balance }: { balance: Receipt['balance'] }) {
  const rows: { label: string; value: string; strong?: boolean }[] = [
    { label: 'Asistencia', value: formatCents(balance.attendanceCents) },
    { label: 'Conceptos', value: signedCentsText(balance.additionsCents - balance.deductionsCents) },
    { label: 'Total', value: formatCents(balance.totalCents), strong: true },
    { label: 'Pagado', value: formatCents(balance.paidCents) },
    { label: 'Pendiente', value: pendingText(balance.pendingCents), strong: true },
  ]
  return (
    <dl className="ml-auto max-w-xs space-y-1 text-sm print:break-inside-avoid">
      {rows.map((row) => (
        <div key={row.label} className={row.strong ? 'flex justify-between gap-4 border-t pt-1 font-semibold' : 'flex justify-between gap-4'}>
          <dt>{row.label}</dt>
          <dd className="tabular-nums">{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}
