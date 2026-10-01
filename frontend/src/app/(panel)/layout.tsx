'use client'

import { Menu } from '@/components/panel/menu'
import { Button } from '@/components/ui/button'
import { errorMessage } from '@/lib/api'
import { useSignOut } from '@/lib/session'
import { useMe } from '@/lib/me'

// An expired session (401) is handled by the query client in Providers: it ends the session and goes to the sign-in.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  const { isPending, error, refetch } = useMe()
  const signOut = useSignOut()

  return (
    <div className="flex min-h-screen">
      <Menu />
      <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <div className="space-y-4">
            <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {errorMessage(error)}
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="lg" onClick={() => refetch()}>
                Reintentar
              </Button>
              <Button variant="destructive" size="lg" onClick={() => void signOut()}>
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
