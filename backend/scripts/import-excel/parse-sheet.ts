import { cellRef, columnIndex, minutesOfDay, numberAt, textAt } from './grid'
import { applyAlias, normalizeName } from './names'
import type { CellValue } from './read-xlsx'
import type { SheetConfig } from './sheets'

export type ReviewReason = 'formula' | 'not_a_time' | 'missing_marks' | 'reversed' | 'times_without_amount' | 'too_long'

export const REVIEW_TEXT: Record<ReviewReason, string> = {
  formula: 'El Excel pagó la jornada con otra regla (posible fórmula errada)',
  not_a_time: 'Hay un valor que no es una hora',
  missing_marks: 'Faltan marcas del día',
  reversed: 'Un tramo tiene la salida antes del ingreso',
  times_without_amount: 'Tiene horas pero el Excel no le pagó ese día',
  too_long: 'Jornada de más de 16 horas',
}

export type ParsedDay = {
  date: string
  /** Minutes of the day in Lima; a mark after midnight is not expected in this file. */
  marks: { clockIn1: number | null; clockOut1: number | null; clockIn2: number | null; clockOut2: number | null }
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
  reasons: ReviewReason[]
}

export type ParsedWorker = {
  row: number
  rawName: string
  name: string
  days: ParsedDay[]
  amountWithoutHoursCents: number
  /** The row total cell; the days' sum when it agrees with them to half a cent (see `warnings`). */
  totalCents: number
  paidCents: number
  warnings: string[]
}

export type ParsedSheet = {
  sheet: string
  campaign: string
  startDate: string
  endDate: string
  hourlyRate: number
  overtimeRate: number
  workers: ParsedWorker[]
  excelTotalCents: number
}

type Grid = Map<string, CellValue>

const REGULAR_MINUTES = 480
const MAX_MINUTES = 960
const REASON_ORDER: ReviewReason[] = ['formula', 'not_a_time', 'missing_marks', 'reversed', 'times_without_amount', 'too_long']

const cents = (soles: number) => Math.round(soles * 100)

const requireRate = (config: SheetConfig, grid: Grid, ref: string): number => {
  const rate = numberAt(grid, ref)
  if (rate === null) throw new Error(`Hoja "${config.sheet}": falta la tarifa en ${ref}`)
  return rate
}

/** The header says "LUNES   13/04/2026"; the date wins over the weekday, which the workbook gets wrong. */
const blockDate = (config: SheetConfig, grid: Grid, column: string): string => {
  const ref = cellRef(column, config.dayHeaderRow)
  const match = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(textAt(grid, ref))
  if (match) {
    const [, day, month, year] = match.map(Number) as [number, number, number, number]
    const parsed = new Date(Date.UTC(year, month - 1, day))
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) {
      return parsed.toISOString().slice(0, 10)
    }
  }
  throw new Error(`Hoja "${config.sheet}": el encabezado ${ref} (columna ${column}) no tiene una fecha dd/mm/aaaa`)
}

/**
 * The day of one worker in the block starting at `start` with its TOTAL in soles, or null when the block holds nothing.
 * `amountCents` is the day rounded on its own; `parseSheet` then rounds the days of a worker cumulatively.
 */
function parseDay(
  grid: Grid,
  start: string,
  row: number,
  date: string,
  rates: { hourly: number; overtime: number },
): { day: ParsedDay; soles: number } | null {
  const at = (offset: number) => numberAt(grid, cellRef(columnIndex(start) + offset, row))
  const cells = [at(0), at(1), at(2), at(3)]
  const total = at(7)
  if (!cells.some((cell) => cell !== null && cell > 0) && !(total !== null && total > 0)) return null

  const reasons = new Set<ReviewReason>()
  const valid: { position: number; minutes: number }[] = []
  cells.forEach((cell, position) => {
    if (cell === null || cell <= 0) return
    if (cell >= 1) reasons.add('not_a_time')
    else valid.push({ position, minutes: minutesOfDay(cell) })
  })

  const marks: ParsedDay['marks'] = { clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null }
  const keys = ['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'] as const
  if (valid.length === 2 || valid.length === 4) {
    valid.forEach((mark, index) => (marks[keys[index]!] = mark.minutes))
  } else {
    // One or three times: they stay in their own cells, and the day cannot be told apart from a typo.
    for (const mark of valid) marks[keys[mark.position]!] = mark.minutes
    if (valid.length > 0) reasons.add('missing_marks')
  }
  if (
    (marks.clockIn1 !== null && marks.clockOut1 !== null && marks.clockOut1 < marks.clockIn1) ||
    (marks.clockIn2 !== null && marks.clockOut2 !== null && marks.clockOut2 < marks.clockIn2)
  ) {
    reasons.add('reversed')
  }

  const workedFraction = at(4) ?? 0
  if (workedFraction < 0) reasons.add('reversed')
  const workedMinutes = workedFraction > 0 ? Math.round(workedFraction * 1440) : 0
  const regularMinutes = Math.round((at(5) ?? 0) * 60)
  const overtimeMinutes = Math.round((at(6) ?? 0) * 60)
  const amountCents = cents(total ?? 0)

  const correctCents = Math.round(
    ((Math.min(workedMinutes, REGULAR_MINUTES) * rates.hourly +
      Math.max(0, workedMinutes - REGULAR_MINUTES) * rates.overtime) /
      60) *
      100,
  )
  if (Math.abs(amountCents - correctCents) > 1) reasons.add('formula')
  if (valid.length > 0 && amountCents === 0) reasons.add('times_without_amount')
  if (workedMinutes > MAX_MINUTES) reasons.add('too_long')

  return {
    day: {
      date,
      marks,
      workedMinutes,
      regularMinutes,
      overtimeMinutes,
      amountCents,
      reasons: REASON_ORDER.filter((reason) => reasons.has(reason)),
    },
    soles: total ?? 0,
  }
}

