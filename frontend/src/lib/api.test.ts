import { describe, expect, it } from 'vitest'
import { ApiClientError, errorMessage, unwrap } from './api'
import { ConfigError } from './env'

const GENERIC = 'No se pudo completar la acción'

// `unwrap` is typed for the Hono client's response; in the test a plain `Response` is enough.
const unwrapResponse = (response: Response) => unwrap(Promise.resolve(response) as never)

describe('unwrap', () => {
  it('returns the body of a successful response', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(unwrapResponse(response)).resolves.toEqual({ ok: true })
  })

  it('throws the API error with its code, message and field', async () => {
    const body = { error: { code: 'validation', message: 'El DNI debe tener 8 dígitos', field: 'dni' } }
    const error = await unwrapResponse(new Response(JSON.stringify(body), { status: 400 })).catch((e) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error.message).toBe('El DNI debe tener 8 dígitos')
    expect(error.code).toBe('validation')
    expect(error.field).toBe('dni')
  })

  it('uses a generic message if the error response is not JSON', async () => {
    const error = await unwrapResponse(new Response('<html>Bad Gateway</html>', { status: 502 })).catch((e) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error.code).toBe('unknown')
    expect(error.message).toBe(GENERIC)
  })

  it('uses a generic message if the error carries no text message', async () => {
    const error = await unwrapResponse(new Response(JSON.stringify({ error: 'boom' }), { status: 500 })).catch((e) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error.code).toBe('unknown')
    expect(error.message).toBe(GENERIC)
  })

  it('turns a network failure into a Spanish error', async () => {
    const error = await unwrap(Promise.reject(new TypeError('Failed to fetch')) as never).catch((e) => e)
    expect(error).toBeInstanceOf(ApiClientError)
    expect(error.code).toBe('network_error')
    expect(error.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  })

  it('does not disguise a missing environment variable as a connection failure', async () => {
    const missing = new ConfigError('Falta la variable de entorno NEXT_PUBLIC_API_URL')
    await expect(unwrap(Promise.reject(missing) as never)).rejects.toBe(missing)
  })
})

describe('errorMessage', () => {
  it('returns the message of an API error', () => {
    expect(errorMessage(new ApiClientError({ code: 'validation', message: 'Dato inválido' }))).toBe('Dato inválido')
  })

  it('shows which environment variable is missing', () => {
    expect(errorMessage(new ConfigError('Falta NEXT_PUBLIC_API_URL'))).toBe('Falta NEXT_PUBLIC_API_URL')
  })

  it('uses a generic message for any other error', () => {
    expect(errorMessage(new Error('Failed to fetch'))).toBe(GENERIC)
    expect(errorMessage('texto')).toBe(GENERIC)
    expect(errorMessage(undefined)).toBe(GENERIC)
  })
})
