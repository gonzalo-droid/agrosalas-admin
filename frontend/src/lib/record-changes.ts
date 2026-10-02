import { limaTime } from './lima-time'

// What goes to the API when a record is saved from the dialog. Pure: no React, no network.
// The rule that matters: on an edit only the fields the user changed are sent. A mark that is not sent keeps its stored
// instant, while a mark that is sent as 'HH:MM' is resolved again by the server (and can move by a day).

export type RecordType = 'worked' | 'absence' | 'leave' | 'medical_leave'
const MARK_KEYS = ['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'] as const
type MarkKey = (typeof MARK_KEYS)[number]

// The part of a loaded record that the form edits, as the API sends it.
export type LoadedRecord = Record<MarkKey, string | null> & {
  type: RecordType
  overtimeMinutes: number
  overtimeEdited: boolean
  // null for the coordinator, who never receives money.
  hourlyRate: number | null
  overtimeRate: number | null
  note: string | null
  needsReview: boolean
}

// The values of the inputs: text as typed. A mark is 'HH:MM' or ''; empty overtime means "the suggested one".
export type RecordForm = Record<MarkKey, string> & {
  type: RecordType
  overtimeMinutes: string
  hourlyRate: string
  overtimeRate: string
  note: string
  needsReview: boolean
}

// The request body of a create or an update (without the ids that a create adds).
export type RecordBody = Partial<
  Record<MarkKey, string | null> & {
    type: RecordType
    overtimeMinutes: number | null
    hourlyRate: number
    overtimeRate: number
    note: string | null
    needsReview: boolean
  }
>

// The form as it is when the dialog opens; a null record is a new one.
export function formFromRecord(record: LoadedRecord | null): RecordForm {
  return {
    type: record?.type ?? 'worked',
    clockIn1: limaTime(record?.clockIn1),
    clockOut1: limaTime(record?.clockOut1),
    clockIn2: limaTime(record?.clockIn2),
    clockOut2: limaTime(record?.clockOut2),
    overtimeMinutes: record?.overtimeEdited ? String(record.overtimeMinutes) : '',
    hourlyRate: record?.hourlyRate == null ? '' : String(record.hourlyRate),
    overtimeRate: record?.overtimeRate == null ? '' : String(record.overtimeRate),
    note: record?.note ?? '',
    needsReview: record?.needsReview ?? false,
  }
}

// The number in a text input, or null when it is empty or not a number.
const parsed = (text: string): number | null => {
  if (text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

// A problem of the form that stops the save, with the field it belongs to. Today only: a stored rate cannot be emptied
// (it would be ignored without a word). A new record may leave the rates empty: they are taken from the position.
export function validateRecordForm(
  record: LoadedRecord | null,
  form: RecordForm,
  options: { canEditMoney: boolean },
): { field: 'hourlyRate' | 'overtimeRate'; message: string } | null {
  if (!record || !options.canEditMoney) return null
  const initial = formFromRecord(record)
  for (const field of ['hourlyRate', 'overtimeRate'] as const) {
    if (parsed(form[field]) === null && initial[field] !== '') return { field, message: 'Escribe la tarifa.' }
  }
  return null
}

// Saving a worked day that has marks as anything else (absence, leave, medical leave) throws the marks away: the
// server keeps hours only for a worked day. The user is asked first.
export const willDiscardMarks = (record: LoadedRecord | null, form: RecordForm): boolean =>
  record?.type === 'worked' && form.type !== 'worked' && MARK_KEYS.some((key) => record[key] !== null)

// Compares the form with what was loaded and builds the body with what has to be sent.
// With a record the body can be empty (nothing changed); without one it always carries the type.
export function buildRecordBody(record: LoadedRecord | null, form: RecordForm, options: { canEditMoney: boolean }): RecordBody {
  const initial = formFromRecord(record)
  const body: RecordBody = {}

  if (!record || form.type !== initial.type) body.type = form.type

  // An absence or a leave carries no hours and no overtime, whatever the inputs still hold.
  if (form.type === 'worked') {
    for (const key of MARK_KEYS) {
      if (form[key] === initial[key]) continue
      body[key] = form[key] === '' ? null : form[key]
    }
    if (form.overtimeMinutes !== initial.overtimeMinutes) {
      const minutes = parsed(form.overtimeMinutes)
      // Emptied: back to the suggested overtime, which only has to be said when it was fixed by hand.
      if (minutes !== null) body.overtimeMinutes = minutes
      else if (initial.overtimeMinutes !== '') body.overtimeMinutes = null
    }
  }

  if (options.canEditMoney) {
    const hourlyRate = parsed(form.hourlyRate)
    const overtimeRate = parsed(form.overtimeRate)
    const hourlyChanged = hourlyRate !== null && hourlyRate !== parsed(initial.hourlyRate)
    const overtimeChanged = overtimeRate !== null && overtimeRate !== parsed(initial.overtimeRate)
    if (hourlyChanged) body.hourlyRate = hourlyRate
    if (overtimeChanged) body.overtimeRate = overtimeRate
    // Whoever sets a rate has reviewed the record, unless they ticked the box themselves.
    if (form.needsReview !== initial.needsReview) body.needsReview = form.needsReview
    else if (hourlyChanged || overtimeChanged) body.needsReview = false
  }

  const note = form.note.trim()
  if (note !== initial.note.trim()) body.note = note === '' ? null : note

  return body
}
