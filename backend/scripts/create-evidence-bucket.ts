import { createClient } from '@supabase/supabase-js'
import { readEnv } from '../src/env'
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from '../src/payroll/evidence'

// Creates the private bucket of payment evidence, or updates its limits if it already exists.
const env = readEnv()
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const options = { public: false, fileSizeLimit: EVIDENCE_MAX_BYTES, allowedMimeTypes: Object.keys(EVIDENCE_TYPES) }

const { data: existing } = await supabase.storage.getBucket(env.EVIDENCE_BUCKET)
const { error } = existing
  ? await supabase.storage.updateBucket(env.EVIDENCE_BUCKET, options)
  : await supabase.storage.createBucket(env.EVIDENCE_BUCKET, options)
if (error) {
  console.error(`Could not prepare the bucket "${env.EVIDENCE_BUCKET}": ${error.message}`)
  process.exit(1)
}
console.log(`Bucket "${env.EVIDENCE_BUCKET}" ${existing ? 'updated' : 'created'}: private, 5 MB, JPG/PNG/WebP/PDF.`)
