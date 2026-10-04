import { describe, expect, it } from 'vitest'
import type { CellValue } from '../../scripts/import-excel/read-xlsx.js'
import { parseSheet, REVIEW_TEXT } from '../../scripts/import-excel/parse-sheet.js'
import { SHEETS, type SheetConfig } from '../../scripts/import-excel/sheets.js'

const HOURLY = 6.2516667
const OVERTIME = 7.8145833

const gridOf = (cells: Record<string, CellValue>): Map<string, CellValue> =>
  new Map(Object.entries({ F19: HOURLY, F20: OVERTIME, ...cells }))

// One block (B..I) is enough to exercise a day; the real sheets only repeat it.
const config: SheetConfig = {
  ...SHEETS[0]!,
  blocks: ['B'],
  totalColumn: 'BG',
  payment: { kind: 'columns', columns: ['BH', 'BJ'] },
}

const monday = { B22: 'LUNES   13/04/2026' }
const at = (hours: number, minutes = 0) => (hours * 60 + minutes) / 1440

// 07:30-12:00 and 13:00-16:30 = 8 h, all regular.
const goodDay = {
  B24: at(7, 30),
  C24: at(12),
  D24: at(13),
  E24: at(16, 30),
  F24: 8 / 24,
  G24: 8,
  H24: 0,
  I24: 50.01,
}
const worker = { A24: 'QUISPE MAMANI, LUIS' }

const ALIASES = { '3': 'PEREZ ROJAS, ANA', 'TORRES DIAZ, JOSE LUIS': 'TORRES DIAZ, LUIS' }

const parse = (cells: Record<string, CellValue>, sheet: SheetConfig = config) =>
  parseSheet(sheet, gridOf({ ...monday, ...worker, ...cells }), {})

