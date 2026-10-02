import { describe, expect, it } from 'vitest'
import { buildRecordBody, formFromRecord, validateRecordForm, willDiscardMarks, type LoadedRecord, type RecordForm } from './record-changes'

// A worked day of 2026-10-05: 07:10 – 13:00 · 14:00 – 18:30 in Lima (UTC-5).
const record: LoadedRecord = {
  type: 'worked',
  clockIn1: '2026-10-05T12:10:00.000Z',
  clockOut1: '2026-10-05T18:00:00.000Z',
  clockIn2: '2026-10-05T19:00:00.000Z',
  clockOut2: '2026-10-05T23:30:00.000Z',
  overtimeMinutes: 80,
  overtimeEdited: false,
  hourlyRate: 7.5,
  overtimeRate: 9.375,
  note: null,
  needsReview: false,
}
const money = { canEditMoney: true }
const noMoney = { canEditMoney: false }

// The form as the user left it after touching some fields.
const edit = (base: LoadedRecord | null, changes: Partial<RecordForm>): RecordForm => ({ ...formFromRecord(base), ...changes })

describe('formFromRecord', () => {
  it('shows the marks in Lima time and the overtime empty while it is the suggested one', () => {
    expect(formFromRecord(record)).toEqual({
      type: 'worked',
      clockIn1: '07:10',
      clockOut1: '13:00',
      clockIn2: '14:00',
      clockOut2: '18:30',
      overtimeMinutes: '',
      hourlyRate: '7.5',
      overtimeRate: '9.375',
      note: '',
      needsReview: false,
    })
  })

  it('shows the hand-set overtime as a number', () => {
    expect(formFromRecord({ ...record, overtimeMinutes: 45, overtimeEdited: true }).overtimeMinutes).toBe('45')
  })

  it('leaves the rates empty when the record has none (the coordinator never receives them)', () => {
    const form = formFromRecord({ ...record, hourlyRate: null, overtimeRate: null })
    expect(form.hourlyRate).toBe('')
    expect(form.overtimeRate).toBe('')
  })

  it('starts a new record as a worked day without anything filled in', () => {
    expect(formFromRecord(null)).toEqual({
      type: 'worked',
      clockIn1: '',
      clockOut1: '',
      clockIn2: '',
      clockOut2: '',
      overtimeMinutes: '',
      hourlyRate: '',
      overtimeRate: '',
      note: '',
      needsReview: false,
    })
  })
})

