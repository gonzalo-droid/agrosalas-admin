import { createBrowserClient } from '@supabase/ssr'
import { variablesRequeridas } from '../entorno'

// En el navegador, createBrowserClient devuelve siempre la misma instancia.
// Las variables se comprueban aquí, al usarlo, para que el build funcione sin ellas.
export function supabaseNavegador() {
  const variables = variablesRequeridas({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  })
  return createBrowserClient(variables.NEXT_PUBLIC_SUPABASE_URL, variables.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
}
