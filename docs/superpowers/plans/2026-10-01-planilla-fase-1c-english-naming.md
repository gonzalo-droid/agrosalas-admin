# Planilla fase 1C: nombres en inglés — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar a inglés todo lo ya construido en la fase 1 (carpetas, archivos, variables, funciones, tipos, componentes, tablas, columnas, rutas de la API, claves JSON, códigos de error y direcciones del panel) sin cambiar lo que el sistema hace ni el texto que ve el usuario.

**Architecture:** Es un cambio de nombres, no de comportamiento. Se hace por capas, de adentro hacia afuera: primero los nombres internos del backend, luego el modelo de datos y el contrato de la API (con la migración inicial generada de nuevo), después el frontend en tres pasos (consumir el contrato nuevo, nombres internos, direcciones). Las pruebas existentes son la red de seguridad: el número de pruebas no baja y todas pasan al final de cada tarea.

**Tech Stack:** el de los planes 1A y 1B (Hono, Zod, Drizzle, PGlite, Vitest, Next.js 16, TanStack Query). No se agrega ninguna dependencia.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, sección 17 (convención de nombres y glosario). Las tablas de la sección 17 son la autoridad para todo nombre de dominio; este plan agrega los mapas de archivos e identificadores del código.

**Planes previos:** `2026-10-01-planilla-fase-1a-backend.md` (ejecutado, PR #1) y `2026-10-01-planilla-fase-1b-frontend.md` (tareas 1 a 11 hechas; tanda final de arreglos en curso al escribir este plan).

## Dónde estamos y qué sigue

| Orden | Paso | Estado al 2026-10-01 |
|---|---|---|
| 1 | Plan 1A: API base | Hecho. PR #1 abierto (`feat/fase-1-base`) |
| 2 | Plan 1B: pantallas base | Tareas 1 a 11 hechas. Tanda final de arreglos (grupos A a H) en curso en `feat/fase-1b-frontend` |
| 3 | PR del plan 1B | Pendiente: se abre al terminar la tanda final |
| 4 | **Plan 1C (este): nombres en inglés** | Pendiente. Rama `refactor/english-naming`, con PR propio |
| 5 | Proyecto Supabase de desarrollo y primer administrador (tarea 12 del plan 1A) y prueba manual de punta a punta (tarea 11, paso 4, del plan 1B) | Pendiente; lo hace Gonzalo. **Va después del plan 1C**, para crear la base ya con los nombres en inglés |
| 6 | Plan de la fase 2 (Asistencia) | Sin escribir. Se escribe con los nombres de la sección 17 del spec |

## Decisiones tomadas

Gonzalo pidió el 2026-10-01 que variables, clases, carpetas y demás estén en inglés. Lo que sigue es cómo se interpretó; se puede cambiar antes de ejecutar.

1. **En inglés va todo el código**, incluida la base de datos, el contrato de la API y las direcciones del panel. Detalle en la sección 17 del spec.
2. **En español queda lo que lee una persona**: textos del panel, `message` de los errores, mensajes de validación, y la prosa del spec, los planes y el README.
3. **La migración inicial se genera de nuevo** en lugar de escribir una migración de renombrado, porque todavía no existe ninguna base con datos. Si para cuando se ejecute este plan ya existe un proyecto Supabase migrado, ver "Antes de empezar".
4. **Se conservan** `dni`, `cci`, `yape` y `plin`.
5. **Único agregado que no es un renombrado:** etiquetas en español para los nombres de campo y los valores enum que muestra la pantalla de auditoría (tarea 3). Sin ellas, esa pantalla pasaría a mostrar `hourlyRate` o `bank_account` al usuario.

## Global Constraints

- No cambia el comportamiento: mismas reglas, mismos permisos, mismas respuestas salvo los nombres. Si un renombrado obliga a cambiar lógica, se detiene la tarea y se reporta.
- Los nombres de dominio salen de la sección 17 del spec; los de archivos e identificadores, de las tablas de este plan. Lo que no esté en ninguna tabla se nombra con las mismas reglas y se lista en el reporte de la tarea.
- Base de datos en `snake_case`; TypeScript y JSON en `camelCase`; archivos, carpetas y rutas en `kebab-case`; componentes, clases y tipos en `PascalCase`; constantes en `UPPER_SNAKE_CASE`.
- Todo texto visible para el usuario sigue en español, sin cambios de redacción. `z.config(z.locales.es())` se queda.
- Un valor del contrato nunca se muestra tal cual en pantalla: pasa por un mapa de etiquetas en español.
- Comentarios del código, nombres de `describe`/`it` y mensajes de `console` pasan a inglés.
- Los archivos se mueven con `git mv`, para conservar la historia.
- El backend sigue usando solo imports relativos. El `exports` de `backend/package.json` (`"./app": "./src/app.ts"`) no cambia.
- No se toca `frontend/src/components/ui/` (generado por shadcn) salvo sus textos visibles, que ya están en español.
- Las pruebas no bajan de número: backend 148; frontend, el total que deje la tanda final del plan 1B más las que agrega la tarea 3.
- Rama `refactor/english-naming`, creada desde la punta de `feat/fase-1b-frontend` cuando la tanda final esté terminada. Commits con Conventional Commits: `refactor(api): …`, `refactor(web): …`, `docs: …`.
- Nunca se versiona `.env`, `.env.local` ni el Excel de planilla. No se hace `git push` sin que Gonzalo lo pida.
- Los comandos se ejecutan desde la raíz del repo (`/Volumes/Neko/webs/agrosalas_admin`) salvo que se indique otra carpeta.

## Antes de empezar

- [ ] La tanda final del plan 1B terminó: `git status --short` vacío en `feat/fase-1b-frontend` y existe `.superpowers/sdd/2026-10-01-planilla-fase-1b-frontend/final-fix-report.md`.
- [ ] La rama `feat/fase-1b-frontend` contiene este plan y la sección 17 del spec (llegan por `feat/fase-1-base`). Si no: `git merge feat/fase-1-base`.
- [ ] Crear la rama: `git switch -c refactor/english-naming feat/fase-1b-frontend`.
- [ ] Anotar la línea base. Ejecutar `npm run lint && npm run typecheck && npm test && npm run build` y guardar: número de pruebas del backend (se espera 148), número de pruebas del frontend y la lista de rutas del build.
- [ ] Preguntar a Gonzalo si ya creó el proyecto Supabase de desarrollo. Si ya lo migró con los nombres en español, la base hay que vaciarla y la cuenta del administrador hay que borrarla en Supabase Auth antes de volver a migrar. Es una acción destructiva: la decide y la hace Gonzalo, no el agente.

## Mapa de archivos

### Backend (`backend/`)

| Antes | Después |
|---|---|
| `src/tipos.ts` | `src/types.ts` |
| `src/auth/primer-admin.ts` | `src/auth/first-admin.ts` |
| `src/auth/verificar.ts` | `src/auth/verify.ts` |
| `src/lib/auditoria.ts` | `src/lib/audit.ts` |
| `src/lib/errores.ts` | `src/lib/errors.ts` |
| `src/lib/paginacion.ts` | `src/lib/pagination.ts` |
| `src/lib/validar.ts` | `src/lib/validate.ts` |
| `src/rutas/` | `src/routes/` |
| `src/rutas/auditoria.ts` | `src/routes/audit-log.ts` |
| `src/rutas/cargos.ts` | `src/routes/positions.ts` |
| `src/rutas/catalogos.ts` | `src/routes/catalogs.ts` |
| `src/rutas/grupos.ts` | `src/routes/groups.ts` |
| `src/rutas/me.ts` | `src/routes/me.ts` |
| `src/rutas/metodos-pago.ts` | `src/routes/payment-methods.ts` |
| `src/rutas/trabajadores.ts` | `src/routes/workers.ts` |
| `src/rutas/usuarios.ts` | `src/routes/users.ts` |
| `scripts/crear-admin.ts` | `scripts/create-admin.ts` |
| `scripts/migrar.ts` | `scripts/migrate.ts` |
| `test/ayudas.ts` | `test/helpers.ts` |
| `test/auditoria.test.ts` | `test/audit-log.test.ts` |
| `test/cargos.test.ts` | `test/positions.test.ts` |
| `test/catalogos.test.ts` | `test/catalogs.test.ts` |
| `test/grupos.test.ts` | `test/groups.test.ts` |
| `test/metodos-pago.test.ts` | `test/payment-methods.test.ts` |
| `test/permisos.test.ts` | `test/permissions.test.ts` |
| `test/primer-admin.test.ts` | `test/first-admin.test.ts` |
| `test/salud.test.ts` | `test/health.test.ts` |
| `test/trabajadores.test.ts` | `test/workers.test.ts` |
| `test/usuarios.test.ts` | `test/users.test.ts` |
| `test/verificar.test.ts` | `test/verify.test.ts` |
| `drizzle/0000_inicial.sql` y `drizzle/meta/` | `drizzle/0000_initial.sql` y `drizzle/meta/` (generados de nuevo) |

Sin cambio de nombre: `src/app.ts`, `src/env.ts`, `src/server.ts`, `src/auth/admin.ts`, `src/auth/middleware.ts`, `src/db/client.ts`, `src/db/schema.ts`, `test/auth.test.ts`, `test/env.test.ts`.

### Frontend (`frontend/src/`)

Lista tomada del commit `f49ddd7`. La tanda final del plan 1B todavía agrega archivos; la tarea 4 empieza con un inventario para nombrar los que falten.

| Antes | Después |
|---|---|
| `components/campo.tsx` | `components/field.tsx` |
| `components/catalogo.tsx` | `components/catalog.tsx` |
| `components/marco-acceso.tsx` | `components/auth-frame.tsx` |
| `components/paginador.tsx` | `components/paginator.tsx` |
| `components/proveedores.tsx` | `components/providers.tsx` |
| `components/error-con-reintento.tsx` (lo agrega la tanda final) | `components/error-with-retry.tsx` |
| `components/trabajadores/` | `components/workers/` |
| `components/trabajadores/formulario.tsx` | `components/workers/worker-form.tsx` |
| `components/trabajadores/grupos-trabajador.tsx` | `components/workers/worker-groups.tsx` |
| `components/trabajadores/metodos-pago.tsx` | `components/workers/payment-methods.tsx` |
| `lib/auditoria.ts` | `lib/audit-log.ts` |
| `lib/cambio-de-usuario.ts` | `lib/user-change.ts` |
| `lib/catalogo-valores.ts` | `lib/catalog-values.ts` |
| `lib/catalogos.ts` | `lib/catalogs.ts` |
| `lib/cliente-consultas.ts` | `lib/query-client.ts` |
| `lib/entorno.ts` | `lib/env.ts` |
| `lib/errores-acceso.ts` | `lib/auth-errors.ts` |
| `lib/formato.ts` | `lib/format.ts` |
| `lib/paginas.ts` | `lib/pagination.ts` |
| `lib/recuperacion.ts` | `lib/recovery.ts` |
| `lib/respuesta-sesion.ts` | `lib/session-response.ts` |
| `lib/sesion-vencida.ts` | `lib/expired-session.ts` |
| `lib/sesion.ts` | `lib/session.ts` |
| `lib/supabase/navegador.ts` | `lib/supabase/browser.ts` |
| `lib/trabajador-vista.ts` | `lib/worker-view.ts` |
| `lib/validar-clave.ts` | `lib/validate-password.ts` |
| `lib/valor-retrasado.ts` | `lib/debounced-value.ts` |
| `lib/yo.ts` | `lib/me.ts` |
| `app/recuperar/` | `app/forgot-password/` |
| `app/restablecer/` | `app/reset-password/` |
| `app/(panel)/perfil/` | `app/(panel)/profile/` |
| `app/(panel)/trabajadores/` | `app/(panel)/workers/` |
| `app/(panel)/trabajadores/nuevo/` | `app/(panel)/workers/new/` |
| `app/(panel)/configuracion/` | `app/(panel)/settings/` |
| `app/(panel)/configuracion/auditoria/` | `app/(panel)/settings/audit-log/` |
| `app/(panel)/configuracion/campanas/` | `app/(panel)/settings/campaigns/` |
| `app/(panel)/configuracion/cargos/` | `app/(panel)/settings/positions/` |
| `app/(panel)/configuracion/grupos/` | `app/(panel)/settings/groups/` |
| `app/(panel)/configuracion/turnos/` | `app/(panel)/settings/shifts/` |
| `app/(panel)/configuracion/usuarios/` | `app/(panel)/settings/users/` |

Cada `x.test.ts` se mueve junto a su módulo con el mismo nombre nuevo. Sin cambio de nombre: `lib/api.ts`, `lib/utils.ts`, `proxy.ts`, `components/panel/menu.tsx`, `app/login/`, `app/(panel)/settings/areas/`, `app/layout.tsx`, `app/globals.css`.

---

### Task 1: Backend: archivos, identificadores, entorno y scripts

Renombra lo interno del backend. No cambia nada que viaje por la red ni que se guarde en la base: nombres de tablas y columnas, claves JSON, rutas, parámetros, códigos de error y valores enum se quedan como están hasta la tarea 2. Por eso el frontend sigue compilando al terminar esta tarea.

**Files:**
- Move: todos los archivos de la tabla "Backend" de arriba, menos `drizzle/`.
- Modify: todos los `.ts` de `backend/src`, `backend/scripts` y `backend/test`; `backend/package.json`; `backend/.env.example`; `.github/workflows/ci.yml`; `README.md`.

**Interfaces:**
- Consumes: nada.
- Produces: los nombres de la tabla de identificadores de abajo. La tarea 2 los usa tal cual.

- [ ] **Step 1: Mover los archivos**

```bash
cd backend
git mv src/tipos.ts src/types.ts
git mv src/auth/primer-admin.ts src/auth/first-admin.ts
git mv src/auth/verificar.ts src/auth/verify.ts
git mv src/lib/auditoria.ts src/lib/audit.ts
git mv src/lib/errores.ts src/lib/errors.ts
git mv src/lib/paginacion.ts src/lib/pagination.ts
git mv src/lib/validar.ts src/lib/validate.ts
git mv src/rutas src/routes
git mv src/routes/auditoria.ts src/routes/audit-log.ts
git mv src/routes/cargos.ts src/routes/positions.ts
git mv src/routes/catalogos.ts src/routes/catalogs.ts
git mv src/routes/grupos.ts src/routes/groups.ts
git mv src/routes/metodos-pago.ts src/routes/payment-methods.ts
git mv src/routes/trabajadores.ts src/routes/workers.ts
git mv src/routes/usuarios.ts src/routes/users.ts
git mv scripts/crear-admin.ts scripts/create-admin.ts
git mv scripts/migrar.ts scripts/migrate.ts
git mv test/ayudas.ts test/helpers.ts
git mv test/auditoria.test.ts test/audit-log.test.ts
git mv test/cargos.test.ts test/positions.test.ts
git mv test/catalogos.test.ts test/catalogs.test.ts
git mv test/grupos.test.ts test/groups.test.ts
git mv test/metodos-pago.test.ts test/payment-methods.test.ts
git mv test/permisos.test.ts test/permissions.test.ts
git mv test/primer-admin.test.ts test/first-admin.test.ts
git mv test/salud.test.ts test/health.test.ts
git mv test/trabajadores.test.ts test/workers.test.ts
git mv test/usuarios.test.ts test/users.test.ts
git mv test/verificar.test.ts test/verify.test.ts
cd ..
```

- [ ] **Step 2: Renombrar los identificadores exportados y sus usos**

| Antes | Después | Archivo |
|---|---|---|
| `crearApp` | `createApp` | `src/app.ts` |
| `Dependencias` | `Dependencies` | `src/types.ts` |
| `Entorno` | `AppEnv` | `src/types.ts` |
| `UsuarioSesion` | `SessionUser` | `src/types.ts` |
| `Rol` | `Role` | `src/types.ts` |
| `AuthAdmin.crearUsuario(correo, clave)` | `AuthAdmin.createUser(email, password)` | `src/types.ts` |
| `AuthAdmin.eliminarUsuario(id)` | `AuthAdmin.deleteUser(id)` | `src/types.ts` |
| `Dependencias.verificarToken` | `Dependencies.verifyToken` | `src/types.ts` |
| `Dependencias.origenPanel` | `Dependencies.panelOrigin` | `src/types.ts` |
| `crearAuthAdminSupabase` | `createSupabaseAuthAdmin` | `src/auth/admin.ts` |
| `autenticar` | `authenticate` | `src/auth/middleware.ts` |
| `requiereRol` | `requireRole` | `src/auth/middleware.ts` |
| `crearPrimerAdmin` | `createFirstAdmin` | `src/auth/first-admin.ts` |
| `crearVerificador` | `createVerifier` | `src/auth/verify.ts` |
| `crearVerificadorSupabase` | `createSupabaseVerifier` | `src/auth/verify.ts` |
| `ERRORES_DE_TOKEN` | `TOKEN_ERRORS` | `src/auth/verify.ts` |
| `crearDb`, que devuelve `{ db, cerrar }` | `createDb`, que devuelve `{ db, close }` | `src/db/client.ts` |
| `leerEnv` | `readEnv` | `src/env.ts` |
| `registrarAuditoria` | `recordAudit` | `src/lib/audit.ts` |
| `ErrorApi` | `ApiError` | `src/lib/errors.ts` |
| `noEncontrado` | `notFound` | `src/lib/errors.ts` |
| `manejarError` | `handleError` | `src/lib/errors.ts` |
| `codigoPostgres` | `postgresCode` | `src/lib/errors.ts` |
| `esquemaPagina` | `pageSchema` | `src/lib/pagination.ts` |
| `Pagina` | `PageParams` | `src/lib/pagination.ts` |
| `desplazamiento` | `offsetOf` | `src/lib/pagination.ts` |
| `paginado` | `paginated` | `src/lib/pagination.ts` |
| `validar` | `validate` | `src/lib/validate.ts` |
| `esquemaId` | `idSchema` | `src/lib/validate.ts` |
| `conAlgunCampo` | `withAtLeastOneField` | `src/lib/validate.ts` |
| `rutasMe` | `meRoutes` | `src/routes/me.ts` |
| `rutasAuditoria` | `auditLogRoutes` | `src/routes/audit-log.ts` |
| `rutasAreas`, `rutasTurnos`, `rutasCampanas` | `areasRoutes`, `shiftsRoutes`, `campaignsRoutes` | `src/routes/catalogs.ts` |
| `rutasCargos` | `positionsRoutes` | `src/routes/positions.ts` |
| `exigirTarifas` | `requireRates` | `src/routes/positions.ts` |
| `rutasTrabajadores` | `workersRoutes` | `src/routes/workers.ts` |
| `alcance` | `workerScope` | `src/routes/workers.ts` |
| `buscarTrabajador` | `findWorker` | `src/routes/workers.ts` |
| `rutasMetodosPago` | `paymentMethodsRoutes` | `src/routes/payment-methods.ts` |
| `rutasGrupos` | `groupsRoutes` | `src/routes/groups.ts` |
| `rutasUsuarios` | `usersRoutes` | `src/routes/users.ts` |
| `areasDe`, `fijarAreas` | `areasOf`, `setAreas` | `src/routes/users.ts` |
| `USUARIOS` | `USERS` | `test/helpers.ts` |
| `crearPrueba` | `createTestApp` | `test/helpers.ts` |
| `pedir(rol, metodo, ruta, cuerpo)` | `request(role, method, path, body)` | `test/helpers.ts` |
| `creadosEnAuth`, `eliminadosEnAuth` | `createdInAuth`, `deletedInAuth` | `test/helpers.ts` |

En `src/types.ts`, la variable de contexto de Hono `usuario` (`c.get('usuario')`, `c.set('usuario', …)`, `Variables: { usuario }`) pasa a `user`.

No se tocan en esta tarea: los nombres exportados por `src/db/schema.ts` y sus claves, los nombres de los esquemas Zod cuyas claves son parte del contrato (se renombran en la tarea 2 junto con sus claves), ni las propiedades `codigo` y `campo` de `ApiError`.

- [ ] **Step 3: Renombrar variables locales, parámetros y comentarios**

Toda variable local, parámetro y comentario de `backend/src`, `backend/scripts` y `backend/test` pasa a inglés. Equivalencias de los nombres que más se repiten:

| Antes | Después |
|---|---|
| `fila`, `filas` | `row`, `rows` |
| `datos` | `data` (o `input` cuando es el cuerpo validado) |
| `antes`, `despues` | `before`, `after` |
| `nuevo`, `nueva` | `created` |
| `condicion` | `condition` |
| `filtros`, `f` | `filters`, `filters` |
| `cabecera`, `identidad` | `header`, `identity` |
| `usuario`, `yo` | `user`, `me` |
| `resultado`, `respuesta`, `cuerpo` | `result`, `response`, `body` |
| `problema`, `causa`, `mensaje` | `issue`, `cause`, `message` |
| `existente`, `existentes`, `asignadas` | `existing`, `existing`, `assigned` |
| `quitados`, `siguiente` | `removed`, `next` |
| `cliente`, `emisor`, `claves`, `faltan` | `client`, `issuer`, `keys`, `missing` |
| `texto`, `idOpcional`, `monto`, `hora`, `fecha`, `nombre` (ayudantes Zod) | `text`, `optionalId`, `amount`, `time`, `date`, `name` |
| `errorLimpieza` | `cleanupError` |
| `siguienteAuthId` | `nextAuthId` |

Los `describe` e `it` de las pruebas se traducen al inglés conservando lo que afirman (por ejemplo `'responde 404 en JSON cuando la ruta no existe'` → `'answers 404 as JSON when the route does not exist'`). Los correos de prueba `<rol>@prueba.test` y `choque@prueba.test` pasan a `<rol>@example.test` y `conflict@example.test`.

Los textos que la API devuelve al usuario (`'Inicia sesión para continuar'`, `noEncontrado('El trabajador')`) no cambian. Los `console.error` y `console.log` sí pasan a inglés (`'API en http://…'` → `'API listening on http://…'`, `'Migraciones aplicadas'` → `'Migrations applied'`, `'Administrador creado: …'` → `'Administrator created: …'`, y el texto de uso de `create-admin`).

- [ ] **Step 4: Variables de entorno**

En `backend/src/env.ts`, `ORIGEN_PANEL` pasa a `PANEL_ORIGIN` y `PUERTO` a `PORT`; `esquema` pasa a `schema`. El mensaje de error pasa a `Invalid or missing environment variables: …`. Actualizar `backend/src/server.ts`, `backend/test/env.test.ts` y `backend/.env.example`:

```dotenv
# "Session pooler" connection string of the Supabase project (Connect → Session pooler).
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://<ref>.supabase.co
# Secret key of the project (sb_secret_… or service_role). Never goes in the frontend.
SUPABASE_SECRET_KEY=
PANEL_ORIGIN=http://localhost:3000
PORT=8787
```

Si existe un `backend/.env` local, no está versionado: avisar a Gonzalo en el reporte de que debe renombrar ahí las dos variables.

- [ ] **Step 5: Scripts de npm, CI y README**

`backend/package.json`, bloque `scripts`:

```json
{
  "dev": "tsx watch --env-file=.env src/server.ts",
  "test": "vitest run",
  "typecheck": "tsc --noEmit",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "tsx --env-file=.env scripts/migrate.ts",
  "create-admin": "tsx --env-file=.env scripts/create-admin.ts"
}
```

En `.github/workflows/ci.yml`, el job `verificar` pasa a `verify`. En `README.md` se actualizan los comandos (`db:migrate`, `db:generate`, `create-admin`) y los nombres `PANEL_ORIGIN` y `PORT`; la prosa sigue en español.

- [ ] **Step 6: Verificar**

Run: `npm run typecheck && npm test`
Expected: sin errores de tipos en los dos workspaces; backend con 148 pruebas en verde y frontend con el mismo total que la línea base.

Run: `git ls-files backend | grep -Ei 'rutas|tipos|errores|paginacion|validar|auditoria|trabajador|usuario|cargo|grupo|catalogos|metodos|ayudas|salud|primer|migrar|crear|verificar|permisos'`
Expected: sin salida. (`backend/drizzle/0000_inicial.sql` se regenera en la tarea 2.)

- [ ] **Step 7: Commit**

```bash
git add -A backend .github README.md
git commit -m "refactor(api): rename backend files, identifiers, env vars and scripts to English"
```

---

### Task 2: Backend: modelo de datos y contrato de la API

Pasa a inglés lo que se guarda y lo que viaja: tablas, columnas, enums, rutas, parámetros, claves JSON, formato y códigos de error, y los valores que escribe la auditoría. Al terminar, el backend queda en verde por sí solo y **el frontend no compila** hasta la tarea 3; es lo esperado.

**Files:**
- Modify: `backend/src/db/schema.ts` (reemplazo completo), todos los archivos de `backend/src/routes/`, `backend/src/app.ts`, `backend/src/types.ts`, `backend/src/auth/*.ts`, `backend/src/lib/*.ts`, todos los de `backend/test/`.
- Delete y generar de nuevo: `backend/drizzle/`.

**Interfaces:**
- Consumes: los nombres de la tarea 1.
- Produces: el contrato de la sección 17 del spec ("Tablas y columnas", "Valores enum", "API"). Las tareas 3 a 5 dependen de él.

- [ ] **Step 1: Reemplazar `backend/src/db/schema.ts`**

```ts
import { sql } from 'drizzle-orm'
import {
  boolean, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const roleEnum = pgEnum('user_role', ['admin', 'management', 'accounting', 'coordinator'])
export const employmentTypeEnum = pgEnum('employment_type', ['temporary', 'contract'])
export const workerStatusEnum = pgEnum('worker_status', ['active', 'terminated'])
export const payTypeEnum = pgEnum('pay_type', ['hourly', 'monthly'])
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['yape', 'plin', 'bank_account'])
export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete'])

// id = the user's id in Supabase Auth
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const areas = pgTable('areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const userAreas = pgTable(
  'user_areas',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').notNull().references(() => areas.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.areaId] })],
).enableRLS()

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  payType: payTypeEnum('pay_type').notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 4, mode: 'number' }),
  overtimeRate: numeric('overtime_rate', { precision: 10, scale: 4, mode: 'number' }),
  monthlySalary: numeric('monthly_salary', { precision: 10, scale: 2, mode: 'number' }),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  temporary: boolean('temporary').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const workers = pgTable(
  'workers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dni: text('dni'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    areaId: uuid('area_id').references(() => areas.id),
    positionId: uuid('position_id').references(() => positions.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    employmentType: employmentTypeEnum('employment_type').notNull(),
    hireDate: date('hire_date'),
    status: workerStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('workers_dni_unique').on(t.dni), index('workers_area_idx').on(t.areaId)],
).enableRLS()

export const groupWorkers = pgTable(
  'group_workers',
  {
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.workerId] })],
).enableRLS()

export const workerPaymentMethods = pgTable(
  'worker_payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    type: paymentMethodTypeEnum('type').notNull(),
    number: text('number').notNull(),
    bank: text('bank'),
    cci: text('cci'),
    holderName: text('holder_name').notNull(),
    // "primary" is a reserved word in SQL, hence the is_ prefix.
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('worker_payment_methods_primary_unique').on(t.workerId).where(sql`is_primary`)],
).enableRLS()

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    action: auditActionEnum('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entity, t.entityId)],
).enableRLS()
```

- [ ] **Step 2: Generar de nuevo la migración inicial**

```bash
git rm -r -q backend/drizzle
npm run db:generate -w @agrosalas/backend -- --name initial
```

Expected: se crean `backend/drizzle/0000_initial.sql` y `backend/drizzle/meta/`.

Run: `grep -c 'ENABLE ROW LEVEL SECURITY' backend/drizzle/0000_initial.sql`
Expected: `11`

Run: `grep -ciE 'usuario|trabajador|cargo|grupo|turno|campana|auditoria|nombre|creado' backend/drizzle/0000_initial.sql`
Expected: `0`

- [ ] **Step 3: Actualizar primero las pruebas del contrato**

En `backend/test/health.test.ts`, la lista de tablas esperada pasa a:

```ts
expect(rows.map((r) => r.tablename)).toEqual([
  'areas',
  'audit_log',
  'campaigns',
  'group_workers',
  'groups',
  'positions',
  'shifts',
  'user_areas',
  'users',
  'worker_payment_methods',
  'workers',
])
```

y las dos comprobaciones de error pasan a:

```ts
const r = await p.request(null, 'GET', '/health')
// …
expect(r.json.error.code).toBe('not_found')
// …
expect(await response.json()).toEqual({ error: { code: 'internal', message: 'Error interno' } })
```

En el resto de `backend/test/` se cambian rutas, claves, valores y códigos según las tablas de los pasos 4 a 7. `test/permissions.test.ts` lista a mano las rutas y los campos de dinero y de banco: las rutas pasan a las nuevas y los campos a `hourlyRate`, `overtimeRate`, `monthlySalary`, `paymentMethods`, `number`, `bank`, `cci`, `holderName`. En `test/helpers.ts`, `USERS` usa los roles nuevos como claves (`admin`, `management`, `accounting`, `coordinator`), que siguen siendo los tokens de prueba.

Run: `npm test -w @agrosalas/backend`
Expected: FAIL. Fallan las pruebas que piden rutas, claves o códigos que el código todavía no tiene.

- [ ] **Step 4: Rutas, parámetros y claves de entrada**

En `backend/src/app.ts`:

```ts
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
```

y `/salud` pasa a `/health`. Subrutas: `/:id/metodos-pago` → `/:id/payment-methods`, `/:id/metodos-pago/:metodoId` → `/:id/payment-methods/:methodId`, `/:id/miembros` → `/:id/members`, `/:id/miembros/:trabajadorId` → `/:id/members/:workerId`.

Esquemas Zod (nombre del esquema y sus claves):

| Antes | Después |
|---|---|
| `editarPerfil { nombre }` | `updateProfile { name }` |
| `crearArea { nombre }`, `editarArea { …, activo }` | `createArea { name }`, `updateArea { …, active }` |
| `crearTurno { nombre, horaInicio, horaFin }`, `editarTurno` | `createShift { name, startTime, endTime }`, `updateShift` |
| `crearCampana { nombre, fechaInicio, fechaFin }`, `editarCampana` | `createCampaign { name, startDate, endDate }`, `updateCampaign` |
| `datosCargo { nombre, tipoPago, tarifaHora, tarifaHoraExtra, sueldoMensual }`, `editarCargo` | `positionInput { name, payType, hourlyRate, overtimeRate, monthlySalary }`, `updatePosition` |
| `crearTrabajador { dni, nombres, apellidos, telefono, correo, direccion, emergenciaNombre, emergenciaTelefono, areaId, cargoId, turnoId, modalidad, fechaIngreso, notas }`, `editarTrabajador { …, estado }` | `createWorker { dni, firstName, lastName, phone, email, address, emergencyContactName, emergencyContactPhone, areaId, positionId, shiftId, employmentType, hireDate, notes }`, `updateWorker { …, status }` |
| filtros de trabajadores `{ pagina, tamano, texto, areaId, modalidad, estado }` | `{ page, pageSize, search, areaId, employmentType, status }` |
| `datosMetodo { tipo, numero, banco, cci, titular, principal }`, `editarMetodo`, `idsMetodo { id, metodoId }` | `paymentMethodInput { type, number, bank, cci, holderName, isPrimary }`, `updatePaymentMethod`, `paymentMethodIds { id, methodId }` |
| `crearGrupo { nombre, temporal, fechaInicio, fechaFin }`, `editarGrupo { …, activo }` | `createGroup { name, temporary, startDate, endDate }`, `updateGroup { …, active }` |
| `agregarMiembros { trabajadorIds }`, `idsMiembro { id, trabajadorId }` | `addMembers { workerIds }`, `memberIds { id, workerId }` |
| `crearUsuario { correo, clave, nombre, rol, areaIds }`, `editarUsuario { nombre, rol, activo, areaIds }` | `createUser { email, password, name, role, areaIds }`, `updateUser { name, role, active, areaIds }` |
| filtro de auditoría `{ pagina, tamano, entidad }` | `{ page, pageSize, entity }` |
| `pageSchema { pagina, tamano }` | `pageSchema { page, pageSize }` |

Los mensajes de validación escritos a mano (`'El DNI debe tener 8 dígitos'`, `'Usa el formato HH:MM'`) no cambian. El `campo` que acompaña a un `ApiError` lleva el nombre nuevo de la clave (`'hourlyRate'`, `'monthlySalary'`, `'isPrimary'`, `'email'`, `'areaIds'`).

- [ ] **Step 5: Claves de salida**

| Antes | Después |
|---|---|
| `{ datos }` (listas sin paginar) | `{ items }` |
| `{ datos, total, pagina, tamano }` | `{ items, total, page, pageSize }` |
| `SessionUser { id, correo, nombre, rol, areaIds }` | `SessionUser { id, email, name, role, areaIds }` |
| ficha del trabajador `{ …, metodosPago, grupoIds }` | `{ …, paymentMethods, groupIds }` |
| grupo en la lista `{ …, miembros }` (número) y en el detalle `{ …, miembros }` (lista) | `{ …, members }` en los dos, con el mismo tipo que hoy |
| fila de auditoría `{ …, usuarioNombre }` | `{ …, userName }` |
| `{ ok: true }` | sin cambio |

Las filas que salen de la base toman las claves nuevas de `schema.ts` sin más cambios.

- [ ] **Step 6: Formato y códigos de error**

En `backend/src/lib/errors.ts`, `ApiError` pasa a:

```ts
export class ApiError extends Error {
  status: ContentfulStatusCode
  code: string
  field?: string

  constructor(status: ContentfulStatusCode, code: string, message: string, field?: string) {
    super(message)
    this.status = status
    this.code = code
    this.field = field
  }
}
```

y toda respuesta de error usa `{ error: { code, message, field } }`, también la de `validate` en `src/lib/validate.ts` y la de `notFound` en `src/app.ts`. Códigos:

| Antes | Después |
|---|---|
| `no_autenticado` | `unauthenticated` |
| `sin_acceso` | `access_denied` |
| `sin_permiso` | `forbidden` |
| `no_encontrado` | `not_found` |
| `validacion` | `validation` |
| `solicitud_invalida` | `invalid_request` |
| `referencia_invalida` | `invalid_reference` |
| `duplicado` | `duplicate` |
| `usuario_auth` | `auth_provider_error` |
| `interno` | `internal` |

El texto de `message` no cambia. El `console.error` de `handleError` pasa a `console.error('Unexpected error:', { name, postgresCode, message })`.

- [ ] **Step 7: Valores que guarda la auditoría**

`recordAudit(db, userId, action, entity, entityId, before, after)`: `action` es `'create' | 'update' | 'delete'` y `entity` es el nombre nuevo de la tabla (`'users'`, `'areas'`, `'shifts'`, `'campaigns'`, `'positions'`, `'groups'`, `'workers'`, `'worker_payment_methods'`). En `src/routes/groups.ts`, `{ agregados: trabajadorIds }` pasa a `{ added: workerIds }` y `{ quitado: trabajadorId }` a `{ removed: workerId }`.

- [ ] **Step 8: Verificar el backend**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores de tipos; 148 pruebas en verde.

Run: `git grep -nwE 'datos|pagina|tamano|codigo|mensaje|campo|correo|nombre|rol|activo|trabajadores|usuarios|cargos|grupos|turnos|campanas|auditoria|metodosPago|tarifaHora|sueldoMensual|modalidad|estado' -- backend/src backend/test backend/scripts`
Expected: ninguna coincidencia fuera de textos en español que se muestran al usuario.

No ejecutar `npm run typecheck` en la raíz: el frontend no compila hasta la tarea 3.

- [ ] **Step 9: Commit**

```bash
git add -A backend
git commit -m "refactor(api)!: rename tables, columns, routes, JSON keys and error codes to English"
```

---

### Task 3: Frontend: consumir el contrato en inglés

Hace que el frontend vuelva a compilar contra la API de la tarea 2. Solo toca lo que es contrato: llamadas, claves JSON, valores enum, formato y códigos de error. Los archivos y componentes siguen con su nombre en español hasta la tarea 4.

**Files:**
- Modify: todos los archivos de `frontend/src` que llaman a `api.v1…` o leen sus respuestas; `frontend/src/lib/api.ts`; `frontend/src/lib/auditoria.ts` y su prueba; `frontend/src/lib/yo.ts`; `frontend/src/lib/trabajador-vista.ts`; las pruebas que usan valores del contrato.

**Interfaces:**
- Consumes: el contrato de la tarea 2 (sección 17 del spec).
- Produces: `FIELD_LABEL` y `VALUE_LABEL` en `frontend/src/lib/auditoria.ts` (la tarea 4 mueve el archivo a `lib/audit-log.ts`).

- [ ] **Step 1: Llamadas a la API**

| Antes | Después |
|---|---|
| `api.v1.trabajadores`, `[':id']` | `api.v1.workers`, `[':id']` |
| `api.v1.trabajadores[':id']['metodos-pago'][':metodoId']` | `api.v1.workers[':id']['payment-methods'][':methodId']` |
| `api.v1.grupos[':id'].miembros[':trabajadorId']` | `api.v1.groups[':id'].members[':workerId']` |
| `api.v1.cargos` | `api.v1.positions` |
| `api.v1.turnos` | `api.v1.shifts` |
| `api.v1.campanas` | `api.v1.campaigns` |
| `api.v1.usuarios` | `api.v1.users` |
| `api.v1.auditoria` | `api.v1['audit-log']` |
| `api.v1.areas`, `api.v1.me` | sin cambio |

Parámetros de consulta, cuerpos y respuestas usan las claves de los pasos 4 y 5 de la tarea 2 (`page`, `pageSize`, `search`, `items`, `firstName`, `paymentMethods`, …). TypeScript marca cada uso que falta: `npm run typecheck -w @agrosalas/frontend` es la lista de pendientes.

- [ ] **Step 2: Formato y códigos de error en `frontend/src/lib/api.ts`**

El tipo del cuerpo de error pasa a `{ error: { code: string; message: string; field?: string } }` y la clase del cliente guarda `code` y `field`. Códigos propios del cliente: `'sin_conexion'` → `'network_error'`, `'desconocido'` → `'unknown'`. En el resto del frontend: `e.codigo === 'duplicado'` → `e.code === 'duplicate'`, `'no_autenticado'` → `'unauthenticated'`, y todo `.campo` → `.field`. El tipo `ResultadoEnlace` de `lib/recuperacion.ts` pasa a `'recovery' | 'invalid' | 'network_error'`.

- [ ] **Step 3: Valores enum y sus etiquetas**

Todo valor enum del contrato pasa al inglés y su etiqueta sigue en español:

| Dónde | Antes | Después |
|---|---|---|
| `lib/yo.ts` | `ETIQUETA_ROL { admin, gerencia, contabilidad, coordinador }` | mismas etiquetas, claves `admin`, `management`, `accounting`, `coordinator` |
| `lib/trabajador-vista.ts` | `type Rol`, `TIPO_METODO { yape, plin, cuenta_bancaria }` | claves `yape`, `plin`, `bank_account`; roles nuevos |
| `configuracion/usuarios/page.tsx` | `['coordinador', 'contabilidad', 'gerencia', 'admin']` | `['coordinator', 'accounting', 'management', 'admin']` |
| `configuracion/cargos/page.tsx` | `'por_hora'`, `'mensual'` | `'hourly'`, `'monthly'` |
| `trabajadores/page.tsx`, `components/trabajadores/formulario.tsx` | `'temporal'`, `'contrato'`, `'activo'`, `'cesado'` | `'temporary'`, `'contract'`, `'active'`, `'terminated'` |
| `components/trabajadores/metodos-pago.tsx` | `'cuenta_bancaria'` | `'bank_account'` |

- [ ] **Step 4: Escribir la prueba de las etiquetas de auditoría**

Agregar a `frontend/src/lib/auditoria.test.ts`:

```ts
describe('audit summary labels', () => {
  it('shows field names and enum values in Spanish', () => {
    expect(
      resumenCambio('update', { payType: 'hourly', hourlyRate: 6 }, { payType: 'monthly', hourlyRate: 7 }),
    ).toBe('Tipo de pago: Por hora → Mensual; Tarifa por hora: 6 → 7')
  })

  it('masks sensitive fields under their new names', () => {
    expect(resumenCambio('update', { phone: '987654321' }, { phone: '912345678' })).toBe(
      'Teléfono: ••••4321 → ••••5678',
    )
  })

  it('falls back to the raw key when a field has no label', () => {
    expect(resumenCambio('create', null, { somethingNew: 'x' })).toBe('somethingNew: x')
  })
})
```

Las pruebas que ya existen en ese archivo se actualizan a las acciones (`'create'`, `'update'`, `'delete'`), a las claves nuevas y a las etiquetas en español del resultado.

Run: `npx vitest run src/lib/auditoria.test.ts` (desde `frontend/`)
Expected: FAIL. Las tres pruebas nuevas fallan porque el resumen todavía muestra la clave tal cual.

- [ ] **Step 5: Etiquetas en `frontend/src/lib/auditoria.ts`**

Reemplazar el contenido del archivo. Si la tanda final del plan 1B lo cambió después del commit `f49ddd7`, conservar esos cambios y aplicar encima los nombres y las etiquetas.

```ts
export const ETIQUETA_ENTIDAD: Record<string, string> = {
  workers: 'Trabajadores',
  worker_payment_methods: 'Métodos de pago',
  users: 'Usuarios',
  positions: 'Cargos',
  groups: 'Grupos',
  areas: 'Áreas',
  shifts: 'Turnos',
  campaigns: 'Campañas',
}

export const FIELD_LABEL: Record<string, string> = {
  name: 'Nombre',
  email: 'Correo',
  role: 'Rol',
  active: 'Activo',
  areaIds: 'Áreas',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',
  payType: 'Tipo de pago',
  hourlyRate: 'Tarifa por hora',
  overtimeRate: 'Tarifa por hora extra',
  monthlySalary: 'Sueldo mensual',
  temporary: 'Temporal',
  dni: 'DNI',
  firstName: 'Nombres',
  lastName: 'Apellidos',
  phone: 'Teléfono',
  address: 'Dirección',
  emergencyContactName: 'Contacto de emergencia',
  emergencyContactPhone: 'Teléfono de emergencia',
  areaId: 'Área',
  positionId: 'Cargo',
  shiftId: 'Turno',
  employmentType: 'Modalidad',
  hireDate: 'Fecha de ingreso',
  status: 'Estado',
  notes: 'Notas',
  workerId: 'Trabajador',
  type: 'Tipo',
  number: 'Número',
  bank: 'Banco',
  cci: 'CCI',
  holderName: 'Titular',
  isPrimary: 'Principal',
  added: 'Agregados',
  removed: 'Quitado',
}

// Enum values of the contract, by field. Anything missing here is shown as it comes.
export const VALUE_LABEL: Record<string, Record<string, string>> = {
  role: { admin: 'Administrador', management: 'Gerencia', accounting: 'Contabilidad', coordinator: 'Coordinador' },
  employmentType: { temporary: 'Temporal', contract: 'Contrato' },
  status: { active: 'Activo', terminated: 'Cesado' },
  payType: { hourly: 'Por hora', monthly: 'Mensual' },
  type: { yape: 'Yape', plin: 'Plin', bank_account: 'Cuenta bancaria' },
}

const IGNORED = new Set(['id', 'createdAt', 'updatedAt'])
// Personal and bank data: the audit log only shows the last characters.
const SENSITIVE = new Set(['dni', 'phone', 'address', 'emergencyContactPhone', 'number', 'cci'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const label = (key: string) => FIELD_LABEL[key] ?? key

function show(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (SENSITIVE.has(key)) return text.length <= 4 ? '••••' : `••••${text.slice(-4)}`
  return VALUE_LABEL[key]?.[text] ?? text
}

// Readable summary of an audit row. It never returns the full JSON or complete personal data.
export function resumenCambio(action: 'create' | 'update' | 'delete', before: unknown, after: unknown): string {
  if (action === 'update' && isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !IGNORED.has(k))
    const changes = keys
      .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map((k) => `${label(k)}: ${show(k, before[k])} → ${show(k, after[k])}`)
    return changes.length > 0 ? changes.join('; ') : 'Sin cambios'
  }

  const row = action === 'delete' ? before : action === 'create' ? after : (after ?? before)
  if (!isObject(row)) return '—'
  const fields = Object.entries(row)
    .filter(([k, v]) => !IGNORED.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => `${label(k)}: ${show(k, v)}`)
  return fields.length > 0 ? fields.join('; ') : '—'
}
```

En `configuracion/auditoria/page.tsx`, el mapa `ACCION` conserva sus textos (`'Creó'`, `'Editó'`, `'Eliminó'`) y cambia sus claves a `create`, `update` y `delete`.

Run: `npx vitest run src/lib/auditoria.test.ts` (desde `frontend/`)
Expected: PASS

- [ ] **Step 6: Verificar todo el repo**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: sin avisos ni errores; backend 148; frontend = línea base + 3; el build lista las mismas rutas que la línea base.

- [ ] **Step 7: Commit**

```bash
git add -A frontend
git commit -m "refactor(web): consume the English API contract and label audit fields in Spanish"
```

---

### Task 4: Frontend: archivos, componentes, hooks y utilidades

Renombra lo interno del frontend. No mueve las carpetas de `app/` (son direcciones; van en la tarea 5).

**Files:**
- Move: las filas `components/…` y `lib/…` de la tabla "Frontend" del mapa de archivos, con sus pruebas.
- Modify: todos los `.ts` y `.tsx` de `frontend/src`.

**Interfaces:**
- Consumes: `FIELD_LABEL` y `VALUE_LABEL` de la tarea 3.
- Produces: los nombres de la tabla de abajo; la tarea 5 los usa.

- [ ] **Step 1: Inventario**

Run: `git ls-files frontend/src | grep -v 'components/ui/'`

Comparar con el mapa de archivos. Todo archivo o export que la tanda final del plan 1B haya agregado y no figure en este plan recibe un nombre en inglés con las mismas reglas, y se lista en el reporte de la tarea con su nombre anterior y el nuevo.

- [ ] **Step 2: Mover los archivos**

Con `git mv`, según el mapa de archivos (solo `components/` y `lib/`). Por ejemplo:

```bash
cd frontend/src
git mv components/campo.tsx components/field.tsx
git mv components/trabajadores components/workers
git mv components/workers/formulario.tsx components/workers/worker-form.tsx
git mv lib/yo.ts lib/me.ts
git mv lib/formato.ts lib/format.ts
git mv lib/formato.test.ts lib/format.test.ts
cd ../..
```

- [ ] **Step 3: Renombrar exports y sus usos**

| Antes | Después | Archivo nuevo |
|---|---|---|
| `Campo`, `claseControl` | `Field`, `controlClass` | `components/field.tsx` |
| `Catalogo` | `Catalog` | `components/catalog.tsx` |
| `MarcoAcceso` | `AuthFrame` | `components/auth-frame.tsx` |
| `Paginador` | `Paginator` | `components/paginator.tsx` |
| `Proveedores` | `Providers` | `components/providers.tsx` |
| `ErrorConReintento` | `ErrorWithRetry` | `components/error-with-retry.tsx` |
| `FormularioTrabajador`, `FichaTrabajador` | `WorkerForm`, `WorkerRecord` | `components/workers/worker-form.tsx` |
| `GruposTrabajador` | `WorkerGroups` | `components/workers/worker-groups.tsx` |
| `MetodosPago` | `PaymentMethods` | `components/workers/payment-methods.tsx` |
| `leer` | `unwrap` | `lib/api.ts` |
| `Datos` | `ResponseBody` | `lib/api.ts` |
| `ErrorApiCliente` | `ApiClientError` | `lib/api.ts` |
| `mensajeDeError` | `errorMessage` | `lib/api.ts` |
| `ETIQUETA_ENTIDAD`, `resumenCambio` | `ENTITY_LABEL`, `summarizeChange` | `lib/audit-log.ts` |
| `hayQueVaciarCache` | `shouldClearCache` | `lib/user-change.ts` |
| `camposVisibles`, `cuerpoParaEnviar`, `valorInicial` | `visibleFields`, `buildRequestBody`, `initialValue` | `lib/catalog-values.ts` |
| `CampoCatalogo`, `FilaCatalogo`, `Valor`, `Valores` | `CatalogField`, `CatalogRow`, `Value`, `Values` | `lib/catalog-values.ts` |
| `useCargos`, `useGrupos`, `useTurnos` | `usePositions`, `useGroups`, `useShifts` | `lib/catalogs.ts` |
| `crearClienteConsultas` | `createQueryClient` | `lib/query-client.ts` |
| `ErrorDeConfiguracion`, `variablesRequeridas` | `ConfigError`, `requireEnv` | `lib/env.ts` |
| `SIN_CONEXION`, `esSinConexion` | `NO_CONNECTION`, `isNetworkError` | `lib/auth-errors.ts` |
| `mensajeIngreso`, `mensajeRecuperacion`, `mensajeRestablecer`, `mensajeCambioClave`, `mensajeClaveActual` | `signInMessage`, `recoveryMessage`, `resetMessage`, `passwordChangeMessage`, `currentPasswordMessage` | `lib/auth-errors.ts` |
| `formatoSoles`, `horaExtraPropuesta`, `formatoFecha` | `formatSoles`, `suggestedOvertimeRate`, `formatDate` | `lib/format.ts` |
| `totalPaginas`, `rangoMostrado` | `totalPages`, `shownRange` | `lib/pagination.ts` |
| `comprobarEnlaceDeRecuperacion`, `AuthParaRecuperar`, `ResultadoEnlace` | `checkRecoveryLink`, `RecoveryAuth`, `LinkResult` | `lib/recovery.ts` |
| `aplicarCabeceras`, `pasarSesion`, `Cabeceras` | `applyHeaders`, `carrySession`, `HeaderMap` | `lib/session-response.ts` |
| `esSesionVencida`, `crearLimitador` | `isExpiredSession`, `createLimiter` | `lib/expired-session.ts` |
| `terminarSesion`, `useCerrarSesion` | `endSession`, `useSignOut` | `lib/session.ts` |
| `supabaseNavegador` | `supabaseBrowser` | `lib/supabase/browser.ts` |
| `Rol`, `Acceso` (`'editar' \| 'ver' \| 'ocultar'`) | `Role`, `Access` (`'edit' \| 'view' \| 'hidden'`) | `lib/worker-view.ts` |
| `puedeCrearTrabajador`, `vistaTrabajador`, `nombreOpcion`, `TIPO_METODO`, `TipoMetodo`, `descripcionMetodo` | `canCreateWorker`, `workerView`, `optionName`, `PAYMENT_METHOD_LABEL`, `PaymentMethodType`, `describePaymentMethod` | `lib/worker-view.ts` |
| `validarClaveNueva`, `hayErrores`, `ErroresClaveNueva` | `validateNewPassword`, `hasErrors`, `NewPasswordErrors` | `lib/validate-password.ts` |
| `useValorRetrasado` | `useDebouncedValue` | `lib/debounced-value.ts` |
| `useYo`, `ETIQUETA_ROL` | `useMe`, `ROLE_LABEL` | `lib/me.ts` |
| `PaginaTrabajadores`, `PaginaNuevoTrabajador`, `PaginaTrabajador` | `WorkersPage`, `NewWorkerPage`, `WorkerPage` | `app/(panel)/trabajadores/**` |
| `PaginaAreas`, `PaginaAuditoria`, `PaginaCampanas`, `PaginaCargos`, `PaginaGrupos`, `PaginaMiembrosGrupo`, `PaginaTurnos`, `PaginaUsuarios`, `PaginaConfiguracion`, `LayoutConfiguracion` | `AreasPage`, `AuditLogPage`, `CampaignsPage`, `PositionsPage`, `GroupsPage`, `GroupMembersPage`, `ShiftsPage`, `UsersPage`, `SettingsPage`, `SettingsLayout` | `app/(panel)/configuracion/**` |
| `PaginaInicio`, `LayoutPanel`, `PaginaPerfil` | `HomePage`, `PanelLayout`, `ProfilePage` | `app/(panel)/**` |
| `PaginaLogin`, `PaginaRecuperar`, `PaginaRestablecer` | `LoginPage`, `ForgotPasswordPage`, `ResetPasswordPage` | `app/**` |

El resultado de `vistaTrabajador` (`{ editarFicha, metodosPago, grupos }`) pasa a `{ canEditRecord, paymentMethods, groups }`.

- [ ] **Step 4: Props, claves de consulta y nombres locales**

| Antes | Después |
|---|---|
| props `etiqueta`, `titulo`, `soloLectura`, `puedeEditar`, `ficha`, `claveConsulta`, `visibleSi`, `derivar`, `celda`, `valor` | `label`, `title`, `readOnly`, `canEdit`, `worker`, `queryKey`, `visibleIf`, `derive`, `cell`, `value` |
| claves de consulta `'yo'`, `'trabajadores'`, `'buscar'`, `'grupos'`, `'cargos'`, `'turnos'`, `'campanas'`, `'usuarios'`, `'auditoria'` | `'me'`, `'workers'`, `'search'`, `'groups'`, `'positions'`, `'shifts'`, `'campaigns'`, `'users'`, `'audit-log'` |
| `ENLACES`, `soloAdmin` (menú), `ACCION` (auditoría), `PUBLICAS` (proxy) | `LINKS`, `adminOnly`, `ACTION_LABEL`, `PUBLIC_PATHS` |
| `ids` de formulario como `metodo-numero` | `method-number` |

Las claves de consulta se cambian en todos los sitios a la vez (`queryKey`, `invalidateQueries`, `setQueryData`): una clave que quede en español deja de invalidarse y la pantalla muestra datos viejos.

El resto de variables locales, parámetros, tipos internos y comentarios pasa a inglés con las equivalencias del paso 3 de la tarea 1. Los `describe` e `it` de las pruebas se traducen conservando lo que afirman.

- [ ] **Step 5: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: sin avisos ni errores; los mismos totales de pruebas que al final de la tarea 3; las mismas rutas en el build.

Run: `git ls-files frontend/src/components frontend/src/lib | grep -Ei 'campo|catalogo|marco|paginador|proveedores|trabajador|formulario|metodos|auditoria|cambio|cliente|entorno|errores|formato|paginas|recuperacion|respuesta|sesion|navegador|validar|clave|valor|yo\.ts'`
Expected: sin salida.

- [ ] **Step 6: Commit**

```bash
git add -A frontend
git commit -m "refactor(web): rename frontend files, components, hooks and helpers to English"
```

---

### Task 5: Frontend: direcciones del panel

Mueve las carpetas de `app/` y actualiza todo lo que apunta a ellas.

**Files:**
- Move: las filas `app/…` de la tabla "Frontend" del mapa de archivos.
- Modify: `frontend/src/components/panel/menu.tsx`, `frontend/src/proxy.ts`, `frontend/next.config.ts`, `frontend/src/lib/session.ts`, toda página o componente con `href`, `router.push`, `router.replace` o `redirect`; `README.md`.

**Interfaces:**
- Consumes: los nombres de la tarea 4.
- Produces: las direcciones de la sección 17 del spec ("Direcciones del panel").

- [ ] **Step 1: Mover las carpetas**

```bash
cd frontend/src/app
git mv recuperar forgot-password
git mv restablecer reset-password
git mv "(panel)/perfil" "(panel)/profile"
git mv "(panel)/trabajadores" "(panel)/workers"
git mv "(panel)/workers/nuevo" "(panel)/workers/new"
git mv "(panel)/configuracion" "(panel)/settings"
git mv "(panel)/settings/auditoria" "(panel)/settings/audit-log"
git mv "(panel)/settings/campanas" "(panel)/settings/campaigns"
git mv "(panel)/settings/cargos" "(panel)/settings/positions"
git mv "(panel)/settings/grupos" "(panel)/settings/groups"
git mv "(panel)/settings/turnos" "(panel)/settings/shifts"
git mv "(panel)/settings/usuarios" "(panel)/settings/users"
cd ../../..
```

- [ ] **Step 2: Actualizar los enlaces y las redirecciones**

Run: `git grep -nE "/(recuperar|restablecer|perfil|trabajadores|configuracion|nuevo|cargos|grupos|turnos|campanas|usuarios|auditoria)" -- frontend/src frontend/next.config.ts README.md`

Cada coincidencia que sea una dirección del panel se cambia según la sección 17 del spec. Los sitios conocidos:

| Dónde | Antes | Después |
|---|---|---|
| `components/panel/menu.tsx` | `/trabajadores`, `/configuracion`, `/perfil` | `/workers`, `/settings`, `/profile` |
| `next.config.ts` (redirecciones de la tanda final) o `app/(panel)/page.tsx` y `app/(panel)/settings/page.tsx` | `/` → `/trabajadores`; `/configuracion` → `/configuracion/cargos` | `/` → `/workers`; `/settings` → `/settings/positions` |
| `app/(panel)/settings/layout.tsx` | pestañas `/configuracion/…` | `/settings/…` |
| `app/login/page.tsx` | enlace a `/recuperar` | `/forgot-password` |
| `app/forgot-password/page.tsx` | `redirectTo: …/restablecer` | `…/reset-password` |
| `app/reset-password/page.tsx` | enlace a `/recuperar` | `/forgot-password` |
| `proxy.ts` | `PUBLIC_PATHS`: `/login`, `/recuperar`, `/restablecer` | `/login`, `/forgot-password`, `/reset-password` |
| `components/workers/worker-form.tsx`, páginas de trabajadores y de grupos | `/trabajadores/…`, `/configuracion/grupos/…` | `/workers/…`, `/settings/groups/…` |

Los textos de los enlaces ("Trabajadores", "Configuración", "¿Olvidaste tu contraseña?") no cambian.

- [ ] **Step 3: README**

En la lista "Despliegue y Supabase" del `README.md` (la agrega la tanda final del plan 1B), las direcciones pasan a `/reset-password`: la URL de redirección permitida y la plantilla del correo de recuperación (`/reset-password?token_hash={{ .TokenHash }}&type=recovery`).

- [ ] **Step 4: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: sin avisos ni errores; los mismos totales de pruebas; el build lista `/login`, `/forgot-password`, `/reset-password`, `/profile`, `/workers`, `/workers/new`, `/workers/[id]`, `/settings/positions`, `/settings/groups`, `/settings/groups/[id]`, `/settings/areas`, `/settings/shifts`, `/settings/campaigns`, `/settings/users`, `/settings/audit-log`, y ninguna ruta en español.

Run (con `frontend/.env.local` presente):

```bash
npm run start -w @agrosalas/frontend -- --port 3111 &
SERVER_PID=$!
sleep 4
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3111/workers
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3111/forgot-password
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3111/trabajadores
kill $SERVER_PID
```

Expected: `307 http://localhost:3111/login` (sin sesión, el panel manda al login), `200`, y para la dirección vieja `307` hacia `/login` (sin sesión toda dirección que no es pública redirige; con sesión es un 404).

- [ ] **Step 5: Commit**

```bash
git add -A frontend README.md
git commit -m "refactor(web): rename panel URLs to English"
```

---

### Task 6: Documentación, barrido final y verificación

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-planilla-design.md` (secciones 3, 5, 9 y 10), `README.md`, `docs/superpowers/plans/2026-10-01-planilla-fase-1b-frontend.md`, este plan.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el repo listo para el PR.

- [ ] **Step 1: Poner el spec al día**

En el spec, las secciones 5 ("Modelo de datos") y 9 ("API") se reescriben con los nombres en inglés de la sección 17, y se quita el aviso "Nombres" que hoy encabeza la sección 5. En la sección 3, `usuarios` pasa a `users`. La sección 17 conserva las tablas de equivalencia: sirven para leer el Excel, el plan 1A y el plan 1B. La prosa sigue en español.

- [ ] **Step 2: Nota en el plan 1B y estado de este plan**

En `2026-10-01-planilla-fase-1b-frontend.md`, bajo "Global Constraints", agregar: `**Nombres:** este plan se ejecutó con identificadores en español; el plan 1C los pasó a inglés. El código del repo manda sobre los nombres de este texto.`

En este plan, agregar una sección "Estado de ejecución" con la fecha, los commits, los totales de pruebas y la lista de nombres que no estaban en las tablas (inventario de la tarea 4).

- [ ] **Step 3: Barrido de nombres en español**

Run: `git ls-files backend frontend .github | grep -Ei 'rutas|tipos|errores|paginacion|validar|auditoria|trabajador|usuario|cargo|grupo|turno|campana|catalogo|metodos|ayudas|salud|primer|migrar|crear|verificar|permisos|perfil|recuperar|restablecer|configuracion|nuevo|campo|marco|paginador|proveedores|formulario|navegador|sesion|entorno|formato|paginas|clave|inicial'`
Expected: sin salida.

Run: `git grep -nE "(const|let|function|type|interface|class) +[A-Za-z_]*(Trabajador|Usuario|Cargo|Grupo|Turno|Campana|Auditoria|Pagina[A-Z]|Paginas|Etiqueta|Sesion|Clave|Mensaje|Catalogo|Campo|Fila|Datos|Valor|crear|editar|eliminar|buscar|leer|fijar|validar)" -- 'backend/**/*.ts' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' ':!frontend/src/components/ui'`
Expected: sin salida.

Run: `git grep -nE "^[[:space:]]*(//|/\*|\*)" -- 'backend/**/*.ts' 'frontend/src/**/*.ts' 'frontend/src/**/*.tsx' ':!frontend/src/components/ui' | grep -wE "el|la|los|las|que|para|con|sin|del|una|según|también|aquí|así"`
Expected: sin salida (ningún comentario en español).

Si aparece algo, se renombra con las mismas reglas y se repite el paso.

- [ ] **Step 4: Verificación final**

```bash
mv frontend/.env.local /tmp/agrosalas-env-local.bak
npm ci && npm run lint && npm run typecheck && npm test && npm run build
mv /tmp/agrosalas-env-local.bak frontend/.env.local
```

Expected: todo en verde sin variables de entorno, como en CI; backend 148 pruebas; frontend = línea base + 3. Si un comando falla, restaurar igual el `.env.local` antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add -A docs README.md
git commit -m "docs: bring the spec, README and plans in line with the English naming"
```

- [ ] **Step 6: Revisión de la rama**

Pedir una revisión de toda la rama (`feat/fase-1b-frontend..refactor/english-naming`) con dos preguntas: si quedó algún nombre, comentario o prueba en español, y si algún cambio altera el comportamiento. Corregir lo que encuentre antes de abrir el PR.

---

## Fuera de este plan

- Traducir los textos del panel o los mensajes de la API: siguen en español.
- Traducir la prosa del spec, de los planes o del README.
- Los hallazgos menores que dejaron abiertos los planes 1A y 1B: no se arreglan aquí, solo se renombran.
- Una migración de renombrado para una base con datos: no existe ninguna todavía.
- Crear el proyecto Supabase y el primer administrador: es el paso 5 de "Dónde estamos y qué sigue", después de este plan.
