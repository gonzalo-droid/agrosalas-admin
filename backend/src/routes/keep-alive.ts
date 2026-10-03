import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { ApiError } from '../lib/errors'
import type { Dependencies } from '../types'

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Called once a day by the Vercel cron: one query keeps the free Supabase project from being paused.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without that secret configured, the route never answers 200.
export const keepAlive =
  ({ db, cronSecret }: Pick<Dependencies, 'db' | 'cronSecret'>) =>
  async (c: Context) => {
    const header = c.req.header('Authorization') ?? ''
    if (!cronSecret || !sameSecret(header, `Bearer ${cronSecret}`)) {
      throw new ApiError(401, 'unauthenticated', 'No autorizado')
    }
    await db.execute(sql`select 1`)
    return c.json({ ok: true })
  }
