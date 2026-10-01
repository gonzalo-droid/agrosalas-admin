'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Error inesperado al mostrar una pantalla. `retry` vuelve a pedir y dibujar la pantalla (Next 16.3).
export default function ErrorDePantalla({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Algo salió mal</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          No se pudo mostrar esta pantalla. Inténtalo de nuevo; si sigue fallando, avisa al administrador.
        </p>
        <Button size="lg" onClick={() => retry()}>
          Reintentar
        </Button>
      </div>
    </main>
  )
}
