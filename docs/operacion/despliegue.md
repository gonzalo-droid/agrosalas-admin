# Despliegue a producción

Guía para publicar y mantener el panel. Producción corre en Vercel (dos proyectos) y Supabase (plan gratuito). Para trabajar en local, ver [desarrollo local](desarrollo-local.md); para el respaldo, [respaldo](respaldo.md).

Las cuentas, los pagos, las claves y los DNS los pone quien administra el panel. Ninguna clave, contraseña ni cadena de conexión se escribe en el repo: viven en Vercel, GitHub y Supabase.

## Mapa

| Pieza | Dónde vive |
|---|---|
| `admin.agrosalasperu.com` | Vercel `agrosalas-admin-web` (raíz `frontend`) |
| `api.agrosalasperu.com` | Vercel `agrosalas-admin-api` (raíz `backend`) |
| Base, login y evidencias | Supabase `agrosalas-admin-prod` (región `us-east-1`) |
| Migraciones y respaldo | GitHub Actions |
| Correo | Resend |
| DNS | Namecheap |

La web de la empresa (`www.agrosalasperu.com`) es otro proyecto de Vercel y no se toca.

## Cómo se publica una versión

1. Se hace merge a `master`. Vercel construye los dos proyectos.
2. Si el merge trae migraciones nuevas (`backend/drizzle/`), el workflow **Production database** las aplica solo. También crea o actualiza el bucket privado de evidencias. Se puede lanzar a mano desde GitHub → Actions → *Production database* → *Run workflow*.
3. Las ramas que no son `master` no se publican: el `ignoreCommand` de los dos `vercel.json` salta cualquier build cuyo `VERCEL_GIT_COMMIT_REF` no sea `master`. No hay despliegues de vista previa.

**Volver atrás:** Vercel → proyecto → Deployments → un despliegue anterior → **Instant Rollback**. Revierte el código, no la base: si la versión mala trajo una migración, hay que corregirla con una migración nueva.

**Despliegue manual.** Publicar es solo por git. Un despliegue desde la CLI de Vercel no trae rama de git y el `ignoreCommand` lo saltaría. Si alguna vez hace falta uno (por ejemplo, tras cambiar variables), se usa **Redeploy** en el panel de Vercel sobre un despliegue de `master`.

**Si la API falla tras cambiar variables.** La API lee sus variables al arrancar. Si falta una o es inválida, todas las peticiones fallan desde el arranque en frío, y los *Runtime Logs* del proyecto en Vercel muestran `Invalid or missing environment variables: …` con los nombres. Es lo primero que hay que mirar. Las variables nuevas solo aplican en despliegues nuevos: hay que hacer **Redeploy**.

## Variables

### `agrosalas-admin-api`

| Variable | Valor | Secreta |
|---|---|---|
| `DATABASE_URL` | Cadena del *Transaction pooler* (puerto 6543) | sí |
| `SUPABASE_URL` | URL del proyecto (`https://<ref>.supabase.co`) | no |
| `SUPABASE_SECRET_KEY` | Clave secreta del proyecto (`sb_secret_…`) | sí |
| `EVIDENCE_BUCKET` | `payment-evidence` | no |
| `PANEL_ORIGIN` | `https://admin.agrosalasperu.com` | no |
| `CRON_SECRET` | Generado con `openssl rand -hex 32` | sí |

- `DATABASE_URL`, `SUPABASE_URL` y `SUPABASE_SECRET_KEY` se sacan de Supabase → botón **Connect** (cadenas de conexión) y Project Settings → API Keys. La cadena trae `[YOUR-PASSWORD]`: es la contraseña de la base que se eligió al crear el proyecto.
- `EVIDENCE_BUCKET` y `PANEL_ORIGIN` tienen valores por defecto pensados para local (`payment-evidence` y `http://localhost:3000`): en producción `PANEL_ORIGIN` es obligatorio ponerlo, o el navegador bloquea las llamadas por CORS. Sin barra final.
- `CRON_SECRET` (16 caracteres o más) lo usa el cron diario de Vercel: llama a `/internal/keep-alive` con `Authorization: Bearer <CRON_SECRET>` y la API hace una consulta a la base. Eso evita que Supabase pause el proyecto por inactividad. Sin el secreto, la ruta responde 401.
- `PORT` no se pone: solo lo usa el servidor local.

