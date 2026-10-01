import { describe, expect, it } from 'vitest'
import { formatDate, formatSoles, suggestedOvertimeRate, dateRange } from './format'

describe('formatSoles', () => {
  it('shows two decimals and a dash when there is no amount', () => {
    expect(formatSoles(7.8125)).toBe('S/ 7.81')
    expect(formatSoles(1800)).toBe('S/ 1,800.00')
    expect(formatSoles(null)).toBe('–')
  })
})

describe('suggestedOvertimeRate', () => {
  it('is the regular rate plus 25 %', () => {
    expect(suggestedOvertimeRate(6.25)).toBe(7.8125)
    expect(suggestedOvertimeRate(10)).toBe(12.5)
    expect(suggestedOvertimeRate(30)).toBe(37.5)
  })
})

describe('formatDate', () => {
  it('turns YYYY-MM-DD into DD/MM/YYYY without shifting the day', () => {
    expect(formatDate('2026-10-04')).toBe('04/10/2026')
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })

  it('shows a dash when there is no date', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
    expect(formatDate('')).toBe('—')
  })
})

describe('dateRange', () => {
  it('describes the range with both ends or with whichever exists', () => {
    expect(dateRange('2026-10-04', '2026-10-10')).toBe('04/10/2026 a 10/10/2026')
    expect(dateRange('2026-10-04', null)).toBe('desde 04/10/2026')
    expect(dateRange(null, '2026-10-10')).toBe('hasta 10/10/2026')
    expect(dateRange(null, undefined)).toBe('')
  })
})
