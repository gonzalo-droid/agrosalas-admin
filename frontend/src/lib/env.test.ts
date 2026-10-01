import { describe, expect, it } from 'vitest'
import { ConfigError, requireEnv } from './env'

describe('requireEnv', () => {
  it('returns the values when all are present', () => {
    expect(requireEnv({ A: 'one', B: 'two' })).toEqual({ A: 'one', B: 'two' })
  })

  it('names every missing variable', () => {
    const error = (() => {
      try {
        requireEnv({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', OTHER: 'x' })
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(ConfigError)
    expect((error as Error).message).toContain('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect((error as Error).message).not.toContain('OTHER')
  })
})
