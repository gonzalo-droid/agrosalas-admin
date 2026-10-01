'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { shouldClearCache } from '@/lib/user-change'
import { createQueryClient } from '@/lib/query-client'
import { endSession } from '@/lib/session'
import { createLimiter } from '@/lib/expired-session'
import { supabaseBrowser } from '@/lib/supabase/browser'

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [client] = useState(() => {
    // Several queries can fail with 401 at once: the session is ended only once every 10 s.
    const canSignOut = createLimiter(10_000)
    const created = createQueryClient(() => {
      if (canSignOut()) void endSession(created, router).catch(console.error)
    })
    return created
  })

  // If the session ends some other way (another tab, expired token) or another person signs in on this
  // tab, the data kept in memory (role, workers, bank accounts) is discarded.
  useEffect(() => {
    let previous: string | null | undefined
    const { data } = supabaseBrowser().auth.onAuthStateChange((event, session) => {
      const current = session?.user.id ?? null
      if (shouldClearCache(event, previous, current)) client.clear()
      previous = current
    })
    return () => data.subscription.unsubscribe()
  }, [client])

  return (
    <QueryClientProvider client={client}>
      {children}
      {/* The panel only has a light theme: the toasts do not follow the system's dark mode. */}
      <Toaster position="top-center" theme="light" />
    </QueryClientProvider>
  )
}
