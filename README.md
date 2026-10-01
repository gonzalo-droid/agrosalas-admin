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
2. Copia `backend/.env.example` a `backend/.env` y complétalo.
3. `npm run db:migrar -w @agrosalas/backend`
4. `npm run crear-admin -w @agrosalas/backend -- <correo> "<nombre>" "<contraseña>"`
5. `npm run dev:api` (API en http://localhost:8787)
6. Copia `frontend/.env.example` a `frontend/.env.local` y complétalo con la URL y la clave pública del proyecto Supabase.
7. `npm run dev:web` (panel en http://localhost:3000)

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de todos los workspaces. Las del backend usan una base en memoria: no necesitan Docker ni red. |
| `npm run typecheck` | Tipos de todos los workspaces |
| `npm run db:generar -w @agrosalas/backend -- --name <nombre>` | Genera una migración a partir de `backend/src/db/schema.ts` |
| `npm run db:migrar -w @agrosalas/backend` | Aplica las migraciones a la base de `backend/.env` |
| `npm run lint` | ESLint del frontend |
| `npm run build` | Build de producción del frontend |

## Reglas

- Los permisos se aplican en la API, no en la pantalla.
- Toda tabla nueva lleva `.enableRLS()` y ninguna política: solo la API accede a la base.
- Todo cambio de datos deja una fila en `auditoria`.
- Nunca se versionan `.env` ni archivos con datos personales.
