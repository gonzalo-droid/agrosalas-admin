import { describe, expect, it } from 'vitest'
import { hayQueVaciarCache } from './cambio-de-usuario'

describe('hayQueVaciarCache', () => {
  it('vacía al cerrar la sesión', () => {
    expect(hayQueVaciarCache('SIGNED_OUT', 'u1', null)).toBe(true)
    expect(hayQueVaciarCache('SIGNED_OUT', undefined, null)).toBe(true)
  })

  it('vacía cuando entra otra persona', () => {
    expect(hayQueVaciarCache('SIGNED_IN', 'u1', 'u2')).toBe(true)
    expect(hayQueVaciarCache('SIGNED_IN', null, 'u2')).toBe(true)
    expect(hayQueVaciarCache('PASSWORD_RECOVERY', 'u1', 'u2')).toBe(true)
  })

  it('no vacía mientras sigue la misma persona', () => {
    expect(hayQueVaciarCache('TOKEN_REFRESHED', 'u1', 'u1')).toBe(false)
    expect(hayQueVaciarCache('SIGNED_IN', 'u1', 'u1')).toBe(false)
    expect(hayQueVaciarCache('USER_UPDATED', 'u1', 'u1')).toBe(false)
  })

  it('el primer aviso solo anota quién está', () => {
    expect(hayQueVaciarCache('INITIAL_SESSION', undefined, 'u1')).toBe(false)
    expect(hayQueVaciarCache('INITIAL_SESSION', undefined, null)).toBe(false)
  })
})
