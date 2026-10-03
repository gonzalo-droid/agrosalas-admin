import { describe, expect, it } from 'vitest'
import { REVIEW_TEXT, type ParsedDay, type ParsedSheet, type ParsedWorker } from '../../scripts/import-excel/parse-sheet.js'
import { buildSummary, findNegatives } from '../../scripts/import-excel/summary.js'

const day = (date: string, amountCents: number, overrides: Partial<ParsedDay> = {}): ParsedDay => ({
  date,
  marks: { clockIn1: 450, clockOut1: 720, clockIn2: 780, clockOut2: 990 },
  workedMinutes: 480,
  regularMinutes: 480,
  overtimeMinutes: 0,
  amountCents,
  reasons: [],
  ...overrides,
})

const worker = (name: string, days: ParsedDay[], overrides: Partial<ParsedWorker> = {}): ParsedWorker => {
  const totalCents = days.reduce((sum, d) => sum + d.amountCents, 0)
  return {
    row: 24,
    rawName: name,
    name,
    days,
    amountWithoutHoursCents: 0,
    totalCents,
    paidCents: 0,
    warnings: [],
    ...overrides,
  }
}

const sheetOne = (): ParsedSheet => ({
  sheet: '13 al 19 1era sem',
  campaign: 'Contenedor Chile',
  startDate: '2026-04-13',
  endDate: '2026-04-19',
  hourlyRate: 6.2517,
  overtimeRate: 7.8146,
  excelTotalCents: 10000 + 5000 + 20000,
  workers: [
    worker('QUISPE MAMANI, LUIS', [day('2026-04-13', 5001), day('2026-04-14', 4999)], {
      totalCents: 10000,
      paidCents: 10000,
    }),
    worker('PEREZ ROJAS, ANA', [day('2026-04-13', 5000, { reasons: ['formula', 'too_long'] })], {
      totalCents: 5000,
      paidCents: 2000,
    }),
    worker('PEREZ LUNA, ANA', [], { amountWithoutHoursCents: 20000, totalCents: 20000, paidCents: 0 }),
  ],
})

const sheetTwo = (): ParsedSheet => ({
  sheet: 'SEM 17 20 AL 25',
  campaign: 'Contenedor Chile',
  startDate: '2026-04-20',
  endDate: '2026-04-25',
  hourlyRate: 6.2517,
  overtimeRate: 7.8146,
  excelTotalCents: 4000,
  workers: [
    worker('QUISPE MAMANI, LUIS', [day('2026-04-20', 4000, { reasons: ['not_a_time'] })], {
      totalCents: 4000,
      paidCents: 4000,
    }),
    // A worker without any data on the sheet must not count as "with data".
    worker('SIN DATOS, NADIE', [], { totalCents: 0 }),
  ],
})

const options = { similar: [] as [string, string][], aliasesUsed: [] as [string, string][], unusedAliases: [] as string[] }

