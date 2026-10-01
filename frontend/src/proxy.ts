import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { variablesRequeridas } from '@/lib/entorno'
import { aplicarCabeceras, pasarSesion, type Cabeceras } from '@/lib/respuesta-sesion'

const PUBLICAS = ['/login', '/recuperar', '/restablecer']

// Refresca la sesión de Supabase y manda al login a quien no la tiene.
// Los permisos reales los aplica la API; esto solo decide qué pantalla se muestra.
export async function proxy(request: NextRequest) {
  const variables = variablesRequeridas({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  let respuesta = NextResponse.next({ request })
  // @supabase/ssr manda las cabeceras de no-caché solo con la primera escritura de cookies:
  // se guardan para ponerlas en cualquier respuesta que lleve la sesión.
  let sinCache: Cabeceras = {}

  const supabase = createServerClient(variables.NEXT_PUBLIC_SUPABASE_URL, variables.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, cabeceras) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value))
        respuesta = NextResponse.next({ request })
        cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options))
        sinCache = { ...sinCache, ...cabeceras }
        aplicarCabeceras(respuesta, sinCache)
      },
    },
  })

  const { data } = await supabase.auth.getClaims()
  const conSesion = Boolean(data?.claims)
  const ruta = request.nextUrl.pathname
  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))
  // Una redirección también lleva las cookies que Supabase acaba de renovar o borrar.
  const redirigir = (pathname: string) => {
    const destino = request.nextUrl.clone()
    destino.pathname = pathname
    destino.search = ''
    return pasarSesion(respuesta, NextResponse.redirect(destino), sinCache)
  }

  if (!conSesion && !esPublica) return redirigir('/login')
  if (conSesion && ruta === '/login') return redirigir('/')
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
