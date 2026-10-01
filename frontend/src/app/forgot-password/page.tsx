'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Field } from '@/components/field'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { recoveryMessage } from '@/lib/auth-errors'
import { supabaseBrowser } from '@/lib/supabase/browser'

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email'))
    setSubmitting(true)
    setError('')
    try {
      const { error } = await supabaseBrowser()
        .auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        .catch((e: unknown) => ({ error: e }))
      // Supabase answers the same whether or not the account exists, so the success notice reveals nothing;
      // it is only shown if the request arrived and was accepted.
      if (error) setError(recoveryMessage(error))
      else setSent(true)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthFrame title="Recuperar contraseña">
      {sent ? (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          Si el correo pertenece a una cuenta, te llegará un enlace para crear una contraseña nueva. Ábrelo en este mismo navegador.
        </p>
      ) : (
        <form onSubmit={send} className="space-y-4">
          <Field id="email" label="Correo" help="Te enviaremos un enlace para crear una contraseña nueva." error={error}>
            <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
          </Field>
          <Button type="submit" disabled={submitting} className="h-11 w-full">
            {submitting ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <Link href="/login" className="inline-block py-2 text-sm font-medium text-primary">
        Volver a iniciar sesión
      </Link>
    </AuthFrame>
  )
}
