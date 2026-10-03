import { createApp } from './app'
import { createSupabaseAuthAdmin } from './auth/admin'
import { createSupabaseVerifier } from './auth/verify'
import { createDb } from './db/client'
import type { Env } from './env'
import { createSupabaseEvidenceStorage } from './storage/evidence'

// The API with its real dependencies: used by the local server (src/server.ts) and by Vercel (index.ts).
export function createProductionApp(env: Env) {
  const { db } = createDb(env.DATABASE_URL)
  return createApp({
    db,
    verifyToken: createSupabaseVerifier(env.SUPABASE_URL),
    authAdmin: createSupabaseAuthAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    panelOrigin: env.PANEL_ORIGIN,
    now: () => new Date(),
    evidence: createSupabaseEvidenceStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.EVIDENCE_BUCKET),
    cronSecret: env.CRON_SECRET,
  })
}
