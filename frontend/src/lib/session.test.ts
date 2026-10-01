import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { endSession } from './session'

function setup(signOut: () => Promise<unknown>) {
  const client = new QueryClient()
  client.setQueryData(['me'], { name: 'Ana' })
  const router = { replace: vi.fn(), refresh: vi.fn() }
  const auth = { signOut: vi.fn(signOut) }
  return { client, router, auth }
}

describe('endSession', () => {
  it('ends only this session, clears the cache and goes to the sign-in', async () => {
    const { client, router, auth } = setup(async () => ({ error: null }))
    await endSession(client, router, auth)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(router.replace).toHaveBeenCalledWith('/login')
    expect(router.refresh).toHaveBeenCalled()
  })

  it('even if signOut fails, it clears the cache and goes to the sign-in', async () => {
    const { client, router, auth } = setup(async () => {
      throw new Error('falló')
    })
    await expect(endSession(client, router, auth)).rejects.toThrow('falló')
    expect(client.getQueryData(['me'])).toBeUndefined()
    expect(router.replace).toHaveBeenCalledWith('/login')
  })

  it('does not repeat while a sign-out is in progress', async () => {
    let finish = () => {}
    const { client, router, auth } = setup(() => new Promise((r) => (finish = () => r({ error: null }))))
    const first = endSession(client, router, auth)
    const second = endSession(client, router, auth)
    finish()
    await Promise.all([first, second])
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledTimes(1)
    // Once the sign-out is done, signing out again is possible (e.g. after another sign-in).
    auth.signOut.mockImplementation(async () => ({ error: null }))
    await endSession(client, router, auth)
    expect(auth.signOut).toHaveBeenCalledTimes(2)
  })
})
