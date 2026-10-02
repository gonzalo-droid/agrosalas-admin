import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth/middleware'
import { handleError } from './lib/errors'
import { attendanceRoutes } from './routes/attendance'
import { areasRoutes, campaignsRoutes, shiftsRoutes } from './routes/catalogs'
import { auditLogRoutes } from './routes/audit-log'
import { meRoutes } from './routes/me'
import { positionsRoutes } from './routes/positions'
import { workersRoutes } from './routes/workers'
import { paymentMethodsRoutes } from './routes/payment-methods'
import { groupsRoutes } from './routes/groups'
import { payrollsRoutes } from './routes/payrolls'
import { usersRoutes } from './routes/users'
import type { AppEnv, Dependencies } from './types'

export function createApp(deps: Dependencies) {
  const v1 = new Hono<AppEnv>()
    .use('*', authenticate(deps))
    .route('/me', meRoutes(deps))
    .route('/audit-log', auditLogRoutes(deps))
    .route('/areas', areasRoutes(deps))
    .route('/shifts', shiftsRoutes(deps))
    .route('/campaigns', campaignsRoutes(deps))
    .route('/positions', positionsRoutes(deps))
    .route('/workers', workersRoutes(deps))
    .route('/workers', paymentMethodsRoutes(deps))
    .route('/groups', groupsRoutes(deps))
    .route('/users', usersRoutes(deps))
    .route('/payrolls', payrollsRoutes(deps))
    .route('/attendance', attendanceRoutes(deps))

  return new Hono()
    .use(
      '*',
      cors({
        origin: deps.panelOrigin,
        allowHeaders: ['Authorization', 'Content-Type'],
        allowMethods: ['GET', 'POST', 'PATCH', 'DELETE'],
      }),
    )
    .get('/health', (c) => c.json({ ok: true }))
    .route('/v1', v1)
    .notFound((c) => c.json({ error: { code: 'not_found', message: 'La ruta no existe' } }, 404))
    .onError(handleError)
}

export type AppType = ReturnType<typeof createApp>
