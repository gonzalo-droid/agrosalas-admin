'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ROLE_LABEL, useMe } from '@/lib/me'

// The following phases add Asistencia, Planillas and Reportes here.
const LINKS = [
  { href: '/trabajadores', label: 'Trabajadores', adminOnly: false },
  { href: '/configuracion', label: 'Configuración', adminOnly: true },
]

export function Menu() {
  const pathname = usePathname()
  const { data: me } = useMe()
  const links = LINKS.filter((l) => !l.adminOnly || me?.role === 'admin')
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      {/* Fixed to the screen height: the profile link is always in view even if the page is long. */}
      <nav aria-label="Principal" className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-1 overflow-y-auto bg-[#0f3d24] p-3 md:flex">
        <p className="px-3 pt-2 pb-5 font-semibold text-white">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center rounded-lg px-3 text-sm text-[#cfe8d8]',
              isActive(l.href) && 'bg-[#1c5a37] font-semibold text-white',
            )}
          >
            {l.label}
          </Link>
        ))}
        <Link
          href="/perfil"
          aria-current={isActive('/perfil') ? 'page' : undefined}
          className={cn(
            'mt-auto rounded-lg border-t border-[#1c5a37] p-3 text-sm text-[#cfe8d8]',
            isActive('/perfil') && 'border-transparent bg-[#1c5a37] text-white',
          )}
        >
          {me?.name ?? '…'}
          <span className="block text-[#a7e3bd]">{me ? `${ROLE_LABEL[me.role]} · mi perfil` : ''}</span>
        </Link>
      </nav>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t bg-background md:hidden"
      >
        {[...links, { href: '/perfil', label: 'Perfil' }].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={cn(
              'flex h-14 items-center justify-center border-t-2 border-transparent text-sm text-muted-foreground',
              isActive(l.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
