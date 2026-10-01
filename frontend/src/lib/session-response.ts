import type { NextResponse } from 'next/server'

export type HeaderMap = Record<string, string>

export function applyHeaders(response: NextResponse, headers: HeaderMap) {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

// Carries over to another response (a redirect) the session cookies that Supabase left in `from`
// —a renewed token or the order to delete one— and the headers that prevent caching it.
export function carrySession(from: NextResponse, to: NextResponse, headers: HeaderMap) {
  for (const cookie of from.cookies.getAll()) to.cookies.set(cookie)
  return applyHeaders(to, headers)
}
