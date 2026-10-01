import { createClient } from '@supabase/supabase-js'
import { ApiError } from '../lib/errors'
import type { AuthAdmin } from '../types'

export function createSupabaseAuthAdmin(supabaseUrl: string, secretKey: string): AuthAdmin {
  const supabase = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async createUser(email, password) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (error || !data.user) {
        if (error?.code === 'email_exists') {
          throw new ApiError(409, 'duplicado', 'Ya existe una cuenta de acceso con ese correo', 'correo')
        }
        console.error(error)
        throw new ApiError(502, 'usuario_auth', 'No se pudo crear la cuenta de acceso')
      }
      return { id: data.user.id }
    },
    async deleteUser(id) {
      const { error } = await supabase.auth.admin.deleteUser(id)
      if (error) throw error
    },
  }
}
