'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mensajeRecuperacion } from '@/lib/errores-acceso'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export default function PaginaRecuperar() {
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const correo = String(new FormData(e.currentTarget).get('correo'))
    setEnviando(true)
    setError('')
    try {
      const { error } = await supabaseNavegador()
        .auth.resetPasswordForEmail(correo, { redirectTo: `${window.location.origin}/restablecer` })
        .catch((e: unknown) => ({ error: e }))
      // Supabase responde igual exista o no la cuenta, así que el aviso de éxito no revela nada;
      // solo se muestra si el pedido llegó y fue aceptado.
      if (error) setError(mensajeRecuperacion(error))
      else setEnviado(true)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <MarcoAcceso titulo="Recuperar contraseña">
      {enviado ? (
        <p role="status" className="rounded-lg border bg-muted/40 p-3 text-sm">
          Si el correo pertenece a una cuenta, te llegará un enlace para crear una contraseña nueva. Ábrelo en este mismo navegador.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo id="correo" etiqueta="Correo" ayuda="Te enviaremos un enlace para crear una contraseña nueva." error={error}>
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
