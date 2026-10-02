import { describe, expect, it } from 'vitest'
import { addDays, limaDate, limaInstant, limaTime, marksFromTimes } from '../src/payroll/time'

describe('Lima time', () => {
  it('gives the Lima date of an instant, five hours behind UTC', () => {
    expect(limaDate(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05')
    expect(limaDate(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06')
  })

  it('gives the Lima wall-clock time of an instant', () => {
    expect(limaTime(new Date('2026-10-06T03:30:00Z'))).toBe('22:30')
  })

  it('turns a Lima date and time into an instant', () => {
    expect(limaInstant('2026-10-05', '07:10').toISOString()).toBe('2026-10-05T12:10:00.000Z')
  })

  it('adds days to a date across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-05', -1)).toBe('2026-10-04')
  })
})

describe('marksFromTimes', () => {
  it('keeps same-day times on the record date', () => {
    const marks = marksFromTimes('2026-10-05', ['07:10', '13:00', '14:00', '18:30'])
    expect(marks.map((m) => m?.toISOString())).toEqual([
      '2026-10-05T12:10:00.000Z',
      '2026-10-05T18:00:00.000Z',
      '2026-10-05T19:00:00.000Z',
      '2026-10-05T23:30:00.000Z',
    ])
  })

  it('moves a time earlier than the previous one to the next day (night shift)', () => {
    const marks = marksFromTimes('2026-10-05', ['19:00', '04:00', null, null])
    expect(marks[1]?.toISOString()).toBe('2026-10-06T09:00:00.000Z')
    expect(marks[2]).toBeNull()
  })

  it('keeps later times on the next day once the shift has crossed midnight', () => {
    const marks = marksFromTimes('2026-10-05', ['22:00', '02:00', '02:30', '06:00'])
    expect(marks.map((m) => m?.toISOString())).toEqual([
      '2026-10-06T03:00:00.000Z',
      '2026-10-06T07:00:00.000Z',
      '2026-10-06T07:30:00.000Z',
      '2026-10-06T11:00:00.000Z',
    ])
  })
})
