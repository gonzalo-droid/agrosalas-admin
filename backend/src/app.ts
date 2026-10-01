import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth/middleware'
import { handleError } from './lib/errors'
import { areasRoutes, campaignsRoutes, shiftsRoutes } from './routes/catalogs'
import { auditLogRoutes } from './routes/audit-log'
import { meRoutes } from './routes/me'
import { positionsRoutes } from './routes/positions'
import { workersRoutes } from './routes/workers'
import { paymentMethodsRoutes } from './routes/payment-methods'
import { groupsRoutes } from './routes/groups'
import { usersRoutes } from './routes/users'
import type { AppEnv, Dependencies } from './types'

export function createApp(deps: Dependencies) {
  const v1 = new Hono<AppEnv>()
    .use('*', authenticate(deps))
    .route('/me', meRoutes(deps))
    .route('/auditoria', auditLogRoutes(deps))
    .route('/areas', areasRoutes(deps))
    .route('/turnos', shiftsRoutes(deps))
    .route('/campanas', campaignsRoutes(deps))
    .route('/cargos', positionsRoutes(deps))
    .route('/trabajadores', workersRoutes(deps))
    .route('/trabajadores', paymentMethodsRoutes(deps))
    .route('/grupos', groupsRoutes(deps))
    .route('/usuarios', usersRoutes(deps))

  return new Hono()
    .use(
      '*',
      cors({
        origin: deps.panelOrigin,
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
      }),
    )
    .get('/salud', (c) => c.json({ ok: true }))
    .route('/v1', v1)
    .notFound((c) => c.json({ error: { codigo: 'no_encontrado', mensaje: 'La ruta no existe' } }, 404))
    .onError(handleError)
}

export type AppType = ReturnType<typeof createApp>
