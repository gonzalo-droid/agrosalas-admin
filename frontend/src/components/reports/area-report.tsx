import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatHours } from '@/lib/attendance'
import { formatCents } from '@/lib/format'
import { signedCentsText } from '@/lib/money'
import { areaChart } from '@/lib/report-charts'
import type { AreaExportInput } from '@/lib/xlsx'
import { ReportChart } from './report-chart'

export function AreaReport({ data }: { data: AreaExportInput }) {
  return (
    <div className="space-y-3">
      <ReportChart title="Costo por área" data={areaChart({ items: data.items, itemsCents: data.totals.itemsCents })} layout="horizontal" />
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Área</TableHead>
              <TableHead className="text-right">Días trabajados</TableHead>
              <TableHead className="text-right">Horas normales</TableHead>
              <TableHead className="text-right">Horas extra</TableHead>
              <TableHead className="text-right">Monto</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.items.map((item, index) => (
              // The API groups by area id and names the missing one "Sin área", so two rows can share a name.
              <TableRow key={`${index}-${item.areaName}`}>
                <TableCell className="font-medium">{item.areaName}</TableCell>
                <TableCell className="text-right tabular-nums">{item.workedDays}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(item.regularMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatHours(item.overtimeMinutes)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCents(item.attendanceCents)}</TableCell>
              </TableRow>
            ))}
            {/* The items of a payroll belong to no area: they are shown apart, with only an amount. */}
            <TableRow>
              <TableCell className="font-medium">Conceptos (sin área)</TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="text-right tabular-nums">{signedCentsText(data.totals.itemsCents)}</TableCell>
            </TableRow>
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Totales</TableCell>
              <TableCell className="text-right tabular-nums">{data.totals.workedDays}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.regularMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatHours(data.totals.overtimeMinutes)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCents(data.totals.totalCents)}</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
      <p className="text-xs text-muted-foreground">Los conceptos no tienen área: se muestran aparte.</p>
    </div>
  )
}
