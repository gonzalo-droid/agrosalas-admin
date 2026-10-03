# Planilla: despliegue en producción — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** El panel y la API quedan publicados en `admin.agrosalasperu.com` y `api.agrosalasperu.com`; cada push a `master` despliega solo; la base de producción se migra sola, se respalda cifrada cada día y no se pausa; el desarrollo pasa a un Supabase local en Docker.

**Architecture:** Dos proyectos de Vercel desde el mismo repo (`frontend/` con Next.js y `backend/` con Hono, que Vercel detecta por un `index.ts` con `export default`), solo despliegues de producción desde `master`. Producción usa un proyecto nuevo de Supabase en plan gratuito (`us-east-1`); el proyecto `agrosalas-admin-dev` se pausa y el desarrollo usa la CLI de Supabase en Docker. GitHub Actions aplica las migraciones al cambiar `backend/drizzle/` y hace el respaldo diario (cifrado con `age`, 30 días); un cron de Vercel consulta la base una vez al día para que Supabase no pause el proyecto.

**Tech Stack:** el del repo, más la CLI de Supabase (paquete npm `supabase`, dependencia de desarrollo), GitHub Actions, `age`, Vercel (trial de Pro; el plan lo activa Gonzalo).

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md` §3 (Entornos, Despliegue), §13 (Seguridad y respaldo), §16 punto 5. Decisiones de Gonzalo del 2026-10-03: Vercel con trial de Pro; Supabase gratis; opción A (desarrollo local con Docker, `nekomangacix` sigue activo en la nube).

**Rama:** `feat/deploy`, desde `master` (`a8b0a2d`).

## Decisiones tomadas

1. **Vercel, dos proyectos:** `agrosalas-admin-web` (raíz `frontend/`, Next.js) y `agrosalas-admin-api` (raíz `backend/`, Hono). Región de funciones `iad1` (la misma zona que Supabase `us-east-1`). Solo se construye la rama `master` (`ignoreCommand`): no hay vistas previas, porque apuntarían a la base de producción.
2. **Entrada de la API en Vercel:** `backend/index.ts` con `export default` de la app. Vercel busca primero `app.*`, `index.*` y `server.*` en la raíz del proyecto, así que `backend/index.ts` gana a `src/app.ts` (que no tiene `export default`). `src/server.ts` sigue siendo el servidor local.
3. **Conexiones a Postgres:** la API en Vercel usa el pooler en **modo transacción** (puerto 6543; el código ya usa `prepare: false`). Las migraciones y el respaldo usan el pooler en **modo sesión** (puerto 5432). Nunca la conexión directa (solo IPv6 en el plan gratuito).
4. **Migraciones:** el workflow `production-db.yml` las aplica al hacer push a `master` con cambios en `backend/drizzle/`, y también a mano (`workflow_dispatch`); el mismo job deja listo el bucket de evidencias. Regla: una migración debe ser compatible con el código anterior (agregar antes de quitar), porque Vercel puede publicar la API unos segundos antes o después.
5. **Respaldo diario:** workflow `backup.yml` a las 03:00 de Lima (08:00 UTC): `supabase db dump` (roles, esquema y datos, el método documentado por Supabase), un `.tar.gz` cifrado con la clave pública `age` de Gonzalo, guardado como artefacto de GitHub por 30 días. El repo es público: el artefacto se puede descargar, pero sin la clave privada no se puede leer. El mismo job comprueba `https://api.agrosalasperu.com/health`; si algo falla, GitHub avisa por correo.
6. **Contra la pausa de Supabase:** además del respaldo diario (que ya consulta la base), un cron de Vercel llama una vez al día a `GET /internal/keep-alive`, que hace `select 1`. La ruta exige `Authorization: Bearer <CRON_SECRET>` (Vercel envía ese encabezado cuando el proyecto tiene la variable `CRON_SECRET`).
7. **Evidencias (fotos):** el bucket no entra en el respaldo diario (lo que se respalda es la base, que dice qué se pagó, a quién y cuándo). Queda anotado como límite conocido.
8. **Correo de Auth:** el SMTP de Supabase por defecto solo envía a miembros del equipo y con un límite muy bajo, así que "Recuperar contraseña" necesita un SMTP propio. Se usa Resend (plan gratuito) con el dominio `agrosalasperu.com`; la cuenta, la clave y los DNS los pone Gonzalo.
9. **Desarrollo local:** `supabase start` levanta Postgres 17, Auth, Storage, Studio (`http://127.0.0.1:54323`) y Mailpit (`http://127.0.0.1:54324`, donde llegan los correos). Los tokens se firman con una clave ES256 local (`supabase/signing_keys.json`, ignorada por git) para que la API los valide con JWKS igual que en producción. Realtime, Edge Functions y Analytics se apagan (no se usan).
10. **Producción empieza vacía:** sin la planilla de prueba. El historial del Excel se carga después, cuando Gonzalo confirme las reglas de pago pendientes (fuera de este plan).

