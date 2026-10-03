import { describe, expect, it } from 'vitest'
import { REPORT_TABS, defaultRange, monthLabel, rangeFromParams, reportTabFromParam, weekLabel } from './report-view'

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
  it('writes the day and month of the start, and the full date of the end', () => {
    expect(weekLabel('2026-09-28', '2026-10-04')).toBe('28/09 al 04/10/2026')
  })

  it('keeps both years when the week crosses New Year', () => {
    expect(weekLabel('2026-12-28', '2027-01-03')).toBe('28/12/2026 al 03/01/2027')
  })
})

describe('monthLabel', () => {
  it('writes the month in Spanish with a capital and the year', () => {
    expect(monthLabel('2026-10')).toBe('Octubre 2026')
    expect(monthLabel('2026-01')).toBe('Enero 2026')
    expect(monthLabel('2026-12')).toBe('Diciembre 2026')
  })
})
