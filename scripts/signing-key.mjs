// Creates supabase/signing_keys.json for the local Supabase (npm run db:signing-key).
// An existing non-empty key is never overwritten; a file that is not a JSON array is never touched.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const path = 'supabase/signing_keys.json'

if (existsSync(path)) {
  let keys
  try {
    keys = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    console.error(`${path} exists but is not valid JSON. Left untouched: fix or delete it and run this again.`)
    process.exit(1)
  }
  if (!Array.isArray(keys)) {
    console.error(`${path} exists but is not a JSON array. Left untouched: fix or delete it and run this again.`)
    process.exit(1)
  }
  if (keys.length > 0) {
    console.log(`${path} already exists; left untouched.`)
    process.exit(0)
  }
}

writeFileSync(path, '[]')
try {
  execFileSync('npx', ['supabase', 'gen', 'signing-key', '--algorithm', 'ES256', '--yes'], { stdio: 'inherit' })
} catch {
  console.error('Generating the signing key failed (see the output above).')
  process.exit(1)
}
