// Creates the first administrator: npm run create-admin -- email@domain.com "First Last" "password"
import { createSupabaseAuthAdmin } from '../src/auth/admin.js'
import { createFirstAdmin } from '../src/auth/first-admin.js'
import { createDb } from '../src/db/client.js'
import { readEnv } from '../src/env.js'

const [email, name, password] = process.argv.slice(2)
if (!email || !name || !password || password.length < 8) {
  console.error('Usage: npm run create-admin -- <email> "<name>" "<password of 8 or more characters>"')
  process.exit(1)
}

const env = readEnv()
const { db, close } = createDb(env.DATABASE_URL)
try {
  await createFirstAdmin(db, createSupabaseAuthAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY), { email, name, password })
} finally {
  await close()
}
console.log(`Administrator created: ${email}`)
