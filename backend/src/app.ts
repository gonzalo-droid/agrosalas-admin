import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authenticate } from './auth/middleware.js'
import { handleError } from './lib/errors.js'
import { attendanceRoutes } from './routes/attendance.js'
import { evidenceRoutes } from './routes/evidence.js'
import { keepAlive } from './routes/keep-alive.js'
import { areasRoutes, campaignsRoutes, shiftsRoutes } from './routes/catalogs.js'
import { auditLogRoutes } from './routes/audit-log.js'
import { meRoutes } from './routes/me.js'
import { positionsRoutes } from './routes/positions.js'
import { workerHistoryRoutes } from './routes/worker-history.js'
import { workersRoutes } from './routes/workers.js'
import { paymentMethodsRoutes } from './routes/payment-methods.js'
import { groupsRoutes } from './routes/groups.js'
import { paymentsRoutes } from './routes/payments.js'
import { payrollItemsRoutes } from './routes/payroll-items.js'
import { payrollsRoutes } from './routes/payrolls.js'
import { reportsRoutes } from './routes/reports.js'
import { usersRoutes } from './routes/users.js'
import type { AppEnv, Dependencies } from './types.js'

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
    .route('/workers', workerHistoryRoutes(deps))
    .route('/groups', groupsRoutes(deps))
    .route('/users', usersRoutes(deps))
    .route('/payrolls', payrollsRoutes(deps))
    .route('/attendance', attendanceRoutes(deps))
    .route('/payroll-items', payrollItemsRoutes(deps))
    .route('/payments', paymentsRoutes(deps))
    .route('/evidence', evidenceRoutes(deps))
    .route('/reports', reportsRoutes(deps))

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
    .get('/internal/keep-alive', keepAlive(deps))
    .route('/v1', v1)
    .notFound((c) => c.json({ error: { code: 'not_found', message: 'La ruta no existe' } }, 404))
    .onError(handleError)
}

export type AppType = ReturnType<typeof createApp>
