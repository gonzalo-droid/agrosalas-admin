import { describe, expect, it } from 'vitest'
import { formatHours, formatMinutes, marksSummary, nextMark } from './attendance'

const record = (clockIn1: string | null, clockOut1: string | null, clockIn2: string | null, clockOut2: string | null) => ({
  type: 'worked' as const,
  clockIn1,
  clockOut1,
  clockIn2,
  clockOut2,
})
const T = ['2026-10-05T12:10:00.000Z', '2026-10-05T18:00:00.000Z', '2026-10-05T19:00:00.000Z', '2026-10-05T23:30:00.000Z']

describe('nextMark', () => {
  it('starts with the clock-in when there is no record', () => {
    expect(nextMark(null)).toBe('clockIn1')
  })

  it('follows the order: clock-in, break, return, exit', () => {
    expect(nextMark(record(T[0], null, null, null))).toBe('clockOut1')
    expect(nextMark(record(T[0], T[1], null, null))).toBe('clockIn2')
    expect(nextMark(record(T[0], T[1], T[2], null))).toBe('clockOut2')
  })

  it('has no next step once the four marks are set', () => {
    expect(nextMark(record(T[0], T[1], T[2], T[3]))).toBeNull()
  })

  it('has no next step on an absence or a leave', () => {
    expect(nextMark({ ...record(null, null, null, null), type: 'absence' })).toBeNull()
    expect(nextMark({ ...record(null, null, null, null), type: 'medical_leave' })).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('writes hours and minutes in words', () => {
    expect(formatMinutes(620)).toBe('10 h 20 min')
    expect(formatMinutes(480)).toBe('8 h')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})

describe('formatHours', () => {
  it('writes minutes as h:mm for the grid', () => {
    expect(formatHours(620)).toBe('10:20')
    expect(formatHours(5)).toBe('0:05')
  })
})

describe('marksSummary', () => {
  it('shows both stretches in Lima time', () => {
    expect(marksSummary(record(T[0], T[1], T[2], T[3]))).toBe('07:10 – 13:00 · 14:00 – 18:30')
  })

  it('shows an open stretch with an ellipsis', () => {
    expect(marksSummary(record(T[0], null, null, null))).toBe('07:10 – …')
    expect(marksSummary(record(T[0], T[1], T[2], null))).toBe('07:10 – 13:00 · 14:00 – …')
  })

  it('is empty when there are no marks', () => {
    expect(marksSummary(record(null, null, null, null))).toBe('')
  })
})
