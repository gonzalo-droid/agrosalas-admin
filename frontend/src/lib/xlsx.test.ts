import { describe, expect, it } from 'vitest'
import { areaSheet, campaignSheets, payrollSheets, periodSheet, safeFileName, solesOf, workerSheet, type CampaignExportInput, type PayrollExportInput, type WorkerExportInput } from './xlsx'

describe('solesOf', () => {
  it('turns cents into soles', () => {
    expect(solesOf(6823)).toBe(68.23)
    expect(solesOf(-500)).toBe(-5)
    expect(solesOf(0)).toBe(0)
  })
})

describe('safeFileName', () => {
  it('removes the characters a file name cannot have, joins repeated spaces and trims', () => {
    expect(safeFileName('Semana 40 / Chile: "A"')).toBe('Semana 40 Chile A')
    expect(safeFileName('  a\\b*c?d<e>f|g  ')).toBe('abcdefg')
  })

  it('never returns an empty name', () => {
    expect(safeFileName('???')).toBe('reporte')
    expect(safeFileName('   ')).toBe('reporte')
  })
})

// Mon 05/10 and Tue 06/10. Ana worked 8:00 + 2:20 overtime on Monday; Luis has an absence on Monday.
const input: PayrollExportInput = {
  payroll: {
    startDate: '2026-10-05',
    endDate: '2026-10-06',
    workers: [
      { id: 'w1', firstName: 'Ana', lastName: 'Pérez', dni: '12345678' },
      { id: 'w2', firstName: 'Luis', lastName: 'Quispe', dni: '87654321' },
    ],
    records: [
      { workerId: 'w1', date: '2026-10-05', type: 'worked', workedMinutes: 620, regularMinutes: 480, overtimeMinutes: 140, amountCents: 11000 },
      { workerId: 'w2', date: '2026-10-05', type: 'absence', workedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 },
    ],
  },
  balances: {
    items: [
      { workerId: 'w1', attendanceCents: 11000, additionsCents: 0, deductionsCents: 1000, totalCents: 10000, paidCents: 6000, pendingCents: 4000 },
      { workerId: 'w2', attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 },
    ],
    totals: { attendanceCents: 11000, additionsCents: 0, deductionsCents: 1000, totalCents: 10000, paidCents: 6000, pendingCents: 4000 },
  },
  items: { items: [{ workerId: 'w1', type: 'deduction', amountCents: 1000, note: 'Adelanto' }] },
  payments: [
    { date: '2026-10-07', workerFirstName: 'Ana', workerLastName: 'Pérez', method: 'yape', methodDetail: 'Yape 987654321', amountCents: 6000, evidencePath: 'p/w1/a.jpg' },
    { date: '2026-10-08', workerFirstName: 'Luis', workerLastName: 'Quispe', method: 'cash', methodDetail: null, amountCents: 500, evidencePath: null },
  ],
}

describe('payrollSheets', () => {
  const sheets = payrollSheets(input)

  it('builds the three sheets in order', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Asistencia', 'Conceptos', 'Pagos'])
  })

  it('writes the attendance with a column per day, one row per worker and a totals row', () => {
    const [attendance] = sheets
    expect(attendance.columns.map((c) => c.header)).toEqual([
      'Trabajador', 'DNI', 'lun 05', 'mar 06', 'Horas normales', 'Horas extra', 'Total (S/)', 'Pagado (S/)', 'Pendiente (S/)',
    ])
    expect(attendance.columns.map((c) => c.money === true)).toEqual([false, false, false, false, false, false, true, true, true])
    expect(attendance.rows).toEqual([
      ['Pérez, Ana', '12345678', '8:00 +2:20', null, '8:00', '2:20', 100, 60, 40],
      ['Quispe, Luis', '87654321', 'F', null, '0:00', '0:00', 0, 0, 0],
      ['Totales', null, null, null, '8:00', '2:20', 100, 60, 40],
    ])
    for (const row of attendance.rows) expect(row).toHaveLength(attendance.columns.length)
  })

  it('writes the payroll items with the sign of a deduction', () => {
    const [, items] = sheets
    expect(items.columns.map((c) => c.header)).toEqual(['Trabajador', 'Tipo', 'Monto (S/)', 'Nota'])
    expect(items.columns[2].money).toBe(true)
    expect(items.rows).toEqual([['Pérez, Ana', 'Descuento', -10, 'Adelanto']])
  })

  it('writes the payments with the date, the medium, the amount in soles and whether there is evidence', () => {
    const [, , payments] = sheets
    expect(payments.columns.map((c) => c.header)).toEqual(['Fecha', 'Trabajador', 'Medio', 'Detalle', 'Monto (S/)', 'Evidencia'])
    expect(payments.columns[4].money).toBe(true)
    expect(payments.rows).toEqual([
      ['07/10/2026', 'Pérez, Ana', 'Yape', 'Yape 987654321', 60, 'Sí'],
      ['08/10/2026', 'Quispe, Luis', 'Efectivo', null, 5, 'No'],
    ])
  })

  it('leaves the money of a worker without balance empty instead of zero', () => {
    const [attendance] = payrollSheets({ ...input, balances: { ...input.balances, items: [input.balances.items[0]] } })
    expect(attendance.rows[1].slice(6)).toEqual([null, null, null])
  })
})