describe('parseSheet', () => {
  it('reads a correct two-leg day', () => {
    const parsed = parse(goodDay)
    expect(parsed.startDate).toBe('2026-04-13')
    expect(parsed.endDate).toBe('2026-04-13')
    expect(parsed.hourlyRate).toBe(6.2517)
    expect(parsed.overtimeRate).toBe(7.8146)
    const [w] = parsed.workers
    expect(w!.row).toBe(24)
    expect(w!.name).toBe('QUISPE MAMANI, LUIS')
    expect(w!.days).toEqual([
      {
        date: '2026-04-13',
        marks: { clockIn1: 450, clockOut1: 720, clockIn2: 780, clockOut2: 990 },
        workedMinutes: 480,
        regularMinutes: 480,
        overtimeMinutes: 0,
        amountCents: 5001,
        reasons: [],
      },
    ])
    expect(w!.totalCents).toBe(0)
    // The row total cell is empty while the day is paid: kept as it is, with a warning.
    expect(w!.warnings).toEqual(['El total de la fila (S/ 0.00) no es la suma de sus días (S/ 50.01)'])
  })

  it('flags a day paid with another rule (whole day as overtime)', () => {
    const parsed = parse({ ...goodDay, G24: 0, H24: 8, I24: 62.52 })
    const [day] = parsed.workers[0]!.days
    expect(day!.reasons).toEqual(['formula'])
    expect(day!.amountCents).toBe(6252)
  })

  it('keeps a single leg written in the first and fourth cells', () => {
    const [day] = parse({ B24: at(8), C24: 0, D24: 0, E24: at(16), F24: 8 / 24, G24: 8, H24: 0, I24: 50.01 })
      .workers[0]!.days
    expect(day!.marks).toEqual({ clockIn1: 480, clockOut1: 960, clockIn2: null, clockOut2: null })
    expect(day!.reasons).toEqual([])
  })

  it('creates a day for a value that is not a time, without marks or amount', () => {
    const [day] = parse({ B24: 7, I24: 0 }).workers[0]!.days
    expect(day).toEqual({
      date: '2026-04-13',
      marks: { clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null },
      workedMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      amountCents: 0,
      reasons: ['not_a_time'],
    })
  })

  it('keeps an odd number of valid times in their own cells and flags the missing marks', () => {
    const [day] = parse({ B24: at(8), C24: at(12), D24: at(13), I24: 25 }).workers[0]!.days
    expect(day!.marks).toEqual({ clockIn1: 480, clockOut1: 720, clockIn2: 780, clockOut2: null })
    expect(day!.reasons).toContain('missing_marks')
    expect(day!.reasons).not.toContain('not_a_time')

    const [single] = parse({ C24: at(12), I24: 25 }).workers[0]!.days
    expect(single!.marks).toEqual({ clockIn1: null, clockOut1: 720, clockIn2: null, clockOut2: null })
    expect(single!.reasons).toContain('missing_marks')
    expect(REVIEW_TEXT.missing_marks).toBe('Faltan marcas del día')
  })

  it('flags a leg whose exit is before its entry', () => {
    const [day] = parse({ ...goodDay, B24: at(14), C24: at(12), F24: 4 / 24, G24: 4, I24: 25 })
      .workers[0]!.days
    expect(day!.reasons).toContain('reversed')
  })

  it('flags a negative day total as reversed and counts no minutes', () => {
    const [day] = parse({ ...goodDay, F24: -0.1, G24: 0, H24: 0, I24: 0 }).workers[0]!.days
    expect(day!.workedMinutes).toBe(0)
    expect(day!.reasons).toContain('reversed')
  })

  it('flags times written without an amount', () => {
    const [day] = parse({ B24: at(8), C24: at(12), F24: 4 / 24, G24: 4 }).workers[0]!.days
    expect(day!.amountCents).toBe(0)
    expect(day!.reasons).toContain('times_without_amount')
  })

  it('flags a day of more than 16 hours', () => {
    const worked = Math.round((18.33 / 24) * 1440)
    const cents = Math.round((480 * HOURLY + (worked - 480) * OVERTIME) / 60 * 100)
    const [day] = parse({
      B24: at(4),
      C24: at(22, 20),
      F24: 18.33 / 24,
      G24: 8,
      H24: (worked - 480) / 60,
      I24: cents / 100,
    }).workers[0]!.days
    expect(day!.workedMinutes).toBe(worked)
    expect(day!.reasons).toEqual(['too_long'])
    // The same day paid with the wrong rule is flagged for both reasons.
    const [wrong] = parse({ B24: at(4), C24: at(22, 20), F24: 18.33 / 24, G24: 0, H24: 18.33, I24: 143.3 })
      .workers[0]!.days
    expect(wrong!.reasons).toEqual(['formula', 'too_long'])
  })

  it('imports a total without days as an amount without hours', () => {
    const [w] = parse({ BG24: 200 }).workers
    expect(w!.days).toEqual([])
    expect(w!.amountWithoutHoursCents).toBe(20000)
    expect(w!.totalCents).toBe(20000)
  })

  it('does not report an amount without hours when the row has days', () => {
    const [w] = parse({ ...goodDay, BG24: 50.01 }).workers
    expect(w!.amountWithoutHoursCents).toBe(0)
    expect(w!.totalCents).toBe(5001)
  })

  describe('cents of a worker', () => {
    const two: SheetConfig = {
      ...config,
      blocks: ['B', 'J'],
      payment: { kind: 'stamp', columns: ['BH', 'BJ'], text: 'CANCELADO' },
    }
    const twoDays = {
      B22: 'LUNES  13/04/2026',
      J22: 'MARTES  14/04/2026',
      ...worker,
      ...goodDay,
      I24: 50.0133,
      J24: at(7, 30),
      K24: at(12),
      L24: at(13),
      M24: at(16, 30),
      N24: 8 / 24,
      O24: 8,
      P24: 0,
      Q24: 50.0133,
    }

    it('rounds the days cumulatively so that they add up to the row total, and a stamp pays it all', () => {
      const [w] = parseSheet(two, gridOf({ ...twoDays, BG24: 100.0266, BH24: 'CANCELADO' }), {}).workers
      // 50.0133 alone rounds to 50.01 twice (100.02), but the row is 100.03: the second day takes the cent.
      expect(w!.days.map((d) => d.amountCents)).toEqual([5001, 5002])
      expect(w!.days.every((d) => d.reasons.length === 0)).toBe(true)
      expect(w!.totalCents).toBe(10003)
      expect(w!.paidCents).toBe(10003)
      expect(w!.days.reduce((sum, d) => sum + d.amountCents, 0) - w!.paidCents).toBe(0)
      expect(w!.warnings).toEqual([])
    })

    it('warns when the row total is not the sum of its days, and keeps the row total', () => {
      const [w] = parseSheet(two, gridOf({ ...twoDays, BG24: 120, BH24: 'CANCELADO' }), {}).workers
      expect(w!.days.map((d) => d.amountCents)).toEqual([5001, 5002])
      expect(w!.totalCents).toBe(12000)
      expect(w!.paidCents).toBe(12000)
      expect(w!.warnings).toEqual(['El total de la fila (S/ 120.00) no es la suma de sus días (S/ 100.03)'])
    })

    it('accepts up to half a cent between the row total and its days', () => {
      const [w] = parseSheet(two, gridOf({ ...twoDays, BG24: 100.03 }), {}).workers
      expect(w!.totalCents).toBe(10003)
      expect(w!.warnings).toEqual([])
    })

    it('shows more decimals when two cents would hide the difference', () => {
      // Both round to 50.01, yet they are almost a cent apart.
      const [w] = parse({ ...goodDay, I24: 50.0051, BG24: 50.0149 }).workers
      expect(w!.totalCents).toBe(5001)
      expect(w!.warnings).toEqual(['El total de la fila (S/ 50.0149) no es la suma de sus días (S/ 50.0051)'])
    })
  })

  it('sums the total column of the worker rows, each rounded to the cent', () => {
    const grid = gridOf({
      ...monday,
      A24: 'A, A',
      BG24: 10.004,
      A25: 'B, B',
      BG25: 20.006,
      A26: 'C, C',
      // A27 is empty: the rows after it are not read.
      A28: 'D, D',
      BG28: 999,
    })
    const parsed = parseSheet(config, grid, {})
    expect(parsed.workers.map((w) => w.row)).toEqual([24, 25, 26])
    expect(parsed.excelTotalCents).toBe(1000 + 2001)
  })

  describe('payments', () => {
    it('sums the numbers of the columns', () => {
      expect(parse({ BG24: 100, BH24: 40 }).workers[0]!.paidCents).toBe(4000)
      expect(parse({ BG24: 100, BH24: 40, BJ24: 10.5 }).workers[0]!.paidCents).toBe(5050)
      expect(parse({ BG24: 100 }).workers[0]!.paidCents).toBe(0)
    })

    it('pays the row total when a column carries the stamp', () => {
      const stamp: SheetConfig = {
        ...config,
        payment: { kind: 'stamp', columns: ['BH', 'BJ'], text: 'CANCELADO' },
      }
      expect(parse({ BG24: 100, BH24: 'Cancelado' }, stamp).workers[0]!.paidCents).toBe(10000)
      expect(parse({ BG24: 100, BJ24: 'CANCELADO ' }, stamp).workers[0]!.paidCents).toBe(10000)
      expect(parse({ BG24: 100, BH24: 'pendiente' }, stamp).workers[0]!.paidCents).toBe(0)
      expect(parse({ BG24: 100 }, stamp).workers[0]!.paidCents).toBe(0)
    })

    it('is not broken by cells the reader skipped (formula errors)', () => {
      // A cell with an error value is simply absent from the grid.
      const parsed = parse({ BG24: 100, BH24: 40 })
      expect(parsed.workers[0]!.paidCents).toBe(4000)
    })
  })

  it('uses the date of the header, not the weekday', () => {
    const parsed = parseSheet(
      config,
      gridOf({ B22: 'LUNES    09/05/2026', ...worker, ...goodDay }),
      {},
    )
    expect(parsed.workers[0]!.days[0]!.date).toBe('2026-05-09')
  })

  it('takes the first and last block dates as the period', () => {
    const two: SheetConfig = { ...config, blocks: ['B', 'J'] }
    const parsed = parseSheet(
      two,
      gridOf({ B22: 'LUNES  13/04/2026', J22: 'MARTES  14/04/2026', ...worker }),
      {},
    )
    expect(parsed.startDate).toBe('2026-04-13')
    expect(parsed.endDate).toBe('2026-04-14')
  })

  it('reads the second block from its own columns', () => {
    const two: SheetConfig = { ...config, blocks: ['B', 'J'] }
    const parsed = parseSheet(
      two,
      gridOf({
        B22: 'LUNES  13/04/2026',
        J22: 'MARTES  14/04/2026',
        ...worker,
        J24: at(8),
        K24: at(12),
        N24: 4 / 24,
        O24: 4,
        P24: 0,
        Q24: 25,
      }),
      {},
    )
    const days = parsed.workers[0]!.days
    expect(days).toHaveLength(1)
    expect(days[0]!.date).toBe('2026-04-14')
    expect(days[0]!.marks.clockOut1).toBe(720)
  })

  it('applies the aliases to the name', () => {
    const parsed = parseSheet(config, gridOf({ ...monday, A24: 3 }), ALIASES)
    expect(parsed.workers[0]!.rawName).toBe('3')
    expect(parsed.workers[0]!.name).toBe('PEREZ ROJAS, ANA')
  })

  it('normalises the name before looking for the alias', () => {
    const parsed = parseSheet(
      config,
      gridOf({ ...monday, A24: ' torres  diaz ,  jose luis ' }),
      ALIASES,
    )
    expect(parsed.workers[0]!.name).toBe('TORRES DIAZ, LUIS')
  })

  it('fails with the sheet and column when a block header has no date', () => {
    expect(() => parseSheet(config, gridOf({ B22: 'LUNES', ...worker }), {})).toThrow(
      /13 al 19 1era sem.*B/,
    )
    expect(() => parseSheet(config, gridOf({ ...worker }), {})).toThrow(/B/)
  })

  it('fails when a rate is missing', () => {
    const grid = gridOf({ ...monday, ...worker })
    grid.delete('F20')
    expect(() => parseSheet(config, grid, {})).toThrow(/F20/)
  })

  it('words a reason in Spanish for each review reason', () => {
    expect(Object.keys(REVIEW_TEXT).sort()).toEqual(
      ['formula', 'missing_marks', 'not_a_time', 'reversed', 'times_without_amount', 'too_long'].sort(),
    )
    for (const text of Object.values(REVIEW_TEXT)) expect(text.length).toBeGreaterThan(10)
  })
})

