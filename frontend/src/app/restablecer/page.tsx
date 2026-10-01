'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { mensajeRestablecer } from '@/lib/errores-acceso'
import { comprobarEnlaceDeRecuperacion, type ResultadoEnlace } from '@/lib/recuperacion'
import { supabaseNavegador } from '@/lib/supabase/navegador'
import { hayErrores, validarClaveNueva, type ErroresClaveNueva } from '@/lib/validar-clave'

// Se llega aquí desde el enlace del correo. El formulario solo aparece si el enlace es una recuperación válida:
// una sesión normal abierta en este navegador no sirve para cambiar la contraseña sin conocer la actual.
export default function PaginaRestablecer() {
  const [enlace, setEnlace] = useState<ResultadoEnlace | 'comprobando'>('comprobando')
  const comprobacion = useRef<Promise<ResultadoEnlace> | null>(null)

  useEffect(() => {
    let vigente = true
    // La URL se lee antes de crear el cliente, que al crearse canjea el ?code= y lo quita de la barra.
    const parametros = new URLSearchParams(window.location.search)
    // En desarrollo React monta dos veces: el enlace (de un solo uso) se comprueba una sola vez.
    comprobacion.current ??= comprobarEnlaceDeRecuperacion(supabaseNavegador().auth, parametros)
    void comprobacion.current.then((resultado) => {
      if (vigente) setEnlace(resultado)
    })
    return () => {
      vigente = false
    }
  }, [])

  return (
    <MarcoAcceso titulo="Nueva contraseña">
      {enlace === 'comprobando' ? (
        <p role="status" className="text-sm text-muted-foreground">
          Comprobando el enlace…
        </p>
      ) : enlace === 'recuperacion' ? (
        <FormularioClaveNueva />
      ) : (
        <EnlaceNoValido sinConexion={enlace === 'sin_conexion'} />
      )}
    </MarcoAcceso>
  )
}

function EnlaceNoValido({ sinConexion }: { sinConexion: boolean }) {
  return (
    <>
      <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        {sinConexion
          ? 'No se pudo conectar para comprobar el enlace. Revisa tu conexión y vuelve a abrir el enlace del correo.'
          : 'Este enlace no es válido: ya venció, ya se usó o se abrió en un navegador distinto del que pidió el cambio.'}
      </p>
      <Link href="/recuperar" className="inline-block py-2 text-sm font-medium text-primary">
        Pedir un enlace nuevo
      </Link>
    </>
  )
}

function FormularioClaveNueva() {
  const router = useRouter()
  const [errores, setErrores] = useState<ErroresClaveNueva & { general?: string }>({})
  // Tras guardar, el botón queda deshabilitado hasta que la navegación termine.
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const clave = String(datos.get('clave'))
    const validacion = validarClaveNueva(clave, String(datos.get('repetir')))
    setErrores(validacion)
    if (hayErrores(validacion)) return
    setEnviando(true)
    const { error } = await supabaseNavegador()
      .auth.updateUser({ password: clave })
      .catch((e: unknown) => ({ error: e }))
    if (error) {
      setEnviando(false)
      setErrores({ general: mensajeRestablecer(error) })
      return
    }
    toast.success('Contraseña actualizada')
    router.replace('/')
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <Campo id="clave" etiqueta="Nueva contraseña" ayuda="Al menos 8 caracteres." error={errores.clave}>
        <Input id="clave" name="clave" type="password" autoComplete="new-password" required className="h-11" />
      </Campo>
      <Campo id="repetir" etiqueta="Repetir contraseña" error={errores.repetir}>
        <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="h-11" />
      </Campo>
      {errores.general && (
        <p role="alert" className="text-sm text-destructive">
          {errores.general}
        </p>
      )}
      <Button type="submit" disabled={enviando} className="h-11 w-full">
        {enviando ? 'Guardando…' : 'Guardar contraseña'}
      </Button>
    </form>
  )
}