describe('buildSummary', () => {
  it('says it is a dry run by default and that it loads into the database in commit mode', () => {
    const dryRun = buildSummary([sheetOne()], options)
    expect(dryRun).toContain('Prueba en seco: no se escribió nada en la base.')
    expect(buildSummary([sheetOne()], { ...options, mode: 'dry-run' })).toBe(dryRun)

    const commit = buildSummary([sheetOne()], { ...options, mode: 'commit' })
    expect(commit).toContain('Carga en la base')
    expect(commit).not.toContain('Prueba en seco')
  })

  it('describes each sheet: campaign, dates, rates, workers, days and the payment figures', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)

    expect(text).toContain('13 al 19 1era sem')
    expect(text).toContain('SEM 17 20 AL 25')
    expect(text).toContain('Contenedor Chile')
    expect(text).toContain('13/04/2026')
    expect(text).toContain('19/04/2026')
    expect(text).toContain('6.2517')
    expect(text).toContain('7.8146')
    expect(text).toMatch(/Trabajadores con datos: 3/)
    expect(text).toMatch(/Días: 3/)
    expect(text).toMatch(/Pagado: S\/ 120\.00/)
    expect(text).toMatch(/Pendiente: S\/ 230\.00/)
  })

  it('shows the Excel total, the imported total and a rounding-only difference without a warning', () => {
    const text = buildSummary([sheetOne()], options)

    // Days add 5001 + 4999 + 5000 = 15000, plus 20000 without hours = 35000, equal to the Excel total.
    expect(text).toMatch(/Total del Excel: S\/ 350\.00/)
    expect(text).toMatch(/Total importado \(asistencia \+ montos sin horas\): S\/ 350\.00/)
    expect(text).toMatch(/Diferencia: S\/ 0\.00/)
    expect(text).not.toContain('Diferencia mayor que el redondeo')
  })

  it('accepts half a cent per day as rounding and nothing more', () => {
    const sheet = sheetOne()
    // 3 days, so up to 1.5 cents of difference is rounding: 1 cent is fine.
    sheet.excelTotalCents += 1
    expect(buildSummary([sheet], options)).not.toContain('Diferencia mayor que el redondeo')

    sheet.excelTotalCents += 1 // now 2 cents over 3 days
    const text = buildSummary([sheet], options)
    expect(text).toContain('⚠ Diferencia mayor que el redondeo')
    expect(text).toMatch(/Diferencia: S\/ 0\.02/)
  })

  it('warns when the imported total is larger than the Excel total too', () => {
    const sheet = sheetOne()
    sheet.excelTotalCents -= 500
    const text = buildSummary([sheet], options)
    expect(text).toContain('⚠ Diferencia mayor que el redondeo')
    expect(text).toMatch(/Diferencia: -S\/ 5\.00/)
  })

  it('computes pending from the imported cents, not from the Excel total, and lists the row warnings', () => {
    const sheet: ParsedSheet = {
      ...sheetTwo(),
      excelTotalCents: 10003 + 6000,
      workers: [
        // Paid in full: the days were rounded cumulatively, so nothing is left pending.
        worker('QUISPE MAMANI, LUIS', [day('2026-04-20', 5001), day('2026-04-21', 5002)], { paidCents: 10003 }),
        worker('TORRES DIAZ, LUIS', [day('2026-04-20', 5001)], {
          totalCents: 6000,
          warnings: ['El total de la fila (S/ 60.00) no es la suma de sus días (S/ 50.01)'],
        }),
      ],
    }
    const text = buildSummary([sheet], options)

    expect(text).toMatch(/\| QUISPE MAMANI, LUIS \| 2 \| S\/ 100\.03 \| S\/ 100\.03 \| S\/ 100\.03 \| S\/ 0\.00 \|/)
    expect(text).toMatch(/\| TORRES DIAZ, LUIS \| 1 \| S\/ 50\.01 \| S\/ 60\.00 \| S\/ 0\.00 \| S\/ 50\.01 \|/)
    expect(text).toMatch(/Total del Excel: S\/ 160\.03/)
    expect(text).toMatch(/Total importado \(asistencia \+ montos sin horas\): S\/ 150\.04/)
    expect(text).toMatch(/Pagado: S\/ 100\.03/)
    expect(text).toMatch(/Pendiente: S\/ 50\.01/)
    expect(text).toContain('- ⚠ TORRES DIAZ, LUIS: El total de la fila (S/ 60.00) no es la suma de sus días (S/ 50.01)')
  })

  it('counts the days to review by reason, in Spanish', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)

    expect(text).toContain(REVIEW_TEXT.formula)
    expect(text).toContain(REVIEW_TEXT.too_long)
    expect(text).toContain(REVIEW_TEXT.not_a_time)
    expect(text).toMatch(/Días a revisar: 1\b/)
    expect(text).not.toContain(REVIEW_TEXT.reversed)
  })

  it('lists one table row per worker with data, with the reasons, and leaves out the empty ones', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)

    expect(text).toContain('| Trabajador | Días | Importado | Total del Excel | Pagado | Pendiente | Motivos |')
    expect(text).toMatch(/\| PEREZ ROJAS, ANA \| 1 \| S\/ 50\.00 \| S\/ 50\.00 \| S\/ 20\.00 \| S\/ 30\.00 \|/)
    expect(text).toContain(REVIEW_TEXT.formula)
    expect(text).not.toContain('SIN DATOS, NADIE')
  })

  it('lists the workers with data split into surnames and given names, once each', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)
    const section = text.slice(text.indexOf('## Trabajadores con datos'))

    expect(section).toContain('QUISPE MAMANI, LUIS → apellidos: QUISPE MAMANI; nombres: LUIS')
    expect(section.match(/QUISPE MAMANI, LUIS →/g)).toHaveLength(1)
    expect(section).toContain('Trabajadores con datos (3)')
    expect(text).not.toContain('Trabajadores nuevos')
  })

  it('lists a name aliased to a DNI as an existing worker', () => {
    const sheet = sheetTwo()
    sheet.workers.push(worker('dni:12345678', [day('2026-04-21', 100)]))
    const section = buildSummary([sheet], options).split('## Trabajadores con datos')[1]!

    expect(section).toContain('- dni:12345678 → el trabajador existente con DNI 12345678')
  })

  it('lists the applied aliases and the similar names that were not unified', () => {
    const text = buildSummary([sheetOne()], {
      ...options,
      aliasesUsed: [['3', 'PEREZ ROJAS, ANA']],
      similar: [['TORRES DIAZ, LUIS', 'TORRES DIAZ, JOSE LUIS']],
    })

    expect(text).toContain('3 → PEREZ ROJAS, ANA')
    expect(text).toContain('TORRES DIAZ, LUIS ≈ TORRES DIAZ, JOSE LUIS')
  })

  it('says so when there are no aliases or similar names', () => {
    const text = buildSummary([sheetOne()], options)
    expect(text).toContain('## Alias aplicados (0)\n\nNinguno.')
    expect(text).toContain('## Nombres parecidos sin unificar (0)\n\nNinguno.')
    expect(text).toContain('## Alias sin efecto (0)\n\nNinguno.')
  })

  it('lists the aliases whose name is in no sheet', () => {
    const text = buildSummary([sheetOne()], { ...options, unusedAliases: ['TORRES DIAZ, JOSE LUIS'] })
    expect(text).toContain('## Alias sin efecto (1)\n\n- TORRES DIAZ, JOSE LUIS')
  })

  it('lists the amounts without hours', () => {
    const text = buildSummary([sheetOne()], options)
    const section = text.slice(text.indexOf('## Montos sin horas'))

    expect(section).toContain('PEREZ LUNA, ANA')
    expect(section).toContain('S/ 200.00')
    expect(section).toContain('13 al 19 1era sem')
  })

  it('states the payment assumptions with the rule of each sheet', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)
    const section = text.slice(text.indexOf('## Supuestos de pago'))

    expect(section).toContain('Migrado del Excel')
    expect(section).toContain('último día del periodo')
    expect(section).toMatch(/13 al 19 1era sem.*BH \+ BJ/)
    expect(section).toMatch(/SEM 17 20 AL 25.*CANCELADO/)
  })

  it('warns about negative day amounts, row totals and payments', () => {
    const sheet = sheetOne()
    sheet.workers[0]!.days[0]!.amountCents = -100
    sheet.workers[1]!.totalCents = -5000
    sheet.workers[2]!.paidCents = -300
    const text = buildSummary([sheet], options)

    expect(text).toContain('⚠ Monto negativo: QUISPE MAMANI, LUIS, día 13/04/2026')
    expect(text).toContain('⚠ Monto negativo: PEREZ ROJAS, ANA, total de la fila')
    expect(text).toContain('⚠ Monto negativo: PEREZ LUNA, ANA, pago')
  })

  it('warns about negative minutes', () => {
    const sheet = sheetOne()
    sheet.workers[0]!.days[0]!.overtimeMinutes = -60
    const text = buildSummary([sheet], options)

    expect(text).toContain('⚠ Minutos negativos: QUISPE MAMANI, LUIS, día 13/04/2026, minutos extra: -60 min')
  })

  it('has no negative warning when every amount is zero or more', () => {
    const text = buildSummary([sheetOne(), sheetTwo()], options)
    expect(text).not.toContain('Monto negativo')
  })
})

