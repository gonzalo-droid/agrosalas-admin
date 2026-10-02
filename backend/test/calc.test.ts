import { describe, expect, it } from 'vitest'
import { amountCents, computeRecord, suggestedOvertime, workedMinutes, type Marks } from '../src/payroll/calc'
import { marksFromTimes } from '../src/payroll/time'

const marks = (date: string, times: (string | null)[]): Marks => {
  const [clockIn1, clockOut1, clockIn2, clockOut2] = marksFromTimes(date, times)
  return { clockIn1, clockOut1, clockIn2, clockOut2 }
}
const worked = (times: (string | null)[]) => ({
  type: 'worked' as const,
  marks: marks('2026-10-05', times),
  employmentType: 'temporary' as const,
  hourlyRate: 6.25,
  overtimeRate: 7.8125,
  overtimeMinutes: null,
})

describe('workedMinutes', () => {
  it('adds both stretches and does not pay the break between them', () => {
    expect(workedMinutes(marks('2026-10-05', ['07:10', '13:00', '14:00', '18:30']))).toBe(620)
  })

  it('counts only the first stretch when there is no second one', () => {
    expect(workedMinutes(marks('2026-10-05', ['08:00', '12:00', null, null]))).toBe(240)
  })

  it('counts nothing for a stretch that has no exit yet', () => {
    expect(workedMinutes(marks('2026-10-05', ['08:00', null, null, null]))).toBe(0)
  })

  it('counts a night shift that ends the next day', () => {
    expect(workedMinutes(marks('2026-10-05', ['19:00', '04:00', null, null]))).toBe(540)
  })

  it('ignores the seconds: each mark counts from the start of its minute', () => {
    expect(
      workedMinutes({
        clockIn1: new Date('2026-10-05T12:10:59Z'),
        clockOut1: new Date('2026-10-05T12:11:00Z'),
        clockIn2: null,
        clockOut2: null,
      }),
    ).toBe(1)
  })
})

describe('suggestedOvertime', () => {
  it('is what exceeds the 480-minute workday', () => {
    expect(suggestedOvertime(620)).toBe(140)
    expect(suggestedOvertime(480)).toBe(0)
    expect(suggestedOvertime(240)).toBe(0)
  })
})

describe('amountCents', () => {
  it('pays by the minute at each rate', () => {
    expect(amountCents(480, 140, 6.25, 7.8125)).toBe(6823)
  })

  it('rounds half a cent up', () => {
    expect(amountCents(1, 0, 0.3, 0)).toBe(1)
    expect(amountCents(1, 0, 0.29, 0)).toBe(0)
  })
})

describe('computeRecord', () => {
  it('matches the example of the spec: S/ 68.23', () => {
    expect(computeRecord(worked(['07:10', '13:00', '14:00', '18:30']))).toEqual({
      workedMinutes: 620,
      regularMinutes: 480,
      overtimeMinutes: 140,
      amountCents: 6823,
    })
  })

  it('pays a short day at the regular rate', () => {
    expect(computeRecord(worked(['08:00', '12:00', null, null]))).toEqual({
      workedMinutes: 240,
      regularMinutes: 240,
      overtimeMinutes: 0,
      amountCents: 2500,
    })
  })

  it('pays a night shift with its own rates', () => {
    expect(computeRecord({ ...worked(['19:00', '04:00', null, null]), hourlyRate: 10, overtimeRate: 12.5 })).toEqual({
      workedMinutes: 540,
      regularMinutes: 480,
      overtimeMinutes: 60,
      amountCents: 9250,
    })
  })

  it('uses the overtime set by hand instead of the suggested one', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: 0 })).toEqual({
      workedMinutes: 620,
      regularMinutes: 620,
      overtimeMinutes: 0,
      amountCents: 6458,
    })
  })

  it('keeps hand-set overtime between zero and the minutes worked', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: 999 })).toMatchObject({
      regularMinutes: 0,
      overtimeMinutes: 620,
      amountCents: 8073,
    })
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: -5 })).toMatchObject({
      regularMinutes: 620,
      overtimeMinutes: 0,
    })
  })

  it('pays nothing per day to contract staff but keeps their hours', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), employmentType: 'contract' })).toEqual({
      workedMinutes: 620,
      regularMinutes: 480,
      overtimeMinutes: 140,
      amountCents: 0,
    })
  })

  it('is all zeros for an absence, a leave or a medical leave', () => {
    for (const type of ['absence', 'leave', 'medical_leave'] as const) {
      expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), type })).toEqual({
        workedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        amountCents: 0,
      })
    }
  })
})
