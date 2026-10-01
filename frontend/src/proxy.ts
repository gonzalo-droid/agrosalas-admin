import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLICAS = ['/login', '/recuperar', '/restablecer']

// Refresca la sesión de Supabase y manda al login a quien no la tiene.
// Los permisos reales los aplica la API; esto solo decide qué pantalla se muestra.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const conSesion = Boolean(data?.claims)
  const ruta = request.nextUrl.pathname
  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  if (!conSesion && !esPublica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.search = ''
    return NextResponse.redirect(destino)
  }
  if (conSesion && ruta === '/login') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
