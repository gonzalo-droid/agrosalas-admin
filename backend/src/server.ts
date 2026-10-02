import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createSupabaseAuthAdmin } from './auth/admin'
import { createSupabaseVerifier } from './auth/verify'
import { createDb } from './db/client'
import { readEnv } from './env'
import { createSupabaseEvidenceStorage } from './storage/evidence'

const env = readEnv()
const { db } = createDb(env.DATABASE_URL)

const app = createApp({
  db,
  verifyToken: createSupabaseVerifier(env.SUPABASE_URL),
  authAdmin: createSupabaseAuthAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  panelOrigin: env.PANEL_ORIGIN,
  now: () => new Date(),
  evidence: createSupabaseEvidenceStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.EVIDENCE_BUCKET),
})

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
