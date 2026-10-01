import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ErrorApi extends Error {
  status: ContentfulStatusCode
  codigo: string
  campo?: string

  constructor(status: ContentfulStatusCode, codigo: string, mensaje: string, campo?: string) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.campo = campo
  }
}

export const noEncontrado = (que: string) => new ErrorApi(404, 'no_encontrado', `${que} no existe`)

// Código de error de Postgres. Drizzle envuelve el error original en `cause`.
function codigoPostgres(err: unknown): string | undefined {
  const codigo = (e: unknown) => (e as { code?: string } | null)?.code
  return codigo(err) ?? codigo((err as { cause?: unknown } | null)?.cause)
}

export function manejarError(err: Error, c: Context) {
  if (err instanceof ErrorApi) {
    return c.json({ error: { codigo: err.codigo, mensaje: err.message, campo: err.campo } }, err.status)
  }
  // Errores que lanza Hono mismo, p. ej. un cuerpo que no es JSON válido.
  if (err instanceof HTTPException) {
    return c.json({ error: { codigo: 'solicitud_invalida', mensaje: 'La solicitud no es válida' } }, err.status)
  }
  const codigoPg = codigoPostgres(err)
  // Postgres 23505 = unique_violation.
  if (codigoPg === '23505') {
    return c.json({ error: { codigo: 'duplicado', mensaje: 'Ya existe un registro con ese valor' } }, 409)
  }
  // Postgres 23503 = foreign_key_violation: el id enviado no existe.
  if (codigoPg === '23503') {
    return c.json({ error: { codigo: 'referencia_invalida', mensaje: 'Uno de los registros indicados no existe' } }, 400)
  }
  // No se registra el error completo: el de Drizzle trae la consulta con sus parámetros (DNI, cuentas bancarias).
  // Solo el nombre, el código de Postgres y el mensaje del driver, que no incluye parámetros.
  const causa = (err as { cause?: unknown }).cause
  const mensaje = causa instanceof Error ? causa.message : err.name === 'DrizzleQueryError' ? undefined : err.message
  console.error('Error inesperado:', { nombre: err.name, codigoPostgres: codigoPg, mensaje })
  return c.json({ error: { codigo: 'interno', mensaje: 'Error interno' } }, 500)
}
