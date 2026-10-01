'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { AuthFrame } from '@/components/auth-frame'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { resetMessage } from '@/lib/auth-errors'
import { checkRecoveryLink, type LinkResult } from '@/lib/recovery'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { hasErrors, validateNewPassword, type NewPasswordErrors } from '@/lib/validate-password'

// This page is reached from the link in the email. The form only appears if the link is a valid recovery one:
// a normal session open in this browser is not enough to change the password without knowing the current one.
export default function ResetPasswordPage() {
  const [link, setLink] = useState<LinkResult | 'checking'>('checking')
  const check = useRef<Promise<LinkResult> | null>(null)

  useEffect(() => {
    let current = true
    // The URL is read before creating the client, which on creation exchanges the ?code= and removes it from the address bar.
    const params = new URLSearchParams(window.location.search)
    // In development React mounts twice: the (single-use) link is checked only once.
    check.current ??= checkRecoveryLink(supabaseBrowser().auth, params)
    void check.current.then((result) => {
      if (current) setLink(result)
    })
    return () => {
      current = false
    }
  }, [])

  return (
    <AuthFrame title="Nueva contraseña">
      {link === 'checking' ? (
        <p role="status" className="text-sm text-muted-foreground">
          Comprobando el enlace…
        </p>
      ) : link === 'recovery' ? (
        <NewPasswordForm />
      ) : (
        <InvalidLink noConnection={link === 'network_error'} />
      )}
    </AuthFrame>
  )
}

function InvalidLink({ noConnection }: { noConnection: boolean }) {
  return (
    <>
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {noConnection
          ? 'No se pudo conectar para comprobar el enlace. Revisa tu conexión y vuelve a abrir el enlace del correo.'
          : 'Este enlace no es válido: ya venció, ya se usó o se abrió en un navegador distinto del que pidió el cambio.'}
      </p>
      <Link href="/forgot-password" className="inline-block py-2 text-sm font-medium text-primary">
        Pedir un enlace nuevo
      </Link>
    </>
  )
}

function NewPasswordForm() {
  const router = useRouter()
  const [errors, setErrors] = useState<NewPasswordErrors & { general?: string }>({})
  // After saving, the button stays disabled until the navigation finishes.
  const [submitting, setSubmitting] = useState(false)

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const password = String(formData.get('password'))
    const validation = validateNewPassword(password, String(formData.get('repeat')))
    setErrors(validation)
    if (hasErrors(validation)) return
    setSubmitting(true)
    const { error } = await supabaseBrowser()
      .auth.updateUser({ password })
      .catch((e: unknown) => ({ error: e }))
    if (error) {
      setSubmitting(false)
      setErrors({ general: resetMessage(error) })
      return
    }
    toast.success('Contraseña actualizada')
    router.replace('/')
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <Field id="password" label="Nueva contraseña" help="Al menos 8 caracteres." error={errors.password}>
        <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-11" />
      </Field>
      <Field id="repeat" label="Repetir contraseña" error={errors.repeat}>
        <Input id="repeat" name="repeat" type="password" autoComplete="new-password" required className="h-11" />
      </Field>
      {errors.general && (
        <p role="alert" className="text-sm text-destructive">
          {errors.general}
        </p>
      )}
      <Button type="submit" disabled={submitting} className="h-11 w-full">
        {submitting ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
