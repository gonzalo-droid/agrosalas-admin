import { describe, expect, it } from 'vitest'
import { shouldClearCache } from './user-change'

describe('shouldClearCache', () => {
  it('clears on sign-out', () => {
    expect(shouldClearCache('SIGNED_OUT', 'u1', null)).toBe(true)
    expect(shouldClearCache('SIGNED_OUT', undefined, null)).toBe(true)
  })

  it('clears when another person signs in', () => {
    expect(shouldClearCache('SIGNED_IN', 'u1', 'u2')).toBe(true)
    expect(shouldClearCache('SIGNED_IN', null, 'u2')).toBe(true)
    expect(shouldClearCache('PASSWORD_RECOVERY', 'u1', 'u2')).toBe(true)
  })

  it('does not clear while the same person remains', () => {
    expect(shouldClearCache('TOKEN_REFRESHED', 'u1', 'u1')).toBe(false)
    expect(shouldClearCache('SIGNED_IN', 'u1', 'u1')).toBe(false)
    expect(shouldClearCache('USER_UPDATED', 'u1', 'u1')).toBe(false)
  })

  it('the first event only notes who is there', () => {
    expect(shouldClearCache('INITIAL_SESSION', undefined, 'u1')).toBe(false)
    expect(shouldClearCache('INITIAL_SESSION', undefined, null)).toBe(false)
  })
})
