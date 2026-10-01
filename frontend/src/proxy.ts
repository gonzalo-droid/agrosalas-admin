import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { requireEnv } from '@/lib/env'
import { applyHeaders, carrySession, type HeaderMap } from '@/lib/session-response'

const PUBLIC_PATHS = ['/login', '/recuperar', '/restablecer']

// Refreshes the Supabase session and sends to the login whoever does not have one.
// The real permissions are enforced by the API; this only decides which screen is shown.
export async function proxy(request: NextRequest) {
  const env = requireEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  let response = NextResponse.next({ request })
  // @supabase/ssr sends the no-cache headers only with the first cookie write:
  // they are kept to put them on any response that carries the session.
  let noCacheHeaders: HeaderMap = {}

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        noCacheHeaders = { ...noCacheHeaders, ...headers }
        applyHeaders(response, noCacheHeaders)
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const hasSession = Boolean(data?.claims)
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))
  // A redirect also carries the cookies that Supabase has just renewed or deleted.
  const redirect = (pathname: string) => {
    const target = request.nextUrl.clone()
    target.pathname = pathname
    target.search = ''
    return carrySession(response, NextResponse.redirect(target), noCacheHeaders)
  }

  if (!hasSession && !isPublic) return redirect('/login')
  if (hasSession && path === '/login') return redirect('/')
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
