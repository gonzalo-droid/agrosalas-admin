export const WORKDAY_MINUTES = 480

export type Marks = {
  clockIn1: Date | null
  clockOut1: Date | null
  clockIn2: Date | null
  clockOut2: Date | null
}

// Each mark counts from the start of its minute: the seconds are not paid.
const minuteOf = (instant: Date) => Math.floor(instant.getTime() / 60000)
const span = (from: Date | null, to: Date | null) => (from && to ? Math.max(0, minuteOf(to) - minuteOf(from)) : 0)

// The break between the two stretches is not paid. A stretch without its exit counts nothing yet.
export const workedMinutes = (marks: Marks): number =>
  span(marks.clockIn1, marks.clockOut1) + span(marks.clockIn2, marks.clockOut2)

export const suggestedOvertime = (worked: number): number => Math.max(0, worked - WORKDAY_MINUTES)

// Rates are soles with up to four decimals: as integers they are ten-thousandths of a sol.
const rateUnits = (rate: number) => Math.round(rate * 10000)

// Paid by the minute. minutes × rate ÷ 60 soles = minutes × rateUnits ÷ 6000 cents, rounded half up.
export function amountCents(regularMinutes: number, overtimeMinutes: number, hourlyRate: number, overtimeRate: number): number {
  const numerator = regularMinutes * rateUnits(hourlyRate) + overtimeMinutes * rateUnits(overtimeRate)
  return Math.floor((numerator + 3000) / 6000)
}

export type RecordInput = {
  type: 'worked' | 'absence' | 'leave' | 'medical_leave'
  marks: Marks
  employmentType: 'temporary' | 'contract'
  hourlyRate: number
  overtimeRate: number
  // null = use the suggested overtime; a number = the overtime set by hand.
  overtimeMinutes: number | null
}

export type RecordTotals = {
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
}

export function computeRecord(input: RecordInput): RecordTotals {
  if (input.type !== 'worked') return { workedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
  const worked = workedMinutes(input.marks)
  const overtime =
    input.overtimeMinutes === null ? suggestedOvertime(worked) : Math.min(Math.max(0, input.overtimeMinutes), worked)
  const regular = worked - overtime
  // Contract staff are paid by the monthly salary item of the payroll, not by the day.
  const amount = input.employmentType === 'contract' ? 0 : amountCents(regular, overtime, input.hourlyRate, input.overtimeRate)
  return { workedMinutes: worked, regularMinutes: regular, overtimeMinutes: overtime, amountCents: amount }
}
