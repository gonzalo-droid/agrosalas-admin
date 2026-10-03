'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fragment, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatHours } from '@/lib/attendance'
import { dateRange, formatCents } from '@/lib/format'
import { limaDate } from '@/lib/lima-time'
import { pendingText } from '@/lib/money'
import { campaignChart } from '@/lib/report-charts'
import { PAYROLL_STATUS_LABEL, payrollDisplayStatus } from '@/lib/payroll-view'
import { cn } from '@/lib/utils'
import { workerName } from '@/lib/worker-view'
import type { CampaignExportInput } from '@/lib/xlsx'

const ReportChart = dynamic(() => import('./report-chart'), {
  ssr: false,
  loading: () => <div className="flex h-[260px] items-center justify-center rounded-xl border bg-background text-sm text-muted-foreground">Cargando gráfico…</div>,
})

const PENDING_CLASS = 'text-amber-700 dark:text-amber-300'
const LINK_CLASS = 'inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline'

export function CampaignReport({ data }: { data: CampaignExportInput }) {
  // Which campaigns are open is local: several can be at once, and a link does not need to carry it.
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const today = limaDate(new Date())

  function toggle(key: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (!next.delete(key)) next.add(key)
      return next
    })
  }

  return (
    <div className="space-y-3">
      <ReportChart title="Pagado y pendiente por campaña" data={campaignChart(data.items)} layout="horizontal" />
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campaña</TableHead>
              <TableHead className="text-right">Planillas</TableHead>
              <TableHead className="text-right">Personas</TableHead>
              <TableHead className="text-right">Días</TableHead>
              <TableHead className="text-right">Horas normales</TableHead>
              <TableHead className="text-right">Horas extra</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>
                <span className="sr-only">Acciones</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => {
              const expanded = open.has(row.key)
              const detailId = `campaign-detail-${row.key}`
              return (
                <Fragment key={row.key}>
                  <TableRow>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.payrollCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.people}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.workedDays}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(row.regularMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatHours(row.overtimeMinutes)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(row.totalCents)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCents(row.paidCents)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', row.pendingCents > 0 && PENDING_CLASS)}>{pendingText(row.pendingCents)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="outline"
                          size="lg"
                          className="h-11"
                          aria-expanded={expanded}
                          aria-controls={detailId}
                          aria-label={`Ver detalle de ${row.name}`}
                          onClick={() => toggle(row.key)}
                        >
                          Ver detalle
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow id={detailId} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={10} className="space-y-4 p-3 whitespace-normal">
                        <section aria-label={`Planillas de ${row.name}`} className="space-y-2">
                          <h3 className="text-sm font-semibold">Planillas</h3>
                          <div className="overflow-x-auto rounded-lg border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Planilla</TableHead>
                                  <TableHead>Estado</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="text-right">Pagado</TableHead>
                                  <TableHead className="text-right">Pendiente</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.payrolls.map((payroll) => (
                                  <TableRow key={payroll.id}>
                                    <TableCell>
                                      <Link href={`/payrolls/${payroll.id}`} className={LINK_CLASS}>
                                        {payroll.name}
                                      </Link>
                                      <span className="block text-xs text-muted-foreground">{dateRange(payroll.startDate, payroll.endDate)}</span>
                                    </TableCell>
                                    <TableCell>{PAYROLL_STATUS_LABEL[payrollDisplayStatus(payroll, today)]}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCents(payroll.totalCents)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCents(payroll.paidCents)}</TableCell>
                                    <TableCell className={cn('text-right tabular-nums', payroll.pendingCents > 0 && PENDING_CLASS)}>{pendingText(payroll.pendingCents)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </section>
                        <section aria-label={`Trabajadores de ${row.name}`} className="space-y-2">
                          <h3 className="text-sm font-semibold">Trabajadores</h3>
                          <div className="overflow-x-auto rounded-lg border bg-background">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Trabajador</TableHead>
                                  <TableHead className="text-right">Días</TableHead>
                                  <TableHead className="text-right">Horas normales</TableHead>
                                  <TableHead className="text-right">Horas extra</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="text-right">Pagado</TableHead>
                                  <TableHead className="text-right">Pendiente</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {row.workers.map((worker) => (
                                  <TableRow key={worker.workerId}>
                                    <TableCell>
                                      <Link href={`/workers/${worker.workerId}`} className={LINK_CLASS}>
                                        {workerName(worker)}
                                      </Link>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">{worker.workedDays}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatHours(worker.regularMinutes)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatHours(worker.overtimeMinutes)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCents(worker.totalCents)}</TableCell>
                                    <TableCell className="text-right tabular-nums">{formatCents(worker.paidCents)}</TableCell>
                                    <TableCell className={cn('text-right tabular-nums', worker.pendingCents > 0 && PENDING_CLASS)}>{pendingText(worker.pendingCents)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </section>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              )
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell className="text-right tabular-nums">{data.totals.payrollCount}</TableCell>
              <TableCell className="text-right tabular-nums">{data.totals.people}</TableCell>
              <TableCell className="text-right tabular-nums">{data.totals.workedDays}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.regularMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.overtimeMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.totalCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.paidCents)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', data.totals.pendingCents > 0 && PENDING_CLASS)}>{pendingText(data.totals.pendingCents)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Incluye las planillas que empiezan en el rango, con todos sus días, conceptos y pagos.</p>
    </div>
  )
}
