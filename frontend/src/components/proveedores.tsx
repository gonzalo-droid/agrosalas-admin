'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { hayQueVaciarCache } from '@/lib/cambio-de-usuario'
import { crearClienteConsultas } from '@/lib/cliente-consultas'
import { terminarSesion } from '@/lib/sesion'
import { crearLimitador } from '@/lib/sesion-vencida'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export function Proveedores({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [cliente] = useState(() => {
    // Varias consultas pueden fallar con 401 a la vez: la sesión se cierra una sola vez cada 10 s.
    const puedeSalir = crearLimitador(10_000)
    const nuevo = crearClienteConsultas(() => {
      if (puedeSalir()) void terminarSesion(nuevo, router).catch(console.error)
    })
    return nuevo
  })

  // Si la sesión termina por otro camino (otra pestaña, token vencido) o entra otra persona en esta
  // pestaña, los datos guardados en memoria (rol, trabajadores, cuentas bancarias) se descartan.
  useEffect(() => {
    let anterior: string | null | undefined
    const { data } = supabaseNavegador().auth.onAuthStateChange((evento, sesion) => {
      const actual = sesion?.user.id ?? null
      if (hayQueVaciarCache(evento, anterior, actual)) cliente.clear()
      anterior = actual
    })
    return () => data.subscription.unsubscribe()
  }, [cliente])

  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  )
}
