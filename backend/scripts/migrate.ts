import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { readEnv } from '../src/env.js'

const client = postgres(readEnv().DATABASE_URL, { prepare: false, max: 1 })
await migrate(drizzle(client), { migrationsFolder: './drizzle' })
await client.end()
console.log('Migrations applied')
