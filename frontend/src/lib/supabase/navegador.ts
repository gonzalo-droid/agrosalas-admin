import { createBrowserClient } from '@supabase/ssr'

// En el navegador, createBrowserClient devuelve siempre la misma instancia.
export const supabaseNavegador = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
