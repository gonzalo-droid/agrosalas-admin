'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useYo } from '@/lib/yo'

const PESTANAS = [
  { href: '/configuracion/cargos', etiqueta: 'Cargos y tarifas' },
  { href: '/configuracion/grupos', etiqueta: 'Grupos' },
  { href: '/configuracion/areas', etiqueta: 'Áreas' },
  { href: '/configuracion/turnos', etiqueta: 'Turnos' },
  { href: '/configuracion/campanas', etiqueta: 'Campañas' },
  { href: '/configuracion/usuarios', etiqueta: 'Usuarios y roles' },
  { href: '/configuracion/auditoria', etiqueta: 'Auditoría' },
]

export default function LayoutConfiguracion({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  const { data: yo } = useYo()

  if (yo && yo.rol !== 'admin') {
    return <p className="text-sm text-muted-foreground">Solo el administrador puede entrar a Configuración.</p>
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <nav aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto border-b">
        {PESTANAS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={ruta.startsWith(p.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center border-b-2 border-transparent px-4 text-sm text-muted-foreground',
              ruta.startsWith(p.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
