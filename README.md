# agrosalas_admin

Panel interno de Agrosalas Perú: planilla, y más adelante inventario, compras y ventas. Es un proyecto aparte del sitio público (`agrosalas-app`).

## Estructura

- `backend/`: API REST (Hono, Zod, Drizzle). Es lo único que habla con la base de datos.
- `frontend/`: pantallas (Next.js). Solo consume la API.
- `docs/superpowers/`: specs y planes.

## Requisitos

Node 22 o superior y un proyecto Supabase (Postgres y Auth).

## Puesta en marcha

1. `npm install`
2. Copia `backend/.env.example` a `backend/.env` y complétalo. `EVIDENCE_BUCKET` es el nombre del bucket privado de las evidencias de pago (por defecto `payment-evidence`).
3. `npm run db:migrate -w @agrosalas/backend`
4. `npm run create-evidence-bucket -w @agrosalas/backend` (una vez por proyecto de Supabase, después de las migraciones: crea el bucket privado, con tope de 5 MB y solo JPG, PNG, WebP y PDF; si ya existe, actualiza esos límites)
5. `npm run create-admin -w @agrosalas/backend -- <correo> "<nombre>" "<contraseña>"`
6. `npm run dev:api` (API en http://localhost:8787)
7. Copia `frontend/.env.example` a `frontend/.env.local` y complétalo con la URL y la clave pública del proyecto Supabase y con `NEXT_PUBLIC_API_URL` (la URL de la API del paso 6).
8. `npm run dev:web` (panel en http://localhost:3000)

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
| `npm run db:generate -w @agrosalas/backend -- --name <nombre>` | Genera una migración a partir de `backend/src/db/schema.ts` |
| `npm run db:migrate -w @agrosalas/backend` | Aplica las migraciones a la base de `backend/.env` |
| `npm run create-evidence-bucket -w @agrosalas/backend` | Crea (o actualiza) el bucket privado de evidencias de pago del proyecto de `backend/.env` |
| `npm run lint` | ESLint del frontend |
| `npm run build` | Build de producción del frontend |

## Reglas

- Los permisos se aplican en la API, no en la pantalla.
- Toda tabla nueva lleva `.enableRLS()` y ninguna política: solo la API accede a la base.
- Todo cambio de datos deja una fila en `audit_log`.
- El cálculo de horas y montos vive en backend/src/payroll/calc.ts y trabaja con enteros (minutos y céntimos).
- El saldo de cada trabajador se calcula en backend/src/payroll/balance.ts: asistencia + conceptos que suman − descuentos − pagos.
- Nunca se versionan `.env` ni archivos con datos personales.
