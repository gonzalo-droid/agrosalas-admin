import type { AppType } from '@agrosalas/backend/app'
import { hc, type ClientResponse } from 'hono/client'
import { ErrorDeConfiguracion, variablesRequeridas } from './entorno'
import { supabaseNavegador } from './supabase/navegador'

type ErrorCuerpo = { error: { codigo: string; mensaje: string; campo?: string } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RespuestaJson = ClientResponse<any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cuerpo<R> = R extends ClientResponse<infer T, any, any> ? T : never

// Datos<typeof api.v1.areas.$get> = el cuerpo de la respuesta correcta de esa llamada.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Datos<F extends (...args: any[]) => Promise<RespuestaJson>> = Exclude<
  Cuerpo<Awaited<ReturnType<F>>>,
  ErrorCuerpo
>

export class ErrorApiCliente extends Error {
  codigo: string
  campo?: string

  constructor(error: ErrorCuerpo['error']) {
    super(error.mensaje)
    this.codigo = error.codigo
    this.campo = error.campo
  }
}

const ERROR_GENERICO: ErrorCuerpo['error'] = { codigo: 'desconocido', mensaje: 'No se pudo completar la acción' }
const ERROR_SIN_CONEXION: ErrorCuerpo['error'] = {
  codigo: 'sin_conexion',
  mensaje: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
}

// Solo se usa el error del servidor si trae código y mensaje de texto; si no, el mensaje genérico.
function errorDeLaApi(cuerpo: unknown): ErrorCuerpo['error'] {
  const error = (cuerpo as { error?: Partial<ErrorCuerpo['error']> } | null)?.error
  return typeof error?.codigo === 'string' && typeof error.mensaje === 'string'
    ? (error as ErrorCuerpo['error'])
    : ERROR_GENERICO
}

// Espera la respuesta de la API; si es un error, lo lanza con el mensaje que mandó el servidor.
export async function leer<R extends RespuestaJson>(promesa: Promise<R>): Promise<Exclude<Cuerpo<R>, ErrorCuerpo>> {
  let respuesta: R
  try {
    respuesta = await promesa
  } catch (e) {
    // Una variable de entorno que falta no es un problema de conexión: se deja ver tal cual.
    if (e instanceof ErrorDeConfiguracion) throw e
    // fetch rechaza (con un mensaje en inglés del navegador) cuando no hay conexión con la API.
    throw new ErrorApiCliente(ERROR_SIN_CONEXION)
  }
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) throw new ErrorApiCliente(errorDeLaApi(cuerpo))
  return cuerpo
}

// La URL se comprueba al hacer cada llamada (no al importar), para que el build y las pruebas funcionen sin ella.
export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL ?? '', {
  headers: async (): Promise<Record<string, string>> => {
    variablesRequeridas({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL })
    const { data } = await supabaseNavegador().auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  },
})

// Solo se muestran los mensajes que escribimos nosotros; cualquier otro error (p. ej. del navegador) va en genérico.
export const mensajeDeError = (e: unknown) =>
  e instanceof ErrorApiCliente || e instanceof ErrorDeConfiguracion ? e.message : ERROR_GENERICO.mensaje
