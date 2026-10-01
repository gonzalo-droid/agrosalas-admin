import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from './api'
import { createQueryClient } from './query-client'

const expired = () => new ApiClientError({ code: 'unauthenticated', message: 'Inicia sesión para continuar' })
const forbidden = () => new ApiClientError({ code: 'forbidden', message: 'No tienes permiso' })

describe('createQueryClient', () => {
  it('notifies when a query fails because the session expired', async () => {
    const onExpired = vi.fn()
    const client = createQueryClient(onExpired)
    await client.fetchQuery({ queryKey: ['me'], queryFn: () => Promise.reject(expired()) }).catch(() => {})
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('notifies when a mutation fails because the session expired', async () => {
    const onExpired = vi.fn()
    const client = createQueryClient(onExpired)
    const mutation = client.getMutationCache().build(client, { mutationFn: () => Promise.reject(expired()) })
    await mutation.execute(undefined).catch(() => {})
    expect(onExpired).toHaveBeenCalledTimes(1)
  })

  it('does not notify for other errors', async () => {
    const onExpired = vi.fn()
    const client = createQueryClient(onExpired)
    await client.fetchQuery({ queryKey: ['x'], queryFn: () => Promise.reject(forbidden()) }).catch(() => {})
    expect(onExpired).not.toHaveBeenCalled()
  })

  it('only retries the queries that failed for lack of connection', () => {
    const retry = createQueryClient(() => {}).getDefaultOptions().queries?.retry as (n: number, e: unknown) => boolean
    expect(retry(0, new ApiClientError({ code: 'network_error', message: 'x' }))).toBe(true)
    expect(retry(1, new ApiClientError({ code: 'network_error', message: 'x' }))).toBe(false)
    expect(retry(0, expired())).toBe(false)
  })
})
