import { describe, expect, it } from 'vitest'
import { REPORT_TABS, defaultRange, monthLabel, periodLabel, rangeFromParams, reportTabFromParam, weekLabel } from './report-view'

describe('REPORT_TABS', () => {
  it('lists the five tabs in order, with their Spanish names', () => {
    expect(REPORT_TABS).toEqual([
      { key: 'weekly', label: 'Semana' },
      { key: 'monthly', label: 'Mes' },
      { key: 'area', label: 'Área' },
      { key: 'campaign', label: 'Campaña' },
      { key: 'worker', label: 'Trabajador' },
    ])
  })
})

describe('reportTabFromParam', () => {
  it('accepts the keys of the tabs', () => {
    for (const { key } of REPORT_TABS) expect(reportTabFromParam(key)).toBe(key)
  })

  it('falls back to the weekly tab for anything else', () => {
    expect(reportTabFromParam(null)).toBe('weekly')
    expect(reportTabFromParam('')).toBe('weekly')
    expect(reportTabFromParam('Semana')).toBe('weekly')
    expect(reportTabFromParam('constructor')).toBe('weekly')
  })
})

describe('defaultRange', () => {
  it('is the whole month of today', () => {
    expect(defaultRange('2026-10-02')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(defaultRange('2026-02-15')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(defaultRange('2028-02-29')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})

describe('rangeFromParams', () => {
  const today = '2026-10-02'

  it('keeps real dates from the address', () => {
    expect(rangeFromParams('2026-09-01', '2026-09-30', today)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('replaces a missing or invalid end with the default of that end', () => {
    expect(rangeFromParams(null, null, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(rangeFromParams('2026-13-01', '2026-02-30', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(rangeFromParams('2026-09-01', null, today)).toEqual({ from: '2026-09-01', to: '2026-10-31' })
    expect(rangeFromParams('hoy', '2026-09-30', today)).toEqual({ from: '2026-10-01', to: '2026-09-30' })
  })
})

describe('weekLabel', () => {
  const wide = { from: '2026-01-01', to: '2026-12-31' }

  it('writes the day and month of the start, and the full date of the end', () => {
    expect(weekLabel('2026-09-28', '2026-10-04', wide)).toBe('28/09 al 04/10/2026')
  })

  it('keeps both years when the week crosses New Year', () => {
    expect(weekLabel('2026-12-28', '2027-01-03', { from: '2026-01-01', to: '2027-12-31' })).toBe('28/12/2026 al 03/01/2027')
  })

  it('keeps the whole label of a week that is fully inside the range', () => {
    expect(weekLabel('2026-10-05', '2026-10-11', { from: '2026-10-05', to: '2026-10-11' })).toBe('05/10 al 11/10/2026')
  })

  it('shows only the days inside the range when the range cuts the week', () => {
    const october = { from: '2026-10-01', to: '2026-10-31' }
    expect(weekLabel('2026-09-28', '2026-10-04', october)).toBe('01/10 al 04/10/2026')
    expect(weekLabel('2026-10-26', '2026-11-01', october)).toBe('26/10 al 31/10/2026')
    expect(weekLabel('2026-10-05', '2026-10-11', { from: '2026-10-07', to: '2026-10-09' })).toBe('07/10 al 09/10/2026')
  })

  it('shows a cut week of one day as that day alone', () => {
    expect(weekLabel('2026-10-26', '2026-11-01', { from: '2026-10-01', to: '2026-10-26' })).toBe('26/10/2026')
    expect(weekLabel('2026-10-26', '2026-11-01', { from: '2026-10-01', to: '2026-10-26' })).not.toContain(' al ')
    expect(weekLabel('2026-10-26', '2026-11-01', { from: '2026-11-01', to: '2026-11-30' })).toBe('01/11/2026')
  })

  it('keeps both years when the covered part still crosses New Year', () => {
    expect(weekLabel('2026-12-28', '2027-01-03', { from: '2026-12-30', to: '2027-01-02' })).toBe('30/12/2026 al 02/01/2027')
  })
})

describe('monthLabel', () => {
  const wide = { from: '2026-01-01', to: '2026-12-31' }

  it('writes the month in Spanish with a capital and the year', () => {
    expect(monthLabel('2026-10', wide)).toBe('Octubre 2026')
    expect(monthLabel('2026-01', wide)).toBe('Enero 2026')
    expect(monthLabel('2026-12', wide)).toBe('Diciembre 2026')
  })

  it('adds nothing when the range covers the whole month', () => {
    expect(monthLabel('2026-10', { from: '2026-10-01', to: '2026-10-31' })).toBe('Octubre 2026')
    expect(monthLabel('2026-02', { from: '2026-01-15', to: '2026-03-10' })).toBe('Febrero 2026')
  })

  it('adds the covered days in parentheses when the range cuts the month', () => {
    expect(monthLabel('2026-10', { from: '2026-10-01', to: '2026-10-15' })).toBe('Octubre 2026 (01/10 al 15/10)')
    expect(monthLabel('2026-09', { from: '2026-09-20', to: '2026-10-15' })).toBe('Septiembre 2026 (20/09 al 30/09)')
    expect(monthLabel('2026-10', { from: '2026-09-20', to: '2026-10-15' })).toBe('Octubre 2026 (01/10 al 15/10)')
    expect(monthLabel('2026-10', { from: '2026-10-10', to: '2026-10-20' })).toBe('Octubre 2026 (10/10 al 20/10)')
  })

  it('shows a cut month of one day as that day alone', () => {
    expect(monthLabel('2026-10', { from: '2026-09-20', to: '2026-10-01' })).toBe('Octubre 2026 (01/10)')
  })
})

describe('periodLabel', () => {
  const october = { from: '2026-10-01', to: '2026-10-31' }

  it('labels a week row and a month row by the days the range covers', () => {
    expect(periodLabel({ weekStart: '2026-09-28', weekEnd: '2026-10-04' }, october)).toBe('01/10 al 04/10/2026')
    expect(periodLabel({ month: '2026-10' }, { from: '2026-10-01', to: '2026-10-15' })).toBe('Octubre 2026 (01/10 al 15/10)')
  })
})
