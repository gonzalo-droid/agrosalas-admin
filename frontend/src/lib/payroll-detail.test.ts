import { describe, expect, it } from 'vitest'
import {
  addedMessage,
  cellAriaLabel,
  cellText,
  cellTone,
  dayHeader,
  daysRecordedByWorker,
  isInProgress,
  hasMinutes,
  isRangeTruncated,
  payrollChanges,
  tabFromParam,
  totalsText,
} from './payroll-detail'

const record = (overrides: Partial<Parameters<typeof cellTone>[0] & object> = {}) => ({
  workerId: 'a',
  date: '2026-10-05',
  type: 'worked' as const,
  workedMinutes: 480,
  regularMinutes: 480,
  overtimeMinutes: 0,
  amountCents: 5000 as number | null,
  needsReview: false,
  clockIn1: '2026-10-05T12:00:00.000Z',
  clockOut1: '2026-10-05T17:00:00.000Z',
  clockIn2: '2026-10-05T18:00:00.000Z',
  clockOut2: '2026-10-05T21:00:00.000Z',
  ...overrides,
})

describe('dayHeader', () => {
  it('shows the weekday and the day of the month', () => {
    expect(dayHeader('2026-10-05')).toBe('lun 05')
    expect(dayHeader('2026-10-11')).toBe('dom 11')
  })
})

describe('isInProgress', () => {
  it('is true for a worked record with a stretch that has its start and not its end', () => {
    expect(isInProgress(record({ clockOut2: null }))).toBe(true)
    expect(isInProgress(record({ clockIn1: '2026-10-05T12:00:00.000Z', clockOut1: null, clockIn2: null, clockOut2: null, workedMinutes: 0 }))).toBe(true)
  })

  it('is false for a complete day, an absence and a day without a record', () => {
    expect(isInProgress(record())).toBe(false)
    // One closed stretch is a complete day: the second one is optional.
    expect(isInProgress(record({ clockIn2: null, clockOut2: null }))).toBe(false)
    expect(isInProgress(record({ type: 'absence', clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null }))).toBe(false)
    expect(isInProgress(null)).toBe(false)
  })
})

describe('cellText', () => {
  it('is the grid label of the record, with a "…" after the hours of a day in progress', () => {
    expect(cellText(record())).toBe('8:00')
    expect(cellText(record({ regularMinutes: 240, workedMinutes: 240, clockOut2: null }))).toBe('4:00…')
  })

  it('shows a day of one closed stretch as complete', () => {
    expect(cellText(record({ regularMinutes: 300, workedMinutes: 300, clockIn2: null, clockOut2: null }))).toBe('5:00')
  })

  it('does not repeat the dots when there are no hours yet', () => {
    expect(cellText(record({ workedMinutes: 0, regularMinutes: 0, clockOut1: null, clockIn2: null, clockOut2: null }))).toBe('…')
  })

  it('is empty without a record, and the letter of an absence', () => {
    expect(cellText(null)).toBe('')
    expect(cellText(record({ type: 'absence', workedMinutes: 0, regularMinutes: 0, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null }))).toBe('F')
  })
})

describe('cellAriaLabel', () => {
  it('names the worker, the day and the hours', () => {
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', record({ overtimeMinutes: 140, regularMinutes: 480, workedMinutes: 620 }))).toBe('Pérez, Ana, lun 05/10: 8:00 +2:20')
  })

  it('says "sin registro" for an empty cell', () => {
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', null)).toBe('Pérez, Ana, lun 05/10: sin registro')
  })

  it('says "en curso" for a day in progress and "por revisar" when it needs review', () => {
    const open = record({ regularMinutes: 240, workedMinutes: 240, clockOut2: null, needsReview: true })
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', open)).toBe('Pérez, Ana, lun 05/10: 4:00, en curso, por revisar')
  })

  it('says "sin horas" for a worked day with no marks, and "en curso" alone for one that has only started', () => {
    const noMarks = record({ workedMinutes: 0, regularMinutes: 0, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null })
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', noMarks)).toBe('Pérez, Ana, lun 05/10: sin horas')
    const started = record({ workedMinutes: 0, regularMinutes: 0, clockOut1: null, clockIn2: null, clockOut2: null })
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', started)).toBe('Pérez, Ana, lun 05/10: en curso')
  })

  it('spells out an absence instead of its letter', () => {
    const absence = record({ type: 'absence', workedMinutes: 0, regularMinutes: 0, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null })
    expect(cellAriaLabel('Pérez, Ana', '2026-10-05', absence)).toBe('Pérez, Ana, lun 05/10: Falta')
  })
})

