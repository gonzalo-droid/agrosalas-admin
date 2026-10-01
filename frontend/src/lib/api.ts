import type { AppType } from '@agrosalas/backend/app'
import { hc, type ClientResponse } from 'hono/client'
import { ConfigError, requireEnv } from './env'
import { supabaseBrowser } from './supabase/browser'

type ErrorBody = { error: { code: string; message: string; field?: string } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonResponse = ClientResponse<any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BodyOf<R> = R extends ClientResponse<infer T, any, any> ? T : never

// ResponseBody<typeof api.v1.areas.$get> = the body of the successful response of that call.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ResponseBody<F extends (...args: any[]) => Promise<JsonResponse>> = Exclude<
  BodyOf<Awaited<ReturnType<F>>>,
  ErrorBody
>

export class ApiClientError extends Error {
  code: string
  field?: string

  constructor(error: ErrorBody['error']) {
    super(error.message)
    this.code = error.code
    this.field = error.field
  }
}

const GENERIC_ERROR: ErrorBody['error'] = { code: 'unknown', message: 'No se pudo completar la acción' }
const NO_CONNECTION_ERROR: ErrorBody['error'] = {
  code: 'network_error',
  message: 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
}

// The server's error is used only if it carries a code and a text message; otherwise the generic message.
function apiError(body: unknown): ErrorBody['error'] {
  const error = (body as { error?: Partial<ErrorBody['error']> } | null)?.error
  return typeof error?.code === 'string' && typeof error.message === 'string'
    ? (error as ErrorBody['error'])
    : GENERIC_ERROR
}

// Waits for the API response; if it is an error, throws it with the message the server sent.
export async function unwrap<R extends JsonResponse>(promise: Promise<R>): Promise<Exclude<BodyOf<R>, ErrorBody>> {
  let response: R
  try {
    response = await promise
  } catch (e) {
    // A missing environment variable is not a connection problem: let it show as it is.
    if (e instanceof ConfigError) throw e
    // fetch rejects (with the browser's own English message) when there is no connection to the API.
    throw new ApiClientError(NO_CONNECTION_ERROR)
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiClientError(apiError(body))
  return body
}

// The URL is checked on each call (not on import), so the build and the tests work without it.
export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL ?? '', {
  headers: async (): Promise<Record<string, string>> => {
    requireEnv({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL })
    const { data } = await supabaseBrowser().auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  },
})

// Only the messages we wrote are shown; any other error (e.g. from the browser) becomes the generic one.
export const errorMessage = (e: unknown) =>
  e instanceof ApiClientError || e instanceof ConfigError ? e.message : GENERIC_ERROR.message