/** Two decimals, or four when two would show the same figure for two amounts that differ. */
const solesText = (a: number, b: number): [string, string] => {
  const digits = a.toFixed(2) === b.toFixed(2) ? 4 : 2
  return [`S/ ${a.toFixed(digits)}`, `S/ ${b.toFixed(digits)}`]
}

/**
 * Rounds the days cumulatively: the k-th day takes round(sum of the TOTALs of days 1..k) minus the cents already
 * given, so the days add up to their sum rounded once and a worker paid in full is left with nothing pending.
 */
function roundDays(parsed: { day: ParsedDay; soles: number }[]): { days: ParsedDay[]; soles: number; cents: number } {
  let soles = 0
  let given = 0
  const days = parsed.map(({ day, soles: daySoles }) => {
    soles += daySoles
    const amountCents = cents(soles) - given
    given += amountCents
    return { ...day, amountCents }
  })
  return { days, soles, cents: given }
}

function paidCents(config: SheetConfig, grid: Grid, row: number, totalCents: number): number {
  const { payment } = config
  if (payment.kind === 'columns') {
    return cents(payment.columns.reduce((sum, column) => sum + (numberAt(grid, cellRef(column, row)) ?? 0), 0))
  }
  const stamp = payment.text.toLowerCase()
  const stamped = payment.columns.some((column) => textAt(grid, cellRef(column, row)).toLowerCase().includes(stamp))
  return stamped ? totalCents : 0
}

export function parseSheet(config: SheetConfig, grid: Grid, aliases: Record<string, string>): ParsedSheet {
  const rates = {
    hourly: requireRate(config, grid, config.rateCells.hourly),
    overtime: requireRate(config, grid, config.rateCells.overtime),
  }
  const blocks = config.blocks.map((start) => ({ start, date: blockDate(config, grid, start) }))
  const dates = blocks.map((block) => block.date).sort()

  const workers: ParsedWorker[] = []
  for (let row = config.firstWorkerRow; textAt(grid, cellRef('A', row)) !== ''; row++) {
    const rawName = textAt(grid, cellRef('A', row))
    const days = roundDays(blocks.flatMap((block) => parseDay(grid, block.start, row, block.date, rates) ?? []))
    const rowSoles = numberAt(grid, cellRef(config.totalColumn, row)) ?? 0
    const warnings: string[] = []
    let totalCents = cents(rowSoles)
    if (days.days.length > 0) {
      // A tiny tolerance keeps float noise in the sum of the days from counting as a difference.
      if (Math.abs(rowSoles - days.soles) > 0.005 + 1e-9) {
        const [rowText, sumText] = solesText(rowSoles, days.soles)
        warnings.push(`El total de la fila (${rowText}) no es la suma de sus días (${sumText})`)
      } else {
        totalCents = days.cents
      }
    }
    workers.push({
      row,
      rawName,
      name: applyAlias(normalizeName(rawName), aliases),
      days: days.days,
      amountWithoutHoursCents: days.days.length === 0 && totalCents > 0 ? totalCents : 0,
      totalCents,
      paidCents: paidCents(config, grid, row, totalCents),
      warnings,
    })
  }

  return {
    sheet: config.sheet,
    campaign: config.campaign,
    startDate: dates[0]!,
    endDate: dates[dates.length - 1]!,
    hourlyRate: Math.round(rates.hourly * 10000) / 10000,
    overtimeRate: Math.round(rates.overtime * 10000) / 10000,
    workers,
    excelTotalCents: workers.reduce((sum, worker) => sum + worker.totalCents, 0),
  }
}
