import dynamic from 'next/dynamic'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatHours } from '@/lib/attendance'
import { formatCents } from '@/lib/format'
import { signedCentsText } from '@/lib/money'
import { periodChart } from '@/lib/report-charts'
import { periodLabel } from '@/lib/report-view'
import type { MonthlyExportInput, WeeklyExportInput } from '@/lib/xlsx'

const ReportChart = dynamic(() => import('./report-chart'), {
  ssr: false,
  loading: () => <div className="flex h-[260px] items-center justify-center rounded-xl border bg-background text-sm text-muted-foreground">Cargando gráfico…</div>,
})

// The weekly and the monthly report are the same table: only the first column changes.
export function PeriodReport({ tab, data, range }: { tab: 'weekly' | 'monthly'; data: WeeklyExportInput | MonthlyExportInput; range: { from: string; to: string } }) {
  const rows = data.items.map((item) => ({
    key: 'month' in item ? item.month : item.weekStart,
    label: periodLabel(item, range),
    ...item,
  }))

  return (
    <div className="space-y-3">
      <ReportChart title={tab === 'weekly' ? 'Costo por semana' : 'Costo por mes'} data={periodChart(data.items, range)} layout="vertical" />
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{tab === 'weekly' ? 'Semana' : 'Mes'}</TableHead>
              <TableHead className="text-right">Horas normales</TableHead>
              <TableHead className="text-right">Horas extra</TableHead>
              <TableHead className="text-right">Asistencia</TableHead>
              <TableHead className="text-right">Conceptos</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium whitespace-nowrap">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(row.regularMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(row.overtimeMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(row.attendanceCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{signedCentsText(row.itemsCents)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(row.totalCents)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.regularMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.overtimeMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.attendanceCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{signedCentsText(data.totals.itemsCents)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.totalCents)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">
        Solo cuentan los días dentro del rango. Los conceptos cuentan en {tab === 'weekly' ? 'la semana' : 'el mes'} en que empieza su planilla, si empieza dentro del rango.
      </p>
    </div>
  )
}
