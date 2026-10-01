import { ApiClientError } from './api'

// The API answered 401: the session is no longer valid (it expired, was revoked or the account was deactivated).
export const isExpiredSession = (error: unknown) => error instanceof ApiClientError && error.code === 'unauthenticated'

// Returns a function that answers true at most once every `intervalMs`.
// It lets several queries that fail together end the session only once, and avoids a loop if,
// after signing out, the browser returns to the panel with the same invalid session.
export function createLimiter(intervalMs: number, now: () => number = Date.now) {
  let last = -Infinity
  return () => {
    const t = now()
    if (t - last < intervalMs) return false
    last = t
    return true
  }
}
