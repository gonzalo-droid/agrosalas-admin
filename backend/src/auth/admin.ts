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
        if (error?.code === 'email_exists') {
          throw new ErrorApi(409, 'duplicado', 'Ya existe una cuenta de acceso con ese correo', 'correo')
        }
        console.error(error)
        throw new ErrorApi(502, 'usuario_auth', 'No se pudo crear la cuenta de acceso')
      }
      return { id: data.user.id }
    },
    async eliminarUsuario(id) {
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error) throw error
    },
  }
}
