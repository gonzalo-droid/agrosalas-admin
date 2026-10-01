import type { Context } from 'hono'
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

// Postgres 23505 = unique_violation. Drizzle envuelve el error original en `cause`.
function esDuplicado(err: unknown): boolean {
  const codigo = (e: unknown) => (e as { code?: string } | null)?.code
  return codigo(err) === '23505' || codigo((err as { cause?: unknown } | null)?.cause) === '23505'
}

export function manejarError(err: Error, c: Context) {
  if (err instanceof ErrorApi) {
    return c.json({ error: { codigo: err.codigo, mensaje: err.message, campo: err.campo } }, err.status)
  }
  if (esDuplicado(err)) {
    return c.json({ error: { codigo: 'duplicado', mensaje: 'Ya existe un registro con ese valor' } }, 409)
  }
  console.error(err)
  return c.json({ error: { codigo: 'interno', mensaje: 'Error interno' } }, 500)
}
