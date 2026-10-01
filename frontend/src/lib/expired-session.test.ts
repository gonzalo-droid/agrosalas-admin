import { describe, expect, it } from 'vitest'
import { ApiClientError } from './api'
import { createLimiter, isExpiredSession } from './expired-session'

describe('isExpiredSession', () => {
  it('recognizes the API 401', () => {
    expect(isExpiredSession(new ApiClientError({ code: 'unauthenticated', message: 'Inicia sesión para continuar' }))).toBe(true)
  })

  it('does not mistake other errors', () => {
    expect(isExpiredSession(new ApiClientError({ code: 'forbidden', message: 'x' }))).toBe(false)
    expect(isExpiredSession(new ApiClientError({ code: 'network_error', message: 'x' }))).toBe(false)
    expect(isExpiredSession(new Error('unauthenticated'))).toBe(false)
  })
})

describe('createLimiter', () => {
  it('lets one through per interval', () => {
    let now = 1_000
    const allowed = createLimiter(10_000, () => now)
    expect(allowed()).toBe(true)
    expect(allowed()).toBe(false)
    now += 9_999
    expect(allowed()).toBe(false)
    now += 1
    expect(allowed()).toBe(true)
  })
})
