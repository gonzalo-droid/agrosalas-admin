import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Db } from '../types.js'
import * as schema from './schema.js'

// prepare: false is required with the Supabase pooler in transaction mode.
// The small pool and the idle timeout are for Vercel functions: several of them can share one instance,
// and Supabase's pooler caps client connections on the free plan, so idle sockets must not pile up.
export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, connect_timeout: 10 })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}
