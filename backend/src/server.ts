import { serve } from '@hono/node-server'
import { crearApp } from './app'
import { crearAuthAdminSupabase } from './auth/admin'
import { crearVerificadorSupabase } from './auth/verificar'
import { crearDb } from './db/client'
import { leerEnv } from './env'

const env = leerEnv()
const { db } = crearDb(env.DATABASE_URL)

const app = crearApp({
  db,
  verificarToken: crearVerificadorSupabase(env.SUPABASE_URL),
  authAdmin: crearAuthAdminSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  origenPanel: env.ORIGEN_PANEL,
})

serve({ fetch: app.fetch, port: env.PUERTO }, (info) => {
  console.log(`API en http://localhost:${info.port}`)
})