## Global Constraints

- Nombres de código en inglés; documentación y textos de la interfaz en español.
- Nunca se versionan `.env*` (salvo `.env.example`), `supabase/signing_keys.json`, la clave privada `age` ni el Excel; ningún nombre real de trabajador entra al repo.
- Node 22 (`engines`); Next.js 16: leer `node_modules/next/dist/docs/` antes de tocar su configuración.
- El número de pruebas no baja: backend 561, frontend 329.
- Rama `feat/deploy`; Conventional Commits; no se hace `git push`, PR ni merge sin que Gonzalo lo pida; merge commits.
- Las cuentas, los pagos, las claves secretas, las contraseñas y los DNS los pone Gonzalo; el controlador nunca escribe una contraseña ni una clave secreta en un archivo versionado.

---

### Task 1: La API en Vercel y la ruta contra la pausa

**Files:**
- Create: `backend/index.ts`, `backend/src/production.ts`, `backend/src/routes/keep-alive.ts`, `backend/test/keep-alive.test.ts`, `backend/vercel.json`, `frontend/vercel.json`
- Modify: `backend/src/server.ts`, `backend/src/env.ts`, `backend/src/types.ts` (`Dependencies`), `backend/src/app.ts`, `backend/test/helpers.ts`, `backend/test/env.test.ts`, `backend/tsconfig.json` (`include` suma `index.ts`), `backend/package.json` (scripts `db:migrate:ci` y `create-evidence-bucket:ci`), `backend/.env.example` (`CRON_SECRET`)

**Interfaces:**
- Produces: `createProductionApp(env: Env)` en `src/production.ts`; `Dependencies.cronSecret?: string`; `Env.CRON_SECRET?: string`; la ruta `GET /internal/keep-alive`; los scripts `db:migrate:ci` y `create-evidence-bucket:ci` (los mismos que `db:migrate` y `create-evidence-bucket`, sin `--env-file=.env`, porque en GitHub Actions las variables vienen del entorno). Las tareas 3 y 5 los usan.

- [ ] **Step 1: Pruebas que fallan** — `backend/test/keep-alive.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

describe('keep-alive', () => {
  it('queries the database with the cron secret', async () => {
    const t = await createTestApp()
    const response = await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer test-cron-secret-0123456789' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('answers 401 without the secret or with another one', async () => {
    const t = await createTestApp()
    expect((await t.app.request('/internal/keep-alive')).status).toBe(401)
    expect((await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
  })

  it('answers 401 when the API has no cron secret configured', async () => {
    const t = await createTestApp({ cronSecret: undefined })
    const response = await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer undefined' } })
    expect(response.status).toBe(401)
  })
})
```

`createTestApp` acepta un objeto opcional `{ cronSecret?: string }` (por defecto `'test-cron-secret-0123456789'`) y devuelve también `app` si hoy no lo hace (mirar `helpers.ts`; si ya devuelve `request`, agregar `app` al objeto devuelto). En `env.test.ts`: `CRON_SECRET` es opcional, y si viene debe tener al menos 16 caracteres.

- [ ] **Step 2: Ver que fallan** — `npm test -w @agrosalas/backend -- keep-alive env`.

- [ ] **Step 3: Implementar.**

`backend/src/routes/keep-alive.ts`:

```ts
import { timingSafeEqual } from 'node:crypto'
import { sql } from 'drizzle-orm'
import type { Context } from 'hono'
import { ApiError } from '../lib/errors'
import type { Dependencies } from '../types'

const sameSecret = (given: string, expected: string) => {
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Called once a day by the Vercel cron: one query keeps the free Supabase project from being paused.
// Vercel sends "Authorization: Bearer <CRON_SECRET>"; without that secret configured, the route never answers 200.
export const keepAlive =
  ({ db, cronSecret }: Pick<Dependencies, 'db' | 'cronSecret'>) =>
  async (c: Context) => {
    const header = c.req.header('Authorization') ?? ''
    if (!cronSecret || !sameSecret(header, `Bearer ${cronSecret}`)) {
      throw new ApiError(401, 'unauthenticated', 'No autorizado')
    }
    await db.execute(sql`select 1`)
    return c.json({ ok: true })
  }
```

