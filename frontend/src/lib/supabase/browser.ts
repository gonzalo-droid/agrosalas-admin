import { createBrowserClient } from '@supabase/ssr'
import { requireEnv } from '../env'

// In the browser, createBrowserClient always returns the same instance.
// The variables are checked here, when it is used, so the build works without them.
export function supabaseBrowser() {
  const env = requireEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
