'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RecordDialog, workerName, type DayRecord } from '@/components/attendance/record-dialog'
import { ErrorWithRetry } from '@/components/error-with-retry'
import { Button } from '@/components/ui/button'
import { api, unwrap, type ResponseBody } from '@/lib/api'
import { formatCents } from '@/lib/format'
import { datesBetween, limaDate } from '@/lib/lima-time'
import { pendingText } from '@/lib/money'
import { buildGrid } from '@/lib/payroll-grid'
import { cellAriaLabel, cellText, cellTone, dayHeader, hasMinutes, isRangeTruncated, totalsText, type CellTone } from '@/lib/payroll-detail'
import { cn } from '@/lib/utils'

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>
type GridWorker = Payroll['workers'][number]

const TONE_CLASS: Record<CellTone, string> = {
  empty: 'hover:bg-muted',
  worked: 'bg-green-100 text-green-900 hover:bg-green-200 dark:bg-green-950 dark:text-green-100 dark:hover:bg-green-900',
  overtime: 'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900',
  absence: 'bg-red-100 text-red-900 hover:bg-red-200 dark:bg-red-950 dark:text-red-100 dark:hover:bg-red-900',
  other: 'bg-muted text-foreground hover:bg-muted/70',
}

const PENDING_CLASS = 'text-amber-700 dark:text-amber-300'

const STICKY = 'sticky left-0 z-10 border-r bg-background'

type DialogState = { open: boolean; worker: GridWorker; date: string; record: DayRecord | null }