`app.ts`: `.get('/internal/keep-alive', keepAlive(deps))` junto a `/health` (fuera de `/v1`, sin el middleware de sesión).

`env.ts`: `CRON_SECRET: z.string().min(16).optional()`.

`types.ts`, dentro de `Dependencies`:

```ts
  // Secret of the daily Vercel cron (GET /internal/keep-alive). Without it the route always answers 401.
  cronSecret?: string
```

`backend/src/production.ts` (todo lo que hoy arma `server.ts`, en un solo lugar):

```ts
import { createApp } from './app'
import { createSupabaseAuthAdmin } from './auth/admin'
import { createSupabaseVerifier } from './auth/verify'
import { createDb } from './db/client'
import type { Env } from './env'
import { createSupabaseEvidenceStorage } from './storage/evidence'

// The API with its real dependencies: used by the local server (src/server.ts) and by Vercel (index.ts).
export function createProductionApp(env: Env) {
  const { db } = createDb(env.DATABASE_URL)
  return createApp({
    db,
    verifyToken: createSupabaseVerifier(env.SUPABASE_URL),
    authAdmin: createSupabaseAuthAdmin(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
    panelOrigin: env.PANEL_ORIGIN,
    now: () => new Date(),
    evidence: createSupabaseEvidenceStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.EVIDENCE_BUCKET),
    cronSecret: env.CRON_SECRET,
  })
}
```

`src/server.ts` queda:

```ts
import { serve } from '@hono/node-server'
import { readEnv } from './env'
import { createProductionApp } from './production'

const env = readEnv()

serve({ fetch: createProductionApp(env).fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`)
})
```

`backend/index.ts`:

```ts
// Entry point of the API on Vercel: Vercel looks for a file that imports hono and exports the app by default
// (it checks app.*, index.* and server.* at the project root before src/). Local development uses src/server.ts.
import type { Hono } from 'hono'
import { readEnv } from './src/env'
import { createProductionApp } from './src/production'

const app: Hono = createProductionApp(readEnv())

export default app
```

Si la anotación `: Hono` no compila con el tipo que devuelve `createApp`, se usa la que compile, pero el archivo conserva un import de `hono`. La detección se confirma en el primer despliegue (paso 5.6); por si acaso, `backend/vercel.json` fija `"framework": "hono"`.

`backend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "hono",
  "regions": ["iad1"],
  "ignoreCommand": "[ \"$VERCEL_GIT_COMMIT_REF\" != \"master\" ]",
  "crons": [{ "path": "/internal/keep-alive", "schedule": "0 13 * * *" }]
}
```

`frontend/vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["iad1"],
  "ignoreCommand": "[ \"$VERCEL_GIT_COMMIT_REF\" != \"master\" ]"
}
```

(`ignoreCommand` sale con 0, que significa "no construir", en cualquier rama que no sea `master`.)

`backend/package.json`, scripts nuevos:

```json
"db:migrate:ci": "tsx scripts/migrate.ts",
"create-evidence-bucket:ci": "tsx scripts/create-evidence-bucket.ts"
```

`backend/.env.example`: agregar al final

```
# Only in production (Vercel): secret of the daily cron that keeps Supabase awake. 16 or more characters.
# CRON_SECRET=
```

- [ ] **Step 4: Verificar** — `npm run lint && npm run typecheck && npm test && npm run build` desde la raíz; además `npx tsx -e "import('./index.ts')"` desde `backend/` con variables falsas válidas (`DATABASE_URL=postgres://x@127.0.0.1:1/x SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SECRET_KEY=x`) debe importar sin errores (no conecta hasta la primera consulta).
- [ ] **Step 5: Commit** — `feat(api): run the API on Vercel with a daily keep-alive`

---

### Task 2: Desarrollo local con Supabase en Docker

