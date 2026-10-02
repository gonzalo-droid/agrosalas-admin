import { describe, expect, it } from 'vitest'
import { payrollDisplayStatus, seesMoney, suggestedPayroll } from './payroll-view'

const week = { status: 'open' as const, startDate: '2026-10-05', endDate: '2026-10-11' }

describe('payrollDisplayStatus', () => {
  it('is in progress while today is inside the period', () => {
    expect(payrollDisplayStatus(week, '2026-10-05')).toBe('in_progress')
    expect(payrollDisplayStatus(week, '2026-10-11')).toBe('in_progress')
  })

  it('is to pay once the period has ended and it is still open', () => {
    expect(payrollDisplayStatus(week, '2026-10-12')).toBe('to_pay')
  })

  it('is upcoming before the period starts', () => {
    expect(payrollDisplayStatus(week, '2026-10-04')).toBe('upcoming')
  })

  it('is closed whatever the dates', () => {
    expect(payrollDisplayStatus({ ...week, status: 'closed' }, '2026-10-07')).toBe('closed')
  })
})

describe('suggestedPayroll', () => {
  it('suggests the current Monday-to-Sunday week and its number', () => {
    expect(suggestedPayroll('weekly', '2026-10-07')).toEqual({
      name: 'Semana 41',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
    })
  })

  it('adds the campaign to the name', () => {
    expect(suggestedPayroll('weekly', '2026-10-07', 'Contenedor Chile').name).toBe('Semana 41 · Contenedor Chile')
  })

  it('suggests the whole month for a monthly payroll', () => {
    expect(suggestedPayroll('monthly', '2026-10-07')).toEqual({
      name: 'Octubre 2026',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })
  })
})

describe('seesMoney', () => {
  it('is true for admin, accounting and management', () => {
    expect(seesMoney('admin')).toBe(true)
    expect(seesMoney('accounting')).toBe(true)
    expect(seesMoney('management')).toBe(true)
  })

  it('is false for the coordinator and while the role is not known yet', () => {
    expect(seesMoney('coordinator')).toBe(false)
    expect(seesMoney(undefined)).toBe(false)
  })
})
