# Respaldo de la base de producción

Cada día, un workflow de GitHub Actions saca una copia completa de la base de producción, la cifra con una clave pública (`age`) y la guarda como artefacto. Solo quien tenga la clave privada puede abrirla.

## Qué se respalda y cuándo

- **Qué:** la base completa de Supabase: roles, estructura (tablas, funciones, políticas) y datos de `public`, de `auth` (los usuarios y sus contraseñas cifradas; sin ellos nadie podría iniciar sesión tras restaurar) y de `storage` (solo los registros de buckets y archivos, no los archivos).
- **Cuándo:** todos los días a las 03:00 hora de Lima (08:00 UTC). También se puede lanzar a mano desde Actions con «Run workflow».
- **Cuánto se guarda:** 30 días; después GitHub borra el artefacto.
- **Qué no entra:** las evidencias (los archivos que se suben al bucket). Viven en Supabase Storage y no se copian.

## Dónde están las copias

En GitHub → pestaña **Actions** → workflow **Production backup** → cada ejecución → sección **Artifacts**. El archivo se llama `agrosalas-AAAA-MM-DD.tar.gz.age`.

## Crear la clave (una sola vez)

```bash
brew install age
age-keygen -o agrosalas-respaldo.key
```

- La **clave privada** (`agrosalas-respaldo.key`) se guarda fuera del repo y fuera de la computadora, por ejemplo en el gestor de contraseñas. Si se pierde, los respaldos no se pueden abrir. Nunca se sube a GitHub.
- La línea `Public key: age1…` que imprime el comando va en GitHub → Settings → Environments → `production` → **Variables** → `BACKUP_AGE_RECIPIENT`. La clave pública no es secreta.
- Los secretos del mismo environment son `PROD_DATABASE_URL` (la cadena del *session pooler* de Supabase, puerto 5432), `PROD_SUPABASE_URL` y `PROD_SUPABASE_SECRET_KEY`.

## Restaurar

La restauración se hace en un proyecto de Supabase **nuevo** (o en el Supabase local), nunca encima del de producción en uso.

1. Descargar el artefacto desde Actions (llega dentro de un `.zip`; descomprimirlo).
2. Descifrar y abrir:

   ```bash
   age -d -i agrosalas-respaldo.key -o respaldo.tar.gz agrosalas-AAAA-MM-DD.tar.gz.age
   tar -xzf respaldo.tar.gz
   ```

   Quedan `roles.sql`, `schema.sql` y `data.sql`.
3. Restaurar con el comando de la guía de Supabase (necesita `psql`; `brew install libpq` si no lo tienes):

   ```bash
   psql \
     --single-transaction \
     --variable ON_ERROR_STOP=1 \
     --file roles.sql \
     --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql \
     --dbname "<cadena de conexión del proyecto nuevo>"
   ```

   Es la misma cadena que `PROD_DATABASE_URL` pero del proyecto nuevo (session pooler, puerto 5432).
4. Con la base restaurada, apuntar el backend al proyecto nuevo y volver a crear el bucket de evidencias (`npm run create-evidence-bucket -w @agrosalas/backend`). Las evidencias antiguas no vuelven: sus registros sí, pero los archivos no estaban en el respaldo.

**Ensayar antes de necesitarlo.** Conviene probar el procedimiento completo una vez en el Supabase local ([desarrollo local](desarrollo-local.md)): levantarlo vacío (`npm run db:stop -- --no-backup` y `npm run db:start`), restaurar con la cadena `postgresql://postgres:postgres@127.0.0.1:54322/postgres` y entrar al panel con un usuario del respaldo.

### Qué dice la guía de Supabase

Fuente: [Backup and Restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore) (consultada el 2026-10-03, CLI 2.119.0).

- **Comandos de volcado:** `supabase db dump --db-url …` tres veces: `--role-only` (roles), sin banderas (estructura) y `--use-copy --data-only` (datos). La guía vigente añade `-x "storage.buckets_vectors" -x "storage.vector_indexes"` al volcado de datos; el workflow ya lo incluye.
- **Pooler:** la guía recomienda la cadena del *session pooler* por defecto, y `--db-url` la acepta. Por eso `PROD_DATABASE_URL` es la del pooler en modo sesión (puerto 5432).
- **Esquemas en `data.sql`:** la guía no los enumera. Se comprobó en local: `data.sql` incluye `auth` (con `auth.users` e `identities`), `public`, `storage`, `drizzle` (historial de migraciones) y `supabase_functions`. Un respaldo de prueba con un usuario de ejemplo se restauró en un Supabase local vacío y el usuario volvió en `auth.users` y en `public.users`.
- **Restauración:** el `psql` de arriba, copiado de la guía. La guía avisa de que, si se cambiaron a mano disparadores o políticas RLS en `auth` o `storage`, hay que restaurarlos aparte; aquí no se tocan.

## Si el workflow falla

GitHub manda un correo. Abrir la ejecución en Actions y revisar el job. Los motivos típicos:

- La cadena `PROD_DATABASE_URL` cambió (por ejemplo, se cambió la contraseña de la base) y hay que actualizar el secreto.
- La base está pausada (Supabase pausa los proyectos gratuitos tras 7 días sin actividad) o inaccesible.
- La variable `BACKUP_AGE_RECIPIENT` falta o está mal escrita (el paso «Encrypt» falla de inmediato).
- La API no responde: el último paso consulta `https://api.agrosalasperu.com/health`. El respaldo ya quedó guardado, pero hay que revisar la API.

## Aviso: workflows programados en repos públicos

GitHub desactiva los workflows programados de un repo público tras 60 días sin actividad. Se reactivan con un push o con **Enable workflow** en Actions. Mientras tanto, el cron de Vercel sigue manteniendo despierta la base.
