'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field } from '@/components/field'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, errorMessage, unwrap } from '@/lib/api'
import { useAreas } from '@/lib/catalogs'
import { passwordChangeMessage, currentPasswordMessage } from '@/lib/auth-errors'
import { useSignOut } from '@/lib/session'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { hasErrors, validateNewPassword } from '@/lib/validate-password'
import { ROLE_LABEL, useMe } from '@/lib/me'

export default function ProfilePage() {
  const queryClient = useQueryClient()
  const signOut = useSignOut()
  const { data: me } = useMe()
  const [passwordErrors, setPasswordErrors] = useState<{ current?: string; password?: string; repeat?: string; general?: string }>({})
  const [changingPassword, setChangingPassword] = useState(false)
  const { data: areas } = useAreas()

  const saveName = useMutation({
    mutationFn: (name: string) => unwrap(api.v1.me.$patch({ json: { name } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['me'] })
      toast.success('Nombre actualizado')
    },
    onError: (e) => toast.error(errorMessage(e)),
  })

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const newPassword = String(formData.get('password'))
    const validation = validateNewPassword(newPassword, String(formData.get('repeat')))
    setPasswordErrors({ password: validation.password, repeat: validation.repeat })
    if (hasErrors(validation)) return
    setChangingPassword(true)
    try {
      const supabase = supabaseBrowser()
      // The current password is asked for again to confirm that whoever changes it owns the account.
      const { error: currentError } = await supabase.auth
        .signInWithPassword({ email: me!.email, password: String(formData.get('current')) })
        .catch((e: unknown) => ({ error: e }))
      if (currentError) return setPasswordErrors({ current: currentPasswordMessage(currentError) })
      const { error } = await supabase.auth.updateUser({ password: newPassword }).catch((e: unknown) => ({ error: e }))
      if (error) return setPasswordErrors({ general: passwordChangeMessage(error) })
      form.reset()
      toast.success('Contraseña actualizada')
    } finally {
      setChangingPassword(false)
    }
  }

  if (!me) return null

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border bg-background p-5"
          onSubmit={(e) => {
            e.preventDefault()
            saveName.mutate(String(new FormData(e.currentTarget).get('name')))
          }}
        >
          <h2 className="font-semibold">Mis datos</h2>
          <Field id="name" label="Nombre">
            <Input id="name" name="name" defaultValue={me.name} required minLength={2} className="h-10" />
          </Field>
          <Field id="email" label="Correo" help="Lo cambia el administrador.">
            <Input id="email" value={me.email} readOnly className="h-10 bg-muted text-muted-foreground" />
          </Field>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Rol</span>
            <Badge variant="secondary">{ROLE_LABEL[me.role]}</Badge>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Áreas asignadas: </span>
            {me.areaIds.length === 0
              ? me.role === 'coordinator'
                ? 'Ninguna'
                : 'Todas'
              : me.areaIds.map((id) => areas?.items.find((a) => a.id === id)?.name ?? '…').join(', ')}
          </p>
          <Button type="submit" size="lg" disabled={saveName.isPending}>
            Guardar
          </Button>
        </form>

        <div className="space-y-4">
          <form onSubmit={changePassword} className="space-y-4 rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Cambiar contraseña</h2>
            <Field id="current" label="Contraseña actual" error={passwordErrors.current}>
              <Input id="current" name="current" type="password" autoComplete="current-password" required className="h-10" />
            </Field>
            <Field id="password" label="Nueva contraseña" help="Al menos 8 caracteres." error={passwordErrors.password}>
              <Input id="password" name="password" type="password" autoComplete="new-password" required className="h-10" />
            </Field>
            <Field id="repeat" label="Repetir nueva contraseña" error={passwordErrors.repeat}>
              <Input id="repeat" name="repeat" type="password" autoComplete="new-password" required className="h-10" />
            </Field>
            {passwordErrors.general && (
              <p role="alert" className="text-sm text-destructive">
                {passwordErrors.general}
              </p>
            )}
            <Button type="submit" variant="outline" size="lg" disabled={changingPassword}>
              {changingPassword ? 'Cambiando…' : 'Cambiar contraseña'}
            </Button>
          </form>

          <div className="flex items-center justify-between rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Sesión</h2>
            <Button variant="destructive" size="lg" onClick={() => void signOut()}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
