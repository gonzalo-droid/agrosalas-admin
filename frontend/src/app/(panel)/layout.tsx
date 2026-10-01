'use client'

import { Menu } from '@/components/panel/menu'
import { mensajeDeError } from '@/lib/api'
import { useYo } from '@/lib/yo'

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { isPending, error } = useYo()

  return (
    <div className="flex min-h-screen">
      <Menu />
      <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {mensajeDeError(error)}
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
