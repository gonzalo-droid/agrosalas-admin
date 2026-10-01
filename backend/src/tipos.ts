import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './db/schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type Rol = (typeof schema.rolEnum.enumValues)[number]

export type UsuarioSesion = {
  id: string
  correo: string
  nombre: string
  rol: Rol
  areaIds: string[]
}

export type Entorno = { Variables: { usuario: UsuarioSesion } }

export interface AuthAdmin {
  crearUsuario(correo: string, clave: string): Promise<{ id: string }>
  eliminarUsuario(id: string): Promise<void>
}

export type Dependencias = {
  db: Db
  // Devuelve el id del usuario de Supabase Auth, o null si el token no es válido.
  verificarToken: (token: string) => Promise<{ sub: string } | null>
  authAdmin: AuthAdmin
  origenPanel: string
}
