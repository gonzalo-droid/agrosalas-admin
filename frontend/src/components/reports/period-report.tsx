import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatHours } from '@/lib/attendance'
import { formatCents } from '@/lib/format'
import { signedCentsText } from '@/lib/money'
import { monthLabel, weekLabel } from '@/lib/report-view'
import type { MonthlyExportInput, WeeklyExportInput } from '@/lib/xlsx'

// The weekly and the monthly report are the same table: only the first column changes.
export function PeriodReport({ tab, data }: { tab: 'weekly' | 'monthly'; data: WeeklyExportInput | MonthlyExportInput }) {
  const rows = data.items.map((item) => ({
    key: 'month' in item ? item.month : item.weekStart,
    label: 'month' in item ? monthLabel(item.month) : weekLabel(item.weekStart, item.weekEnd),
    ...item,
  }))

  return (
    <div className="space-y-3">
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
        La asistencia cuenta por la fecha de cada día; los conceptos, en {tab === 'weekly' ? 'la semana' : 'el mes'} en que empieza su planilla.
      </p>
    </div>
  )
}
