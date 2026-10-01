import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Db } from '../tipos'
import * as schema from './schema'

// prepare: false es obligatorio con el pooler de Supabase en modo transacción.
export function crearDb(url: string): { db: Db; cerrar: () => Promise<void> } {
  const cliente = postgres(url, { prepare: false })
  return { db: drizzle(cliente, { schema }), cerrar: () => cliente.end() }
}
