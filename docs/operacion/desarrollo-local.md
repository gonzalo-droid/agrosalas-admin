# Desarrollo local con Supabase en Docker

En local el panel no usa el proyecto de Supabase de la nube: usa una copia de Supabase (Postgres, Auth, Storage, Studio y bandeja de correo) que corre en Docker con la CLI oficial. La nube queda libre para producción.

## Requisitos

- Node 22 o superior.
- Docker Desktop instalado y **abierto** (el icono de la ballena debe estar quieto, sin "starting").

## Paso a paso

1. **Instalar y abrir Docker Desktop.** Descárgalo de https://www.docker.com/products/docker-desktop/ y ábrelo antes de seguir.

2. **Preparar el proyecto y levantar Supabase** (desde la raíz del repo):

   ```bash
   npm install
   npm run db:signing-key
   npm run db:start
   ```

   - `db:signing-key` crea `supabase/signing_keys.json`, la clave con la que el Supabase local firma los tokens. Es solo local, no se versiona y no sobrescribe una clave que ya existe. Se hace una sola vez.
   - `db:start` levanta los contenedores. **La primera vez descarga varias imágenes (unos GB) y puede tardar varios minutos**; las siguientes veces arranca en segundos.

3. **Copiar las claves a los `.env`.** Ejecuta `npm run db:status` y busca, en la tabla «Authentication Keys» (si la salida sale en JSON, son `SECRET_KEY` y `PUBLISHABLE_KEY`):
   - `Secret` (empieza con `sb_secret_`) va en `SUPABASE_SECRET_KEY` de `backend/.env`.
   - `Publishable` (empieza con `sb_publishable_`) va en `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de `frontend/.env.local`.

   Copia antes `backend/.env.example` a `backend/.env` y `frontend/.env.example` a `frontend/.env.local`: ya traen los valores locales (`DATABASE_URL`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_API_URL`); solo faltan esas dos claves.

4. **Crear las tablas, el bucket y tu usuario administrador:**

   ```bash
   npm run db:migrate -w @agrosalas/backend
   npm run create-evidence-bucket -w @agrosalas/backend
   npm run create-admin -w @agrosalas/backend -- <correo> "<Nombre>" "<contraseña>"
   ```

   La contraseña es solo para tu entorno local; elige la que quieras.

5. **Arrancar la API y el panel** (en dos terminales):

   ```bash
   npm run dev:api
   npm run dev:web
   ```

   Panel en http://localhost:3000 y API en http://localhost:8787. Entra con el correo y la contraseña del paso 4.

6. **Correos y base de datos.**
   - Los correos (por ejemplo, recuperar contraseña) no se envían: llegan a la bandeja local en http://127.0.0.1:54324.
   - La base se ve en Supabase Studio: http://127.0.0.1:54323 (Table Editor, SQL Editor, Authentication, Storage).

7. **Opcional: cargar el historial del Excel en local.** Con `import-excel`, igual que en el README (sección «Importar el historial del Excel»): primero la prueba en seco, revisar el resumen y solo después la carga real con `--commit --user <correo>`. Es un buen ensayo antes de hacerlo en producción.

8. **Al terminar:**

   ```bash
   npm run db:stop
   ```

   Los datos **se conservan** entre reinicios: la próxima vez basta con `npm run db:start`. Para empezar de cero (borra todos los datos locales): `npm run db:stop -- --no-backup` y vuelve a los pasos 2 a 4.

## Puertos que usa

| Servicio | Dirección |
|---|---|
| API de Supabase (Auth y Storage) | http://127.0.0.1:54321 |
| Postgres | 127.0.0.1:54322 |
| Studio | http://127.0.0.1:54323 |
| Bandeja de correo | http://127.0.0.1:54324 |
| Panel (Next.js) | http://localhost:3000 |
| API del panel (Hono) | http://localhost:8787 |

## Si algo falla

- **«Cannot connect to the Docker daemon» o «docker: command not found»:** Docker Desktop está cerrado o no está instalado. Ábrelo, espera a que termine de iniciar y repite el comando.
- **Puerto ocupado** (`port is already allocated` o similar en 54321 a 54324): otro programa (u otra copia de Supabase local) usa ese puerto. Cierra ese programa o, si es otra copia de Supabase, detenla con `supabase stop` en su carpeta. Si el ocupado es el 3000, Next elige otro puerto y las llamadas a la API fallan por CORS: libera el 3000 (`PANEL_ORIGIN` debe ser exactamente el origen del panel).
- **`db:start` se queja de `signing_keys.json`:** falta el archivo. Ejecuta `npm run db:signing-key` y vuelve a empezar.
- **La API responde 401 después de recrear Supabase con otra clave de firma:** los tokens viejos ya no valen. Cierra sesión en el panel (o borra las cookies de localhost) y entra de nuevo.
- **La clave de firma es solo local.** `supabase/signing_keys.json` contiene una clave privada que solo sirve para este Supabase en Docker: no se sube al repo (está en `.gitignore`), no se usa en producción y, si la pierdes o la borras, se genera otra con `npm run db:signing-key` (hay que volver a iniciar sesión).
- **Las claves de `db:status` cambiaron:** vuelve a copiarlas a `backend/.env` y `frontend/.env.local` y reinicia la API y el panel.