const totals = { regularMinutes: 1500, overtimeMinutes: 200, attendanceCents: 30000, itemsCents: -1500, totalCents: 28500 }

describe('periodSheet', () => {
  const weekly = periodSheet('weekly', {
    items: [
      { weekStart: '2026-09-28', weekEnd: '2026-10-04', regularMinutes: 900, overtimeMinutes: 200, attendanceCents: 20000, itemsCents: -1500, totalCents: 18500 },
      { weekStart: '2026-10-05', weekEnd: '2026-10-11', regularMinutes: 600, overtimeMinutes: 0, attendanceCents: 10000, itemsCents: 0, totalCents: 10000 },
    ],
    totals,
  })

  it('writes a row per week and a totals row, with the money in soles', () => {
    expect(weekly.name).toBe('Semana')
    expect(weekly.columns.map((c) => c.header)).toEqual(['Semana', 'Horas normales', 'Horas extra', 'Asistencia (S/)', 'Conceptos (S/)', 'Total (S/)'])
    expect(weekly.columns.map((c) => c.money === true)).toEqual([false, false, false, true, true, true])
    expect(weekly.rows).toEqual([
      ['28/09 al 04/10/2026', '15:00', '3:20', 200, -15, 185],
      ['05/10 al 11/10/2026', '10:00', '0:00', 100, 0, 100],
      ['Totales', '25:00', '3:20', 300, -15, 285],
    ])
    for (const row of weekly.rows) expect(row).toHaveLength(weekly.columns.length)
  })

  it('writes a row per month under the Mes header', () => {
    const monthly = periodSheet('monthly', {
      items: [{ month: '2026-10', regularMinutes: 1500, overtimeMinutes: 200, attendanceCents: 30000, itemsCents: -1500, totalCents: 28500 }],
      totals,
    })
    expect(monthly.name).toBe('Mes')
    expect(monthly.columns[0].header).toBe('Mes')
    expect(monthly.rows).toEqual([
      ['Octubre 2026', '25:00', '3:20', 300, -15, 285],
      ['Totales', '25:00', '3:20', 300, -15, 285],
    ])
  })

  it('still writes the totals row when there are no periods', () => {
    const empty = periodSheet('monthly', { items: [], totals: { regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 } })
    expect(empty.rows).toEqual([['Totales', '0:00', '0:00', 0, 0, 0]])
  })
})

describe('areaSheet', () => {
  const sheet = areaSheet({
    items: [
      { areaName: 'Campo', workedDays: 12, regularMinutes: 5760, overtimeMinutes: 120, attendanceCents: 40000 },
      { areaName: 'Sin área', workedDays: 1, regularMinutes: 480, overtimeMinutes: 0, attendanceCents: 3000 },
    ],
    totals: { workedDays: 13, regularMinutes: 6240, overtimeMinutes: 120, itemsCents: -2000, totalCents: 41000 },
  })

  it('writes a row per area, the concepts apart with only an amount, and the totals', () => {
    expect(sheet.name).toBe('Área')
    expect(sheet.columns.map((c) => c.header)).toEqual(['Área', 'Días trabajados', 'Horas normales', 'Horas extra', 'Monto (S/)'])
    expect(sheet.columns.map((c) => c.money === true)).toEqual([false, false, false, false, true])
    expect(sheet.rows).toEqual([
      ['Campo', 12, '96:00', '2:00', 400],
      ['Sin área', 1, '8:00', '0:00', 30],
      ['Conceptos (sin área)', null, null, null, -20],
      ['Totales', 13, '104:00', '2:00', 410],
    ])
    for (const row of sheet.rows) expect(row).toHaveLength(sheet.columns.length)
  })
})

