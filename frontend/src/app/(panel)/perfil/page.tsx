'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo } from '@/components/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useAreas } from '@/lib/catalogos'
import { mensajeCambioClave, mensajeClaveActual } from '@/lib/errores-acceso'
import { useCerrarSesion } from '@/lib/sesion'
import { supabaseNavegador } from '@/lib/supabase/navegador'
import { hayErrores, validarClaveNueva } from '@/lib/validar-clave'
import { ETIQUETA_ROL, useYo } from '@/lib/yo'

export default function PaginaPerfil() {
  const cliente = useQueryClient()
  const cerrarSesion = useCerrarSesion()
  const { data: yo } = useYo()
  const [erroresClave, setErroresClave] = useState<{ actual?: string; nueva?: string; repetir?: string; general?: string }>({})
  const [cambiandoClave, setCambiandoClave] = useState(false)
  const { data: areas } = useAreas()

  const guardarNombre = useMutation({
    mutationFn: (nombre: string) => leer(api.v1.me.$patch({ json: { nombre } })),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['yo'] })
      toast.success('Nombre actualizado')
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  async function cambiarClave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulario = e.currentTarget
    const datos = new FormData(formulario)
    const nueva = String(datos.get('nueva'))
    const validacion = validarClaveNueva(nueva, String(datos.get('repetir')))
    setErroresClave({ nueva: validacion.clave, repetir: validacion.repetir })
    if (hayErrores(validacion)) return
    setCambiandoClave(true)
    try {
      const supabase = supabaseNavegador()
      // Se vuelve a pedir la contraseña actual para confirmar que quien la cambia es el dueño de la cuenta.
      const { error: errorActual } = await supabase.auth
        .signInWithPassword({ email: yo!.correo, password: String(datos.get('actual')) })
        .catch((e: unknown) => ({ error: e }))
      if (errorActual) return setErroresClave({ actual: mensajeClaveActual(errorActual) })
      const { error } = await supabase.auth.updateUser({ password: nueva }).catch((e: unknown) => ({ error: e }))
      if (error) return setErroresClave({ general: mensajeCambioClave(error) })
      formulario.reset()
      toast.success('Contraseña actualizada')
    } finally {
      setCambiandoClave(false)
    }
  }

  if (!yo) return null

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border bg-background p-5"
          onSubmit={(e) => {
            e.preventDefault()
            guardarNombre.mutate(String(new FormData(e.currentTarget).get('nombre')))
          }}
        >
          <h2 className="font-semibold">Mis datos</h2>
          <Campo id="nombre" etiqueta="Nombre">
            <Input id="nombre" name="nombre" defaultValue={yo.nombre} required minLength={2} className="h-10" />
          </Campo>
          <Campo id="correo" etiqueta="Correo" ayuda="Lo cambia el administrador.">
            <Input id="correo" value={yo.correo} readOnly className="h-10 bg-muted text-muted-foreground" />
          </Campo>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Rol</span>
            <Badge variant="secondary">{ETIQUETA_ROL[yo.rol]}</Badge>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Áreas asignadas: </span>
            {yo.areaIds.length === 0
              ? yo.rol === 'coordinador'
                ? 'Ninguna'
                : 'Todas'
              : yo.areaIds.map((id) => areas?.datos.find((a) => a.id === id)?.nombre ?? '…').join(', ')}
          </p>
          <Button type="submit" size="lg" disabled={guardarNombre.isPending}>
            Guardar
          </Button>
        </form>

        <div className="space-y-4">
          <form onSubmit={cambiarClave} className="space-y-4 rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Cambiar contraseña</h2>
            <Campo id="actual" etiqueta="Contraseña actual" error={erroresClave.actual}>
              <Input id="actual" name="actual" type="password" autoComplete="current-password" required className="h-10" />
            </Campo>
            <Campo id="nueva" etiqueta="Nueva contraseña" ayuda="Al menos 8 caracteres." error={erroresClave.nueva}>
              <Input id="nueva" name="nueva" type="password" autoComplete="new-password" required className="h-10" />
            </Campo>
            <Campo id="repetir" etiqueta="Repetir nueva contraseña" error={erroresClave.repetir}>
              <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="h-10" />
            </Campo>
            {erroresClave.general && (
              <p role="alert" className="text-sm text-destructive">
                {erroresClave.general}
              </p>
            )}
            <Button type="submit" variant="outline" size="lg" disabled={cambiandoClave}>
              {cambiandoClave ? 'Cambiando…' : 'Cambiar contraseña'}
            </Button>
          </form>

          <div className="flex items-center justify-between rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Sesión</h2>
            <Button variant="destructive" size="lg" onClick={() => void cerrarSesion()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
