import { describe, expect, it } from 'vitest'
import { receiptDays } from './receipt'

const worked = {
  date: '2026-10-05',
  type: 'worked' as const,
  clockIn1: '2026-10-05T12:10:00.000Z',
  clockOut1: '2026-10-05T18:00:00.000Z',
  clockIn2: '2026-10-05T19:00:00.000Z',
  clockOut2: '2026-10-05T23:30:00.000Z',
  regularMinutes: 480,
  overtimeMinutes: 140,
  amountCents: 6823,
}

describe('receiptDays', () => {
  it('describes a worked day with its times in Lima, its hours and its amount', () => {
    expect(receiptDays([worked])).toEqual([
      { date: '2026-10-05', label: '07:10–13:00 · 14:00–18:30', hours: '8:00 +2:20', amountCents: 6823 },
    ])
  })

  it('names a day that was not worked and sorts the days by date', () => {
    const absence = { ...worked, date: '2026-10-04', type: 'absence' as const, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
    const days = receiptDays([worked, absence])
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-05'])
    expect(days[0]).toEqual({ date: '2026-10-04', label: 'Falta', hours: '–', amountCents: 0 })
  })

  it('shows a stretch without its exit with an ellipsis', () => {
    const open = { ...worked, clockIn2: null, clockOut2: null, clockOut1: null, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
    expect(receiptDays([open])[0].label).toBe('07:10–…')
  })
})