**Files:**
- Create: `supabase/config.toml` (con `npx supabase init`), `docs/operacion/desarrollo-local.md`
- Modify: `package.json` (dependencia de desarrollo `supabase` y scripts), `package-lock.json`, `.gitignore`, `backend/.env.example`, `frontend/.env.example`, `README.md` (enlace a la guía)

**Interfaces:**
- Consumes: los scripts `db:migrate`, `create-evidence-bucket`, `create-admin` y `import-excel` del backend (sin cambios).
- Produces: `npm run db:start`, `npm run db:stop`, `npm run db:status`, `npm run db:signing-key`; `supabase/config.toml`. La tarea 5 los usa.

Pasos de implementación:

- `npm install -D supabase@^2 -w` en la raíz (paquete oficial de la CLI; no se instala nada global) y `npx supabase init` desde la raíz (sin generar configuración de VS Code ni de Deno).
- En `supabase/config.toml`: `project_id = "agrosalas-admin"`; `[db] major_version = 17`; `[auth] site_url = "http://localhost:3000"`, `additional_redirect_urls = ["http://localhost:3000/reset-password"]`, `enable_signup = false`, `signing_keys_path = "./signing_keys.json"`; `[realtime] enabled = false`, `[edge_runtime] enabled = false`, `[analytics] enabled = false`. Dejar Storage, Studio y la bandeja de correo (Mailpit/Inbucket, según la versión) activos con sus puertos por defecto (API 54321, DB 54322, Studio 54323, correo 54324).
- Script `db:signing-key`: genera `supabase/signing_keys.json` con una clave ES256 **dentro de un arreglo** (`[ { … } ]`), que es lo que espera `signing_keys_path`. Leer `npx supabase gen signing-key --help` de la versión instalada: si ya escribe el arreglo, usarlo tal cual; si imprime una sola clave, envolverla con un `node -e` en el mismo script. No sobrescribe un archivo que ya existe.
- `.gitignore`: `supabase/signing_keys.json` y lo que `supabase init` pida ignorar (`supabase/.temp`, `supabase/.branches`).
- Scripts de la raíz: `"db:start": "supabase start"`, `"db:stop": "supabase stop"`, `"db:status": "supabase status"`.
- `backend/.env.example` y `frontend/.env.example`: los valores locales por defecto, con comentarios en inglés, y la producción comentada aparte:
  - backend: `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`, `SUPABASE_URL=http://127.0.0.1:54321`, `SUPABASE_SECRET_KEY=` ("Secret key" de `npm run db:status`).
  - frontend: `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` ("Publishable key" de `npm run db:status`), `NEXT_PUBLIC_API_URL=http://localhost:8787`.
- `docs/operacion/desarrollo-local.md` (español), paso a paso:
  1. Instalar Docker Desktop y abrirlo.
  2. `npm install`, `npm run db:signing-key`, `npm run db:start` (la primera vez descarga imágenes).
  3. Copiar las claves de `npm run db:status` a `backend/.env` y `frontend/.env.local`.
  4. `npm run db:migrate -w @agrosalas/backend`, `npm run create-evidence-bucket -w @agrosalas/backend` y `npm run create-admin -w @agrosalas/backend -- <correo> "<Nombre>" "<contraseña>"`.
  5. `npm run dev:api` y `npm run dev:web`.
  6. Los correos (recuperar contraseña) llegan a `http://127.0.0.1:54324`; la base se ve en Studio (`http://127.0.0.1:54323`).
  7. Opcional: cargar el historial del Excel en local con `import-excel` (primero en simulación, como dice la fase 5).
  8. `npm run db:stop` al terminar; los datos se conservan entre reinicios.

  Además, una sección "Si algo falla": puerto ocupado, Docker cerrado, y que la clave de firma es solo local.

- [ ] **Step 1: Implementar** lo de arriba.
- [ ] **Step 2: Verificar sin Docker** (el implementador no tiene Docker): `npx supabase --version` responde; `npm run db:signing-key` crea un `supabase/signing_keys.json` que es un arreglo JSON con una clave `"kty": "EC"`, `"crv": "P-256"` y `"d"`, y `git status` no lo muestra; `npm run lint && npm run typecheck && npm test` siguen verdes. La prueba con `supabase start` la hace el controlador (tarea 5) cuando Gonzalo tenga Docker.
- [ ] **Step 3: Commit** — `chore(dev): run Supabase locally in Docker for development`

---

### Task 3: Migraciones y respaldo automáticos en GitHub Actions

