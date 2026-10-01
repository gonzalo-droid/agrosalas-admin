'use client'

import { Menu } from '@/components/panel/menu'
import { Button } from '@/components/ui/button'
import { mensajeDeError } from '@/lib/api'
import { useCerrarSesion } from '@/lib/sesion'
import { useYo } from '@/lib/yo'

// Una sesión vencida (401) la atiende el cliente de consultas en Proveedores: cierra la sesión y lleva al ingreso.
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { isPending, error, refetch } = useYo()
  const cerrarSesion = useCerrarSesion()

  return (
    <div className="flex min-h-screen">
      <Menu />
      <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {mensajeDeError(error)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={() => refetch()}>
                Reintentar
              </Button>
              <Button variant="destructive" size="lg" onClick={() => void cerrarSesion()}>
                Cerrar sesión
              </Button>
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
