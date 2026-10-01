import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Db } from '../types'
import * as schema from './schema'

// prepare: false is required with the Supabase pooler in transaction mode.
export function createDb(url: string): { db: Db; close: () => Promise<void> } {
  const client = postgres(url, { prepare: false })
  return { db: drizzle(client, { schema }), close: () => client.end() }
}
