import type { NextResponse } from 'next/server'

export type Cabeceras = Record<string, string>

export function aplicarCabeceras(respuesta: NextResponse, cabeceras: Cabeceras) {
  for (const [nombre, valor] of Object.entries(cabeceras)) respuesta.headers.set(nombre, valor)
  return respuesta
}

// Lleva a otra respuesta (una redirección) las cookies de sesión que dejó Supabase en `desde`
// —un token renovado o la orden de borrar uno— y las cabeceras que impiden guardarla en caché.
export function pasarSesion(desde: NextResponse, hacia: NextResponse, cabeceras: Cabeceras) {
  for (const cookie of desde.cookies.getAll()) hacia.cookies.set(cookie)
  return aplicarCabeceras(hacia, cabeceras)
}