**Files:**
- Create: `.github/workflows/production-db.yml`, `.github/workflows/backup.yml`, `docs/operacion/respaldo.md`

**Interfaces:**
- Consumes: `db:migrate:ci` y `create-evidence-bucket:ci` (tarea 1).
- Produces: el environment de GitHub `production` con los secretos `PROD_DATABASE_URL` (pooler en modo sesión, puerto 5432), `PROD_SUPABASE_URL` y `PROD_SUPABASE_SECRET_KEY`, y la variable `BACKUP_AGE_RECIPIENT` (clave pública `age`, empieza con `age1`). Los carga Gonzalo (tarea 5).

`.github/workflows/production-db.yml`:

```yaml
name: Production database

on:
  push:
    branches: [master]
    paths: ['backend/drizzle/**']
  workflow_dispatch:

concurrency:
  group: production-db
  cancel-in-progress: false

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    env:
      DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
      SUPABASE_URL: ${{ secrets.PROD_SUPABASE_URL }}
      SUPABASE_SECRET_KEY: ${{ secrets.PROD_SUPABASE_SECRET_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run db:migrate:ci -w @agrosalas/backend
      - run: npm run create-evidence-bucket:ci -w @agrosalas/backend
```

`.github/workflows/backup.yml`:

```yaml
name: Production backup

on:
  schedule:
    - cron: '0 8 * * *' # 03:00 in Lima
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      - name: Dump the database
        env:
          DB_URL: ${{ secrets.PROD_DATABASE_URL }}
        run: |
          mkdir backup
          supabase db dump --db-url "$DB_URL" -f backup/roles.sql --role-only
          supabase db dump --db-url "$DB_URL" -f backup/schema.sql
          supabase db dump --db-url "$DB_URL" -f backup/data.sql --use-copy --data-only
      - name: Encrypt
        env:
          AGE_RECIPIENT: ${{ vars.BACKUP_AGE_RECIPIENT }}
        run: |
          test -n "$AGE_RECIPIENT"
          sudo apt-get update -qq && sudo apt-get install -y -qq age
          name="agrosalas-$(date -u +%Y-%m-%d)"
          tar -czf "$name.tar.gz" -C backup .
          age -r "$AGE_RECIPIENT" -o "$name.tar.gz.age" "$name.tar.gz"
          rm -rf backup "$name.tar.gz"
          echo "BACKUP_NAME=$name" >> "$GITHUB_ENV"
      - uses: actions/upload-artifact@v4
        with:
          name: ${{ env.BACKUP_NAME }}
          path: ${{ env.BACKUP_NAME }}.tar.gz.age
          retention-days: 30
          if-no-files-found: error
      - name: Check that the API answers
        run: curl -fsS --max-time 20 https://api.agrosalasperu.com/health
```

Antes de dar por buena la parte del volcado, el implementador lee la guía de Supabase "Backup and Restore using the CLI" (`https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore`) y confirma tres cosas, ajustando los comandos si la guía vigente dice otra cosa:
- qué esquemas entran en `data.sql`; deben entrar los datos de `public` y los usuarios de `auth`, porque sin ellos nadie puede iniciar sesión tras restaurar;
- que `--db-url` funciona con el pooler en modo sesión;
- el comando exacto de restauración.

Lo que encuentre va en `respaldo.md`.

`docs/operacion/respaldo.md` (español):
- **Qué se respalda y cuándo:** la base completa, cada día a las 03:00, por 30 días. Las evidencias no entran.
- **Dónde:** artefactos del workflow "Production backup", en GitHub → Actions.
- **Crear la clave:** `brew install age` y `age-keygen -o agrosalas-respaldo.key`. La clave privada se guarda fuera del repo y de la computadora, por ejemplo en el gestor de contraseñas; la línea `public key: age1…` va a la variable `BACKUP_AGE_RECIPIENT`.
- **Restaurar:** descargar el artefacto, `age -d -i agrosalas-respaldo.key -o respaldo.tar.gz <archivo>.age`, `tar -xzf respaldo.tar.gz`, y restaurar con el comando de la guía de Supabase en un proyecto nuevo. Primero se ensaya en el Supabase local de la tarea 2.
- **Si el workflow falla:** GitHub manda un correo. Revisar el job; los motivos típicos son una clave cambiada, la base pausada o la API caída.
- **Aviso:** GitHub desactiva los workflows programados de un repo público tras 60 días sin actividad. Se reactivan con un push o con "Enable workflow" en Actions, y el cron de Vercel sigue manteniendo despierta la base mientras tanto.