describe('SHEETS', () => {
  it('lists the four sheets with the shared layout', () => {
    expect(SHEETS.map((s) => s.sheet)).toEqual([
      '13 al 19 1era sem',
      'SEM 17 20 AL 25',
      '9 MAYO',
      'ETI 5 AL 10 Junio',
    ])
    for (const s of SHEETS) {
      expect(s.rateCells).toEqual({ hourly: 'F19', overtime: 'F20' })
      expect(s.dayHeaderRow).toBe(22)
      expect(s.firstWorkerRow).toBe(24)
    }
  })

  it('sets the campaigns', () => {
    expect(SHEETS.map((s) => s.campaign)).toEqual([
      'Contenedor Chile',
      'Contenedor Chile',
      'Contenedor Chile',
      'Etiquetado junio',
    ])
  })

  it('sets the day blocks and the total column', () => {
    expect(SHEETS.map((s) => [s.blocks, s.totalColumn])).toEqual([
      [['B', 'J', 'R', 'Z', 'AH', 'AP', 'AX'], 'BG'],
      [['B', 'J', 'R', 'Z', 'AH', 'AP'], 'BG'],
      [['B'], 'I'],
      [['B', 'J', 'R', 'Z', 'AH', 'AP'], 'AY'],
    ])
  })

  it('sets how each sheet was paid', () => {
    expect(SHEETS.map((s) => s.payment)).toEqual([
      { kind: 'columns', columns: ['BH', 'BJ'] },
      { kind: 'stamp', columns: ['BH', 'BJ'], text: 'CANCELADO' },
      { kind: 'columns', columns: ['M'] },
      { kind: 'columns', columns: ['AZ'] },
    ])
  })
})