describe('buildRecordBody when editing', () => {
  it('sends nothing when nothing changed', () => {
    expect(buildRecordBody(record, formFromRecord(record), money)).toEqual({})
  })

  it('sends only the hour that changed', () => {
    expect(buildRecordBody(record, edit(record, { clockOut2: '19:00' }), money)).toEqual({ clockOut2: '19:00' })
  })

  it('does not send the marks that were not touched, even the ones that fall the next day', () => {
    const night: LoadedRecord = { ...record, clockIn1: '2026-10-05T23:00:00.000Z', clockOut1: '2026-10-06T07:00:00.000Z', clockIn2: null, clockOut2: null }
    const body = buildRecordBody(night, edit(night, { note: 'turno de noche' }), money)
    expect(body).toEqual({ note: 'turno de noche' })
  })

  it('sends null for an hour that was cleared', () => {
    expect(buildRecordBody(record, edit(record, { clockOut2: '' }), money)).toEqual({ clockOut2: null })
  })

  it('does not send an empty hour that was already empty', () => {
    const open = { ...record, clockIn2: null, clockOut2: null }
    expect(buildRecordBody(open, formFromRecord(open), money)).toEqual({})
  })

  it('sends the hours typed on a record that had none', () => {
    const open = { ...record, clockIn2: null, clockOut2: null }
    expect(buildRecordBody(open, edit(open, { clockIn2: '14:00', clockOut2: '18:00' }), money)).toEqual({ clockIn2: '14:00', clockOut2: '18:00' })
  })

  it('sends only the type, without hours or overtime, when it changes to an absence', () => {
    const form = edit(record, { type: 'absence', clockIn1: '08:00', overtimeMinutes: '30' })
    expect(buildRecordBody(record, form, money)).toEqual({ type: 'absence' })
  })

  it('sends only the type when it changes to a leave or a medical leave, plus the note if it changed', () => {
    expect(buildRecordBody(record, edit(record, { type: 'medical_leave', note: 'CITT 123' }), money)).toEqual({
      type: 'medical_leave',
      note: 'CITT 123',
    })
  })

  it('sends neither hours nor overtime for a record that stays an absence', () => {
    const absence: LoadedRecord = { ...record, type: 'absence', clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null, overtimeMinutes: 0 }
    expect(buildRecordBody(absence, edit(absence, { clockIn1: '08:00', overtimeMinutes: '30', note: 'avisó' }), money)).toEqual({ note: 'avisó' })
  })

  it('sends the hours when an absence becomes a worked day', () => {
    const absence: LoadedRecord = { ...record, type: 'absence', clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null, overtimeMinutes: 0 }
    expect(buildRecordBody(absence, edit(absence, { type: 'worked', clockIn1: '08:00', clockOut1: '12:00' }), money)).toEqual({
      type: 'worked',
      clockIn1: '08:00',
      clockOut1: '12:00',
    })
  })

  describe('overtime', () => {
    const handSet: LoadedRecord = { ...record, overtimeMinutes: 45, overtimeEdited: true }

    it('sends null when the field is emptied while it was set by hand', () => {
      expect(buildRecordBody(handSet, edit(handSet, { overtimeMinutes: '' }), money)).toEqual({ overtimeMinutes: null })
    })

    it('does not send anything when the field is empty and it was not set by hand', () => {
      expect(buildRecordBody(record, edit(record, { overtimeMinutes: '' }), money)).toEqual({})
    })

    it('sends the number typed', () => {
      expect(buildRecordBody(record, edit(record, { overtimeMinutes: '30' }), money)).toEqual({ overtimeMinutes: 30 })
    })

    it('sends a number that equals the suggested one: the user fixed it by hand', () => {
      expect(buildRecordBody(record, edit(record, { overtimeMinutes: '80' }), money)).toEqual({ overtimeMinutes: 80 })
    })

    it('does not send an unchanged hand-set number', () => {
      expect(buildRecordBody(handSet, formFromRecord(handSet), money)).toEqual({})
    })

    it('sends a changed hand-set number', () => {
      expect(buildRecordBody(handSet, edit(handSet, { overtimeMinutes: '60' }), money)).toEqual({ overtimeMinutes: 60 })
    })

    it('sends 0 when the user typed 0', () => {
      expect(buildRecordBody(record, edit(record, { overtimeMinutes: '0' }), money)).toEqual({ overtimeMinutes: 0 })
    })
  })

  describe('rates and review', () => {
    it('adds needsReview: false when a rate changes and the box was not touched', () => {
      expect(buildRecordBody(record, edit(record, { hourlyRate: '8' }), money)).toEqual({ hourlyRate: 8, needsReview: false })
      expect(buildRecordBody(record, edit(record, { overtimeRate: '10.5' }), money)).toEqual({ overtimeRate: 10.5, needsReview: false })
    })

    it('clears the review flag of a record that was flagged when the rate is set', () => {
      const flagged = { ...record, hourlyRate: 0, overtimeRate: 0, needsReview: true }
      expect(buildRecordBody(flagged, edit(flagged, { hourlyRate: '7.5' }), money)).toEqual({ hourlyRate: 7.5, needsReview: false })
    })

    it('respects the box when the user ticked it with the rate change', () => {
      expect(buildRecordBody(record, edit(record, { hourlyRate: '8', needsReview: true }), money)).toEqual({ hourlyRate: 8, needsReview: true })
    })

    it('respects the box when the user unticked it with the rate change', () => {
      const flagged = { ...record, needsReview: true }
      expect(buildRecordBody(flagged, edit(flagged, { hourlyRate: '8', needsReview: false }), money)).toEqual({ hourlyRate: 8, needsReview: false })
    })

    it('sends the box alone when only it changed', () => {
      expect(buildRecordBody(record, edit(record, { needsReview: true }), money)).toEqual({ needsReview: true })
    })

    it('does not send an unchanged rate', () => {
      expect(buildRecordBody(record, edit(record, { hourlyRate: '7.50', note: 'x' }), money)).toEqual({ note: 'x' })
    })

    it('never sends rates or the review flag when the role cannot edit money', () => {
      const form = edit(record, { hourlyRate: '9', overtimeRate: '11', needsReview: true, clockOut2: '19:00' })
      expect(buildRecordBody(record, form, noMoney)).toEqual({ clockOut2: '19:00' })
    })

    it('never sends rates for a coordinator, who receives them as null', () => {
      const hidden = { ...record, hourlyRate: null, overtimeRate: null }
      const form = edit(hidden, { hourlyRate: '9', note: 'ok' })
      expect(buildRecordBody(hidden, form, noMoney)).toEqual({ note: 'ok' })
    })
  })

  describe('note', () => {
    it('sends the trimmed text', () => {
      expect(buildRecordBody(record, edit(record, { note: '  llegó tarde ' }), money)).toEqual({ note: 'llegó tarde' })
    })

    it('sends null when the note was cleared', () => {
      const noted = { ...record, note: 'algo' }
      expect(buildRecordBody(noted, edit(noted, { note: '  ' }), money)).toEqual({ note: null })
    })

    it('does not send a note that only differs in blank space', () => {
      const noted = { ...record, note: 'algo' }
      expect(buildRecordBody(noted, edit(noted, { note: 'algo ' }), money)).toEqual({})
    })
  })
})

