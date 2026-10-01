import { describe, expect, it } from 'vitest'
import { ErrorApiCliente, leer, mensajeDeError } from './api'
import { ErrorDeConfiguracion } from './entorno'

const GENERICO = 'No se pudo completar la acción'

// `leer` está tipado para la respuesta del cliente de Hono; en la prueba basta con un `Response` normal.
const leerRespuesta = (respuesta: Response) => leer(Promise.resolve(respuesta) as never)

describe('leer', () => {
  it('devuelve el cuerpo de una respuesta correcta', async () => {
    const respuesta = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(leerRespuesta(respuesta)).resolves.toEqual({ ok: true })
  })

  it('lanza el error de la API con su código, mensaje y campo', async () => {
    const cuerpo = { error: { code: 'validation', message: 'El DNI debe tener 8 dígitos', field: 'dni' } }
    const error = await leerRespuesta(new Response(JSON.stringify(cuerpo), { status: 400 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.message).toBe('El DNI debe tener 8 dígitos')
    expect(error.code).toBe('validation')
    expect(error.field).toBe('dni')
  })

  it('usa un mensaje genérico si la respuesta de error no es JSON', async () => {
    const error = await leerRespuesta(new Response('<html>Bad Gateway</html>', { status: 502 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.code).toBe('unknown')
    expect(error.message).toBe(GENERICO)
  })

  it('usa un mensaje genérico si el error no trae un mensaje de texto', async () => {
    const error = await leerRespuesta(new Response(JSON.stringify({ error: 'boom' }), { status: 500 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.code).toBe('unknown')
    expect(error.message).toBe(GENERICO)
  })

  it('convierte un fallo de red en un error en español', async () => {
    const error = await leer(Promise.reject(new TypeError('Failed to fetch')) as never).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.code).toBe('network_error')
    expect(error.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  })

  it('no disfraza de falta de conexión una variable de entorno que falta', async () => {
    const falta = new ErrorDeConfiguracion('Falta la variable de entorno NEXT_PUBLIC_API_URL')
    await expect(leer(Promise.reject(falta) as never)).rejects.toBe(falta)
  })
})

describe('mensajeDeError', () => {
  it('devuelve el mensaje de un error de la API', () => {
    expect(mensajeDeError(new ErrorApiCliente({ code: 'validation', message: 'Dato inválido' }))).toBe('Dato inválido')
  })

  it('muestra qué variable de entorno falta', () => {
    expect(mensajeDeError(new ErrorDeConfiguracion('Falta NEXT_PUBLIC_API_URL'))).toBe('Falta NEXT_PUBLIC_API_URL')
  })

  it('usa un mensaje genérico para cualquier otro error', () => {
    expect(mensajeDeError(new Error('Failed to fetch'))).toBe(GENERICO)
    expect(mensajeDeError('texto')).toBe(GENERICO)
    expect(mensajeDeError(undefined)).toBe(GENERICO)
  })
})
