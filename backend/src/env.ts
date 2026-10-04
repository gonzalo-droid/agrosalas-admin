import { z } from 'zod'

// No trailing slash: with one, the token issuer and the CORS origin never match.
const url = () => z.url().transform((value) => value.replace(/\/+$/, ''))

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  EVIDENCE_BUCKET: z.string().min(1).default('payment-evidence'),
  PANEL_ORIGIN: url().default('http://localhost:3000'),
  CRON_SECRET: z.string().min(16).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(8787),
})

export type Env = z.infer<typeof schema>

export function readEnv(source: Record<string, string | undefined> = process.env): Env {
  const result = schema.safeParse(source)
  if (!result.success) {
    const missing = result.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Invalid or missing environment variables: ${missing}`)
  }
  return result.data
}