describe('buildRecordBody when creating', () => {
  it('creates an absence with only its type, plus the note when there is one', () => {
    expect(buildRecordBody(null, edit(null, { type: 'absence' }), money)).toEqual({ type: 'absence' })
    expect(buildRecordBody(null, edit(null, { type: 'absence', note: 'sin aviso' }), money)).toEqual({ type: 'absence', note: 'sin aviso' })
  })

  it('does not send hours or overtime for an absence even if they were typed before changing the type', () => {
    expect(buildRecordBody(null, edit(null, { type: 'leave', clockIn1: '08:00', overtimeMinutes: '20' }), money)).toEqual({ type: 'leave' })
  })

  it('creates a worked day with the hours that were filled in', () => {
    expect(buildRecordBody(null, edit(null, { clockIn1: '07:00', clockOut1: '12:00' }), money)).toEqual({
      type: 'worked',
      clockIn1: '07:00',
      clockOut1: '12:00',
    })
  })

  it('sends the overtime typed and nothing when it is empty', () => {
    expect(buildRecordBody(null, edit(null, { clockIn1: '07:00', overtimeMinutes: '15' }), money)).toEqual({
      type: 'worked',
      clockIn1: '07:00',
      overtimeMinutes: 15,
    })
  })

  it('sends the rates typed with needsReview: false, or the box when it was ticked', () => {
    expect(buildRecordBody(null, edit(null, { hourlyRate: '7', overtimeRate: '8.75' }), money)).toEqual({
      type: 'worked',
      hourlyRate: 7,
      overtimeRate: 8.75,
      needsReview: false,
    })
    expect(buildRecordBody(null, edit(null, { hourlyRate: '7', needsReview: true }), money)).toEqual({
      type: 'worked',
      hourlyRate: 7,
      needsReview: true,
    })
  })

  it('leaves the rates to the server when none was typed, and never sends them without money rights', () => {
    expect(buildRecordBody(null, edit(null, { clockIn1: '07:00' }), money)).toEqual({ type: 'worked', clockIn1: '07:00' })
    expect(buildRecordBody(null, edit(null, { hourlyRate: '7', needsReview: true }), noMoney)).toEqual({ type: 'worked' })
  })
})

describe('validateRecordForm', () => {
  it('asks for the rate when the field of a stored rate was emptied', () => {
    expect(validateRecordForm(record, edit(record, { hourlyRate: '' }), money)).toEqual({ field: 'hourlyRate', message: 'Escribe la tarifa.' })
    expect(validateRecordForm(record, edit(record, { overtimeRate: '' }), money)).toEqual({ field: 'overtimeRate', message: 'Escribe la tarifa.' })
  })

  it('accepts a rate that was changed, and a record that was not touched', () => {
    expect(validateRecordForm(record, edit(record, { hourlyRate: '8' }), money)).toBeNull()
    expect(validateRecordForm(record, formFromRecord(record), money)).toBeNull()
  })

  it('lets a new record leave the rates empty: they are taken from the position', () => {
    expect(validateRecordForm(null, formFromRecord(null), money)).toBeNull()
  })

  it('does not look at rates the role cannot edit', () => {
    expect(validateRecordForm(record, edit(record, { hourlyRate: '' }), noMoney)).toBeNull()
  })
})

describe('willDiscardMarks', () => {
  it('is true when a worked day with marks is saved as an absence', () => {
    expect(willDiscardMarks(record, edit(record, { type: 'absence' }))).toBe(true)
  })

  it('is false for a worked day without marks, a new record and a day that stays worked', () => {
    expect(willDiscardMarks({ ...record, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null }, edit(record, { type: 'absence' }))).toBe(false)
    expect(willDiscardMarks(null, edit(null, { type: 'absence' }))).toBe(false)
    expect(willDiscardMarks(record, formFromRecord(record))).toBe(false)
  })

  it('is false when the stored record was not worked', () => {
    expect(willDiscardMarks({ ...record, type: 'absence' }, edit(record, { type: 'absence' }))).toBe(false)
  })
})
