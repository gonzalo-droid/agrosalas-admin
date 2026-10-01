import { describe, expect, it } from 'vitest'
import { ErrorDeConfiguracion, variablesRequeridas } from './entorno'

describe('variablesRequeridas', () => {
  it('devuelve los valores cuando están todos', () => {
    expect(variablesRequeridas({ A: 'uno', B: 'dos' })).toEqual({ A: 'uno', B: 'dos' })
  })

  it('nombra todas las variables que faltan', () => {
    const error = (() => {
      try {
        variablesRequeridas({ NEXT_PUBLIC_SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: '', OTRA: 'x' })
      } catch (e) {
        return e
      }
    })()
    expect(error).toBeInstanceOf(ErrorDeConfiguracion)
    expect((error as Error).message).toContain('NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY')
    expect((error as Error).message).not.toContain('OTRA')
  })
})
