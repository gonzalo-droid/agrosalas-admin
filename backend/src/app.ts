import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { manejarError } from './lib/errores'
import type { Dependencias } from './tipos'

export function crearApp(deps: Dependencias) {
  return new Hono()
    .use(
      '*',
      cors({
        origin: deps.origenPanel,
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
      }),
    )
    .get('/salud', (c) => c.json({ ok: true }))
    .notFound((c) => c.json({ error: { codigo: 'no_encontrado', mensaje: 'La ruta no existe' } }, 404))
    .onError(manejarError)
}

export type AppType = ReturnType<typeof crearApp>