- [ ] **Step 1: Implementar** los dos workflows y la guía.
- [ ] **Step 2: Verificar** — los YAML se leen sin errores con `npx --yes yaml-lint .github/workflows/*.yml` (o `node -e` con el paquete `yaml` si ese no existe), y no hay secretos ni direcciones reales de base escritos en ningún archivo. La prueba real (`workflow_dispatch`) la hace el controlador en la tarea 5, después del merge.
- [ ] **Step 3: Commit** — `ci: migrate and back up the production database`

---

### Task 4: Documentación del despliegue

**Files:**
- Create: `docs/operacion/despliegue.md`
- Modify: `docs/superpowers/specs/2026-10-01-planilla-design.md` (§3 "Entornos" y "Despliegue", §13 "Respaldo", §16 punto 5), `README.md` (enlaces a `docs/operacion/`)

`docs/operacion/despliegue.md` (español) es la guía para Gonzalo y para quien mantenga el panel:

- **Mapa:**

  | Pieza | Dónde vive |
  |---|---|
  | `admin.agrosalasperu.com` | Vercel `agrosalas-admin-web` |
  | `api.agrosalasperu.com` | Vercel `agrosalas-admin-api` |
  | Base, login y evidencias | Supabase `agrosalas-admin-prod` |
  | Migraciones y respaldo | GitHub Actions |
  | Correo | Resend |
  | DNS | Namecheap |

- **Cómo se publica una versión:** merge a `master`, y Vercel construye los dos proyectos. Si hay migraciones nuevas, las aplica "Production database". Para volver atrás: Vercel → proyecto → Deployments → "Instant Rollback".
- **Variables por proyecto:** nombre, de dónde se saca cada valor y si es secreta. Para `agrosalas-admin-api`:

  | Variable | Valor | Secreta |
  |---|---|---|
  | `DATABASE_URL` | Pooler en modo transacción, puerto 6543 | sí |
  | `SUPABASE_URL` | URL del proyecto | no |
  | `SUPABASE_SECRET_KEY` | Clave secreta del proyecto | sí |
  | `EVIDENCE_BUCKET` | `payment-evidence` | no |
  | `PANEL_ORIGIN` | `https://admin.agrosalasperu.com` | no |
  | `CRON_SECRET` | Generado con `openssl rand -hex 32` | sí |

  Para `agrosalas-admin-web`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y `NEXT_PUBLIC_API_URL=https://api.agrosalasperu.com`.

  Para el environment `production` de GitHub: los tres secretos y la variable de la tarea 3.
- **Supabase producción** (lo hace Gonzalo en el panel de Supabase):
  - Authentication → URL Configuration: Site URL `https://admin.agrosalasperu.com`, Redirect URL `https://admin.agrosalasperu.com/reset-password`.
  - Desactivar "Allow new users to sign up".
  - SMTP propio con Resend (host, puerto, usuario `resend`, clave de Resend, remitente `no-responder@agrosalasperu.com`).
- **Resend:** crear la cuenta, agregar el dominio `agrosalasperu.com` y copiar a Namecheap los registros que Resend indique (SPF, DKIM).
- **Namecheap:** los registros `CNAME` de `admin` y `api` con el valor exacto que muestre Vercel al agregar cada dominio. No se toca el registro de la web actual (`www`).
- **Primer administrador:** Gonzalo lo crea desde su computadora. Usa un `backend/.env.production` que no se versiona, con los valores de producción y el pooler en modo sesión: `npx tsx --env-file=.env.production scripts/create-admin.ts <correo> "<Nombre>" "<contraseña>"` desde `backend/`.
- **Límites del plan gratuito** y qué hacer al llegar a cada uno:
  - 1 GB de evidencias: pasar a Supabase Pro.
  - 2 proyectos activos.
  - La pausa por inactividad, que cubren el cron y el respaldo.
  - El fin del trial de Vercel Pro: decidir antes si se paga o se vuelve a Hobby, que no admite uso comercial.