### `agrosalas-admin-web`

| Variable | Valor | Secreta |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | no |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Clave publicable (`sb_publishable_…`) | no (es pública) |
| `NEXT_PUBLIC_API_URL` | `https://api.agrosalasperu.com` | no |

La clave secreta nunca va en el frontend. Las variables `NEXT_PUBLIC_*` se incrustan al construir: si cambian, hay que redesplegar.

### GitHub: environment `production`

En GitHub → Settings → Environments → `production`:

| Tipo | Nombre | Valor |
|---|---|---|
| Secreto | `PROD_DATABASE_URL` | Cadena del *Session pooler* (puerto 5432) |
| Secreto | `PROD_SUPABASE_URL` | URL del proyecto |
| Secreto | `PROD_SUPABASE_SECRET_KEY` | Clave secreta del proyecto |
| Variable | `BACKUP_AGE_RECIPIENT` | Clave pública `age` (empieza con `age1`; ver [respaldo](respaldo.md)) |

Las migraciones y el respaldo usan el pooler en modo sesión (5432); la API en Vercel usa el de transacción (6543), que aguanta muchas conexiones cortas.

## Poner producción en marcha (primera vez)

En este orden:

1. **Supabase.** Crear el proyecto `agrosalas-admin-prod` en `us-east-1`, plan gratuito, y guardar la contraseña de la base. Ver «Supabase producción» más abajo.
2. **Resend y Namecheap** (correo). Ver más abajo.
3. **GitHub.** Cargar el environment `production` y generar la clave `age` (ver [respaldo](respaldo.md)).
4. **Migraciones.** Lanzar a mano **Production database** (Actions → *Run workflow*): crea las tablas con RLS y el bucket privado.
5. **Vercel.** Importar el repo dos veces:
   - `agrosalas-admin-api`: *Root Directory* `backend`; el framework se detecta como Hono.
   - `agrosalas-admin-web`: *Root Directory* `frontend`; Next.js.
   - En los dos: *Production Branch* `master`, Node.js 22.x, y dejar activado *Include source files outside of the Root Directory in the Build Step* (el frontend importa el tipo de la API del workspace `backend`).
   - Cargar las variables de cada proyecto (tablas de arriba) antes del primer despliegue.
6. **Dominios.** En cada proyecto, Settings → Domains: agregar `api.agrosalasperu.com` y `admin.agrosalasperu.com`, y poner los registros en Namecheap (abajo).
7. **Primer administrador** (abajo).
8. **Comprobar:** `https://api.agrosalasperu.com/health` responde `{"ok":true}`, y se puede entrar al panel y recuperar una contraseña.

## Supabase producción

Lo hace quien administra el panel, en el panel de Supabase del proyecto `agrosalas-admin-prod`:

- **Authentication → URL Configuration:** *Site URL* `https://admin.agrosalasperu.com` y, en *Redirect URLs*, `https://admin.agrosalasperu.com/reset-password`.
- **Registro público desactivado:** Authentication → Sign In / Providers → apagar *Allow new users to sign up*. Las cuentas las crea el administrador.
- **SMTP propio con Resend:** Authentication → Emails → SMTP Settings → activar *Enable custom SMTP*. El correo que envía Supabase por defecto tiene un límite muy bajo y no sirve en producción.

  | Campo | Valor |
  |---|---|
  | Host | `smtp.resend.com` |
  | Puerto | `465` |
  | Usuario | `resend` |
  | Contraseña | La API key de Resend (se pega aquí; no va en el repo) |
  | Correo del remitente | `no-responder@agrosalasperu.com` |
  | Nombre del remitente | `Agrosalas Perú` |

  Valores tomados de la guía de Resend para Supabase (consultada el 2026-10-03).
