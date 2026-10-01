'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseNavegador } from '@/lib/supabase/navegador'

// Se llega aquí desde el enlace del correo; Supabase ya dejó una sesión temporal.
export default function PaginaRestablecer() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const clave = String(datos.get('clave'))
    if (clave.length < 8) return setError('Usa al menos 8 caracteres')
    if (clave !== String(datos.get('repetir'))) return setError('Las contraseñas no coinciden')
    setEnviando(true)
    const { error } = await supabaseNavegador().auth.updateUser({ password: clave })
    setEnviando(false)
    if (error) return setError('El enlace venció o ya se usó. Pide uno nuevo.')
    toast.success('Contraseña actualizada')
    router.replace('/')
  }

  return (
    <MarcoAcceso titulo="Nueva contraseña">
      <form onSubmit={guardar} className="space-y-4">
        <Campo id="clave" etiqueta="Nueva contraseña">
          <Input id="clave" name="clave" type="password" autoComplete="new-password" required className="h-11" />
        </Campo>
        <Campo id="repetir" etiqueta="Repetir contraseña" error={error}>
          <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="h-11" />
        </Campo>
        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </MarcoAcceso>
  )
}
