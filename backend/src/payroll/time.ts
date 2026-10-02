// Lima has no daylight saving time: it is always five hours behind UTC.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const inLima = (instant: Date) => new Date(instant.getTime() - LIMA_OFFSET_MS).toISOString()

// 'YYYY-MM-DD' of an instant, in Lima.
export const limaDate = (instant: Date): string => inLima(instant).slice(0, 10)

// 'HH:MM' of an instant, in Lima.
export const limaTime = (instant: Date): string => inLima(instant).slice(11, 16)

// The instant of a Lima wall-clock time ('HH:MM') on a date ('YYYY-MM-DD').
export const limaInstant = (date: string, time: string): Date => new Date(`${date}T${time}:00-05:00`)

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

// Turns the wall-clock times of a record into instants. A time earlier than the one before it belongs to the
// next day: the record keeps the date of the first clock-in (night shift).
export function marksFromTimes(date: string, times: (string | null)[]): (Date | null)[] {
  let previous: Date | null = null
  return times.map((time) => {
    if (time === null) return null
    let instant = limaInstant(date, time)
    while (previous && instant.getTime() < previous.getTime()) instant = new Date(instant.getTime() + DAY_MS)
    previous = instant
    return instant
  })
}