// Two campaigns; Ana is in both, so the people total (2) is less than the sum of the rows (3).
const campaignInput: CampaignExportInput = {
  items: [
    {
      key: 'c1',
      name: 'Chile 2026',
      payrollCount: 2,
      people: 2,
      workedDays: 20,
      regularMinutes: 9600,
      overtimeMinutes: 150,
      totalCents: 50000,
      paidCents: 30000,
      pendingCents: 20000,
      payrolls: [
        { id: 'p1', name: 'Semana 40', startDate: '2026-10-05', endDate: '2026-10-11', status: 'closed', totalCents: 30000, paidCents: 30000, pendingCents: 0 },
        { id: 'p2', name: 'Semana 41', startDate: '2026-10-12', endDate: '2026-10-18', status: 'open', totalCents: 20000, paidCents: 0, pendingCents: 20000 },
      ],
      workers: [
        { workerId: 'w1', firstName: 'Ana', lastName: 'Pérez', dni: '12345678', workedDays: 12, regularMinutes: 5760, overtimeMinutes: 150, totalCents: 30000, paidCents: 30000, pendingCents: 0 },
        { workerId: 'w2', firstName: 'Luis', lastName: 'Quispe', dni: null, workedDays: 8, regularMinutes: 3840, overtimeMinutes: 0, totalCents: 20000, paidCents: 0, pendingCents: 20000 },
      ],
    },
    {
      key: 'none',
      name: 'Sin campaña',
      payrollCount: 1,
      people: 1,
      workedDays: 4,
      regularMinutes: 1920,
      overtimeMinutes: 0,
      totalCents: 10000,
      paidCents: 12000,
      pendingCents: -2000,
      payrolls: [{ id: 'p3', name: 'Semana 40 sin campaña', startDate: '2026-10-05', endDate: '2026-10-11', status: 'closed', totalCents: 10000, paidCents: 12000, pendingCents: -2000 }],
      workers: [{ workerId: 'w1', firstName: 'Ana', lastName: 'Pérez', dni: '12345678', workedDays: 4, regularMinutes: 1920, overtimeMinutes: 0, totalCents: 10000, paidCents: 12000, pendingCents: -2000 }],
    },
  ],
  totals: { payrollCount: 3, people: 2, workedDays: 24, regularMinutes: 11520, overtimeMinutes: 150, totalCents: 60000, paidCents: 42000, pendingCents: 18000 },
}

