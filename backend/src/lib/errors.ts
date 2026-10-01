import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ApiError extends Error {
  status: ContentfulStatusCode
  codigo: string
  campo?: string

  constructor(status: ContentfulStatusCode, code: string, message: string, field?: string) {
    super(message)
    this.status = status
    this.codigo = code
    this.campo = field
  }
}

export const notFound = (subject: string) => new ApiError(404, 'no_encontrado', `${subject} no existe`)

// Postgres error code. Drizzle wraps the original error in `cause`.
function postgresCode(err: unknown): string | undefined {
  const codeOf = (e: unknown) => (e as { code?: string } | null)?.code
  return codeOf(err) ?? codeOf((err as { cause?: unknown } | null)?.cause)
}

export function handleError(err: Error, c: Context) {
  if (err instanceof ApiError) {
    return c.json({ error: { codigo: err.codigo, mensaje: err.message, campo: err.campo } }, err.status)
  }
  // Errors thrown by Hono itself, e.g. a body that is not valid JSON.
  if (err instanceof HTTPException) {
    return c.json({ error: { codigo: 'solicitud_invalida', mensaje: 'La solicitud no es válida' } }, err.status)
  }
  const pgCode = postgresCode(err)
  // Postgres 23505 = unique_violation.
  if (pgCode === '23505') {
    return c.json({ error: { codigo: 'duplicado', mensaje: 'Ya existe un registro con ese valor' } }, 409)
  }
  // Postgres 23503 = foreign_key_violation: the id that was sent does not exist.
  if (pgCode === '23503') {
    return c.json({ error: { codigo: 'referencia_invalida', mensaje: 'Uno de los registros indicados no existe' } }, 400)
  }
  // The full error is not logged: Drizzle's carries the query with its parameters (DNI, bank accounts).
  // Only the name, the Postgres code and the driver message, which does not include parameters.
  const cause = (err as { cause?: unknown }).cause
  const message = cause instanceof Error ? cause.message : err.name === 'DrizzleQueryError' ? undefined : err.message
  console.error('Unexpected error:', { name: err.name, postgresCode: pgCode, message })
  return c.json({ error: { codigo: 'interno', mensaje: 'Error interno' } }, 500)
}
