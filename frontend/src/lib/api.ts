import type { AppType } from '@agrosalas/backend/app'
import { hc, type ClientResponse } from 'hono/client'
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

// Espera la respuesta de la API; si es un error, lo lanza con el mensaje que mandó el servidor.
export async function leer<R extends RespuestaJson>(promesa: Promise<R>): Promise<Exclude<Cuerpo<R>, ErrorCuerpo>> {
  const respuesta = await promesa
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new ErrorApiCliente(cuerpo?.error ?? { codigo: 'desconocido', mensaje: 'No se pudo completar la acción' })
  }
  return cuerpo
}

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!, {
  headers: async (): Promise<Record<string, string>> => {
    const { data } = await supabaseNavegador().auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  },
})

export const mensajeDeError = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la acción')
