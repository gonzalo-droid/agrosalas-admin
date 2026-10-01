'use client'

import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from './supabase/browser'

type Router = { replace(href: string): void; refresh(): void }
type SignOutAuth = { signOut(options: { scope: 'local' }): Promise<unknown> }

// Only one sign-out at a time in this tab (double click, or several queries that fail together).
let signingOut = false

// Ends this browser's session (not those of other devices), clears the data in memory
// and returns to the sign-in screen, even if signOut fails.
export async function endSession(client: QueryClient, router: Router, auth?: SignOutAuth) {
  if (signingOut) return
  signingOut = true
  try {
    await (auth ?? supabaseBrowser().auth).signOut({ scope: 'local' })
  } finally {
    client.clear()
    router.replace('/login')
    router.refresh()
    signingOut = false
  }
}

export function useSignOut() {
  const router = useRouter()
  const client = useQueryClient()
  return () => endSession(client, router)
}
