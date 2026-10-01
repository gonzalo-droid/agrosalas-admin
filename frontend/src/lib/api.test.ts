import { describe, expect, it } from 'vitest'
import { ErrorApiCliente, leer, mensajeDeError } from './api'

const GENERICO = 'No se pudo completar la acción'

// `leer` está tipado para la respuesta del cliente de Hono; en la prueba basta con un `Response` normal.
const leerRespuesta = (respuesta: Response) => leer(Promise.resolve(respuesta) as never)

describe('leer', () => {
  it('devuelve el cuerpo de una respuesta correcta', async () => {
    const respuesta = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(leerRespuesta(respuesta)).resolves.toEqual({ ok: true })
  })

  it('lanza el error de la API con su código, mensaje y campo', async () => {
    const cuerpo = { error: { codigo: 'validacion', mensaje: 'El DNI debe tener 8 dígitos', campo: 'dni' } }
    const error = await leerRespuesta(new Response(JSON.stringify(cuerpo), { status: 400 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.message).toBe('El DNI debe tener 8 dígitos')
    expect(error.codigo).toBe('validacion')
    expect(error.campo).toBe('dni')
  })

  it('usa un mensaje genérico si la respuesta de error no es JSON', async () => {
    const error = await leerRespuesta(new Response('<html>Bad Gateway</html>', { status: 502 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.codigo).toBe('desconocido')
    expect(error.message).toBe(GENERICO)
  })

  it('usa un mensaje genérico si el error no trae un mensaje de texto', async () => {
    const error = await leerRespuesta(new Response(JSON.stringify({ error: 'boom' }), { status: 500 })).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.codigo).toBe('desconocido')
    expect(error.message).toBe(GENERICO)
  })

  it('convierte un fallo de red en un error en español', async () => {
    const error = await leer(Promise.reject(new TypeError('Failed to fetch')) as never).catch((e) => e)
    expect(error).toBeInstanceOf(ErrorApiCliente)
    expect(error.codigo).toBe('sin_conexion')
    expect(error.message).toBe('No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  })
})

describe('mensajeDeError', () => {
  it('devuelve el mensaje de un error de la API', () => {
    expect(mensajeDeError(new ErrorApiCliente({ codigo: 'validacion', mensaje: 'Dato inválido' }))).toBe('Dato inválido')
  })

  it('usa un mensaje genérico para cualquier otro error', () => {
    expect(mensajeDeError(new Error('Failed to fetch'))).toBe(GENERICO)
    expect(mensajeDeError('texto')).toBe(GENERICO)
    expect(mensajeDeError(undefined)).toBe(GENERICO)
  })
})
