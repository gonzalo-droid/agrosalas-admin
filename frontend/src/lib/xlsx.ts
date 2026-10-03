import type { api, ResponseBody } from './api'
import { formatHours } from './attendance'
import { formatDate } from './format'
import { datesBetween } from './lima-time'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, signedItemCents } from './payments'
import { dayHeader } from './payroll-detail'
import { buildGrid, cellLabel } from './payroll-grid'
import { workerName } from './worker-view'

export type Cell = string | number | null
// money: the cells are numbers in soles with two decimals.
export type Column = { header: string; width?: number; money?: boolean }
export type Sheet = { name: string; columns: Column[]; rows: Cell[][] }

type Payroll = ResponseBody<(typeof api.v1.payrolls)[':id']['$get']>
type Balances = ResponseBody<(typeof api.v1.payrolls)[':id']['balances']['$get']>
type Items = ResponseBody<(typeof api.v1)['payroll-items']['$get']>
type Payment = ResponseBody<typeof api.v1.payments.$get>['items'][number]

// What the export reads of each response: the payments are every page of the list, joined.
export type PayrollExportInput = {
  payroll: Pick<Payroll, 'startDate' | 'endDate'> & {
    workers: Pick<Payroll['workers'][number], 'id' | 'firstName' | 'lastName' | 'dni'>[]
    records: Pick<Payroll['records'][number], 'workerId' | 'date' | 'type' | 'workedMinutes' | 'regularMinutes' | 'overtimeMinutes' | 'amountCents'>[]
  }
  balances: Balances
  items: { items: Pick<Items['items'][number], 'workerId' | 'type' | 'amountCents' | 'note'>[] }
  payments: Pick<Payment, 'date' | 'workerFirstName' | 'workerLastName' | 'method' | 'methodDetail' | 'amountCents' | 'evidencePath'>[]
}

// 6823 → 68.23: the sheets hold numbers in soles, so the person can add them up.
export const solesOf = (cents: number): number => cents / 100

// A file name the operating systems accept: without / \ : * ? " < > |, with single spaces, never empty.
export function safeFileName(text: string): string {
  return text.replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim() || 'reporte'
}

const MONEY_WIDTH = 14

export function payrollSheets({ payroll, balances, items, payments }: PayrollExportInput): Sheet[] {
  const dates = datesBetween(payroll.startDate, payroll.endDate)
  const grid = buildGrid(payroll.workers, dates, payroll.records)
  const balanceOf = new Map(balances.items.map((b) => [b.workerId, b]))
  const nameOf = new Map(payroll.workers.map((w) => [w.id, workerName(w)]))

  // A worker with no balance gets empty money cells: a missing amount is never written as zero.
  const money = (balance: { totalCents: number; paidCents: number; pendingCents: number } | undefined): Cell[] =>
    balance ? [solesOf(balance.totalCents), solesOf(balance.paidCents), solesOf(balance.pendingCents)] : [null, null, null]

  const attendance: Sheet = {
    name: 'Asistencia',
    columns: [
      { header: 'Trabajador', width: 28 },
      { header: 'DNI', width: 12 },
      ...dates.map((date) => ({ header: dayHeader(date), width: 12 })),
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      { header: 'Total (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Pagado (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Pendiente (S/)', width: MONEY_WIDTH, money: true },
    ],
    rows: [
      ...grid.rows.map((row): Cell[] => [
        workerName(row.worker),
        row.worker.dni,
        ...row.cells.map((cell) => cellLabel(cell) || null),
        formatHours(row.totals.regularMinutes),
        formatHours(row.totals.overtimeMinutes),
        ...money(balanceOf.get(row.worker.id)),
      ]),
      [
        'Totales',
        null,
        ...dates.map(() => null),
        formatHours(grid.total.regularMinutes),
        formatHours(grid.total.overtimeMinutes),
        ...money(balances.totals),
      ],
    ],
  }

  const concepts: Sheet = {
    name: 'Conceptos',
    columns: [
      { header: 'Trabajador', width: 28 },
      { header: 'Tipo', width: 14 },
      { header: 'Monto (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Nota', width: 40 },
    ],
    rows: items.items.map((item) => [
      nameOf.get(item.workerId) ?? null,
      ITEM_TYPE_LABEL[item.type],
      solesOf(signedItemCents(item.type, item.amountCents)),
      item.note,
    ]),
  }

  const paymentsSheet: Sheet = {
    name: 'Pagos',
    columns: [
      { header: 'Fecha', width: 12 },
      { header: 'Trabajador', width: 28 },
      { header: 'Medio', width: 16 },
      { header: 'Detalle', width: 36 },
      { header: 'Monto (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Evidencia', width: 11 },
    ],
    rows: payments.map((p) => [
      formatDate(p.date),
      workerName({ firstName: p.workerFirstName, lastName: p.workerLastName }),
      PAYMENT_MEDIUM_LABEL[p.method],
      p.methodDetail,
      solesOf(p.amountCents),
      p.evidencePath ? 'Sí' : 'No',
    ]),
  }

  return [attendance, concepts, paymentsSheet]
}

// The package is read only when a file is made: it stays out of the page's first download.
// Its browser entry (`write-excel-file/browser`) is the one that saves the file through the browser.
export async function downloadXlsx(sheets: Sheet[], fileName: string): Promise<void> {
  const { default: writeXlsxFile } = await import('write-excel-file/browser')
  await writeXlsxFile(
    sheets.map((sheet) => ({
      sheet: sheet.name,
      columns: sheet.columns.map((column) => (column.width === undefined ? {} : { width: column.width })),
      data: [
        sheet.columns.map((column) => ({ value: column.header, fontWeight: 'bold' as const })),
        ...sheet.rows.map((row) =>
          row.map((value, index) =>
            sheet.columns[index].money && typeof value === 'number' ? { value, type: Number, format: '#,##0.00' } : value,
          ),
        ),
      ],
    })),
  ).toFile(fileName)
}
