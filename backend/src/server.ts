import { serve } from '@hono/node-server'
import { readEnv } from './env'
import { createProductionApp } from './production'

const env = readEnv()

serve({ fetch: createProductionApp(env).fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
