'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Field } from '@/components/field'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { signInMessage } from '@/lib/auth-errors'
import { supabaseBrowser } from '@/lib/supabase/browser'

export default function LoginPage() {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [error, setError] = useState('')
  // After signing in, the button stays disabled until the navigation finishes (avoids a double submit).
  const [submitting, setSubmitting] = useState(false)

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    setSubmitting(true)
    setError('')
    const { error } = await supabaseBrowser()
      .auth.signInWithPassword({ email: String(formData.get('email')), password: String(formData.get('password')) })
      .catch((e: unknown) => ({ error: e }))
    if (error) {
      setSubmitting(false)
      setError(signInMessage(error))
      return
    }
    // Nothing kept in memory (from a previous session in this tab) is useful to whoever has just signed in.
    queryClient.clear()
    router.replace('/')
    router.refresh()
  }

  return (
    <AuthFrame title="Iniciar sesión">
      <form onSubmit={signIn} className="space-y-4">
        <Field id="email" label="Correo">
          <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        </Field>
        <Field id="password" label="Contraseña" error={error}>
          <Input id="password" name="password" type="password" autoComplete="current-password" required className="h-11" />
        </Field>
        <Button type="submit" disabled={submitting} className="h-11 w-full">
          {submitting ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <Link href="/forgot-password" className="inline-block py-2 text-sm font-medium text-primary">
        Olvidé mi contraseña
      </Link>
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Las cuentas las crea el administrador. No hay registro público.
      </p>
    </AuthFrame>
  )
}