describe('findNegatives', () => {
  it('returns one entry per negative amount with the sheet and worker', () => {
    const sheet = sheetOne()
    sheet.workers[0]!.days[1]!.amountCents = -1
    sheet.workers[2]!.paidCents = -300

    expect(findNegatives([sheet, sheetTwo()])).toEqual([
      { sheet: '13 al 19 1era sem', worker: 'QUISPE MAMANI, LUIS', what: 'día 14/04/2026', value: -1, unit: 'cents' },
      { sheet: '13 al 19 1era sem', worker: 'PEREZ LUNA, ANA', what: 'pago', value: -300, unit: 'cents' },
    ])
  })

  it('returns the negative minutes of each kind', () => {
    const sheet = sheetTwo()
    Object.assign(sheet.workers[0]!.days[0]!, { workedMinutes: -1, regularMinutes: -2, overtimeMinutes: -3 })

    expect(findNegatives([sheet])).toEqual([
      { sheet: 'SEM 17 20 AL 25', worker: 'QUISPE MAMANI, LUIS', what: 'día 20/04/2026, minutos trabajados', value: -1, unit: 'minutes' },
      { sheet: 'SEM 17 20 AL 25', worker: 'QUISPE MAMANI, LUIS', what: 'día 20/04/2026, minutos normales', value: -2, unit: 'minutes' },
      { sheet: 'SEM 17 20 AL 25', worker: 'QUISPE MAMANI, LUIS', what: 'día 20/04/2026, minutos extra', value: -3, unit: 'minutes' },
    ])
  })

  it('returns nothing when there are none', () => {
    expect(findNegatives([sheetOne(), sheetTwo()])).toEqual([])
  })
})
