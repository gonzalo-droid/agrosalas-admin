import { createClient } from '@supabase/supabase-js'
import { ErrorApi } from '../lib/errores'
import type { AuthAdmin } from '../tipos'

export function crearAuthAdminSupabase(supabaseUrl: string, claveSecreta: string): AuthAdmin {
  const supabase = createClient(supabaseUrl, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async crearUsuario(correo, clave) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: correo,
        password: clave,
        email_confirm: true,
      })
      if (error || !data.user) {
        throw new ErrorApi(409, 'usuario_auth', error?.message ?? 'No se pudo crear el usuario', 'correo')
      }
      return { id: data.user.id }
    },
  }
}
