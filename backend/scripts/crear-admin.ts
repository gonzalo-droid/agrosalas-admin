// Crea el primer administrador: npm run crear-admin -- correo@dominio.com "Nombre Apellido" "contraseña"
import { crearAuthAdminSupabase } from '../src/auth/admin'
import { crearPrimerAdmin } from '../src/auth/primer-admin'
import { crearDb } from '../src/db/client'
import { leerEnv } from '../src/env'

const [correo, nombre, clave] = process.argv.slice(2)
if (!correo || !nombre || !clave || clave.length < 8) {
  console.error('Uso: npm run crear-admin -- <correo> "<nombre>" "<contraseña de 8 o más caracteres>"')
  process.exit(1)
}

const env = leerEnv()
const { db, cerrar } = crearDb(env.DATABASE_URL)
try {
  await crearPrimerAdmin(db, crearAuthAdminSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY), { correo, nombre, clave })
} finally {
  await cerrar()
}
console.log(`Administrador creado: ${correo}`)
