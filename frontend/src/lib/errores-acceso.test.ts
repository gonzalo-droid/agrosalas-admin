import {
  AuthApiError,
  AuthInvalidCredentialsError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  AuthWeakPasswordError,
} from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { mensajeCambioClave, mensajeClaveActual, mensajeIngreso, mensajeRecuperacion, mensajeRestablecer } from './errores-acceso'

// Los errores se construyen con las clases de auth-js, tal como los devuelve el cliente de Supabase.
const sinConexion = new AuthRetryableFetchError('Failed to fetch', 0)
const servidorCaido = new AuthRetryableFetchError('Bad Gateway', 502)
const demasiados = new AuthApiError('Request rate limit reached', 429, 'over_request_rate_limit')
const debil = new AuthWeakPasswordError('Password should be at least 8 characters.', 422, ['length'])
const misma = new AuthApiError('New password should be different from the old password.', 422, 'same_password')
const credenciales = new AuthApiError('Invalid login credentials', 400, 'invalid_credentials')
const correoDemasiados = new AuthApiError('Email rate limit exceeded', 429, 'over_email_send_rate_limit')

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

describe('mensajeIngreso', () => {
  it('solo dice "incorrectos" cuando lo son', () => {
    expect(mensajeIngreso(credenciales)).toBe('Correo o contraseña incorrectos')
    expect(mensajeIngreso(new AuthInvalidCredentialsError('You must provide either an email or phone number and a password'))).toBe(
      'Correo o contraseña incorrectos',
    )
  })

  it('distingue la falta de conexión y el exceso de intentos', () => {
    expect(mensajeIngreso(sinConexion)).toBe(SIN_CONEXION)
    expect(mensajeIngreso(demasiados)).toMatch(/demasiados intentos/i)
  })

  it('usa un texto genérico para lo demás', () => {
    expect(mensajeIngreso(servidorCaido)).toBe('No se pudo iniciar sesión. Inténtalo de nuevo.')
  })
})

describe('mensajeRecuperacion', () => {
  it('distingue la falta de conexión y el exceso de intentos', () => {
    expect(mensajeRecuperacion(sinConexion)).toBe(SIN_CONEXION)
    expect(mensajeRecuperacion(correoDemasiados)).toMatch(/demasiados intentos/i)
  })

  it('usa un texto genérico para lo demás', () => {
    expect(mensajeRecuperacion(servidorCaido)).toBe('No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.')
  })
})

describe('mensajeClaveActual', () => {
  it('dice que la contraseña actual no es correcta solo cuando lo es', () => {
    expect(mensajeClaveActual(credenciales)).toBe('La contraseña actual no es correcta')
    expect(mensajeClaveActual(sinConexion)).toBe(SIN_CONEXION)
    expect(mensajeClaveActual(demasiados)).toMatch(/demasiados intentos/i)
    expect(mensajeClaveActual(servidorCaido)).toBe('No se pudo comprobar la contraseña actual')
  })
})

describe('mensajeCambioClave', () => {
  it('explica la contraseña débil, la repetida y la falta de conexión', () => {
    expect(mensajeCambioClave(debil)).toMatch(/débil/)
    expect(mensajeCambioClave(misma)).toMatch(/distinta de la actual/)
    expect(mensajeCambioClave(sinConexion)).toBe(SIN_CONEXION)
  })

  it('usa un texto genérico para lo demás', () => {
    expect(mensajeCambioClave(servidorCaido)).toBe('No se pudo cambiar la contraseña')
  })
})
