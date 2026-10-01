'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

// Unexpected error while showing a screen. `retry` requests and draws the screen again (Next 16.3).
export default function ScreenError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
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
