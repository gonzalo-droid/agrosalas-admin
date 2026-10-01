'use client'

import { useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mensajeIngreso } from '@/lib/errores-acceso'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export default function PaginaLogin() {
  const router = useRouter()
  const cliente = useQueryClient()
  const [error, setError] = useState('')
  // Tras entrar, el botón queda deshabilitado hasta que la navegación termine (evita un doble envío).
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    setEnviando(true)
    setError('')
    const { error } = await supabaseNavegador()
      .auth.signInWithPassword({ email: String(datos.get('correo')), password: String(datos.get('clave')) })
      .catch((e: unknown) => ({ error: e }))
    if (error) {
      setEnviando(false)
      setError(mensajeIngreso(error))
      return
    }
    // Nada de lo guardado en memoria (de una sesión anterior en esta pestaña) sirve para quien acaba de entrar.
    cliente.clear()
    router.replace('/')
    router.refresh()
  }

  return (
    <MarcoAcceso titulo="Iniciar sesión">
      <form onSubmit={entrar} className="space-y-4">
        <Campo id="correo" etiqueta="Correo">
          <Input id="correo" name="correo" type="email" autoComplete="email" required className="h-11" />
        </Campo>
        <Campo id="clave" etiqueta="Contraseña" error={error}>
          <Input id="clave" name="clave" type="password" autoComplete="current-password" required className="h-11" />
        </Campo>
        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <Link href="/recuperar" className="inline-block py-2 text-sm font-medium text-primary">
        Olvidé mi contraseña
      </Link>
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Las cuentas las crea el administrador. No hay registro público.
      </p>
    </MarcoAcceso>
  )
}
