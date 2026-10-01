import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { checkRecoveryLink, type RecoveryAuth } from './recovery'

// Imitates auth-js: initialize() resolves and the URL events come out afterwards, in a setTimeout(0).
function fakeAuth({
  events = [] as string[],
  initError = null as unknown,
  verifyError = null as unknown,
} = {}) {
  const listeners = new Map<number, (event: string) => void>()
  let nextId = 0
  const auth = {
    initialize: vi.fn(async () => {
      setTimeout(() => events.forEach((e) => listeners.forEach((l) => l(e))), 0)
      return { error: initError }
    }),
    onAuthStateChange: vi.fn((callback: (event: string) => void) => {
      const id = nextId++
      listeners.set(id, callback)
      return { data: { subscription: { unsubscribe: () => listeners.delete(id) } } }
    }),
    verifyOtp: vi.fn(async () => ({ error: verifyError })),
  }
  return { auth: auth satisfies RecoveryAuth, listeners }
}

const withParams = (query: string) => new URLSearchParams(query)

describe('checkRecoveryLink with token_hash', () => {
  it('confirms the recovery if Supabase accepts the token', async () => {
    const { auth } = fakeAuth()
    await expect(checkRecoveryLink(auth, withParams('token_hash=abc&type=recovery'))).resolves.toBe('recovery')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' })
  })

  it('is not a recovery if the token expired or was already used', async () => {
    const { auth } = fakeAuth({ verifyError: new AuthApiError('Token has expired', 403, 'otp_expired') })
    await expect(checkRecoveryLink(auth, withParams('token_hash=abc&type=recovery'))).resolves.toBe('invalid')
  })

  it('tells a missing connection apart', async () => {
    const { auth } = fakeAuth({ verifyError: new AuthRetryableFetchError('Failed to fetch', 0) })
    await expect(checkRecoveryLink(auth, withParams('token_hash=abc&type=recovery'))).resolves.toBe('network_error')
  })

  it('ignores a token_hash that is not for recovery', async () => {
    const { auth } = fakeAuth()
    await expect(checkRecoveryLink(auth, withParams('token_hash=abc&type=signup'), 5)).resolves.toBe('invalid')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('checkRecoveryLink with ?code=', () => {
  it('confirms the recovery when PASSWORD_RECOVERY arrives and stops listening', async () => {
    const { auth, listeners } = fakeAuth({ events: ['PASSWORD_RECOVERY'] })
    await expect(checkRecoveryLink(auth, withParams('code=xyz'), 5)).resolves.toBe('recovery')
    expect(listeners.size).toBe(0)
  })

  it('a normal session already open does not count as recovery', async () => {
    const { auth, listeners } = fakeAuth({ events: ['INITIAL_SESSION', 'SIGNED_IN'] })
    await expect(checkRecoveryLink(auth, withParams('code=xyz'), 5)).resolves.toBe('invalid')
    expect(listeners.size).toBe(0)
  })

  it('without a code or an event, neither', async () => {
    const { auth } = fakeAuth()
    await expect(checkRecoveryLink(auth, withParams(''), 5)).resolves.toBe('invalid')
  })

  it('tells a missing connection apart when exchanging the code', async () => {
    const { auth } = fakeAuth({ initError: new AuthRetryableFetchError('Failed to fetch', 0) })
    await expect(checkRecoveryLink(auth, withParams('code=xyz'), 5)).resolves.toBe('network_error')
  })

  it('subscribes before the initialization finishes', async () => {
    const { auth } = fakeAuth({ events: ['PASSWORD_RECOVERY'] })
    await checkRecoveryLink(auth, withParams('code=xyz'), 5)
    expect(auth.onAuthStateChange.mock.invocationCallOrder[0]).toBeLessThan(auth.initialize.mock.invocationCallOrder[0])
  })
})
