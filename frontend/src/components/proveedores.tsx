'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { ErrorApiCliente } from '@/lib/api'

export function Proveedores({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            // Si la API respondió con un error (401, 403, 404…) reintentar no sirve; solo se reintenta si no hubo conexión.
            retry: (intentos, error) => !(error instanceof ErrorApiCliente && error.codigo !== 'sin_conexion') && intentos < 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  )
  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  )
}
