import { serve } from '@hono/node-server'
import { readEnv } from './env.js'
import { createProductionApp } from './production.js'

const env = readEnv()

serve({ fetch: createProductionApp(env).fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
