'use client'

import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { supabaseNavegador } from './supabase/navegador'

type Enrutador = { replace(href: string): void; refresh(): void }
type AuthParaSalir = { signOut(opciones: { scope: 'local' }): Promise<unknown> }

// Una sola salida a la vez en esta pestaña (doble clic, o varias consultas que fallan juntas).
let saliendo = false

// Cierra la sesión de este navegador (no las de otros dispositivos), borra los datos en memoria
// y vuelve a la pantalla de ingreso, aunque signOut falle.
export async function terminarSesion(cliente: QueryClient, router: Enrutador, auth?: AuthParaSalir) {
  if (saliendo) return
  saliendo = true
  try {
    await (auth ?? supabaseNavegador().auth).signOut({ scope: 'local' })
  } finally {
    cliente.clear()
    router.replace('/login')
    router.refresh()
    saliendo = false
  }
}

export function useCerrarSesion() {
  const router = useRouter()
  const cliente = useQueryClient()
  return () => terminarSesion(cliente, router)
}
