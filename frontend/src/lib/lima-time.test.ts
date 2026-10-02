import { describe, expect, it } from 'vitest'
import { addDays, datesBetween, dayOffset, isoWeek, isRealDate, limaDate, limaTime, monthOf, weekOf, weekdayOf } from './lima-time'

describe('Lima time', () => {
  it('gives the Lima date of an instant, five hours behind UTC', () => {
    expect(limaDate(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05')
    expect(limaDate(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06')
  })

  it('gives the Lima wall-clock time of a stored mark, or nothing when there is none', () => {
    expect(limaTime('2026-10-05T12:10:00.000Z')).toBe('07:10')
    expect(limaTime(null)).toBe('')
  })

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-05', -1)).toBe('2026-10-04')
  })

  it('tells how many days after the record date a mark falls', () => {
    expect(dayOffset('2026-10-05', '2026-10-05T12:10:00.000Z')).toBe(0)
    expect(dayOffset('2026-10-05', '2026-10-06T09:00:00.000Z')).toBe(1)
  })

  it('lists the dates of a range, both ends included', () => {
    expect(datesBetween('2026-10-05', '2026-10-11')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
    expect(datesBetween('2026-10-11', '2026-10-05')).toEqual([])
  })

  it('names the weekday in Spanish', () => {
    expect(weekdayOf('2026-10-05')).toBe('lun')
    expect(weekdayOf('2026-10-11')).toBe('dom')
  })

  it('gives the Monday-to-Sunday week of a date', () => {
    const week = { start: '2026-10-05', end: '2026-10-11' }
    expect(weekOf('2026-10-05')).toEqual(week)
    expect(weekOf('2026-10-07')).toEqual(week)
    expect(weekOf('2026-10-11')).toEqual(week)
  })

  it('gives the whole month of a date, leap years included', () => {
    expect(monthOf('2026-10-07')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(monthOf('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('numbers the weeks the ISO way', () => {
    expect(isoWeek('2026-10-05')).toBe(41)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53)
  })
})

describe('isRealDate', () => {
  it('accepts a real date, a leap day included', () => {
    expect(isRealDate('2026-10-05')).toBe(true)
    expect(isRealDate('2028-02-29')).toBe(true)
  })

  it('rejects a text that is not shaped like YYYY-MM-DD', () => {
    expect(isRealDate('')).toBe(false)
    expect(isRealDate('2026-1-5')).toBe(false)
    expect(isRealDate('05/10/2026')).toBe(false)
    expect(isRealDate('2026-10-05T00:00')).toBe(false)
  })

  it('rejects dates that do not exist, so no helper is ever called with them', () => {
    expect(isRealDate('2026-13-01')).toBe(false)
    expect(isRealDate('2026-00-10')).toBe(false)
    expect(isRealDate('2026-10-00')).toBe(false)
    expect(isRealDate('2026-02-30')).toBe(false)
    expect(isRealDate('2027-02-29')).toBe(false)
    expect(isRealDate('2026-04-31')).toBe(false)
  })
})
