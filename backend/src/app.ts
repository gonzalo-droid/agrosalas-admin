import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { autenticar } from './auth/middleware'
import { manejarError } from './lib/errores'
import { rutasAreas, rutasCampanas, rutasTurnos } from './rutas/catalogos'
import { rutasAuditoria } from './rutas/auditoria'
import { rutasMe } from './rutas/me'
import { rutasCargos } from './rutas/cargos'
import { rutasTrabajadores } from './rutas/trabajadores'
import { rutasMetodosPago } from './rutas/metodos-pago'
import { rutasGrupos } from './rutas/grupos'
import { rutasUsuarios } from './rutas/usuarios'
import type { Dependencias, Entorno } from './tipos'

export function crearApp(deps: Dependencias) {
  const v1 = new Hono<Entorno>()
    .use('*', autenticar(deps))
    .route('/me', rutasMe(deps))
    .route('/auditoria', rutasAuditoria(deps))
    .route('/areas', rutasAreas(deps))
    .route('/turnos', rutasTurnos(deps))
    .route('/campanas', rutasCampanas(deps))
    .route('/cargos', rutasCargos(deps))
    .route('/trabajadores', rutasTrabajadores(deps))
    .route('/trabajadores', rutasMetodosPago(deps))
    .route('/grupos', rutasGrupos(deps))
    .route('/usuarios', rutasUsuarios(deps))

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
    .route('/v1', v1)
    .notFound((c) => c.json({ error: { codigo: 'no_encontrado', mensaje: 'La ruta no existe' } }, 404))
    .onError(manejarError)
}

export type AppType = ReturnType<typeof crearApp>
