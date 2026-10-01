import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError, AuthWeakPasswordError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { mensajeRestablecer } from './errores-acceso'

// Los errores se construyen con las clases de auth-js, tal como los devuelve el cliente de Supabase.
const sinConexion = new AuthRetryableFetchError('Failed to fetch', 0)
const servidorCaido = new AuthRetryableFetchError('Bad Gateway', 502)
const demasiados = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')
const debil = new AuthWeakPasswordError('Password should be at least 8 characters.', 422, ['length'])
const misma = new AuthApiError('New password should be different from the old password.', 422, 'same_password')

const SIN_CONEXION = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'

describe('mensajeRestablecer', () => {
  it('distingue la falta de conexión', () => {
    expect(mensajeRestablecer(sinConexion)).toBe(SIN_CONEXION)
  })

  it('pide esperar cuando hubo demasiados intentos', () => {
    expect(mensajeRestablecer(demasiados)).toMatch(/demasiados intentos.*espera unos minutos/i)
    expect(mensajeRestablecer(new AuthApiError('Too many requests', 429, undefined))).toMatch(/demasiados intentos/i)
  })

  it('explica la contraseña débil y la repetida', () => {
    expect(mensajeRestablecer(debil)).toMatch(/débil/)
    expect(mensajeRestablecer(misma)).toMatch(/distinta de la actual/)
  })

  it('usa el texto genérico para lo demás (también un servidor caído)', () => {
    expect(mensajeRestablecer(servidorCaido)).toBe('No se pudo guardar la contraseña')
    expect(mensajeRestablecer(new AuthSessionMissingError())).toBe('No se pudo guardar la contraseña')
    expect(mensajeRestablecer(new TypeError('x'))).toBe('No se pudo guardar la contraseña')
  })
})
