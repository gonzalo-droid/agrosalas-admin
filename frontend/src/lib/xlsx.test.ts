import { describe, expect, it } from 'vitest'
import { payrollSheets, safeFileName, solesOf, type PayrollExportInput } from './xlsx'

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
