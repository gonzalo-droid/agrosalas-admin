import { describe, expect, it } from 'vitest'
import { ApiClientError } from './api'
import { applyRecords, attendanceHref, formatHours, formatMinutes, hasOpenStretch, markErrorText, marksSummary, nextMark } from './attendance'

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

describe('hasOpenStretch', () => {
  it('is false when there are no marks', () => {
    expect(hasOpenStretch(record(null, null, null, null))).toBe(false)
    expect(hasOpenStretch(null)).toBe(false)
  })

  it('is true when a stretch has its start and not its end', () => {
    expect(hasOpenStretch(record(T[0], null, null, null))).toBe(true)
    expect(hasOpenStretch(record(T[0], T[1], T[2], null))).toBe(true)
  })

  it('is false for a day of one closed stretch: the second one is optional', () => {
    expect(hasOpenStretch(record(T[0], T[1], null, null))).toBe(false)
  })

  it('is false once both stretches are closed', () => {
    expect(hasOpenStretch(record(T[0], T[1], T[2], T[3]))).toBe(false)
  })

  it('is false on an absence or a leave', () => {
    expect(hasOpenStretch({ ...record(null, null, null, null), type: 'absence' })).toBe(false)
    expect(hasOpenStretch({ ...record(T[0], null, null, null), type: 'leave' })).toBe(false)
  })
})

describe('applyRecords', () => {
  const item = (id: string, rec: { workerId: string; v: number } | null) => ({ worker: { id }, record: rec })
  const list = { items: [item('a', null), item('b', { workerId: 'b', v: 1 }), item('c', null)] }

  it('replaces the record of the workers that were answered and leaves the rest untouched', () => {
    const next = applyRecords(list, [{ workerId: 'a', v: 2 }, { workerId: 'b', v: 3 }])
    expect(next.items[0].record).toEqual({ workerId: 'a', v: 2 })
    expect(next.items[1].record).toEqual({ workerId: 'b', v: 3 })
    expect(next.items[2]).toBe(list.items[2])
  })

  it('ignores a record of a worker that is not in the list', () => {
    expect(applyRecords(list, [{ workerId: 'z', v: 9 }]).items).toEqual(list.items)
  })

  it('does not mutate the list it receives', () => {
    applyRecords(list, [{ workerId: 'a', v: 2 }])
    expect(list.items[0].record).toBeNull()
  })
})

describe('attendanceHref', () => {
  it('carries no date when it is today', () => {
    expect(attendanceHref({ date: '2026-10-05', today: '2026-10-05' })).toBe('/attendance')
    expect(attendanceHref({ date: '2026-10-05', today: '2026-10-05', payrollId: 'p1' })).toBe('/attendance?payrollId=p1')
  })

  it('carries the date when it is another day', () => {
    expect(attendanceHref({ date: '2026-10-04', today: '2026-10-05' })).toBe('/attendance?date=2026-10-04')
    expect(attendanceHref({ date: '2026-10-04', today: '2026-10-05', payrollId: 'p1' })).toBe('/attendance?date=2026-10-04&payrollId=p1')
  })
})

describe('markErrorText', () => {
  const error = (code: string, message: string) => new ApiClientError({ code, message })

  it('adds the final period and asks to tap again after a connection failure', () => {
    expect(markErrorText(error('network_error', 'No se pudo conectar con el servidor'))).toBe(
      'No se pudo conectar con el servidor. Vuelve a tocar el botón.',
    )
  })

  it('does not repeat a period the message already has', () => {
    expect(markErrorText(error('network_error', 'Sin conexión.'))).toBe('Sin conexión. Vuelve a tocar el botón.')
  })

  it('asks to tap again after a conflict', () => {
    expect(markErrorText(error('conflict', 'El registro cambió mientras se guardaba; inténtalo de nuevo'))).toBe(
      'El registro cambió mientras se guardaba; inténtalo de nuevo. Vuelve a tocar el botón.',
    )
  })

  it('only gives the message when tapping again cannot help', () => {
    expect(markErrorText(error('not_worked', 'Ese día está marcado como falta o permiso; edita el registro'))).toBe(
      'Ese día está marcado como falta o permiso; edita el registro.',
    )
    expect(markErrorText(error('out_of_order', 'Falta la marca anterior'))).toBe('Falta la marca anterior.')
    expect(markErrorText(error('other_payroll', 'Ya tiene un registro en otra planilla.'))).toBe('Ya tiene un registro en otra planilla.')
  })

  it('uses the generic message for an error that is not the API\'s', () => {
    expect(markErrorText(new Error('boom'))).toBe('No se pudo completar la acción.')
  })
})
