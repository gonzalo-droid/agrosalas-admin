import { describe, expect, it } from 'vitest'
import { daysInRange, monthsInRange, sumByPeriod, weekStart, weeksInRange } from '../src/payroll/report-periods.js'

describe('report periods', () => {
  it('counts the days of a range, both ends included', () => {
    expect(daysInRange('2026-10-01', '2026-10-01')).toBe(1)
    expect(daysInRange('2026-01-01', '2026-12-31')).toBe(365)
    expect(daysInRange('2028-01-01', '2028-12-31')).toBe(366)
  })

  it('gives the Monday of the week of a date', () => {
    expect(weekStart('2026-10-05')).toBe('2026-10-05') // a Monday
    expect(weekStart('2026-10-04')).toBe('2026-09-28') // a Sunday belongs to the week before
    expect(weekStart('2026-01-01')).toBe('2025-12-29') // a Thursday, in the previous year
  })

  it('lists every Monday to Sunday week that touches the range', () => {
    expect(weeksInRange('2026-10-01', '2026-10-14')).toEqual([
      { start: '2026-09-28', end: '2026-10-04' },
      { start: '2026-10-05', end: '2026-10-11' },
      { start: '2026-10-12', end: '2026-10-18' },
    ])
  })

  it('lists the months of the range', () => {
    expect(monthsInRange('2026-11-15', '2027-02-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
    expect(monthsInRange('2026-10-01', '2026-10-31')).toEqual(['2026-10'])
  })

  it('adds the daily totals up into periods and ignores what falls outside them', () => {
    const weeks = weeksInRange('2026-10-05', '2026-10-25')
    const periods = weeks.map((week) => week.start)
    const periodOf = weekStart
    const rows = sumByPeriod(
      periods.slice(0, 2).concat(periods[2]),
      periodOf,
      [
        { date: '2026-10-05', regularMinutes: 480, overtimeMinutes: 60, cents: 5000 },
        { date: '2026-10-07', regularMinutes: 300, overtimeMinutes: 0, cents: 3125 },
        { date: '2026-10-12', regularMinutes: 600, overtimeMinutes: 120, cents: 7000 },
        { date: '2026-09-30', regularMinutes: 999, overtimeMinutes: 999, cents: 99999 }, // outside every period
      ],
      [
        { date: '2026-10-06', cents: 2000 },
        { date: '2026-10-13', cents: -500 },
        { date: '2026-09-29', cents: 12345 }, // outside every period
      ],
    )
    expect(rows).toEqual([
      { period: '2026-10-05', regularMinutes: 780, overtimeMinutes: 60, attendanceCents: 8125, itemsCents: 2000, totalCents: 10125 },
      { period: '2026-10-12', regularMinutes: 600, overtimeMinutes: 120, attendanceCents: 7000, itemsCents: -500, totalCents: 6500 },
      { period: '2026-10-19', regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 },
    ])
  })
})
