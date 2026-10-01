import { describe, expect, it } from 'vitest'
import { validateNewPassword } from './validate-password'

describe('validateNewPassword', () => {
  it('accepts a password of 8 or more characters repeated identically', () => {
    expect(validateNewPassword('12345678', '12345678')).toEqual({})
  })

  it('flags the length on the first field', () => {
    expect(validateNewPassword('corta', 'corta')).toEqual({ password: 'Usa al menos 8 caracteres' })
  })

  it('flags the difference on the repeat field', () => {
    expect(validateNewPassword('12345678', '12345679')).toEqual({ repeat: 'Las contraseñas no coinciden' })
  })

  it('shows both errors at once', () => {
    expect(validateNewPassword('corta', 'otra')).toEqual({
      password: 'Usa al menos 8 caracteres',
      repeat: 'Las contraseñas no coinciden',
    })
  })
})