- **Plantilla *Reset password*:** se recomienda que el enlace sea `{{ .SiteURL }}/reset-password?token_hash={{ .TokenHash }}&type=recovery`, para que funcione en cualquier dispositivo (ver README).

## Resend

1. Crear la cuenta en resend.com.
2. Domains → *Add Domain* → `agrosalasperu.com`.
3. Resend muestra unos registros (SPF y DKIM, y a veces MX para el subdominio de envío). Copiarlos a Namecheap tal cual, y esperar a que Resend marque el dominio como *Verified*.
4. API Keys → crear una con permiso de envío y pegarla como contraseña SMTP en Supabase.

## Namecheap (DNS)

En Namecheap → Domain List → `agrosalasperu.com` → **Advanced DNS**:

- Dos registros `CNAME`: host `admin` y host `api`, cada uno con el valor exacto que Vercel muestra al agregar el dominio en su proyecto (Vercel indica el valor en Settings → Domains).
- Los registros de Resend (SPF, DKIM) tal como los dé Resend.
- **No se toca el registro de `www`** ni el de la raíz: son de la web de la empresa.

La propagación puede tardar de minutos a unas horas. Vercel emite el certificado solo, cuando el DNS ya apunta bien.

## Primer administrador

Se crea desde la computadora de quien administra, una sola vez. Se usa un archivo `backend/.env.production` (no se versiona: `.gitignore` ignora `.env.*`) con tres valores de producción:

```
DATABASE_URL=<cadena del Session pooler, puerto 5432>
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<clave secreta del proyecto>
```

Se usa el pooler en modo sesión porque este script es de un solo uso, no una API. Luego, desde `backend/`, pidiendo la contraseña con `read -s` para que no quede en el historial del shell:

```bash
cd backend
read -s "ADMIN_PASSWORD?Contraseña: "
npx tsx --env-file=.env.production scripts/create-admin.ts <correo> "<Nombre>" "$ADMIN_PASSWORD"
unset ADMIN_PASSWORD
```

`read -s` (zsh, el shell de macOS) no muestra lo que se escribe y guarda la contraseña solo en una variable del shell; el historial registra el comando con `$ADMIN_PASSWORD`, no su valor. La contraseña tiene 8 caracteres como mínimo. Al terminar, borrar `backend/.env.production`: la clave secreta no debe quedarse en el disco.

El script no usa `npm run create-admin` porque ese comando lee `backend/.env` (el de local).

## Límites del plan gratuito

| Límite | Qué hacer al llegar |
|---|---|
| 1 GB de evidencias (Storage) | Pasar a Supabase Pro. |
| 2 proyectos activos | `agrosalas-admin-dev` está pausado y no cuenta. Antes de activar otro proyecto, pausar uno o pasar a Pro. |
| Pausa por inactividad (7 días sin uso) | La cubren el cron de Vercel (consulta diaria) y el respaldo diario. Si un proyecto se pausa igual, se reanuda desde el panel de Supabase. |
| Fin del trial de Vercel Pro | Decidir antes de que termine: pagar Pro o volver a Hobby, que no admite uso comercial. |

Los números de Supabase pueden cambiar: conviene revisar la página de precios vigente al decidir.

## Si algo falla

| Síntoma | Qué mirar |
|---|---|
| La API responde 500 en todo | Runtime Logs de `agrosalas-admin-api`: `Invalid or missing environment variables: …`. |
| El panel dice que no puede conectar con la API | `NEXT_PUBLIC_API_URL` y, en la API, `PANEL_ORIGIN` (exacto, con `https://` y sin barra final). Es CORS. |
| No llega el correo de recuperar contraseña | SMTP de Supabase y dominio *Verified* en Resend; el nombre del remitente tiene que ser del dominio verificado. |
| El merge no se publicó | El `ignoreCommand`: solo se construye `master`. Revisar la rama del despliegue en Vercel. |
| Falla *Production database* | Revisar el job en Actions; casi siempre es `PROD_DATABASE_URL` (contraseña cambiada o pooler equivocado). |
