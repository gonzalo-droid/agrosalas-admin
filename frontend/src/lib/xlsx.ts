import type { api, ResponseBody } from './api'
import { formatHours } from './attendance'
import { formatDate } from './format'
import { datesBetween, limaDate } from './lima-time'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, signedItemCents } from './payments'
import { dayHeader } from './payroll-detail'
import { buildGrid, cellLabel } from './payroll-grid'
import { PAYROLL_STATUS_LABEL, payrollDisplayStatus } from './payroll-view'
import { monthLabel, weekLabel } from './report-view'
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

type CostTotals = { regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number; totalCents: number }
// What the sheets read of the weekly, monthly and by-area reports.
export type WeeklyExportInput = { items: (CostTotals & { weekStart: string; weekEnd: string })[]; totals: CostTotals }
export type MonthlyExportInput = { items: (CostTotals & { month: string })[]; totals: CostTotals }
export type AreaExportInput = {
  items: { areaName: string; workedDays: number; regularMinutes: number; overtimeMinutes: number; attendanceCents: number }[]
  totals: { workedDays: number; regularMinutes: number; overtimeMinutes: number; totalCents: number; itemsCents: number }
}

// One row per week or month plus the totals. The concepts are signed: a deduction subtracts.
export function periodSheet(tab: 'weekly', data: WeeklyExportInput): Sheet
export function periodSheet(tab: 'monthly', data: MonthlyExportInput): Sheet
export function periodSheet(tab: 'weekly' | 'monthly', data: WeeklyExportInput | MonthlyExportInput): Sheet {
  const row = (label: string, t: CostTotals): Cell[] => [
    label,
    formatHours(t.regularMinutes),
    formatHours(t.overtimeMinutes),
    solesOf(t.attendanceCents),
    solesOf(t.itemsCents),
    solesOf(t.totalCents),
  ]
  const header = tab === 'weekly' ? 'Semana' : 'Mes'
  return {
    name: header,
    columns: [
      { header, width: 24 },
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      { header: 'Asistencia (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Conceptos (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Total (S/)', width: MONEY_WIDTH, money: true },
    ],
    rows: [
      ...data.items.map((item) => row('month' in item ? monthLabel(item.month) : weekLabel(item.weekStart, item.weekEnd), item)),
      row('Totales', data.totals),
    ],
  }
}

// One row per area; the payroll items have no area, so they go on a row of their own with only an amount.
export function areaSheet(data: AreaExportInput): Sheet {
  return {
    name: 'Área',
    columns: [
      { header: 'Área', width: 24 },
      { header: 'Días trabajados', width: 16 },
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      { header: 'Monto (S/)', width: MONEY_WIDTH, money: true },
    ],
    rows: [
      ...data.items.map((item): Cell[] => [item.areaName, item.workedDays, formatHours(item.regularMinutes), formatHours(item.overtimeMinutes), solesOf(item.attendanceCents)]),
      ['Conceptos (sin área)', null, null, null, solesOf(data.totals.itemsCents)],
      ['Totales', data.totals.workedDays, formatHours(data.totals.regularMinutes), formatHours(data.totals.overtimeMinutes), solesOf(data.totals.totalCents)],
    ],
  }
}

type Money = { totalCents: number; paidCents: number; pendingCents: number }
type WorkerLine = { workerId: string; firstName: string; lastName: string; dni: string | null; workedDays: number; regularMinutes: number; overtimeMinutes: number } & Money
// What the sheets read of the by-campaign and by-worker reports.
export type CampaignExportInput = {
  items: ({
    key: string
    name: string
    payrollCount: number
    people: number
    workedDays: number
    regularMinutes: number
    overtimeMinutes: number
    payrolls: ({ id: string; name: string; startDate: string; endDate: string; status: 'open' | 'closed' } & Money)[]
    workers: WorkerLine[]
  } & Money)[]
  totals: { payrollCount: number; people: number; workedDays: number; regularMinutes: number; overtimeMinutes: number } & Money
}
export type WorkerExportInput = {
  items: (WorkerLine & { attendanceCents: number; itemsCents: number })[]
  totals: { people: number; workedDays: number; regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number } & Money
}

