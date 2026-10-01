// Crea el primer administrador: npm run crear-admin -- correo@dominio.com "Nombre Apellido" "contraseña"
import { crearAuthAdminSupabase } from '../src/auth/admin'
import { crearDb } from '../src/db/client'
import { usuarios } from '../src/db/schema'
import { leerEnv } from '../src/env'

const [correo, nombre, clave] = process.argv.slice(2)
if (!correo || !nombre || !clave || clave.length < 8) {
  console.error('Uso: npm run crear-admin -- <correo> "<nombre>" "<contraseña de 8 o más caracteres>"')
  process.exit(1)
}

const env = leerEnv()
const { db, cerrar } = crearDb(env.DATABASE_URL)
const { id } = await crearAuthAdminSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY).crearUsuario(correo, clave)
await db.insert(usuarios).values({ id, correo, nombre, rol: 'admin' })
await cerrar()
console.log(`Administrador creado: ${correo}`)
