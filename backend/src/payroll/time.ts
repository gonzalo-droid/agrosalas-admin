// Lima has no daylight saving time: it is always five hours behind UTC.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const inLima = (instant: Date) => new Date(instant.getTime() - LIMA_OFFSET_MS).toISOString()

// 'YYYY-MM-DD' of an instant, in Lima.
export const limaDate = (instant: Date): string => inLima(instant).slice(0, 10)

// The instant of a Lima wall-clock time ('HH:MM') on a date ('YYYY-MM-DD').
export const limaInstant = (date: string, time: string): Date => new Date(`${date}T${time}:00-05:00`)

// The instant itself, or the same wall-clock time on the following days until it is not earlier than the mark
// before it (night shift). With no previous mark it is returned as it is.
export function notBefore(instant: Date, previous: Date | null): Date {
  let result = instant
  while (previous && result.getTime() < previous.getTime()) result = new Date(result.getTime() + DAY_MS)
  return result
}

// Turns the wall-clock times of a record into instants. A time earlier than the one before it belongs to the
// next day: the record keeps the date of the first clock-in (night shift).
export function marksFromTimes(date: string, times: (string | null)[]): (Date | null)[] {
  let previous: Date | null = null
  return times.map((time) => {
    if (time === null) return null
    const instant = notBefore(limaInstant(date, time), previous)
    previous = instant
    return instant
  })
}