const moneyCells = (m: Money): Cell[] => [solesOf(m.totalCents), solesOf(m.paidCents), solesOf(m.pendingCents)]
const moneyColumns: Column[] = [
  { header: 'Total (S/)', width: MONEY_WIDTH, money: true },
  { header: 'Pagado (S/)', width: MONEY_WIDTH, money: true },
  { header: 'Pendiente (S/)', width: MONEY_WIDTH, money: true },
]

// Three sheets: a row per campaign (with the totals), per payroll and per worker within a campaign. The campaign is on
// every row of the last two, so each sheet can be filtered on its own. The payroll status is the one the screen shows,
// which depends on today's date.
export function campaignSheets(data: CampaignExportInput, today: string = limaDate(new Date())): Sheet[] {
  const campaigns: Sheet = {
    name: 'Campañas',
    columns: [
      { header: 'Campaña', width: 28 },
      { header: 'Planillas', width: 11 },
      { header: 'Personas', width: 11 },
      { header: 'Días', width: 8 },
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      ...moneyColumns,
    ],
    rows: [
      ...data.items.map((c): Cell[] => [c.name, c.payrollCount, c.people, c.workedDays, formatHours(c.regularMinutes), formatHours(c.overtimeMinutes), ...moneyCells(c)]),
      [
        'Totales',
        data.totals.payrollCount,
        data.totals.people,
        data.totals.workedDays,
        formatHours(data.totals.regularMinutes),
        formatHours(data.totals.overtimeMinutes),
        ...moneyCells(data.totals),
      ],
    ],
  }

  const payrolls: Sheet = {
    name: 'Planillas',
    columns: [
      { header: 'Campaña', width: 28 },
      { header: 'Planilla', width: 28 },
      { header: 'Desde', width: 12 },
      { header: 'Hasta', width: 12 },
      { header: 'Estado', width: 12 },
      ...moneyColumns,
    ],
    rows: data.items.flatMap((c) =>
      c.payrolls.map((p): Cell[] => [
        c.name,
        p.name,
        formatDate(p.startDate),
        formatDate(p.endDate),
        PAYROLL_STATUS_LABEL[payrollDisplayStatus(p, today)],
        ...moneyCells(p),
      ]),
    ),
  }

  const workers: Sheet = {
    name: 'Trabajadores',
    columns: [
      { header: 'Campaña', width: 28 },
      { header: 'Trabajador', width: 28 },
      { header: 'DNI', width: 12 },
      { header: 'Días', width: 8 },
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      ...moneyColumns,
    ],
    rows: data.items.flatMap((c) =>
      c.workers.map((w): Cell[] => [c.name, workerName(w), w.dni, w.workedDays, formatHours(w.regularMinutes), formatHours(w.overtimeMinutes), ...moneyCells(w)]),
    ),
  }

  return [campaigns, payrolls, workers]
}

// One row per worker over every payroll that starts in the range, plus the totals.
export function workerSheet(data: WorkerExportInput): Sheet {
  const row = (label: string, dni: string | null, t: Omit<WorkerExportInput['items'][number], 'workerId' | 'firstName' | 'lastName' | 'dni'>): Cell[] => [
    label,
    dni,
    t.workedDays,
    formatHours(t.regularMinutes),
    formatHours(t.overtimeMinutes),
    solesOf(t.attendanceCents),
    solesOf(t.itemsCents),
    ...moneyCells(t),
  ]
  return {
    name: 'Trabajadores',
    columns: [
      { header: 'Trabajador', width: 28 },
      { header: 'DNI', width: 12 },
      { header: 'Días', width: 8 },
      { header: 'Horas normales', width: 16 },
      { header: 'Horas extra', width: 13 },
      { header: 'Asistencia (S/)', width: MONEY_WIDTH, money: true },
      { header: 'Conceptos (S/)', width: MONEY_WIDTH, money: true },
      ...moneyColumns,
    ],
    rows: [...data.items.map((w) => row(workerName(w), w.dni, w)), row('Totales', null, data.totals)],
  }
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
