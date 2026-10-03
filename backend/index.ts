// Entry point of the API on Vercel: Vercel looks for a file that imports hono and exports the app by default
// (it checks app.*, index.* and server.* at the project root before src/). Local development uses src/server.ts.
import type { Hono } from 'hono'
import { readEnv } from './src/env'
import { createProductionApp } from './src/production'

const app: Hono = createProductionApp(readEnv())

export default app
