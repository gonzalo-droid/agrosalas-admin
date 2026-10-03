# agrosalas_admin

Panel interno de Agrosalas Perú: planilla, y más adelante inventario, compras y ventas. Es un proyecto aparte del sitio público (`agrosalas-app`).

## Estructura

- `backend/`: API REST (Hono, Zod, Drizzle). Es lo único que habla con la base de datos.
- `frontend/`: pantallas (Next.js). Solo consume la API.
- `docs/operacion/`: guías de operación (desarrollo local, despliegue).
- `docs/superpowers/`: specs y planes.
- `supabase/`: configuración de Supabase local (CLI en Docker).

## Requisitos

Node 22 o superior y Docker Desktop (en desarrollo, Supabase corre en local con la CLI: ver [Desarrollo local](docs/operacion/desarrollo-local.md)). Producción usa un proyecto Supabase en la nube.

## Puesta en marcha

La guía paso a paso, con Supabase en Docker, está en [docs/operacion/desarrollo-local.md](docs/operacion/desarrollo-local.md). Resumen:

1. `npm install`, `npm run db:signing-key` (una vez) y `npm run db:start` (Supabase en Docker; `npm run db:status` muestra las claves).
2. Copia `backend/.env.example` a `backend/.env` y complétalo con la `Secret key` de `db:status`. `EVIDENCE_BUCKET` es el nombre del bucket privado de las evidencias de pago (por defecto `payment-evidence`).
3. `npm run db:migrate -w @agrosalas/backend`
4. `npm run create-evidence-bucket -w @agrosalas/backend` (una vez por proyecto de Supabase, después de las migraciones: crea el bucket privado, con tope de 5 MB y solo JPG, PNG, WebP y PDF; si ya existe, actualiza esos límites)
5. `npm run create-admin -w @agrosalas/backend -- <correo> "<nombre>" "<contraseña>"`
6. `npm run dev:api` (API en http://localhost:8787)
7. Copia `frontend/.env.example` a `frontend/.env.local` y complétalo con la `Publishable key` de `db:status` y con `NEXT_PUBLIC_API_URL` (la URL de la API del paso 6).
8. `npm run dev:web` (panel en http://localhost:3000)

## Importar el historial del Excel

Script de una sola vez (`backend/scripts/import-excel/`) que lee el Excel de planilla y carga sus cuatro hojas de historial (trabajadores, planillas, asistencias, conceptos y pagos). El script se lanza con `tsx --env-file=.env`, así que `backend/.env` tiene que existir aun para la prueba en seco (que no usa `DATABASE_URL`); la carga necesita el `.env` completo. El archivo `.xlsx`, el archivo de alias y el resumen tienen datos personales: se guardan fuera del repo (por ejemplo en `~/planilla/`) y se pasan por ruta; `.gitignore` ignora `*.xlsx`, `alias*.json` y `resumen*.md`.

1. **Prueba en seco** (por defecto: no lee `DATABASE_URL` y no escribe nada):
   `npm run import-excel -w @agrosalas/backend -- ~/planilla/planilla.xlsx --aliases ~/planilla/alias.json --out ~/planilla/resumen.md`
   Imprime el resumen (y lo guarda en `--out`): por hoja, el total importado frente al del Excel, los días a revisar, lo pagado y lo pendiente (calculado con lo importado), con avisos por trabajador; además los trabajadores con datos, los alias aplicados, los alias sin efecto y los nombres parecidos sin unificar. `--aliases` es un JSON `{ "nombre tal como está": "nombre unificado" }`; el valor también puede ser `"dni:<8 dígitos>"` para asignar ese nombre al trabajador existente con ese DNI. El script no trae alias propios.
2. **Carga real**, solo después de revisar el resumen y confirmar las reglas de pago:
   `npm run import-excel -w @agrosalas/backend -- ~/planilla/planilla.xlsx --aliases ~/planilla/alias.json --out ~/planilla/resumen.md --commit --user <correo>`
   Antes de escribir imprime el host de la base y el proyecto de Supabase (nunca el usuario ni la contraseña). `--user` es el correo de un administrador activo; queda en la auditoría. Todo se carga en una sola transacción: si algo falla, no se escribe nada (tampoco el `--out`). Al terminar dice qué trabajadores reutilizó y cuáles creó. Las planillas quedan cerradas.

La carga se niega, sin escribir nada, si una hoja ya se importó (existe una planilla con su nombre y asistencias con origen `excel`), si hay montos o minutos negativos, si un nombre del Excel coincide (sin tildes) con un trabajador que tiene DNI sin un alias `dni:`, si coincide con dos trabajadores sin DNI, o si un trabajador reutilizado ya tiene asistencia en una de las fechas.

## Despliegue y Supabase

Revisar en cada entorno (local, pruebas, producción):

- **Authentication → URL Configuration:** la *Site URL* es el origen del panel y las *Redirect URLs* incluyen `<origen del panel>/reset-password`.
- **Registro público desactivado** (Authentication → Sign In / Providers → *Allow new users to sign up* apagado): las cuentas solo las crea el administrador.
- **`PANEL_ORIGIN`** del backend es exactamente el origen del panel (esquema, dominio y puerto). En local el panel debe correr en ese puerto: si el 3000 está ocupado, Next elige otro y todas las llamadas a la API fallan por CORS.
- **Correo de recuperación:** se recomienda que la plantilla *Reset password* enlace a `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`. Así el enlace funciona en cualquier dispositivo; con el enlace por defecto (`?code=`) solo funciona en el mismo navegador donde se pidió.
- **SMTP propio en producción:** el envío de correos de Supabase por defecto tiene un límite muy bajo y no sirve para producción.
- **Migración inicial regenerada con los nombres en inglés:** una base migrada antes de ese cambio (con tablas como `usuarios` o `trabajadores`) hay que recrearla desde cero, y su cuenta de administrador borrarla en Authentication. Todavía no existe ninguna.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de todos los workspaces. Las del backend usan una base en memoria: no necesitan Docker ni red. |
| `npm run typecheck` | Tipos de todos los workspaces |
| `npm run db:start` / `db:stop` / `db:status` | Levanta, detiene y muestra el estado (URLs y claves) del Supabase local en Docker |
| `npm run db:signing-key` | Genera `supabase/signing_keys.json` (clave local de firma; no sobrescribe una existente) |
| `npm run db:generate -w @agrosalas/backend -- --name <nombre>` | Genera una migración a partir de `backend/src/db/schema.ts` |
| `npm run db:migrate -w @agrosalas/backend` | Aplica las migraciones a la base de `backend/.env` |
| `npm run create-evidence-bucket -w @agrosalas/backend` | Crea (o actualiza) el bucket privado de evidencias de pago del proyecto de `backend/.env` |
| `npm run import-excel -w @agrosalas/backend -- <ruta.xlsx> [opciones]` | Prueba en seco de la migración del Excel; con `--commit --user <correo>` carga el historial (ver «Importar el historial del Excel») |
| `npm run lint` | ESLint del frontend |
| `npm run build` | Build de producción del frontend |

## Reglas

- Los permisos se aplican en la API, no en la pantalla.
- Toda tabla nueva lleva `.enableRLS()` y ninguna política: solo la API accede a la base.
- Todo cambio de datos deja una fila en `audit_log`.
- El cálculo de horas y montos vive en backend/src/payroll/calc.ts y trabaja con enteros (minutos y céntimos).
- El saldo de cada trabajador se calcula en backend/src/payroll/balance.ts: asistencia + conceptos que suman − descuentos − pagos. La lista de planillas y el resumen aplican la misma regla en SQL (backend/src/routes/payrolls.ts): si cambia la regla, hay que cambiar ambos lugares a la vez.
- Nunca se versionan `.env` ni archivos con datos personales.
