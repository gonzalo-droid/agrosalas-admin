'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Dialog } from '@base-ui/react/dialog'
import { MenuIcon, XIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ROLE_LABEL, useMe } from '@/lib/me'
import type { Role } from '@/lib/worker-view'

// The one list of entries: the desktop sidebar and the phone side menu both render it.
// `roles` are the ones that see the entry; with none, everyone does. The API is what enforces the permissions.
const LINKS: { href: string; label: string; roles?: Role[] }[] = [
  { href: '/attendance', label: 'Asistencia' },
  { href: '/payrolls', label: 'Planillas' },
  { href: '/workers', label: 'Trabajadores' },
  { href: '/reports', label: 'Reportes', roles: ['admin', 'accounting', 'management'] },
  { href: '/settings', label: 'Configuración', roles: ['admin'] },
]

// Width from which the desktop sidebar replaces the phone bar (Tailwind `md`).
const DESKTOP_QUERY = '(min-width: 768px)'

type MenuLinksProps = {
  links: typeof LINKS
  isActive: (href: string) => boolean
  profileActive: boolean
  me: ReturnType<typeof useMe>['data']
  onNavigate?: () => void
}

// Entries plus the profile link at the bottom. Shared by both menus so the entries are never duplicated.
function MenuLinks({ links, isActive, profileActive, me, onNavigate }: MenuLinksProps) {
  return (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={onNavigate}
          aria-current={isActive(l.href) ? 'page' : undefined}
          className={cn(
            'flex h-11 shrink-0 items-center rounded-lg px-3 text-sm text-[#cfe8d8]',
            isActive(l.href) && 'bg-[#1c5a37] font-semibold text-white',
          )}
        >
          {l.label}
        </Link>
      ))}
      <Link
        href="/profile"
        onClick={onNavigate}
        aria-current={profileActive ? 'page' : undefined}
        className={cn(
          'mt-auto min-h-11 shrink-0 rounded-lg border-t border-[#1c5a37] p-3 text-sm text-[#cfe8d8]',
          profileActive && 'border-transparent bg-[#1c5a37] text-white',
        )}
      >
        {me?.name ?? '…'}
        <span className="block text-[#a7e3bd]">{me ? `${ROLE_LABEL[me.role]} · mi perfil` : ''}</span>
      </Link>
    </>
  )
}

// The sidebar, the phone bar and the side menu are hidden when printing (print:hidden): a receipt or a report prints without the menu.
export function Menu() {
  const pathname = usePathname()
  const { data: me } = useMe()
  // A role that is not known yet sees only the entries for everyone.
  const links = LINKS.filter((l) => !l.roles || (me !== undefined && l.roles.includes(me.role)))
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  // The side menu is open only for the page it was opened on, so any navigation closes it without an effect.
  const [openedOn, setOpenedOn] = useState<string | null>(null)
  // Derived during render (React's "storing information from previous renders"): a path that no longer matches
  // (back button, in-page link) is dropped at once, so coming back to that path never reopens the menu by itself.
  if (openedOn !== null && openedOn !== pathname) setOpenedOn(null)
  const open = openedOn === pathname
  const close = () => setOpenedOn(null)

  // Stays even though the panel has md:hidden: the dialog's scroll lock follows `open`, so a panel hidden by CSS
  // would keep the page from scrolling. Growing the window to desktop width closes it.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenedOn(null)
    }
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const shared = { links, isActive, profileActive: isActive('/profile'), me }

  return (
    <>
      {/* Fixed to the screen height: the profile link is always in view even if the page is long. */}
      <nav aria-label="Principal" className="sticky top-0 hidden h-screen w-52 shrink-0 flex-col gap-1 overflow-y-auto bg-[#0f3d24] p-3 md:flex print:hidden">
        <p className="px-3 pt-2 pb-5 font-semibold text-white">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        <MenuLinks {...shared} />
      </nav>

      {/* Phones: a top bar in the page flow (the layout is a column there) with a button that opens the side menu. */}
      <Dialog.Root open={open} onOpenChange={(next) => setOpenedOn(next ? pathname : null)}>
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 bg-[#0f3d24] px-2 md:hidden print:hidden">
          <Dialog.Trigger
            aria-label="Abrir menú"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white outline-none hover:bg-[#1c5a37] focus-visible:ring-2 focus-visible:ring-[#a7e3bd]"
          >
            <MenuIcon aria-hidden className="size-6" />
          </Dialog.Trigger>
          <p className="min-w-0 truncate font-semibold text-white">Agrosalas Admin</p>
        </header>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 duration-200 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 md:hidden print:hidden" />
          <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-full flex-col gap-1 overflow-y-auto bg-[#0f3d24] p-3 outline-none duration-200 data-open:animate-in data-open:slide-in-from-left data-closed:animate-out data-closed:slide-out-to-left md:hidden print:hidden">
            <Dialog.Title className="sr-only">Menú principal</Dialog.Title>
            <div className="flex items-center justify-between pb-3 pl-3">
              <p className="font-semibold text-white">
                Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
              </p>
              <Dialog.Close
                aria-label="Cerrar menú"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg text-white outline-none hover:bg-[#1c5a37] focus-visible:ring-2 focus-visible:ring-[#a7e3bd]"
              >
                <XIcon aria-hidden className="size-6" />
              </Dialog.Close>
            </div>
            <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
              <MenuLinks {...shared} onNavigate={close} />
            </nav>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  )
}
