'use client'

import { useEffect } from 'react'
import { Menu } from '@/components/panel/menu'
import { Button } from '@/components/ui/button'
import { ErrorApiCliente, mensajeDeError } from '@/lib/api'
import { useCerrarSesion } from '@/lib/sesion'
import { useYo } from '@/lib/yo'

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { isPending, error, refetch } = useYo()
  const cerrarSesion = useCerrarSesion()
  // La sesión ya no es válida (por ejemplo, fue revocada): se sale al ingreso en lugar de mostrar un error.
  const sesionInvalida = error instanceof ErrorApiCliente && error.codigo === 'no_autenticado'

  useEffect(() => {
    if (sesionInvalida) void cerrarSesion()
    // cerrarSesion cambia en cada render; solo importa reaccionar cuando la sesión pasa a ser inválida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionInvalida])

  return (
    <div className="flex min-h-screen">
      <Menu />
      <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
        {isPending || sesionInvalida ? (
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
              <Button variant="destructive" size="lg" onClick={cerrarSesion}>
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