// Workers in rows and days in columns, like the sheet it replaces. Only the scroll container is wider than the page.
export function AttendanceGrid({
  payroll,
  canEditMoney,
  canRegister,
  readOnly,
  showMoney,
  onGoToWorkers,
}: {
  payroll: Payroll
  canEditMoney: boolean // admin and accounting: the dialog shows the rates
  canRegister: boolean // admin, accounting and coordinator
  readOnly: boolean // management: the dialog opens only to read
  showMoney: boolean // everyone but the coordinator; a missing amount is never painted as zero
  onGoToWorkers: () => void
}) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<DialogState | null>(null)
  // Today in Lima, never the device's date.
  const today = limaDate(new Date())

  const dates = useMemo(() => datesBetween(payroll.startDate, payroll.endDate), [payroll.startDate, payroll.endDate])
  const grid = useMemo(() => buildGrid(payroll.workers, dates, payroll.records), [payroll.workers, dates, payroll.records])

  // The balances carry the money of each worker (attendance plus payroll items, and what was paid). The coordinator
  // never receives them: the request is not even made. The key is shared with the payments tab and the closing dialog.
  const balances = useQuery({
    queryKey: ['payrolls', payroll.id, 'balances'],
    enabled: showMoney,
    queryFn: () => unwrap(api.v1.payrolls[':id'].balances.$get({ param: { id: payroll.id } })),
  })
  const balanceOf = useMemo(() => new Map(balances.data?.items.map((b) => [b.workerId, b])), [balances.data])
  // "…" while the balances load, a dash when they could not be loaded.
  const shown = (cents: number | undefined, text: (cents: number) => string) => (cents !== undefined ? text(cents) : balances.isPending ? '…' : '–')
  const isDue = (cents: number | undefined) => cents !== undefined && cents > 0

  // On a phone the grid opens on the first days of the payroll: bring today's column next to the name column. The
  // scroll is set on the grid's own container, so the page never moves, and the name column is measured rather than
  // assumed: it is sticky and grows with the longest name.
  const scroller = useRef<HTMLDivElement>(null)
  const nameColumn = useRef<HTMLTableCellElement>(null)
  const todayColumn = useRef<HTMLTableCellElement>(null)
  const hasWorkers = payroll.workers.length > 0
  const todayInRange = dates.includes(today)
  useEffect(() => {
    const container = scroller.current
    const column = todayColumn.current
    if (!hasWorkers || !todayInRange || !container || !column) return
    container.scrollLeft = column.offsetLeft - (nameColumn.current?.offsetWidth ?? 0)
  }, [payroll.id, hasWorkers, todayInRange])

  if (payroll.workers.length === 0) {
    return (
      <div className="space-y-3 rounded-xl border bg-background p-4">
        <p className="text-sm text-muted-foreground">Esta planilla todavía no tiene trabajadores.</p>
        <Button variant="outline" size="lg" onClick={onGoToWorkers}>
          Ir a Trabajadores
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {isRangeTruncated(dates, payroll.endDate) && (
        <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
          Se muestran los primeros 62 días de la planilla.
        </p>
      )}

      {showMoney && balances.error && !balances.data && <ErrorWithRetry error={balances.error} onRetry={balances.refetch} />}

      <div ref={scroller} className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th ref={nameColumn} scope="col" className={cn(STICKY, 'z-20 h-10 w-36 min-w-36 border-b px-2 text-left font-medium sm:w-48 sm:min-w-48')}>
                Trabajador
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  ref={date === today ? todayColumn : undefined}
                  scope="col"
                  aria-current={date === today ? 'date' : undefined}
                  className={cn('h-10 min-w-[4.75rem] border-b px-1 text-center font-medium whitespace-nowrap', date === today && 'bg-primary/10 text-primary')}
                >
                  {dayHeader(date)}
                </th>
              ))}
              <th scope="col" className="h-10 min-w-24 border-b border-l px-2 text-right font-medium">
                Total
              </th>
              {showMoney && (
                <>
                  <th scope="col" className="h-10 min-w-24 border-b px-2 text-right font-medium">
                    Pagado
                  </th>
                  <th scope="col" className="h-10 min-w-24 border-b px-2 text-right font-medium">
                    Pendiente
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const name = workerName(row.worker)
              const balance = balanceOf.get(row.worker.id)
              return (
                <tr key={row.worker.id}>
                  <th scope="row" className={cn(STICKY, 'h-10 w-36 min-w-36 border-b px-2 text-left font-medium sm:w-48 sm:min-w-48')}>
                    <span className="block truncate" title={name}>
                      {name}
                    </span>
                  </th>
                  {row.cells.map((record, column) => {
                    const date = dates[column]
                    const tone = cellTone(record)
                    return (
                      <td key={date} className={cn('h-10 border-b p-0.5 text-center', date === today && 'bg-primary/5')}>
                        {record === null && !canRegister ? null : (
                          <button
                            type="button"
                            aria-label={cellAriaLabel(name, date, record)}
                            className={cn(
                              'relative h-9 w-full min-w-[4.25rem] rounded-md px-1 whitespace-nowrap tabular-nums outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                              TONE_CLASS[tone],
                            )}
                            onClick={() => setDialog({ open: true, worker: row.worker, date, record })}
                          >
                            {cellText(record)}
                            {record?.needsReview && <span aria-hidden className="absolute top-1 right-1 size-1.5 rounded-full bg-amber-500" />}
                          </button>
                        )}
                      </td>
                    )
                  })}
                  <td className="h-10 border-b border-l px-2 text-right tabular-nums">
                    <span className="block font-medium">{totalsText(row.totals)}</span>
                    {/* The balance's total includes the payroll items; the sum of the days does not. */}
                    {showMoney && <span className="block text-muted-foreground">{shown(balance?.totalCents, formatCents)}</span>}
                  </td>
                  {showMoney && (
                    <>
                      <td className="h-10 border-b px-2 text-right tabular-nums">{shown(balance?.paidCents, formatCents)}</td>
                      <td className={cn('h-10 border-b px-2 text-right tabular-nums', isDue(balance?.pendingCents) && PENDING_CLASS)}>
                        {shown(balance?.pendingCents, pendingText)}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className={cn(STICKY, 'h-10 px-2 text-left font-semibold')}>
                Totales
              </th>
              {grid.dayTotals.map((totals, column) => (
                <td key={dates[column]} className={cn('px-1 py-1 text-center tabular-nums', dates[column] === today && 'bg-primary/5')}>
                  <span className="block font-medium">{totalsText(totals)}</span>
                  {showMoney && hasMinutes(totals) && <span className="block text-muted-foreground">{formatCents(totals.amountCents)}</span>}
                </td>
              ))}
              <td className="border-l px-2 py-1 text-right tabular-nums">
                <span className="block font-semibold">{totalsText(grid.total)}</span>
                {showMoney && <span className="block font-semibold">{shown(balances.data?.totals.totalCents, formatCents)}</span>}
              </td>
              {showMoney && (
                <>
                  <td className="px-2 py-1 text-right font-semibold tabular-nums">{shown(balances.data?.totals.paidCents, formatCents)}</td>
                  <td className={cn('px-2 py-1 text-right font-semibold tabular-nums', isDue(balances.data?.totals.pendingCents) && PENDING_CLASS)}>
                    {shown(balances.data?.totals.pendingCents, pendingText)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {dialog && (
        <RecordDialog
          open={dialog.open}
          onOpenChange={(open) => setDialog((d) => d && { ...d, open })}
          payrollId={payroll.id}
          date={dialog.date}
          worker={dialog.worker}
          record={dialog.record}
          canEditMoney={canEditMoney}
          showMoney={showMoney}
          readOnly={readOnly}
          onSaved={() => {
            // The dialog refreshes the payrolls (this detail and the list); the day screen would show the old record.
            void queryClient.invalidateQueries({ queryKey: ['attendance'] })
          }}
        />
      )}
    </div>
  )
}
