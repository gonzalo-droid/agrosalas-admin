'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export default function PaginaRecuperar() {
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const correo = String(new FormData(e.currentTarget).get('correo'))
    setEnviando(true)
    // No se revela si el correo existe: la respuesta es la misma en ambos casos.
    await supabaseNavegador().auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    setEnviando(false)
    setEnviado(true)
  }

  return (
    <MarcoAcceso titulo="Recuperar contraseña">
      {enviado ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          Si el correo pertenece a una cuenta, te llegará un enlace para crear una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo id="correo" etiqueta="Correo" ayuda="Te enviaremos un enlace para crear una contraseña nueva.">
            <Input id="correo" name="correo" type="email" autoComplete="email" required className="h-11" />
          </Campo>
          <Button type="submit" disabled={enviando} className="h-11 w-full">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <Link href="/login" className="inline-block py-2 text-sm font-medium text-primary">
        Volver a iniciar sesión
      </Link>
    </MarcoAcceso>
  )
}