describe('cellTone', () => {
  it('colours worked, overtime, absence and the other types of day apart', () => {
    expect(cellTone(null)).toBe('empty')
    expect(cellTone(record())).toBe('worked')
    expect(cellTone(record({ overtimeMinutes: 30 }))).toBe('overtime')
    expect(cellTone(record({ type: 'absence' }))).toBe('absence')
    expect(cellTone(record({ type: 'leave' }))).toBe('other')
    expect(cellTone(record({ type: 'medical_leave' }))).toBe('other')
  })
})

describe('totalsText', () => {
  it('shows regular hours and, when there are, the extra ones', () => {
    expect(totalsText({ regularMinutes: 1920, overtimeMinutes: 140, amountCents: 0 })).toBe('32:00 +2:20')
    expect(totalsText({ regularMinutes: 480, overtimeMinutes: 0, amountCents: 0 })).toBe('8:00')
  })

  it('shows a dash when nothing was worked', () => {
    expect(totalsText({ regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 })).toBe('–')
  })
})

describe('hasMinutes', () => {
  it('is true when the day has regular or overtime minutes, even if its amount is zero (contract staff)', () => {
    expect(hasMinutes({ regularMinutes: 480, overtimeMinutes: 0, amountCents: 0 })).toBe(true)
    expect(hasMinutes({ regularMinutes: 0, overtimeMinutes: 30, amountCents: 0 })).toBe(true)
  })

  it('is false when nothing was worked', () => {
    expect(hasMinutes({ regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 })).toBe(false)
  })
})

describe('isRangeTruncated', () => {
  it('is true when the dates shown stop before the end of the payroll', () => {
    expect(isRangeTruncated(['2026-10-01', '2026-10-02'], '2026-10-03')).toBe(true)
  })

  it('is false when the last date shown is the end of the payroll', () => {
    expect(isRangeTruncated(['2026-10-01', '2026-10-02'], '2026-10-02')).toBe(false)
    expect(isRangeTruncated([], '2026-10-02')).toBe(false)
  })
})

describe('daysRecordedByWorker', () => {
  it('counts the records of each worker', () => {
    const counts = daysRecordedByWorker([{ workerId: 'a' }, { workerId: 'a' }, { workerId: 'b' }])
    expect(counts.get('a')).toBe(2)
    expect(counts.get('b')).toBe(1)
    expect(counts.get('c')).toBeUndefined()
  })
})

describe('payrollChanges', () => {
  const payroll = { name: 'Semana 41', startDate: '2026-10-05', endDate: '2026-10-11', campaignId: 'c1' as string | null }
  const same = { name: 'Semana 41', startDate: '2026-10-05', endDate: '2026-10-11', campaignId: 'c1' }

  it('is empty when nothing changed, so nothing is sent', () => {
    expect(payrollChanges(payroll, same)).toEqual({})
    expect(payrollChanges(payroll, { ...same, name: '  Semana 41  ' })).toEqual({})
  })

  it('carries only what changed', () => {
    expect(payrollChanges(payroll, { ...same, name: 'Semana 41 · Uva' })).toEqual({ name: 'Semana 41 · Uva' })
    expect(payrollChanges(payroll, { ...same, endDate: '2026-10-12' })).toEqual({ endDate: '2026-10-12' })
  })

  it('sends null for "Sin campaña" and the id for a campaign', () => {
    expect(payrollChanges(payroll, { ...same, campaignId: '' })).toEqual({ campaignId: null })
    expect(payrollChanges({ ...payroll, campaignId: null }, { ...same, campaignId: 'c2' })).toEqual({ campaignId: 'c2' })
    expect(payrollChanges({ ...payroll, campaignId: null }, { ...same, campaignId: '' })).toEqual({})
  })
})

describe('addedMessage', () => {
  it('tells how many were added, or that they were all there already', () => {
    expect(addedMessage(3)).toBe('3 agregados')
    expect(addedMessage(1)).toBe('1 agregado')
    expect(addedMessage(0)).toBe('Ya estaban todos')
  })
})

describe('tabFromParam', () => {
  it('opens the workers tab only when the address asks for it', () => {
    expect(tabFromParam('workers')).toBe('workers')
    expect(tabFromParam('attendance')).toBe('attendance')
    expect(tabFromParam(null)).toBe('attendance')
    expect(tabFromParam('payments')).toBe('attendance')
  })
})
