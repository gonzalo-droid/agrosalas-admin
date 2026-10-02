'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { RecordDialog, workerName, type DayRecord } from '@/components/attendance/record-dialog'
import { Button } from '@/components/ui/button'
import type { api, ResponseBody } from '@/lib/api'
import { formatCents } from '@/lib/format'
import { datesBetween, limaDate } from '@/lib/lima-time'
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

  // On a phone the grid opens on the first days of the payroll: bring today's column into view, inside the grid's own
  // scroll container. 'nearest' on the block axis leaves the page where it is; the scroll margin keeps the column from
  // hiding under the sticky name column (w-36, or w-48 from the sm breakpoint).
  const todayColumn = useRef<HTMLTableCellElement>(null)
  const hasWorkers = payroll.workers.length > 0
  const todayInRange = dates.includes(today)
  useEffect(() => {
    if (hasWorkers && todayInRange) todayColumn.current?.scrollIntoView({ inline: 'start', block: 'nearest' })
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

      <div className="overflow-x-auto rounded-xl border bg-background">
        <table className="w-max min-w-full border-separate border-spacing-0 text-xs">
          <thead>
            <tr>
              <th scope="col" className={cn(STICKY, 'z-20 h-10 w-36 min-w-36 border-b px-2 text-left font-medium sm:w-48 sm:min-w-48')}>
                Trabajador
              </th>
              {dates.map((date) => (
                <th
                  key={date}
                  ref={date === today ? todayColumn : undefined}
                  scope="col"
                  aria-current={date === today ? 'date' : undefined}
                  className={cn('h-10 min-w-[4.75rem] scroll-ml-36 border-b px-1 text-center font-medium whitespace-nowrap sm:scroll-ml-48', date === today && 'bg-primary/10 text-primary')}
                >
                  {dayHeader(date)}
                </th>
              ))}
              <th scope="col" className="h-10 min-w-24 border-b border-l px-2 text-right font-medium">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row) => {
              const name = workerName(row.worker)
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
                    {showMoney && <span className="block text-muted-foreground">{formatCents(row.totals.amountCents)}</span>}
                  </td>
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
                {showMoney && <span className="block font-semibold">{formatCents(grid.total.amountCents)}</span>}
              </td>
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
