'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useMe } from '@/lib/me'

const TABS = [
  { href: '/settings/positions', label: 'Cargos y tarifas' },
  { href: '/settings/groups', label: 'Grupos' },
  { href: '/settings/areas', label: 'Áreas' },
  { href: '/settings/shifts', label: 'Turnos' },
  { href: '/settings/campaigns', label: 'Campañas' },
  { href: '/settings/users', label: 'Usuarios y roles' },
  { href: '/settings/audit-log', label: 'Auditoría' },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { data: me } = useMe()

  if (me && me.role !== 'admin') {
    return <p className="text-sm text-muted-foreground">Solo el administrador puede entrar a Configuración.</p>
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <nav aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={pathname.startsWith(t.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center border-b-2 border-transparent px-4 text-sm text-muted-foreground',
              pathname.startsWith(t.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
