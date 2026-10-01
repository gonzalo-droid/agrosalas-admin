import {
  AuthApiError,
  AuthInvalidCredentialsError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { passwordChangeMessage, currentPasswordMessage, signInMessage, recoveryMessage, resetMessage } from './auth-errors'

// The errors are built with the auth-js classes, as the Supabase client returns them.
const noConnection = new AuthRetryableFetchError('Failed to fetch', 0)
const serverDown = new AuthRetryableFetchError('Bad Gateway', 502)
const tooMany = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')
const weak = new AuthWeakPasswordError('Password should be at least 8 characters.', 422, ['length'])
const same = new AuthApiError('New password should be different from the old password.', 422, 'same_password')
const credentials = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
const emailTooMany = new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit')

const NO_CONNECTION = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'

describe('resetMessage', () => {
  it('tells a missing connection apart', () => {
    expect(resetMessage(noConnection)).toBe(NO_CONNECTION)
  })

  it('asks to wait when there were too many attempts', () => {
    expect(resetMessage(tooMany)).toMatch(/demasiados intentos.*espera unos minutos/i)
    expect(resetMessage(new AuthApiError('Too many requests', 429, undefined))).toMatch(/demasiados intentos/i)
  })

  it('explains the weak and the repeated password', () => {
    expect(resetMessage(weak)).toMatch(/débil/)
    expect(resetMessage(same)).toMatch(/distinta de la actual/)
  })

  it('uses the generic text for everything else (also a server that is down)', () => {
    expect(resetMessage(serverDown)).toBe('No se pudo guardar la contraseña')
    expect(resetMessage(new AuthSessionMissingError())).toBe('No se pudo guardar la contraseña')
    expect(resetMessage(new TypeError('x'))).toBe('No se pudo guardar la contraseña')
  })
})

describe('signInMessage', () => {
  it('only says "incorrectos" when they are', () => {
    expect(signInMessage(credentials)).toBe('Correo o contraseña incorrectos')
    expect(signInMessage(new AuthInvalidCredentialsError('You must provide either an email or phone number and a password'))).toBe(
      'Correo o contraseña incorrectos',
    )
  })

  it('tells a missing connection and too many attempts apart', () => {
    expect(signInMessage(noConnection)).toBe(NO_CONNECTION)
    expect(signInMessage(tooMany)).toMatch(/demasiados intentos/i)
  })

  it('uses a generic text for everything else', () => {
    expect(signInMessage(serverDown)).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.')
  })
})

describe('recoveryMessage', () => {
  it('tells a missing connection and too many attempts apart', () => {
    expect(recoveryMessage(noConnection)).toBe(NO_CONNECTION)
    expect(recoveryMessage(emailTooMany)).toMatch(/demasiados intentos/i)
  })

  it('uses a generic text for everything else', () => {
    expect(recoveryMessage(serverDown)).toBe('No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.')
  })
})

describe('currentPasswordMessage', () => {
  it('says the current password is wrong only when it is', () => {
    expect(currentPasswordMessage(credentials)).toBe('La contraseña actual no es correcta')
    expect(currentPasswordMessage(noConnection)).toBe(NO_CONNECTION)
    expect(currentPasswordMessage(tooMany)).toMatch(/demasiados intentos/i)
    expect(currentPasswordMessage(serverDown)).toBe('No se pudo comprobar la contraseña actual')
  })
})

describe('passwordChangeMessage', () => {
  it('explains the weak and the repeated password and the missing connection', () => {
    expect(passwordChangeMessage(weak)).toMatch(/débil/)
    expect(passwordChangeMessage(same)).toMatch(/distinta de la actual/)
    expect(passwordChangeMessage(noConnection)).toBe(NO_CONNECTION)
  })

  it('uses a generic text for everything else', () => {
    expect(passwordChangeMessage(serverDown)).toBe('No se pudo cambiar la contraseña')
  })
})