describe('campaignSheets', () => {
  // Wednesday 14/10: the payroll that is open and ended on 18/10 is in progress.
  const sheets = campaignSheets(campaignInput, '2026-10-14')

  it('builds the three sheets in order', () => {
    expect(sheets.map((s) => s.name)).toEqual(['Campañas', 'Planillas', 'Trabajadores'])
  })

  it('writes a row per campaign and the totals, with the money in soles', () => {
    const [campaigns] = sheets
    expect(campaigns.columns.map((c) => c.header)).toEqual([
      'Campaña',
      'Planillas',
      'Personas',
      'Días',
      'Horas normales',
      'Horas extra',
      'Total (S/)',
      'Pagado (S/)',
      'Pendiente (S/)',
    ])
    expect(campaigns.columns.map((c) => c.money === true)).toEqual([false, false, false, false, false, false, true, true, true])
    expect(campaigns.rows).toEqual([
      ['Chile 2026', 2, 2, 20, '160:00', '2:30', 500, 300, 200],
      ['Sin campaña', 1, 1, 4, '32:00', '0:00', 100, 120, -20],
      ['Totales', 3, 2, 24, '192:00', '2:30', 600, 420, 180],
    ])
  })

  it('writes a row per payroll with its campaign, the dates and the status as the screen shows it', () => {
    const payrolls = sheets[1]
    expect(payrolls.columns.map((c) => c.header)).toEqual(['Campaña', 'Planilla', 'Desde', 'Hasta', 'Estado', 'Total (S/)', 'Pagado (S/)', 'Pendiente (S/)'])
    expect(payrolls.columns.map((c) => c.money === true)).toEqual([false, false, false, false, false, true, true, true])
    expect(payrolls.rows).toEqual([
      ['Chile 2026', 'Semana 40', '05/10/2026', '11/10/2026', 'Cerrada', 300, 300, 0],
      ['Chile 2026', 'Semana 41', '12/10/2026', '18/10/2026', 'En curso', 200, 0, 200],
      ['Sin campaña', 'Semana 40 sin campaña', '05/10/2026', '11/10/2026', 'Cerrada', 100, 120, -20],
    ])
  })

  it('writes a row per worker and campaign, so a person in two campaigns has two rows', () => {
    const workers = sheets[2]
    expect(workers.columns.map((c) => c.header)).toEqual(['Campaña', 'Trabajador', 'DNI', 'Días', 'Horas normales', 'Horas extra', 'Total (S/)', 'Pagado (S/)', 'Pendiente (S/)'])
    expect(workers.columns.map((c) => c.money === true)).toEqual([false, false, false, false, false, false, true, true, true])
    expect(workers.rows).toEqual([
      ['Chile 2026', 'Pérez, Ana', '12345678', 12, '96:00', '2:30', 300, 300, 0],
      ['Chile 2026', 'Quispe, Luis', null, 8, '64:00', '0:00', 200, 0, 200],
      ['Sin campaña', 'Pérez, Ana', '12345678', 4, '32:00', '0:00', 100, 120, -20],
    ])
  })

  it('keeps every row as wide as its columns', () => {
    for (const sheet of sheets) for (const row of sheet.rows) expect(row).toHaveLength(sheet.columns.length)
  })

  it('writes the sheets with no payrolls or workers when there are no campaigns, and still the totals row', () => {
    const empty = campaignSheets(
      { items: [], totals: { payrollCount: 0, people: 0, workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, totalCents: 0, paidCents: 0, pendingCents: 0 } },
      '2026-10-14',
    )
    expect(empty[0].rows).toEqual([['Totales', 0, 0, 0, '0:00', '0:00', 0, 0, 0]])
    expect(empty[1].rows).toEqual([])
    expect(empty[2].rows).toEqual([])
  })
})

describe('workerSheet', () => {
  const input: WorkerExportInput = {
    items: [
      { workerId: 'w1', firstName: 'Ana', lastName: 'Pérez', dni: '12345678', workedDays: 16, regularMinutes: 7680, overtimeMinutes: 150, attendanceCents: 32000, itemsCents: -2000, totalCents: 30000, paidCents: 30000, pendingCents: 0 },
      { workerId: 'w2', firstName: 'Luis', lastName: 'Quispe', dni: null, workedDays: 8, regularMinutes: 3840, overtimeMinutes: 0, attendanceCents: 20000, itemsCents: 0, totalCents: 20000, paidCents: 5000, pendingCents: 15000 },
    ],
    totals: { people: 2, workedDays: 24, regularMinutes: 11520, overtimeMinutes: 150, attendanceCents: 52000, itemsCents: -2000, totalCents: 50000, paidCents: 35000, pendingCents: 15000 },
  }
  const sheet = workerSheet(input)

  it('writes a row per worker and the totals, with the money in soles', () => {
    expect(sheet.name).toBe('Trabajadores')
    expect(sheet.columns.map((c) => c.header)).toEqual([
      'Trabajador',
      'DNI',
      'Días',
      'Horas normales',
      'Horas extra',
      'Asistencia (S/)',
      'Conceptos (S/)',
      'Total (S/)',
      'Pagado (S/)',
      'Pendiente (S/)',
    ])
    expect(sheet.columns.map((c) => c.money === true)).toEqual([false, false, false, false, false, true, true, true, true, true])
    expect(sheet.rows).toEqual([
      ['Pérez, Ana', '12345678', 16, '128:00', '2:30', 320, -20, 300, 300, 0],
      ['Quispe, Luis', null, 8, '64:00', '0:00', 200, 0, 200, 50, 150],
      ['Totales', null, 24, '192:00', '2:30', 520, -20, 500, 350, 150],
    ])
    for (const row of sheet.rows) expect(row).toHaveLength(sheet.columns.length)
  })

  it('still writes the totals row when there are no workers', () => {
    const empty = workerSheet({ items: [], totals: { people: 0, workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 } })
    expect(empty.rows).toEqual([['Totales', null, 0, '0:00', '0:00', 0, 0, 0, 0, 0]])
  })
})
