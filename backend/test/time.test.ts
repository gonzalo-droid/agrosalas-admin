import { describe, expect, it } from 'vitest'
import { limaDate, limaInstant, marksFromTimes, notBefore } from '../src/payroll/time'

describe('Lima time', () => {
  it('gives the Lima date of an instant, five hours behind UTC', () => {
    expect(limaDate(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05')
    expect(limaDate(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06')
  })

  it('turns a Lima date and time into an instant', () => {
    expect(limaInstant('2026-10-05', '07:10').toISOString()).toBe('2026-10-05T12:10:00.000Z')
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

describe('notBefore', () => {
  const at = (iso: string) => new Date(iso)

  it('returns the instant as it is when there is no previous mark or it is not earlier', () => {
    expect(notBefore(at('2026-10-05T12:00:00Z'), null).toISOString()).toBe('2026-10-05T12:00:00.000Z')
    expect(notBefore(at('2026-10-05T18:00:00Z'), at('2026-10-05T12:00:00Z')).toISOString()).toBe('2026-10-05T18:00:00.000Z')
    // The same instant is not earlier.
    expect(notBefore(at('2026-10-05T12:00:00Z'), at('2026-10-05T12:00:00Z')).toISOString()).toBe('2026-10-05T12:00:00.000Z')
  })

  it('moves an earlier instant forward a day at a time until it is not earlier', () => {
    expect(notBefore(at('2026-10-05T09:00:00Z'), at('2026-10-05T12:00:00Z')).toISOString()).toBe('2026-10-06T09:00:00.000Z')
    expect(notBefore(at('2026-10-05T09:00:00Z'), at('2026-10-07T12:00:00Z')).toISOString()).toBe('2026-10-08T09:00:00.000Z')
  })
})
