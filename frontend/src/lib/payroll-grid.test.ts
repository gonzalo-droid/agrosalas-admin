import { describe, expect, it } from 'vitest'
import { buildGrid, cellLabel, type GridRecord } from './payroll-grid'

const DATES = ['2026-10-05', '2026-10-06', '2026-10-07']
const WORKERS = [{ id: 'a' }, { id: 'b' }]

const worked = (workerId: string, date: string, regularMinutes: number, overtimeMinutes: number, amountCents: number | null): GridRecord => ({
  workerId,
  date,
  type: 'worked',
  workedMinutes: regularMinutes + overtimeMinutes,
  regularMinutes,
  overtimeMinutes,
  amountCents,
})
const absence = (workerId: string, date: string): GridRecord => ({
  workerId,
  date,
  type: 'absence',
  workedMinutes: 0,
  regularMinutes: 0,
  overtimeMinutes: 0,
  amountCents: 0,
})

describe('buildGrid', () => {
  const records = [worked('a', '2026-10-05', 480, 140, 6823), absence('a', '2026-10-06'), worked('b', '2026-10-05', 240, 0, 2500)]
  const grid = buildGrid(WORKERS, DATES, records)

  it('puts each record in the cell of its worker and date, and leaves the rest empty', () => {
    expect(grid.rows[0].cells).toEqual([records[0], records[1], null])
    expect(grid.rows[1].cells).toEqual([records[2], null, null])
  })

  it('totals each worker', () => {
    expect(grid.rows[0].totals).toEqual({ regularMinutes: 480, overtimeMinutes: 140, amountCents: 6823 })
    expect(grid.rows[1].totals).toEqual({ regularMinutes: 240, overtimeMinutes: 0, amountCents: 2500 })
  })

  it('totals each day and the whole payroll', () => {
    expect(grid.dayTotals).toEqual([
      { regularMinutes: 720, overtimeMinutes: 140, amountCents: 9323 },
      { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 },
      { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 },
    ])
    expect(grid.total).toEqual({ regularMinutes: 720, overtimeMinutes: 140, amountCents: 9323 })
  })

  it('has no amount when the records come without money (coordinator)', () => {
    const redacted = buildGrid(WORKERS, DATES, [worked('a', '2026-10-05', 480, 140, null)])
    expect(redacted.rows[0].totals).toEqual({ regularMinutes: 480, overtimeMinutes: 140, amountCents: null })
    expect(redacted.dayTotals[0].amountCents).toBeNull()
    expect(redacted.total.amountCents).toBeNull()
  })

  it('ignores records of workers or dates that are not in the grid', () => {
    const stray = buildGrid(WORKERS, DATES, [worked('zzz', '2026-10-05', 60, 0, 625), worked('a', '2026-11-01', 60, 0, 625)])
    expect(stray.total).toEqual({ regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 })
  })

  it('keeps the order of the workers and the dates it was given', () => {
    expect(grid.rows.map((row) => row.worker.id)).toEqual(['a', 'b'])
  })
})

describe('cellLabel', () => {
  it('is empty when there is no record', () => {
    expect(cellLabel(null)).toBe('')
  })

  it('shows the regular hours, and the overtime after a plus sign', () => {
    expect(cellLabel(worked('a', '2026-10-05', 480, 140, 6823))).toBe('8:00 +2:20')
    expect(cellLabel(worked('a', '2026-10-05', 240, 0, 2500))).toBe('4:00')
  })

  it('shows an ellipsis for a day in progress', () => {
    expect(cellLabel(worked('a', '2026-10-05', 0, 0, 0))).toBe('…')
  })

  it('abbreviates the days not worked', () => {
    expect(cellLabel(absence('a', '2026-10-05'))).toBe('F')
    expect(cellLabel({ ...absence('a', '2026-10-05'), type: 'leave' })).toBe('P')
    expect(cellLabel({ ...absence('a', '2026-10-05'), type: 'medical_leave' })).toBe('DM')
  })
})
