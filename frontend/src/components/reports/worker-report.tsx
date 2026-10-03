import Link from 'next/link'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatHours } from '@/lib/attendance'
import { formatCents } from '@/lib/format'
import { pendingText, signedCentsText } from '@/lib/money'
import { workerChart } from '@/lib/report-charts'
import { cn } from '@/lib/utils'
import { workerName } from '@/lib/worker-view'
import type { WorkerExportInput } from '@/lib/xlsx'
import { ReportChart } from './report-chart'

const PENDING_CLASS = 'text-amber-700 dark:text-amber-300'

export function WorkerReport({ data }: { data: WorkerExportInput }) {
  return (
    <div className="space-y-3">
      <ReportChart title="Pagado y pendiente por trabajador (10 con mayor total)" data={workerChart(data.items)} layout="horizontal" />
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>DNI</TableHead>
              <TableHead className="text-right">Días</TableHead>
              <TableHead className="text-right">Horas normales</TableHead>
              <TableHead className="text-right">Horas extra</TableHead>
              <TableHead className="text-right">Asistencia</TableHead>
              <TableHead className="text-right">Conceptos</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Pagado</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((row) => (
              <TableRow key={row.workerId}>
                <TableCell>
                  <Link href={`/workers/${row.workerId}`} className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline">
                    {workerName(row)}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{row.dni ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums">{row.workedDays}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(row.regularMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(row.overtimeMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(row.attendanceCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{signedCentsText(row.itemsCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(row.totalCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(row.paidCents)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', row.pendingCents > 0 && PENDING_CLASS)}>{pendingText(row.pendingCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{data.totals.workedDays}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.regularMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.overtimeMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.attendanceCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{signedCentsText(data.totals.itemsCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.totalCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.paidCents)}</TableCell>
              <TableCell className={cn('text-right tabular-nums', data.totals.pendingCents > 0 && PENDING_CLASS)}>{pendingText(data.totals.pendingCents)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Incluye las planillas que empiezan en el rango, con todos sus días, conceptos y pagos.</p>
    </div>
  )
}
