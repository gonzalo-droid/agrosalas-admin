'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ETIQUETA_ROL, useYo } from '@/lib/yo'

// Las fases siguientes agregan aquí Asistencia, Planillas y Reportes.
const ENLACES = [
  { href: '/trabajadores', etiqueta: 'Trabajadores', soloAdmin: false },
  { href: '/configuracion', etiqueta: 'Configuración', soloAdmin: true },
]

export function Menu() {
  const ruta = usePathname()
  const { data: yo } = useYo()
  const enlaces = ENLACES.filter((e) => !e.soloAdmin || yo?.rol === 'admin')
  const activo = (href: string) => ruta === href || ruta.startsWith(`${href}/`)

  return (
    <>
      <nav aria-label="Principal" className="hidden w-52 shrink-0 flex-col gap-1 bg-[#0f3d24] p-3 md:flex">
        <p className="px-3 pt-2 pb-5 font-semibold text-white">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        {enlaces.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo(e.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center rounded-lg px-3 text-sm text-[#cfe8d8]',
              activo(e.href) && 'bg-[#1c5a37] font-semibold text-white',
            )}
          >
            {e.etiqueta}
          </Link>
        ))}
        <Link
          href="/perfil"
          className={cn(
            'mt-auto rounded-lg border-t border-[#1c5a37] p-3 text-sm text-[#cfe8d8]',
            activo('/perfil') && 'border-transparent bg-[#1c5a37] text-white',
          )}
        >
          {yo?.nombre ?? '…'}
          <span className="block text-[#a7e3bd]">{yo ? `${ETIQUETA_ROL[yo.rol]} · mi perfil` : ''}</span>
        </Link>
      </nav>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t bg-background md:hidden"
      >
        {[...enlaces, { href: '/perfil', etiqueta: 'Perfil' }].map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo(e.href) ? 'page' : undefined}
            className={cn(
              'flex h-14 items-center justify-center border-t-2 border-transparent text-sm text-muted-foreground',
              activo(e.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {e.etiqueta}
          </Link>
        ))}
      </nav>
    </>
  )
}
