'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { supabaseNavegador } from './supabase/navegador'

// Cierra la sesión, borra los datos en memoria y vuelve a la pantalla de ingreso.
export function useCerrarSesion() {
  const router = useRouter()
  const cliente = useQueryClient()

  return async function cerrarSesion() {
    await supabaseNavegador().auth.signOut()
    cliente.clear()
    router.replace('/login')
    router.refresh()
  }
}