Spec:
- **§3 "Entornos":** producción en Supabase gratis (`agrosalas-admin-prod`); desarrollo local con la CLI de Supabase en Docker; `agrosalas-admin-dev` pausado.
- **§3 "Despliegue":** Vercel con dos proyectos y solo `master`; se acabó el "se decide al desplegar".
- **§13 "Respaldo":** el respaldo diario cifrado de la decisión 5, más el aviso de que las evidencias no entran.
- **§16 punto 5:** resuelto el 2026-10-03.

- [ ] **Step 1: Escribir** la guía y los cambios del spec.
- [ ] **Step 2: Commit** — `docs(planilla): document the production deployment`

---

### Task 5: Poner en producción (la hace el controlador con Gonzalo)

No es una tarea de subagente. Usa los conectores de Vercel y de Supabase y necesita a Gonzalo en varios pasos. Cada paso que toca algo fuera del repo, o que no se puede deshacer, se confirma con él antes.

- [ ] **5.1 Merge** de `feat/deploy` cuando Gonzalo lo pida (PR, CI verde, merge commit).
- [ ] **5.2 Docker y desarrollo local:**
  1. Gonzalo instala Docker Desktop.
  2. El controlador sigue `docs/operacion/desarrollo-local.md` y verifica en el navegador:
     - login con un administrador local;
     - una marca de asistencia;
     - "Recuperar contraseña" llega a la bandeja local;
     - un token local pasa la validación JWKS de la API.
  3. Se detienen los servidores que apuntan a `agrosalas-admin-dev` y `backend/.env` y `frontend/.env.local` pasan a los valores locales.
- [ ] **5.3 Pausar `agrosalas-admin-dev`** (con la confirmación de Gonzalo; se puede reactivar durante 90 días).
- [ ] **5.4 Crear `agrosalas-admin-prod`** en `us-east-1`, plan gratuito, con el conector de Supabase (confirmar el costo de US$ 0). Gonzalo copia:
  - la contraseña de la base;
  - la URL del pooler en modo transacción;
  - la URL del pooler en modo sesión;
  - la clave secreta;
  - la clave publicable.

  Las claves van solo a Vercel, a GitHub y a su `backend/.env.production`.
- [ ] **5.5 GitHub:**
  1. Gonzalo crea la clave `age` y carga el environment `production` con sus secretos y la variable.
  2. El controlador lanza "Production database" (`workflow_dispatch`) y confirma con el conector de Supabase que existen las tablas con RLS y el bucket privado.
- [ ] **5.6 Vercel:**
  1. Gonzalo activa el trial de Pro y autoriza a Vercel en el repo de GitHub.
  2. El controlador crea `agrosalas-admin-api` (raíz `backend`) y `agrosalas-admin-web` (raíz `frontend`) enlazados al repo, carga las variables no secretas y deja a Gonzalo las secretas, o las carga si él las pega en la configuración de Vercel.
  3. Agrega los dominios `api.agrosalasperu.com` y `admin.agrosalasperu.com` y le pasa a Gonzalo los `CNAME` exactos para Namecheap.
- [ ] **5.7 Supabase Auth y correo:** Gonzalo configura las URLs, apaga el alta pública y conecta el SMTP de Resend (con los DNS de Resend en Namecheap).
- [ ] **5.8 Primer administrador:** Gonzalo ejecuta `create-admin` contra producción.
- [ ] **5.9 Prueba de humo en `https://admin.agrosalasperu.com`:**
  - login;
  - crear un área de prueba y borrarla;
  - "Recuperar contraseña" llega por Resend;
  - `https://api.agrosalasperu.com/health` responde;
  - `GET /internal/keep-alive` responde 401 sin el secreto;
  - el cron aparece en Vercel → Settings → Cron Jobs;
  - en Vercel → proyecto API → Settings → Cron Jobs, "Run" sobre `/internal/keep-alive` y comprobar en los logs que respondió 200 (así se nota si falta `CRON_SECRET`).
- [ ] **5.10 Respaldo:**
  1. Lanzar "Production backup" a mano y descargar el artefacto.
  2. Gonzalo lo descifra.
  3. Restaurarlo en el Supabase local y comprobar que están las tablas y el usuario administrador. Si `data.sql` no trae los usuarios de `auth`, se corrige el workflow antes de cerrar.
- [ ] **5.11 Estado de ejecución** en este plan y en la memoria del proyecto. Pendiente para después, fuera de este plan: cargar en producción el historial del Excel, cuando estén confirmadas las reglas de pago.
