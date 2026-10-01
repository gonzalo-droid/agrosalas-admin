import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { leerEnv } from '../src/env'

const cliente = postgres(leerEnv().DATABASE_URL, { prepare: false, max: 1 })
await migrate(drizzle(cliente), { migrationsFolder: './drizzle' })
await cliente.end()
console.log('Migraciones aplicadas')
