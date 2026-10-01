# Planilla fase 1A: API base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando y probada la API del panel: login con roles, catálogos (áreas, turnos, campañas, cargos con tarifas, grupos), trabajadores con métodos de pago, usuarios y auditoría.

**Architecture:** Repo con npm workspaces. `backend/` es una API REST con Hono; `crearApp(deps)` recibe la base de datos, el verificador de tokens y el cliente de administración de usuarios, de modo que las pruebas inyectan una base PGlite en memoria y dobles de prueba, sin Docker ni red. Supabase aporta Postgres y Auth; la API es lo único que toca la base. El frontend (plan 1B) consume esta API con el cliente tipado de Hono.

**Tech Stack:** Node ≥ 22, npm workspaces, TypeScript, Hono 4, Zod 4, @hono/zod-validator, Drizzle ORM 0.45 + drizzle-kit 0.31, postgres.js, PGlite (solo pruebas), jose 6, @supabase/supabase-js 2, Vitest 5, tsx.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md` (secciones 3, 4, 5, 9, 13, 14 y fase 1 de la sección 15).

**Plan hermano:** `docs/superpowers/plans/2026-10-01-planilla-fase-1b-frontend.md` (pantallas). Se ejecuta después de este.

## Global Constraints

- Los permisos se aplican en el backend. Para el coordinador, la API no envía campos de dinero ni datos bancarios; no basta con ocultarlos en pantalla.
- RLS activado en todas las tablas y sin políticas: toda tabla nueva lleva `.enableRLS()`.
- Toda creación, edición o eliminación escribe una fila en `auditoria` dentro de la misma transacción.
- Formato único de error: `{ "error": { "codigo", "mensaje", "campo?" } }`, con mensajes en español.
- Toda lista paginada recibe `pagina` y `tamano` (máximo 100) y devuelve `{ datos, total, pagina, tamano }`.
- Rutas bajo `/v1`; las rutas se encadenan (`new Hono().get(...).post(...)`) para que el cliente tipado del frontend infiera los tipos.
- El backend solo usa imports relativos (sin alias), porque el frontend importa sus tipos.
- Identificadores del dominio en español (`trabajadores`, `crearApp`, `tarifaHora`).
- Las pruebas no necesitan Docker, red ni variables de entorno.
- El DNI es obligatorio al crear un trabajador desde la API; en la base puede ser nulo (migrados del Excel).
- Rama de trabajo `feat/fase-1-base`; commits con Conventional Commits y scope (`feat(api): …`). Nunca se versiona `.env` ni el Excel de planilla.
- Los comandos se ejecutan desde la raíz del repo (`/Volumes/Neko/webs/agrosalas_admin`) salvo que se indique otra carpeta.

## Estado de verificación

El código de este plan se ejecutó completo en una carpeta temporal el 2026-10-01 con las versiones del `package.json` de la tarea 1: 61 pruebas en verde, `tsc --noEmit` sin errores y el servidor respondiendo en `/salud`. Si una versión más nueva de una librería rompe algo, fija la versión indicada antes de cambiar el código.

npm 11 puede mostrar avisos `npm warn install-scripts` (esbuild, unrs-resolver). No impiden nada; se pueden ignorar.

## Estado de ejecución (2026-10-01)

Ejecutado en la rama `feat/fase-1-base` (tareas 1 a 11 y 13). La tarea 12 queda pendiente: la hace Gonzalo. La suite tiene 148 pruebas, no las 61 que anuncian los pasos de abajo.

**El código del repo manda sobre los bloques de código de este plan.** Las revisiones por tarea y la revisión final encontraron defectos en el código del propio plan, y se corrigieron. Diferencias respecto del texto de abajo:

| Dónde | Qué cambió y por qué |
|---|---|
| `backend/src/lib/errores.ts` | `manejarError` también responde 400 `solicitud_invalida` a las excepciones de Hono (cuerpo que no es JSON) y 400 `referencia_invalida` a una clave foránea inexistente (Postgres 23503). Los errores 500 se registran sin la consulta ni sus parámetros, que pueden traer DNI y cuentas. |
| `backend/src/lib/validar.ts` | Configura el locale español de Zod; omite `campo` cuando el error no es de un campo; exporta `conAlgunCampo(esquema)`, que hace que un PATCH con cuerpo vacío responda 400 en lugar de 500. Todos los esquemas de edición lo usan. |
| `backend/src/auth/verificar.ts` | Devuelve `null` solo para errores de validez del token (lista explícita de clases de jose); si no puede leer las claves públicas, relanza el error (500) en vez de responder 401 a todos. |
| `backend/src/rutas/auditoria.ts`, `trabajadores.ts` | El orden de las listas paginadas termina con `id` como desempate; sin él, la paginación repetía y saltaba filas. |
| `backend/src/rutas/grupos.ts` | El esquema de edición es explícito y sin valores por defecto (en Zod 4, `.partial()` conservaba `temporal: false` y lo pisaba al editar). `GET /:id` solo devuelve al coordinador los miembros de sus áreas. Quitar a quien no es miembro responde 404 y no escribe auditoría. |
| `backend/src/rutas/usuarios.ts`, `backend/src/auth/admin.ts`, `backend/src/tipos.ts` | Las áreas se validan antes de crear la cuenta de login; si la base falla después, la cuenta se elimina (`AuthAdmin.eliminarUsuario`). Los errores del proveedor se responden en español: 409 solo si el correo ya existe, 502 en otro caso. Un PATCH solo con `areaIds` ya no falla. |
| `backend/src/auth/primer-admin.ts` (nuevo), `backend/scripts/crear-admin.ts` | El alta del primer administrador escribe auditoría y limpia la cuenta de login si falla; el script solo llama a `crearPrimerAdmin`. |
| `backend/src/env.ts` | Quita la barra final de `SUPABASE_URL` y `ORIGEN_PANEL`; `PUERTO` debe estar entre 1 y 65535. |
| `backend/test/permisos.test.ts` (nuevo) | Matriz rol × ruta (403 en cada combinación prohibida) y barrido que comprueba que el coordinador no recibe montos ni datos bancarios en ningún GET. |

Pendiente para el plan de la fase 2 (lo dejó anotado la revisión final): decidir entre esquemas de salida por rol o un ayudante común de redacción (el spec pide validar también la salida); dinero en enteros en el cálculo; qué pasa si la forma de pago del cargo no coincide con la modalidad del trabajador; regla de fechas fin ≥ inicio; búsqueda de trabajadores sin acentos.

Hallazgos menores que quedaron abiertos (ninguno bloquea el plan 1B):

- `GET /v1/grupos` muestra al coordinador el número total de miembros de cada grupo, incluidos los de otras áreas (solo la cifra, no las personas).
- La búsqueda de trabajadores distingue acentos, no busca "nombre apellido" junto y no escapa `%` ni `_`.
- `areaIds` repetidos al crear un usuario dan un 409 confuso; el correo no se pasa a minúsculas.
- Un cargo que cambia de sueldo mensual a pago por hora conserva el sueldo anterior; los montos con más de cuatro decimales se redondean sin avisar.
- La API devuelve las horas de turno como `HH:MM:SS` pero solo acepta `HH:MM`.
- Los campos de texto opcionales guardan `''` en lugar de nulo si se les manda una cadena vacía.
- No se valida que la fecha de fin sea posterior a la de inicio (campañas, grupos).
- Un método de pago de tipo cuenta bancaria no exige banco; marcar `principal: false` se rechaza aunque el método no sea el principal.
- El log de un error 500 ya no trae la consulta, pero el mensaje del motor puede incluir un valor suelto, y ya no se registra la traza.
- La matriz de permisos y el barrido del coordinador listan rutas y nombres de campo a mano: una ruta o un campo de dinero nuevo hay que añadirlo a `backend/test/permisos.test.ts`.
- El backend no tiene ESLint; `npm audit` reporta cuatro avisos moderados de una cadena solo de desarrollo (drizzle-kit → esbuild). No ejecutar `npm audit fix --force`: degrada drizzle-kit.
- El servidor no cierra la conexión al recibir SIGTERM, no limita el tamaño del cuerpo y faltan índices secundarios; se resuelve al desplegar o con la migración de la fase 2.
- Tres commits hechos por subagentes llevan la firma "Claude Haiku 4.5", que es el modelo que los escribió.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json`, `.gitignore` | Workspace raíz y scripts comunes |
| `backend/src/db/schema.ts` | Tablas y enums de la fase 1 |
| `backend/drizzle/` | Migraciones SQL generadas por drizzle-kit |
| `backend/src/tipos.ts` | Tipos compartidos: `Db`, `Tx`, `Rol`, `UsuarioSesion`, `Entorno`, `AuthAdmin`, `Dependencias` |
| `backend/src/lib/errores.ts` | `ErrorApi`, `noEncontrado`, `manejarError` |
| `backend/src/lib/validar.ts` | `validar` (Zod con el formato de error de la API), `esquemaId` |
| `backend/src/lib/paginacion.ts` | `esquemaPagina`, `desplazamiento`, `paginado` |
| `backend/src/lib/auditoria.ts` | `registrarAuditoria` |
| `backend/src/auth/middleware.ts` | `autenticar`, `requiereRol` |
| `backend/src/auth/verificar.ts` | Verificación del token de Supabase (JWKS) |
| `backend/src/auth/admin.ts` | Alta de usuarios en Supabase Auth |
| `backend/src/rutas/*.ts` | Un archivo por recurso: `me`, `auditoria`, `catalogos`, `cargos`, `trabajadores`, `metodos-pago`, `grupos`, `usuarios` |
| `backend/src/app.ts` | `crearApp(deps)` y el tipo `AppType` |
| `backend/src/env.ts`, `backend/src/db/client.ts`, `backend/src/server.ts` | Arranque real: entorno, conexión y servidor |
| `backend/scripts/migrar.ts`, `backend/scripts/crear-admin.ts` | Migraciones y primer administrador |
| `backend/test/ayudas.ts` | `crearPrueba()`: base PGlite migrada, un usuario por rol y `pedir()` |
| `backend/test/*.test.ts` | Una prueba por recurso |

Endpoints que quedan al terminar:

| Ruta | Métodos | Quién |
|---|---|---|
| `/salud` | GET | Sin sesión |
| `/v1/me` | GET, PATCH | Cualquier usuario activo |
| `/v1/auditoria` | GET | Administrador |
| `/v1/areas`, `/v1/turnos`, `/v1/campanas` | GET (todos); POST, PATCH `/:id` (administrador) | |
| `/v1/cargos` | GET (todos; el coordinador sin montos); POST, PATCH `/:id` (administrador) | |
| `/v1/trabajadores` | GET, GET `/:id` (el coordinador solo sus áreas); POST, PATCH `/:id` (administrador, contabilidad) | |
| `/v1/trabajadores/:id/metodos-pago` | POST, PATCH `/:metodoId`, DELETE `/:metodoId` (administrador, contabilidad) | |
| `/v1/grupos` | GET, GET `/:id` (todos); POST, PATCH `/:id` (administrador); POST `/:id/miembros`, DELETE `/:id/miembros/:trabajadorId` (administrador, contabilidad) | |
| `/v1/usuarios` | GET, POST, PATCH `/:id` | Administrador |

---

### Task 1: Repo, esquema de base de datos y arnés de pruebas

**Files:**
- Create: `package.json`, `.gitignore`
- Create: `backend/package.json`, `backend/tsconfig.json`, `backend/vitest.config.ts`, `backend/drizzle.config.ts`
- Create: `backend/src/db/schema.ts`, `backend/drizzle/0000_inicial.sql` (generado)
- Create: `backend/src/tipos.ts`, `backend/src/lib/errores.ts`, `backend/src/app.ts`
- Test: `backend/test/ayudas.ts`, `backend/test/salud.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `crearApp(deps: Dependencias)` devuelve la app Hono; `AppType = ReturnType<typeof crearApp>`.
  - `Dependencias = { db: Db; verificarToken(token): Promise<{ sub: string } | null>; authAdmin: AuthAdmin; origenPanel: string }`.
  - `ErrorApi(status, codigo, mensaje, campo?)`, `noEncontrado(que)`, `manejarError(err, c)`.
  - `crearPrueba()` devuelve `{ app, db, pedir, creadosEnAuth }`; `pedir(rol | null, metodo, ruta, cuerpo?)` devuelve `{ status, json }`. En las pruebas el token es el nombre del rol. `USUARIOS[rol]` es el id de cada usuario semilla.
  - Tablas Drizzle exportadas desde `schema.ts`: `usuarios`, `usuarioAreas`, `areas`, `turnos`, `campanas`, `cargos`, `grupos`, `grupoTrabajadores`, `trabajadores`, `trabajadorMetodosPago`, `auditoria`.

- [ ] **Step 1: Crear la rama de trabajo**

```bash
git switch -c feat/fase-1-base
```

- [ ] **Step 2: Crear el workspace raíz**

`package.json`:

```json
{
  "name": "agrosalas-admin",
  "private": true,
  "workspaces": ["backend"],
  "scripts": {
    "dev:api": "npm run dev -w @agrosalas/backend",
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "engines": { "node": ">=22" }
}
```

`.gitignore`:

```gitignore
node_modules/
.env
.env.*
!.env.example
.next/
out/
*.tsbuildinfo
next-env.d.ts
.DS_Store
.vercel
# El Excel de planilla tiene datos personales: nunca va al repo.
*.xlsx
```

- [ ] **Step 3: Crear `backend/package.json` e instalar**

```json
{
  "name": "@agrosalas/backend",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./app": "./src/app.ts"
  },
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "db:generar": "drizzle-kit generate",
    "db:migrar": "tsx --env-file=.env scripts/migrar.ts",
    "crear-admin": "tsx --env-file=.env scripts/crear-admin.ts"
  },
  "dependencies": {
    "@hono/node-server": "^2.1.3",
    "@hono/zod-validator": "^0.9.1",
    "@supabase/supabase-js": "^2.117.2",
    "drizzle-orm": "^0.45.3",
    "hono": "^4.13.12",
    "jose": "^6.2.12",
    "postgres": "^3.4.9",
    "zod": "^4.6.5"
  },
  "devDependencies": {
    "@electric-sql/pglite": "^0.5.8",
    "@types/node": "^26.6.3",
    "drizzle-kit": "^0.31.11",
    "tsx": "^4.23.15",
    "typescript": "^7.0.2",
    "vitest": "^5.0.3"
  }
}
```

```bash
npm install
```

Expected: termina sin errores y crea `package-lock.json` y `node_modules/` en la raíz.

- [ ] **Step 4: Configurar TypeScript, Vitest y drizzle-kit**

`backend/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"]
  },
  "include": ["src", "test", "scripts", "drizzle.config.ts", "vitest.config.ts"]
}
```

`backend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 30000,
  },
})
```

`backend/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
```

- [ ] **Step 5: Escribir el arnés y la prueba que falla**

`backend/test/ayudas.ts`:

```ts
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { crearApp } from '../src/app'
import * as schema from '../src/db/schema'
import type { Rol } from '../src/tipos'

// Un usuario por rol. En las pruebas, el token es el nombre del rol.
export const USUARIOS: Record<Rol, string> = {
  admin: '00000000-0000-4000-8000-000000000001',
  gerencia: '00000000-0000-4000-8000-000000000002',
  contabilidad: '00000000-0000-4000-8000-000000000003',
  coordinador: '00000000-0000-4000-8000-000000000004',
}

export async function crearPrueba() {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  await db.insert(schema.usuarios).values(
    (Object.keys(USUARIOS) as Rol[]).map((rol) => ({
      id: USUARIOS[rol],
      correo: `${rol}@prueba.test`,
      nombre: `Usuario ${rol}`,
      rol,
    })),
  )

  let siguienteAuthId = 100
  const creadosEnAuth: { id: string; correo: string }[] = []

  const app = crearApp({
    db,
    verificarToken: async (token) => (token in USUARIOS ? { sub: USUARIOS[token as Rol] } : null),
    authAdmin: {
      async crearUsuario(correo) {
        const id = `00000000-0000-4000-8000-${String(siguienteAuthId++).padStart(12, '0')}`
        creadosEnAuth.push({ id, correo })
        return { id }
      },
    },
    origenPanel: 'http://localhost:3000',
  })

  // pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
  async function pedir(rol: Rol | null, metodo: string, ruta: string, cuerpo?: unknown) {
    const respuesta = await app.request(ruta, {
      method: metodo,
      headers: {
        ...(rol ? { Authorization: `Bearer ${rol}` } : {}),
        ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await respuesta.json()
    return { status: respuesta.status, json }
  }

  return { app, db, pedir, creadosEnAuth }
}
```

`backend/test/salud.test.ts`:

```ts
import { sql } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('salud', () => {
  it('responde sin token', async () => {
    const r = await p.pedir(null, 'GET', '/salud')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
  })

  it('responde 404 en JSON cuando la ruta no existe', async () => {
    const r = await p.pedir(null, 'GET', '/no-existe')
    expect(r.status).toBe(404)
    expect(r.json.error.codigo).toBe('no_encontrado')
  })
})

describe('migraciones', () => {
  it('crean las tablas de la fase 1 con RLS activado', async () => {
    const resultado = await p.db.execute(
      sql`select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename`,
    )
    const filas = resultado.rows as { tablename: string; rowsecurity: boolean }[]
    expect(filas.map((f) => f.tablename)).toEqual([
      'areas',
      'auditoria',
      'campanas',
      'cargos',
      'grupo_trabajadores',
      'grupos',
      'trabajador_metodos_pago',
      'trabajadores',
      'turnos',
      'usuario_areas',
      'usuarios',
    ])
    expect(filas.every((f) => f.rowsecurity)).toBe(true)
  })
})
```

- [ ] **Step 6: Ejecutar la prueba y verla fallar**

Run: `npm test -w @agrosalas/backend`
Expected: FAIL, no encuentra `../src/app` ni `../src/db/schema`.

- [ ] **Step 7: Escribir el esquema**

`backend/src/db/schema.ts`:

```ts
import { sql } from 'drizzle-orm'
import {
  boolean, date, index, jsonb, numeric, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

const marcas = {
  creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  actualizadoEn: timestamp('actualizado_en', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const rolEnum = pgEnum('rol', ['admin', 'gerencia', 'contabilidad', 'coordinador'])
export const modalidadEnum = pgEnum('modalidad', ['temporal', 'contrato'])
export const estadoTrabajadorEnum = pgEnum('estado_trabajador', ['activo', 'cesado'])
export const tipoPagoEnum = pgEnum('tipo_pago', ['por_hora', 'mensual'])
export const tipoMetodoPagoEnum = pgEnum('tipo_metodo_pago', ['yape', 'plin', 'cuenta_bancaria'])
export const accionAuditoriaEnum = pgEnum('accion_auditoria', ['crear', 'editar', 'eliminar'])

// id = id del usuario en Supabase Auth
export const usuarios = pgTable('usuarios', {
  id: uuid('id').primaryKey(),
  correo: text('correo').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const areas = pgTable('areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const usuarioAreas = pgTable(
  'usuario_areas',
  {
    usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').notNull().references(() => areas.id),
  },
  (t) => [primaryKey({ columns: [t.usuarioId, t.areaId] })],
).enableRLS()

export const turnos = pgTable('turnos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  horaInicio: time('hora_inicio').notNull(),
  horaFin: time('hora_fin').notNull(),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const campanas = pgTable('campanas', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const cargos = pgTable('cargos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  tipoPago: tipoPagoEnum('tipo_pago').notNull(),
  tarifaHora: numeric('tarifa_hora', { precision: 10, scale: 4, mode: 'number' }),
  tarifaHoraExtra: numeric('tarifa_hora_extra', { precision: 10, scale: 4, mode: 'number' }),
  sueldoMensual: numeric('sueldo_mensual', { precision: 10, scale: 2, mode: 'number' }),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const grupos = pgTable('grupos', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull().unique(),
  temporal: boolean('temporal').notNull().default(false),
  fechaInicio: date('fecha_inicio'),
  fechaFin: date('fecha_fin'),
  activo: boolean('activo').notNull().default(true),
  ...marcas,
}).enableRLS()

export const trabajadores = pgTable(
  'trabajadores',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dni: text('dni'),
    nombres: text('nombres').notNull(),
    apellidos: text('apellidos').notNull(),
    telefono: text('telefono'),
    correo: text('correo'),
    direccion: text('direccion'),
    emergenciaNombre: text('emergencia_nombre'),
    emergenciaTelefono: text('emergencia_telefono'),
    areaId: uuid('area_id').references(() => areas.id),
    cargoId: uuid('cargo_id').references(() => cargos.id),
    turnoId: uuid('turno_id').references(() => turnos.id),
    modalidad: modalidadEnum('modalidad').notNull(),
    fechaIngreso: date('fecha_ingreso'),
    estado: estadoTrabajadorEnum('estado').notNull().default('activo'),
    notas: text('notas'),
    ...marcas,
  },
  (t) => [uniqueIndex('trabajadores_dni_unico').on(t.dni), index('trabajadores_area_idx').on(t.areaId)],
).enableRLS()

export const grupoTrabajadores = pgTable(
  'grupo_trabajadores',
  {
    grupoId: uuid('grupo_id').notNull().references(() => grupos.id, { onDelete: 'cascade' }),
    trabajadorId: uuid('trabajador_id').notNull().references(() => trabajadores.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.grupoId, t.trabajadorId] })],
).enableRLS()

export const trabajadorMetodosPago = pgTable(
  'trabajador_metodos_pago',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    trabajadorId: uuid('trabajador_id').notNull().references(() => trabajadores.id, { onDelete: 'cascade' }),
    tipo: tipoMetodoPagoEnum('tipo').notNull(),
    numero: text('numero').notNull(),
    banco: text('banco'),
    cci: text('cci'),
    titular: text('titular').notNull(),
    principal: boolean('principal').notNull().default(false),
    ...marcas,
  },
  (t) => [uniqueIndex('metodo_principal_unico').on(t.trabajadorId).where(sql`principal`)],
).enableRLS()

export const auditoria = pgTable(
  'auditoria',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    usuarioId: uuid('usuario_id').notNull().references(() => usuarios.id),
    accion: accionAuditoriaEnum('accion').notNull(),
    entidad: text('entidad').notNull(),
    entidadId: uuid('entidad_id').notNull(),
    antes: jsonb('antes'),
    despues: jsonb('despues'),
    creadoEn: timestamp('creado_en', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('auditoria_entidad_idx').on(t.entidad, t.entidadId)],
).enableRLS()
```

- [ ] **Step 8: Generar la migración**

Run: `npm run db:generar -w @agrosalas/backend -- --name inicial`
Expected: `11 tables` y `Your SQL migration file ➜ drizzle/0000_inicial.sql`. El archivo debe contener un `ENABLE ROW LEVEL SECURITY` por cada tabla.

- [ ] **Step 9: Escribir tipos, errores y la app mínima**

`backend/src/tipos.ts`:

```ts
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './db/schema'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type Rol = (typeof schema.rolEnum.enumValues)[number]

export type UsuarioSesion = {
  id: string
  correo: string
  nombre: string
  rol: Rol
  areaIds: string[]
}

export type Entorno = { Variables: { usuario: UsuarioSesion } }

export interface AuthAdmin {
  crearUsuario(correo: string, clave: string): Promise<{ id: string }>
}

export type Dependencias = {
  db: Db
  // Devuelve el id del usuario de Supabase Auth, o null si el token no es válido.
  verificarToken: (token: string) => Promise<{ sub: string } | null>
  authAdmin: AuthAdmin
  origenPanel: string
}
```

`backend/src/lib/errores.ts`:

```ts
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class ErrorApi extends Error {
  status: ContentfulStatusCode
  codigo: string
  campo?: string

  constructor(status: ContentfulStatusCode, codigo: string, mensaje: string, campo?: string) {
    super(mensaje)
    this.status = status
    this.codigo = codigo
    this.campo = campo
  }
}

export const noEncontrado = (que: string) => new ErrorApi(404, 'no_encontrado', `${que} no existe`)

// Postgres 23505 = unique_violation. Drizzle envuelve el error original en `cause`.
function esDuplicado(err: unknown): boolean {
  const codigo = (e: unknown) => (e as { code?: string } | null)?.code
  return codigo(err) === '23505' || codigo((err as { cause?: unknown } | null)?.cause) === '23505'
}

export function manejarError(err: Error, c: Context) {
  if (err instanceof ErrorApi) {
    return c.json({ error: { codigo: err.codigo, mensaje: err.message, campo: err.campo } }, err.status)
  }
  if (esDuplicado(err)) {
    return c.json({ error: { codigo: 'duplicado', mensaje: 'Ya existe un registro con ese valor' } }, 409)
  }
  console.error(err)
  return c.json({ error: { codigo: 'interno', mensaje: 'Error interno' } }, 500)
}
```

`backend/src/app.ts`:

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { manejarError } from './lib/errores'
import type { Dependencias } from './tipos'

export function crearApp(deps: Dependencias) {
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
    .notFound((c) => c.json({ error: { codigo: 'no_encontrado', mensaje: 'La ruta no existe' } }, 404))
    .onError(manejarError)
}

export type AppType = ReturnType<typeof crearApp>
```

- [ ] **Step 10: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 3 pruebas en `test/salud.test.ts`; `tsc` sin salida.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json .gitignore backend
git commit -m "chore(repo): scaffold workspace, database schema and test harness"
```

---

### Task 2: Autenticación, roles y `/v1/me`

**Files:**
- Create: `backend/src/lib/validar.ts`, `backend/src/lib/auditoria.ts`, `backend/src/auth/middleware.ts`, `backend/src/rutas/me.ts`
- Modify: `backend/src/app.ts` (se reemplaza completo)
- Test: `backend/test/auth.test.ts`

**Interfaces:**
- Consumes: `Dependencias`, `Entorno`, `ErrorApi`, `crearPrueba`, tablas `usuarios`, `usuarioAreas`, `auditoria`.
- Produces:
  - `autenticar(deps)`: middleware que exige `Authorization: Bearer <token>`, carga el usuario activo y deja `c.get('usuario')` como `UsuarioSesion`. Responde 401 `no_autenticado` o 403 `sin_acceso`.
  - `requiereRol(...roles: Rol[])`: middleware que responde 403 `sin_permiso`.
  - `validar(destino, esquemaZod)`: como `zValidator`, pero responde 400 `{ error: { codigo: 'validacion', mensaje, campo } }`.
  - `esquemaId`: `z.object({ id: z.uuid() })`.
  - `registrarAuditoria(db | tx, usuarioId, accion, entidad, entidadId, antes, despues)`.
  - `GET /v1/me` devuelve `UsuarioSesion`; `PATCH /v1/me` con `{ nombre }`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/auth.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditoria, usuarios } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('autenticación', () => {
  it('rechaza sin token', async () => {
    const r = await p.pedir(null, 'GET', '/v1/me')
    expect(r.status).toBe(401)
    expect(r.json.error.codigo).toBe('no_autenticado')
  })

  it('rechaza un token inválido', async () => {
    const r = await p.app.request('/v1/me', { headers: { Authorization: 'Bearer falso' } })
    expect(r.status).toBe(401)
  })

  it('rechaza a un usuario desactivado', async () => {
    await p.db.update(usuarios).set({ activo: false }).where(eq(usuarios.id, USUARIOS.gerencia))
    const r = await p.pedir('gerencia', 'GET', '/v1/me')
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_acceso')
    await p.db.update(usuarios).set({ activo: true }).where(eq(usuarios.id, USUARIOS.gerencia))
  })
})

describe('/v1/me', () => {
  it('devuelve el usuario con su rol y áreas', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/me')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({
      id: USUARIOS.admin,
      correo: 'admin@prueba.test',
      nombre: 'Usuario admin',
      rol: 'admin',
      areaIds: [],
    })
  })

  it('cambia el nombre y lo deja en auditoría', async () => {
    const r = await p.pedir('contabilidad', 'PATCH', '/v1/me', { nombre: 'Rosa Contadora' })
    expect(r.status).toBe(200)
    expect(r.json.nombre).toBe('Rosa Contadora')
    const filas = await p.db.select().from(auditoria).where(eq(auditoria.entidadId, USUARIOS.contabilidad))
    expect(filas).toHaveLength(1)
    expect(filas[0].accion).toBe('editar')
    expect(filas[0].despues).toEqual({ nombre: 'Rosa Contadora' })
  })

  it('valida el nombre con el formato de error de la API', async () => {
    const r = await p.pedir('admin', 'PATCH', '/v1/me', { nombre: 'x' })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.campo).toBe('nombre')
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/auth.test.ts`
Expected: FAIL, `/v1/me` responde 404 en lugar de 401 y 200.

- [ ] **Step 3: Escribir validación y auditoría**

`backend/src/lib/validar.ts`:

```ts
import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z, type ZodType } from 'zod'

// Igual que zValidator, pero responde con el formato de error de la API.
export const validar = <D extends keyof ValidationTargets, E extends ZodType>(destino: D, esquema: E) =>
  zValidator(destino, esquema, (resultado, c) => {
    if (!resultado.success) {
      const problema = resultado.error.issues[0]
      return c.json(
        { error: { codigo: 'validacion', mensaje: problema.message, campo: problema.path.join('.') } },
        400,
      )
    }
  })

export const esquemaId = z.object({ id: z.uuid() })
```

`backend/src/lib/auditoria.ts`:

```ts
import { auditoria } from '../db/schema'
import type { Db, Tx } from '../tipos'

type Accion = 'crear' | 'editar' | 'eliminar'

export async function registrarAuditoria(
  db: Db | Tx,
  usuarioId: string,
  accion: Accion,
  entidad: string,
  entidadId: string,
  antes: unknown,
  despues: unknown,
) {
  await db.insert(auditoria).values({ usuarioId, accion, entidad, entidadId, antes, despues })
}
```

- [ ] **Step 4: Escribir los middlewares**

`backend/src/auth/middleware.ts`:

```ts
import { eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import { usuarioAreas, usuarios } from '../db/schema'
import { ErrorApi } from '../lib/errores'
import type { Dependencias, Entorno, Rol } from '../tipos'

export const autenticar = ({ db, verificarToken }: Dependencias) =>
  createMiddleware<Entorno>(async (c, next) => {
    const cabecera = c.req.header('Authorization') ?? ''
    const token = cabecera.startsWith('Bearer ') ? cabecera.slice(7) : ''
    const identidad = token ? await verificarToken(token) : null
    if (!identidad) throw new ErrorApi(401, 'no_autenticado', 'Inicia sesión para continuar')

    const [usuario] = await db.select().from(usuarios).where(eq(usuarios.id, identidad.sub))
    if (!usuario || !usuario.activo) throw new ErrorApi(403, 'sin_acceso', 'Tu usuario no tiene acceso al panel')

    const filas = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuario.id))
    c.set('usuario', {
      id: usuario.id,
      correo: usuario.correo,
      nombre: usuario.nombre,
      rol: usuario.rol,
      areaIds: filas.map((f) => f.areaId),
    })
    await next()
  })

export const requiereRol = (...roles: Rol[]) =>
  createMiddleware<Entorno>(async (c, next) => {
    if (!roles.includes(c.get('usuario').rol)) {
      throw new ErrorApi(403, 'sin_permiso', 'Tu rol no permite esta acción')
    }
    await next()
  })
```

- [ ] **Step 5: Escribir las rutas de `/me`**

`backend/src/rutas/me.ts`:

```ts
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { usuarios } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const editarPerfil = z.object({ nombre: z.string().trim().min(2).max(80) })

export const rutasMe = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', (c) => c.json(c.get('usuario')))
    .patch('/', validar('json', editarPerfil), async (c) => {
      const usuario = c.get('usuario')
      const { nombre } = c.req.valid('json')
      await db.transaction(async (tx) => {
        await tx.update(usuarios).set({ nombre }).where(eq(usuarios.id, usuario.id))
        await registrarAuditoria(tx, usuario.id, 'editar', 'usuarios', usuario.id, { nombre: usuario.nombre }, { nombre })
      })
      return c.json({ ...usuario, nombre })
    })
```

- [ ] **Step 6: Montar `/v1` en la app**

Reemplaza `backend/src/app.ts` completo:

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { autenticar } from './auth/middleware'
import { manejarError } from './lib/errores'
import { rutasMe } from './rutas/me'
import type { Dependencias, Entorno } from './tipos'

export function crearApp(deps: Dependencias) {
  const v1 = new Hono<Entorno>()
    .use('*', autenticar(deps))
    .route('/me', rutasMe(deps))

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
```

En las tareas siguientes, "montar la ruta" significa agregar el `import` y una línea `.route(...)` al final de la cadena de `v1`.

- [ ] **Step 7: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 9 pruebas (3 de salud, 6 de auth).

- [ ] **Step 8: Commit**

```bash
git add backend
git commit -m "feat(api): add authentication, role guard and /v1/me"
```

---

### Task 3: Verificación de tokens de Supabase

**Files:**
- Create: `backend/src/auth/verificar.ts`
- Test: `backend/test/verificar.test.ts`

**Interfaces:**
- Consumes: nada del proyecto (solo `jose`).
- Produces:
  - `crearVerificador(claves: JWTVerifyGetKey, emisor: string)` devuelve `(token) => Promise<{ sub: string } | null>`, la forma que espera `Dependencias.verificarToken`. Exige emisor y audiencia `authenticated`; ante cualquier fallo devuelve `null`.
  - `crearVerificadorSupabase(supabaseUrl)`: lo mismo, leyendo las claves públicas de `<supabaseUrl>/auth/v1/.well-known/jwks.json`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/verificar.test.ts`:

```ts
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { crearVerificador } from '../src/auth/verificar'

const EMISOR = 'https://proyecto.supabase.co/auth/v1'

async function preparar() {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
  const verificar = crearVerificador(createLocalJWKSet({ keys: [jwk] }), EMISOR)
  const firmar = (emisor: string, audiencia: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('usuario-1')
      .setIssuer(emisor)
      .setAudience(audiencia)
      .setExpirationTime('5m')
      .sign(privateKey)
  return { verificar, firmar }
}

describe('crearVerificador', () => {
  it('acepta un token firmado por el emisor esperado', async () => {
    const { verificar, firmar } = await preparar()
    expect(await verificar(await firmar(EMISOR, 'authenticated'))).toEqual({ sub: 'usuario-1' })
  })

  it('rechaza otro emisor, otra audiencia y texto que no es un token', async () => {
    const { verificar, firmar } = await preparar()
    expect(await verificar(await firmar('https://otro.supabase.co/auth/v1', 'authenticated'))).toBeNull()
    expect(await verificar(await firmar(EMISOR, 'anon'))).toBeNull()
    expect(await verificar('no-es-un-token')).toBeNull()
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/verificar.test.ts`
Expected: FAIL, no encuentra `../src/auth/verificar`.

- [ ] **Step 3: Implementar**

`backend/src/auth/verificar.ts`:

```ts
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Supabase firma los tokens de sesión; se validan contra sus claves públicas (JWKS).
export function crearVerificador(claves: JWTVerifyGetKey, emisor: string) {
  return async (token: string): Promise<{ sub: string } | null> => {
    try {
      const { payload } = await jwtVerify(token, claves, { issuer: emisor, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? { sub: payload.sub } : null
    } catch {
      return null
    }
  }
}

export function crearVerificadorSupabase(supabaseUrl: string) {
  const emisor = `${supabaseUrl}/auth/v1`
  return crearVerificador(createRemoteJWKSet(new URL(`${emisor}/.well-known/jwks.json`)), emisor)
}
```

- [ ] **Step 4: Ejecutar la prueba**

Run: `npm test -w @agrosalas/backend -- test/verificar.test.ts`
Expected: PASS, 2 pruebas.

- [ ] **Step 5: Commit**

```bash
git add backend
git commit -m "feat(api): verify Supabase session tokens against JWKS"
```

---

### Task 4: Paginación y consulta de auditoría

**Files:**
- Create: `backend/src/lib/paginacion.ts`, `backend/src/rutas/auditoria.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/auditoria.test.ts`

**Interfaces:**
- Consumes: `validar`, `requiereRol`, `registrarAuditoria` (indirectamente, vía `PATCH /v1/me`), tablas `auditoria` y `usuarios`.
- Produces:
  - `esquemaPagina`: `z.object({ pagina, tamano })` con valores por defecto 1 y 25, máximo 100. Se extiende con `.extend({...})` para sumar filtros.
  - `desplazamiento(p)`: el `offset` SQL.
  - `paginado(datos, total, p)`: `{ datos, total, pagina, tamano }`.
  - `GET /v1/auditoria?entidad=&pagina=&tamano=`: filas de auditoría con `usuarioNombre`, de la más reciente a la más antigua.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/auditoria.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
  // Cada cambio de nombre deja una fila de auditoría.
  for (const nombre of ['Uno Uno', 'Dos Dos', 'Tres Tres']) {
    await p.pedir('admin', 'PATCH', '/v1/me', { nombre })
  }
})

describe('/v1/auditoria', () => {
  it('solo el administrador la consulta', async () => {
    for (const rol of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await p.pedir(rol, 'GET', '/v1/auditoria')).status).toBe(403)
    }
  })

  it('pagina, devuelve el total y ordena de la más reciente a la más antigua', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=2')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 3, pagina: 1, tamano: 2 })
    expect(r.json.datos.map((f: { despues: { nombre: string } }) => f.despues.nombre)).toEqual(['Tres Tres', 'Dos Dos'])

    const segunda = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=2&pagina=2')
    expect(segunda.json.datos).toHaveLength(1)
  })

  it('incluye el nombre de quien hizo el cambio y filtra por tabla', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=usuarios')
    expect(r.json.total).toBe(3)
    expect(r.json.datos[0]).toMatchObject({ accion: 'editar', entidad: 'usuarios', usuarioNombre: 'Tres Tres' })
    expect((await p.pedir('admin', 'GET', '/v1/auditoria?entidad=areas')).json.total).toBe(0)
  })

  it('usa 25 filas por defecto y rechaza más de 100', async () => {
    expect((await p.pedir('admin', 'GET', '/v1/auditoria')).json.tamano).toBe(25)
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=101')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/auditoria.test.ts`
Expected: FAIL, `/v1/auditoria` responde 404.

- [ ] **Step 3: Escribir la paginación**

`backend/src/lib/paginacion.ts`:

```ts
import { z } from 'zod'

export const esquemaPagina = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(100).default(25),
})

export type Pagina = z.infer<typeof esquemaPagina>

export const desplazamiento = (p: Pagina) => (p.pagina - 1) * p.tamano

export const paginado = <T>(datos: T[], total: number, p: Pagina) => ({
  datos,
  total,
  pagina: p.pagina,
  tamano: p.tamano,
})
```

- [ ] **Step 4: Escribir la ruta**

`backend/src/rutas/auditoria.ts`:

```ts
import { count, desc, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { auditoria, usuarios } from '../db/schema'
import { desplazamiento, esquemaPagina, paginado } from '../lib/paginacion'
import { validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const filtros = esquemaPagina.extend({ entidad: z.string().trim().min(1).optional() })

export const rutasAuditoria = ({ db }: Dependencias) =>
  new Hono<Entorno>().get('/', requiereRol('admin'), validar('query', filtros), async (c) => {
    const f = c.req.valid('query')
    const condicion = f.entidad ? eq(auditoria.entidad, f.entidad) : undefined
    const [{ total }] = await db.select({ total: count() }).from(auditoria).where(condicion)
    const datos = await db
      .select({ ...getTableColumns(auditoria), usuarioNombre: usuarios.nombre })
      .from(auditoria)
      .innerJoin(usuarios, eq(usuarios.id, auditoria.usuarioId))
      .where(condicion)
      .orderBy(desc(auditoria.creadoEn))
      .limit(f.tamano)
      .offset(desplazamiento(f))
    return c.json(paginado(datos, total, f))
  })
```

- [ ] **Step 5: Montar la ruta**

En `backend/src/app.ts` agrega el import y la línea al final de la cadena de `v1`:

```ts
import { rutasAuditoria } from './rutas/auditoria'
```

```ts
    .route('/auditoria', rutasAuditoria(deps))
```

- [ ] **Step 6: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 15 pruebas en total.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(api): add server-side pagination and audit log endpoint"
```

---

### Task 5: Catálogos: áreas, turnos y campañas

**Files:**
- Create: `backend/src/rutas/catalogos.ts`
- Modify: `backend/src/app.ts` (montar tres rutas)
- Test: `backend/test/catalogos.test.ts`

**Interfaces:**
- Consumes: `validar`, `esquemaId`, `requiereRol`, `registrarAuditoria`, `noEncontrado`, tablas `areas`, `turnos`, `campanas`.
- Produces: `rutasAreas`, `rutasTurnos`, `rutasCampanas`. Cada una expone `GET /` (`{ datos }`, sin paginar, ordenado por nombre), `POST /` (201) y `PATCH /:id`. Un nombre repetido responde 409 `duplicado`. No hay DELETE: se desactiva con `PATCH { activo: false }`.
- Nota: el spec llama `activa` al campo de campañas; aquí se unifica como `activo` en todos los catálogos.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/catalogos.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('áreas', () => {
  it('el administrador crea y todos los roles listan', async () => {
    const creada = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(creada.status).toBe(201)
    expect(creada.json).toMatchObject({ nombre: 'Producción', activo: true })

    const lista = await p.pedir('coordinador', 'GET', '/v1/areas')
    expect(lista.status).toBe(200)
    expect(lista.json.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Producción'])
  })

  it('solo el administrador puede crear o editar', async () => {
    const r = await p.pedir('contabilidad', 'POST', '/v1/areas', { nombre: 'Almacén' })
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_permiso')
  })

  it('rechaza un nombre repetido con 409', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(r.status).toBe(409)
    expect(r.json.error.codigo).toBe('duplicado')
  })

  it('edita, desactiva y responde 404 si no existe', async () => {
    const { json: area } = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Etiquetado' })
    const editada = await p.pedir('admin', 'PATCH', `/v1/areas/${area.id}`, { activo: false })
    expect(editada.status).toBe(200)
    expect(editada.json.activo).toBe(false)

    const nada = await p.pedir('admin', 'PATCH', '/v1/areas/00000000-0000-4000-8000-00000000ffff', { activo: false })
    expect(nada.status).toBe(404)
  })

  it('deja creación y edición en auditoría', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=areas')
    expect(r.json.datos.map((f: { accion: string }) => f.accion).sort()).toEqual(['crear', 'crear', 'editar'])
  })
})

describe('turnos', () => {
  it('crea con horas HH:MM y rechaza otro formato', async () => {
    const ok = await p.pedir('admin', 'POST', '/v1/turnos', { nombre: 'Día', horaInicio: '07:00', horaFin: '17:00' })
    expect(ok.status).toBe(201)
    expect(ok.json.horaInicio).toBe('07:00:00')

    const mal = await p.pedir('admin', 'POST', '/v1/turnos', { nombre: 'Noche', horaInicio: '7pm', horaFin: '05:00' })
    expect(mal.status).toBe(400)
    expect(mal.json.error.campo).toBe('horaInicio')
  })
})

describe('campañas', () => {
  it('crea con fechas opcionales y edita', async () => {
    const creada = await p.pedir('admin', 'POST', '/v1/campanas', { nombre: 'Contenedor Chile' })
    expect(creada.status).toBe(201)
    expect(creada.json.fechaInicio).toBeNull()

    const editada = await p.pedir('admin', 'PATCH', `/v1/campanas/${creada.json.id}`, {
      fechaInicio: '2026-09-07',
      fechaFin: '2026-10-04',
    })
    expect(editada.json).toMatchObject({ fechaInicio: '2026-09-07', fechaFin: '2026-10-04' })
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/catalogos.test.ts`
Expected: FAIL, las rutas responden 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/catalogos.ts`:

```ts
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { areas, campanas, turnos } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const nombre = z.string().trim().min(2).max(60)
const hora = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM')
const fecha = z.iso.date().nullable().optional()

const crearArea = z.object({ nombre })
const editarArea = crearArea.extend({ activo: z.boolean() }).partial()

export const rutasAreas = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(areas).orderBy(asc(areas.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearArea), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nueva] = await tx.insert(areas).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'areas', nueva.id, null, nueva)
        return nueva
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarArea), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(areas).where(eq(areas.id, id))
        if (!antes) throw noEncontrado('El área')
        const [despues] = await tx.update(areas).set(c.req.valid('json')).where(eq(areas.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'areas', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })

const crearTurno = z.object({ nombre, horaInicio: hora, horaFin: hora })
const editarTurno = crearTurno.extend({ activo: z.boolean() }).partial()

export const rutasTurnos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(turnos).orderBy(asc(turnos.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearTurno), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(turnos).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'turnos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarTurno), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(turnos).where(eq(turnos.id, id))
        if (!antes) throw noEncontrado('El turno')
        const [despues] = await tx.update(turnos).set(c.req.valid('json')).where(eq(turnos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'turnos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })

const crearCampana = z.object({ nombre, fechaInicio: fecha, fechaFin: fecha })
const editarCampana = crearCampana.extend({ activo: z.boolean() }).partial()

export const rutasCampanas = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => c.json({ datos: await db.select().from(campanas).orderBy(asc(campanas.nombre)) }))
    .post('/', requiereRol('admin'), validar('json', crearCampana), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nueva] = await tx.insert(campanas).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'campanas', nueva.id, null, nueva)
        return nueva
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarCampana), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(campanas).where(eq(campanas.id, id))
        if (!antes) throw noEncontrado('La campaña')
        const [despues] = await tx.update(campanas).set(c.req.valid('json')).where(eq(campanas.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'campanas', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
```

- [ ] **Step 4: Montar las rutas**

En `backend/src/app.ts`:

```ts
import { rutasAreas, rutasCampanas, rutasTurnos } from './rutas/catalogos'
```

```ts
    .route('/areas', rutasAreas(deps))
    .route('/turnos', rutasTurnos(deps))
    .route('/campanas', rutasCampanas(deps))
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 22 pruebas en total.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(api): add areas, shifts and campaigns catalogs"
```

---

### Task 6: Cargos y tarifas de referencia

**Files:**
- Create: `backend/src/rutas/cargos.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/cargos.test.ts`

**Interfaces:**
- Consumes: lo mismo que la tarea 5, más `ErrorApi` y la tabla `cargos`.
- Produces: `rutasCargos` con `GET /`, `POST /`, `PATCH /:id`. Campos: `nombre`, `tipoPago` (`por_hora` | `mensual`), `tarifaHora`, `tarifaHoraExtra`, `sueldoMensual` (números o `null`), `activo`. Un cargo `por_hora` exige las dos tarifas; uno `mensual`, el sueldo. Para el rol coordinador, `GET /` devuelve los tres montos en `null`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/cargos.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('cargos y tarifas', () => {
  it('crea un cargo por hora con sus dos tarifas', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Estibador',
      tipoPago: 'por_hora',
      tarifaHora: 10,
      tarifaHoraExtra: 12.5,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ nombre: 'Estibador', tarifaHora: 10, tarifaHoraExtra: 12.5, sueldoMensual: null })
  })

  it('conserva cuatro decimales en la tarifa', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Operario',
      tipoPago: 'por_hora',
      tarifaHora: 6.25,
      tarifaHoraExtra: 7.8125,
    })
    expect(r.json.tarifaHoraExtra).toBe(7.8125)
  })

  it('exige tarifas en un cargo por hora y sueldo en uno mensual', async () => {
    const sinExtra = await p.pedir('admin', 'POST', '/v1/cargos', { nombre: 'Mecánico', tipoPago: 'por_hora', tarifaHora: 30 })
    expect(sinExtra.status).toBe(400)
    expect(sinExtra.json.error.campo).toBe('tarifaHora')

    const sinSueldo = await p.pedir('admin', 'POST', '/v1/cargos', { nombre: 'Jefe de planta', tipoPago: 'mensual' })
    expect(sinSueldo.status).toBe(400)
    expect(sinSueldo.json.error.campo).toBe('sueldoMensual')
  })

  it('al editar valida contra el cargo ya guardado', async () => {
    const { json: cargo } = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Jefa de almacén',
      tipoPago: 'mensual',
      sueldoMensual: 1800,
    })
    const aPorHora = await p.pedir('admin', 'PATCH', `/v1/cargos/${cargo.id}`, { tipoPago: 'por_hora' })
    expect(aPorHora.status).toBe(400)

    const sube = await p.pedir('admin', 'PATCH', `/v1/cargos/${cargo.id}`, { sueldoMensual: 2000 })
    expect(sube.json.sueldoMensual).toBe(2000)
  })

  it('el coordinador recibe los cargos sin montos', async () => {
    const r = await p.pedir('coordinador', 'GET', '/v1/cargos')
    expect(r.status).toBe(200)
    expect(r.json.datos.length).toBeGreaterThan(0)
    for (const cargo of r.json.datos) {
      expect(cargo.tarifaHora).toBeNull()
      expect(cargo.tarifaHoraExtra).toBeNull()
      expect(cargo.sueldoMensual).toBeNull()
    }
  })

  it('gerencia sí ve los montos, pero no puede crear', async () => {
    const lista = await p.pedir('gerencia', 'GET', '/v1/cargos')
    expect(lista.json.datos.find((c: { nombre: string }) => c.nombre === 'Estibador').tarifaHora).toBe(10)
    const crear = await p.pedir('gerencia', 'POST', '/v1/cargos', { nombre: 'X1', tipoPago: 'mensual', sueldoMensual: 1 })
    expect(crear.status).toBe(403)
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/cargos.test.ts`
Expected: FAIL, `/v1/cargos` responde 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/cargos.ts`:

```ts
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { cargos } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const monto = z.number().positive().max(99999).nullable().optional()

const datosCargo = z.object({
  nombre: z.string().trim().min(2).max(60),
  tipoPago: z.enum(['por_hora', 'mensual']),
  tarifaHora: monto,
  tarifaHoraExtra: monto,
  sueldoMensual: monto,
})
const editarCargo = datosCargo.extend({ activo: z.boolean() }).partial()

type Tarifas = Pick<typeof cargos.$inferSelect, 'tipoPago' | 'tarifaHora' | 'tarifaHoraExtra' | 'sueldoMensual'>

// Un cargo por hora necesita sus dos tarifas; uno mensual, su sueldo.
function exigirTarifas(c: Tarifas) {
  if (c.tipoPago === 'por_hora' && (c.tarifaHora == null || c.tarifaHoraExtra == null)) {
    throw new ErrorApi(400, 'validacion', 'Un cargo por hora necesita tarifa normal y tarifa extra', 'tarifaHora')
  }
  if (c.tipoPago === 'mensual' && c.sueldoMensual == null) {
    throw new ErrorApi(400, 'validacion', 'Un cargo mensual necesita sueldo', 'sueldoMensual')
  }
}

export const rutasCargos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => {
      const filas = await db.select().from(cargos).orderBy(asc(cargos.nombre))
      // El coordinador no ve montos: se quitan en el servidor, no en la pantalla.
      const datos =
        c.get('usuario').rol === 'coordinador'
          ? filas.map((f) => ({ ...f, tarifaHora: null, tarifaHoraExtra: null, sueldoMensual: null }))
          : filas
      return c.json({ datos })
    })
    .post('/', requiereRol('admin'), validar('json', datosCargo), async (c) => {
      const datos = c.req.valid('json')
      exigirTarifas({
        tipoPago: datos.tipoPago,
        tarifaHora: datos.tarifaHora ?? null,
        tarifaHoraExtra: datos.tarifaHoraExtra ?? null,
        sueldoMensual: datos.sueldoMensual ?? null,
      })
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(cargos).values(datos).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'cargos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarCargo), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(cargos).where(eq(cargos.id, id))
        if (!antes) throw noEncontrado('El cargo')
        exigirTarifas({ ...antes, ...c.req.valid('json') })
        const [despues] = await tx.update(cargos).set(c.req.valid('json')).where(eq(cargos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'cargos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
```

- [ ] **Step 4: Montar la ruta**

En `backend/src/app.ts`:

```ts
import { rutasCargos } from './rutas/cargos'
```

```ts
    .route('/cargos', rutasCargos(deps))
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 28 pruebas en total.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(api): add job titles with reference rates"
```

---

### Task 7: Trabajadores: lista, ficha, alta y edición

**Files:**
- Create: `backend/src/rutas/trabajadores.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/trabajadores.test.ts`

**Interfaces:**
- Consumes: `esquemaPagina`, `desplazamiento`, `paginado`, `validar`, `esquemaId`, `requiereRol`, `registrarAuditoria`, `noEncontrado`, tablas `trabajadores`, `trabajadorMetodosPago`, `grupoTrabajadores`, y `POST /v1/areas` (en la prueba).
- Produces:
  - `rutasTrabajadores` con `GET /?texto=&areaId=&modalidad=&estado=&pagina=&tamano=` (paginado, ordenado por apellidos), `GET /:id` (trabajador + `metodosPago` + `grupoIds`), `POST /` y `PATCH /:id`.
  - `alcance(usuario): SQL | undefined`: condición que limita al coordinador a sus áreas.
  - `buscarTrabajador(db | tx, usuario, id)`: devuelve la fila o lanza 404 si no existe o está fuera del alcance. La usa la tarea 8.
  - Para el coordinador, `GET /:id` devuelve `metodosPago: []`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/trabajadores.test.ts`:

```ts
import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let produccion: string
let almacen: string

const base = { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal' }

beforeAll(async () => {
  p = await crearPrueba()
  produccion = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  almacen = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
})

describe('crear y editar trabajadores', () => {
  it('contabilidad crea con DNI y nombre; lo demás es opcional', async () => {
    const r = await p.pedir('contabilidad', 'POST', '/v1/trabajadores', { ...base, dni: '45871236', areaId: produccion })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ dni: '45871236', estado: 'activo', telefono: null })
  })

  it('exige un DNI de 8 dígitos al crear', async () => {
    const sin = await p.pedir('admin', 'POST', '/v1/trabajadores', base)
    expect(sin.status).toBe(400)
    expect(sin.json.error.campo).toBe('dni')
    const corto = await p.pedir('admin', 'POST', '/v1/trabajadores', { ...base, dni: '123' })
    expect(corto.json.error.mensaje).toBe('El DNI debe tener 8 dígitos')
  })

  it('rechaza un DNI repetido con 409', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/trabajadores', { ...base, nombres: 'Otra', dni: '45871236' })
    expect(r.status).toBe(409)
  })

  it('gerencia y coordinador no pueden crear', async () => {
    for (const rol of ['gerencia', 'coordinador'] as const) {
      const r = await p.pedir(rol, 'POST', '/v1/trabajadores', { ...base, dni: '11112222' })
      expect(r.status).toBe(403)
    }
  })

  it('edita, cesa y deja el antes y el después en auditoría', async () => {
    const { json: t } = await p.pedir('admin', 'POST', '/v1/trabajadores', {
      ...base,
      nombres: 'José',
      apellidos: 'Chávez Rojas',
      dni: '40236517',
      areaId: almacen,
    })
    const r = await p.pedir('contabilidad', 'PATCH', `/v1/trabajadores/${t.id}`, { estado: 'cesado', telefono: '987654321' })
    expect(r.json).toMatchObject({ estado: 'cesado', telefono: '987654321' })

    const audit = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=trabajadores')
    const edicion = audit.json.datos.find((f: { accion: string }) => f.accion === 'editar')
    expect(edicion.antes.estado).toBe('activo')
    expect(edicion.despues.estado).toBe('cesado')
    expect(edicion.usuarioNombre).toBe('Usuario contabilidad')
  })
})

describe('listar trabajadores', () => {
  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      await p.pedir('admin', 'POST', '/v1/trabajadores', {
        nombres: `Persona ${i}`,
        apellidos: `Apellido ${i}`,
        dni: `7000000${i}`,
        modalidad: i === 0 ? 'contrato' : 'temporal',
        areaId: i < 3 ? produccion : almacen,
      })
    }
  })

  it('pagina y devuelve el total', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?pagina=2&tamano=3')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 7, pagina: 2, tamano: 3 })
    expect(r.json.datos).toHaveLength(3)
  })

  it('ordena por apellidos', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?tamano=100')
    const apellidos = r.json.datos.map((t: { apellidos: string }) => t.apellidos)
    expect(apellidos).toEqual([...apellidos].sort((a, b) => a.localeCompare(b)))
  })

  it('filtra por texto (nombre, apellido o DNI), área, modalidad y estado', async () => {
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?texto=torres')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?texto=4023')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores?areaId=${almacen}`)).json.total).toBe(3)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?modalidad=contrato')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?estado=cesado')).json.total).toBe(1)
  })

  it('rechaza un tamaño de página mayor a 100', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?tamano=500')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })

  it('el coordinador solo ve a los de sus áreas', async () => {
    const r = await p.pedir('coordinador', 'GET', '/v1/trabajadores?tamano=100')
    expect(r.json.total).toBe(4)
    expect(r.json.datos.every((t: { areaId: string }) => t.areaId === produccion)).toBe(true)
  })

  it('un coordinador sin áreas no ve a nadie', async () => {
    await p.db.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, USUARIOS.coordinador))
    expect((await p.pedir('coordinador', 'GET', '/v1/trabajadores')).json.total).toBe(0)
    await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/trabajadores.test.ts`
Expected: FAIL, `/v1/trabajadores` responde 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/trabajadores.ts`:

```ts
import { and, asc, count, eq, ilike, inArray, or, type SQL } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { grupoTrabajadores, trabajadorMetodosPago, trabajadores } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { desplazamiento, esquemaPagina, paginado } from '../lib/paginacion'
import { esquemaId, validar } from '../lib/validar'
import type { Db, Dependencias, Entorno, Tx, UsuarioSesion } from '../tipos'

const texto = (max: number) => z.string().trim().max(max).nullable().optional()
const idOpcional = z.uuid().nullable().optional()

const crearTrabajador = z.object({
  dni: z.string().regex(/^\d{8}$/, 'El DNI debe tener 8 dígitos'),
  nombres: z.string().trim().min(1).max(80),
  apellidos: z.string().trim().min(1).max(80),
  telefono: texto(20),
  correo: z.email().nullable().optional(),
  direccion: texto(160),
  emergenciaNombre: texto(80),
  emergenciaTelefono: texto(20),
  areaId: idOpcional,
  cargoId: idOpcional,
  turnoId: idOpcional,
  modalidad: z.enum(['temporal', 'contrato']),
  fechaIngreso: z.iso.date().nullable().optional(),
  notas: texto(500),
})
const editarTrabajador = crearTrabajador.partial().extend({ estado: z.enum(['activo', 'cesado']).optional() })

const filtros = esquemaPagina.extend({
  texto: z.string().trim().min(1).optional(),
  areaId: z.uuid().optional(),
  modalidad: z.enum(['temporal', 'contrato']).optional(),
  estado: z.enum(['activo', 'cesado']).optional(),
})

// El coordinador solo alcanza a los trabajadores de sus áreas.
export function alcance(usuario: UsuarioSesion): SQL | undefined {
  if (usuario.rol !== 'coordinador') return undefined
  if (usuario.areaIds.length === 0) return eq(trabajadores.id, '00000000-0000-0000-0000-000000000000')
  return inArray(trabajadores.areaId, usuario.areaIds)
}

export async function buscarTrabajador(db: Db | Tx, usuario: UsuarioSesion, id: string) {
  const [fila] = await db
    .select()
    .from(trabajadores)
    .where(and(eq(trabajadores.id, id), alcance(usuario)))
  if (!fila) throw noEncontrado('El trabajador')
  return fila
}

export const rutasTrabajadores = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', validar('query', filtros), async (c) => {
      const f = c.req.valid('query')
      const condicion = and(
        alcance(c.get('usuario')),
        f.areaId ? eq(trabajadores.areaId, f.areaId) : undefined,
        f.modalidad ? eq(trabajadores.modalidad, f.modalidad) : undefined,
        f.estado ? eq(trabajadores.estado, f.estado) : undefined,
        f.texto
          ? or(
              ilike(trabajadores.nombres, `%${f.texto}%`),
              ilike(trabajadores.apellidos, `%${f.texto}%`),
              ilike(trabajadores.dni, `%${f.texto}%`),
            )
          : undefined,
      )
      const [{ total }] = await db.select({ total: count() }).from(trabajadores).where(condicion)
      const datos = await db
        .select()
        .from(trabajadores)
        .where(condicion)
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres))
        .limit(f.tamano)
        .offset(desplazamiento(f))
      return c.json(paginado(datos, total, f))
    })
    .get('/:id', validar('param', esquemaId), async (c) => {
      const usuario = c.get('usuario')
      const { id } = c.req.valid('param')
      const fila = await buscarTrabajador(db, usuario, id)
      // Los métodos de pago son datos bancarios: el coordinador no los recibe.
      const metodosPago =
        usuario.rol === 'coordinador'
          ? []
          : await db
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
      const grupos = await db.select().from(grupoTrabajadores).where(eq(grupoTrabajadores.trabajadorId, id))
      return c.json({ ...fila, metodosPago, grupoIds: grupos.map((g) => g.grupoId) })
    })
    .post('/', requiereRol('admin', 'contabilidad'), validar('json', crearTrabajador), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(trabajadores).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'trabajadores', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch(
      '/:id',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', editarTrabajador),
      async (c) => {
        const { id } = c.req.valid('param')
        const fila = await db.transaction(async (tx) => {
          const antes = await buscarTrabajador(tx, c.get('usuario'), id)
          const [despues] = await tx
            .update(trabajadores)
            .set(c.req.valid('json'))
            .where(eq(trabajadores.id, id))
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'trabajadores', id, antes, despues)
          return despues
        })
        return c.json(fila)
      },
    )
```

- [ ] **Step 4: Montar la ruta**

En `backend/src/app.ts`:

```ts
import { rutasTrabajadores } from './rutas/trabajadores'
```

```ts
    .route('/trabajadores', rutasTrabajadores(deps))
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 39 pruebas en total.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(api): add workers with filters, pagination and area scoping"
```

---

### Task 8: Métodos de pago del trabajador

**Files:**
- Create: `backend/src/rutas/metodos-pago.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/metodos-pago.test.ts`

**Interfaces:**
- Consumes: `buscarTrabajador` (tarea 7), `validar`, `esquemaId`, `requiereRol`, `registrarAuditoria`, `ErrorApi`, `noEncontrado`, tabla `trabajadorMetodosPago`.
- Produces: `rutasMetodosPago`, que se monta también en `/trabajadores`: `POST /:id/metodos-pago`, `PATCH /:id/metodos-pago/:metodoId`, `DELETE /:id/metodos-pago/:metodoId`. Reglas: el primer método queda como principal; marcar uno como principal desmarca a los demás; no se puede desmarcar el principal directamente; al borrar el principal, el más antiguo que queda pasa a serlo.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/metodos-pago.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let trabajadorId: string
let deOtraArea: string
let yapeId: string
let cuentaId: string

beforeAll(async () => {
  p = await crearPrueba()
  const produccion = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  const almacen = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
  const crear = (dni: string, areaId: string) =>
    p.pedir('admin', 'POST', '/v1/trabajadores', { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal', dni, areaId })
  trabajadorId = (await crear('45871236', produccion)).json.id
  deOtraArea = (await crear('40236517', almacen)).json.id
})

describe('métodos de pago', () => {
  it('el primer método queda como principal', async () => {
    const r = await p.pedir('contabilidad', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'yape',
      numero: '912345678',
      titular: 'Jhon Torres',
    })
    expect(r.status).toBe(201)
    expect(r.json.principal).toBe(true)
    yapeId = r.json.id
  })

  it('un segundo método no desplaza al principal salvo que se pida', async () => {
    const r = await p.pedir('admin', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'cuenta_bancaria',
      numero: '191-00000000-0-00',
      banco: 'BCP',
      cci: '002-191-000000000000-00',
      titular: 'Ana Torres Quispe',
    })
    expect(r.json.principal).toBe(false)
    cuentaId = r.json.id
  })

  it('marcar otro como principal desmarca al anterior', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`, { principal: true })
    expect(r.json.principal).toBe(true)
    const { json: ficha } = await p.pedir('admin', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.metodosPago.map((m: { id: string; principal: boolean }) => [m.id, m.principal])).toEqual([
      [yapeId, false],
      [cuentaId, true],
    ])
  })

  it('no permite dejar al trabajador sin principal desmarcándolo', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`, { principal: false })
    expect(r.status).toBe(400)
  })

  it('al quitar el principal, el más antiguo que queda pasa a serlo', async () => {
    const r = await p.pedir('admin', 'DELETE', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`)
    expect(r.status).toBe(200)
    const { json: ficha } = await p.pedir('admin', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.metodosPago).toHaveLength(1)
    expect(ficha.metodosPago[0]).toMatchObject({ id: yapeId, principal: true })
  })

  it('el coordinador ve la ficha de su área sin métodos de pago, y no puede agregarlos', async () => {
    const ficha = await p.pedir('coordinador', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.status).toBe(200)
    expect(ficha.json.metodosPago).toEqual([])
    const r = await p.pedir('coordinador', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'plin',
      numero: '999888777',
      titular: 'X Y',
    })
    expect(r.status).toBe(403)
  })

  it('el coordinador recibe 404 por un trabajador de otra área', async () => {
    const r = await p.pedir('coordinador', 'GET', `/v1/trabajadores/${deOtraArea}`)
    expect(r.status).toBe(404)
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/metodos-pago.test.ts`
Expected: FAIL, las rutas de métodos de pago responden 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/metodos-pago.ts`:

```ts
import { and, asc, count, eq, ne } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { trabajadorMetodosPago } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'
import { buscarTrabajador } from './trabajadores'

const texto = (max: number) => z.string().trim().max(max).nullable().optional()

const datosMetodo = z.object({
  tipo: z.enum(['yape', 'plin', 'cuenta_bancaria']),
  numero: z.string().trim().min(6).max(30),
  banco: texto(40),
  cci: texto(30),
  titular: z.string().trim().min(2).max(80),
  principal: z.boolean().optional(),
})
const idsMetodo = z.object({ id: z.uuid(), metodoId: z.uuid() })

// Se monta en /v1/trabajadores, junto a rutasTrabajadores.
export const rutasMetodosPago = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .post(
      '/:id/metodos-pago',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', datosMetodo),
      async (c) => {
        const { id } = c.req.valid('param')
        const datos = c.req.valid('json')
        const fila = await db.transaction(async (tx) => {
          await buscarTrabajador(tx, c.get('usuario'), id)
          const [{ total }] = await tx
            .select({ total: count() })
            .from(trabajadorMetodosPago)
            .where(eq(trabajadorMetodosPago.trabajadorId, id))
          // El primer método queda como principal aunque no se pida.
          const principal = total === 0 || datos.principal === true
          if (principal) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
          }
          const [nuevo] = await tx
            .insert(trabajadorMetodosPago)
            .values({ ...datos, trabajadorId: id, principal })
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'trabajador_metodos_pago', nuevo.id, null, nuevo)
          return nuevo
        })
        return c.json(fila, 201)
      },
    )
    .patch(
      '/:id/metodos-pago/:metodoId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMetodo),
      validar('json', datosMetodo.partial()),
      async (c) => {
        const { id, metodoId } = c.req.valid('param')
        const datos = c.req.valid('json')
        if (datos.principal === false) {
          throw new ErrorApi(400, 'validacion', 'Marca otro método como principal en lugar de quitar este', 'principal')
        }
        const fila = await db.transaction(async (tx) => {
          const [antes] = await tx
            .select()
            .from(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, metodoId), eq(trabajadorMetodosPago.trabajadorId, id)))
          if (!antes) throw noEncontrado('El método de pago')
          if (datos.principal) {
            await tx
              .update(trabajadorMetodosPago)
              .set({ principal: false })
              .where(and(eq(trabajadorMetodosPago.trabajadorId, id), ne(trabajadorMetodosPago.id, metodoId)))
          }
          const [despues] = await tx
            .update(trabajadorMetodosPago)
            .set(datos)
            .where(eq(trabajadorMetodosPago.id, metodoId))
            .returning()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'trabajador_metodos_pago', metodoId, antes, despues)
          return despues
        })
        return c.json(fila)
      },
    )
    .delete(
      '/:id/metodos-pago/:metodoId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMetodo),
      async (c) => {
        const { id, metodoId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          const [antes] = await tx
            .delete(trabajadorMetodosPago)
            .where(and(eq(trabajadorMetodosPago.id, metodoId), eq(trabajadorMetodosPago.trabajadorId, id)))
            .returning()
          if (!antes) throw noEncontrado('El método de pago')
          if (antes.principal) {
            // Si se quita el principal, el más antiguo de los que quedan pasa a serlo.
            const [siguiente] = await tx
              .select()
              .from(trabajadorMetodosPago)
              .where(eq(trabajadorMetodosPago.trabajadorId, id))
              .orderBy(asc(trabajadorMetodosPago.creadoEn))
              .limit(1)
            if (siguiente) {
              await tx
                .update(trabajadorMetodosPago)
                .set({ principal: true })
                .where(eq(trabajadorMetodosPago.id, siguiente.id))
            }
          }
          await registrarAuditoria(tx, c.get('usuario').id, 'eliminar', 'trabajador_metodos_pago', metodoId, antes, null)
        })
        return c.json({ ok: true })
      },
    )
```

- [ ] **Step 4: Montar la ruta**

En `backend/src/app.ts`, justo después de la línea de `rutasTrabajadores`:

```ts
import { rutasMetodosPago } from './rutas/metodos-pago'
```

```ts
    .route('/trabajadores', rutasMetodosPago(deps))
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 46 pruebas en total.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(api): add worker payment methods with a single primary"
```

---

### Task 9: Grupos de trabajadores

**Files:**
- Create: `backend/src/rutas/grupos.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/grupos.test.ts`

**Interfaces:**
- Consumes: `validar`, `esquemaId`, `requiereRol`, `registrarAuditoria`, `noEncontrado`, tablas `grupos`, `grupoTrabajadores`, `trabajadores`, y `POST /v1/trabajadores` (en la prueba).
- Produces: `rutasGrupos` con `GET /` (cada grupo con `miembros: number`), `GET /:id` (grupo + `miembros: { id, nombres, apellidos, dni }[]`), `POST /`, `PATCH /:id`, `POST /:id/miembros` con `{ trabajadorIds: string[] }` (repetidos se ignoran) y `DELETE /:id/miembros/:trabajadorId`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/grupos.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let ids: string[]
let grupoId: string

beforeAll(async () => {
  p = await crearPrueba()
  ids = []
  for (let i = 0; i < 3; i++) {
    const r = await p.pedir('admin', 'POST', '/v1/trabajadores', {
      nombres: `Persona ${i}`,
      apellidos: 'Prueba',
      dni: `6000000${i}`,
      modalidad: 'temporal',
    })
    ids.push(r.json.id)
  }
})

describe('grupos de trabajadores', () => {
  it('el administrador crea un grupo fijo y uno temporal con fechas', async () => {
    const fijo = await p.pedir('admin', 'POST', '/v1/grupos', { nombre: 'Turno noche' })
    expect(fijo.status).toBe(201)
    expect(fijo.json).toMatchObject({ temporal: false, fechaInicio: null })
    grupoId = fijo.json.id

    const temporal = await p.pedir('admin', 'POST', '/v1/grupos', {
      nombre: 'Apoyo contenedor Chile',
      temporal: true,
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-04',
    })
    expect(temporal.json).toMatchObject({ temporal: true, fechaFin: '2026-10-04' })
  })

  it('contabilidad agrega miembros; repetir uno no falla ni lo duplica', async () => {
    const r = await p.pedir('contabilidad', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[0], ids[1]] })
    expect(r.status).toBe(200)
    await p.pedir('contabilidad', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[1], ids[2]] })

    const { json: grupo } = await p.pedir('admin', 'GET', `/v1/grupos/${grupoId}`)
    expect(grupo.miembros.map((m: { id: string }) => m.id).sort()).toEqual([...ids].sort())
    expect(grupo.miembros[0]).toEqual({ id: ids[0], nombres: 'Persona 0', apellidos: 'Prueba', dni: '60000000' })
  })

  it('la lista trae el número de miembros de cada grupo', async () => {
    const { json } = await p.pedir('coordinador', 'GET', '/v1/grupos')
    expect(json.datos.map((g: { nombre: string; miembros: number }) => [g.nombre, g.miembros])).toEqual([
      ['Apoyo contenedor Chile', 0],
      ['Turno noche', 3],
    ])
  })

  it('quita un miembro y la ficha del trabajador refleja sus grupos', async () => {
    const r = await p.pedir('admin', 'DELETE', `/v1/grupos/${grupoId}/miembros/${ids[0]}`)
    expect(r.status).toBe(200)
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores/${ids[0]}`)).json.grupoIds).toEqual([])
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores/${ids[1]}`)).json.grupoIds).toEqual([grupoId])
  })

  it('solo el administrador crea grupos; el coordinador no toca miembros', async () => {
    expect((await p.pedir('contabilidad', 'POST', '/v1/grupos', { nombre: 'Otro' })).status).toBe(403)
    const r = await p.pedir('coordinador', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[0]] })
    expect(r.status).toBe(403)
  })

  it('responde 404 al agregar miembros a un grupo que no existe', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/grupos/00000000-0000-4000-8000-00000000ffff/miembros', {
      trabajadorIds: [ids[0]],
    })
    expect(r.status).toBe(404)
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/grupos.test.ts`
Expected: FAIL, `/v1/grupos` responde 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/grupos.ts`:

```ts
import { and, asc, count, eq, getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { grupoTrabajadores, grupos, trabajadores } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Dependencias, Entorno } from '../tipos'

const fecha = z.iso.date().nullable().optional()
const crearGrupo = z.object({
  nombre: z.string().trim().min(2).max(60),
  temporal: z.boolean().default(false),
  fechaInicio: fecha,
  fechaFin: fecha,
})
const editarGrupo = crearGrupo.extend({ activo: z.boolean() }).partial()
const agregarMiembros = z.object({ trabajadorIds: z.array(z.uuid()).min(1).max(200) })
const idsMiembro = z.object({ id: z.uuid(), trabajadorId: z.uuid() })

export const rutasGrupos = ({ db }: Dependencias) =>
  new Hono<Entorno>()
    .get('/', async (c) => {
      const datos = await db
        .select({ ...getTableColumns(grupos), miembros: count(grupoTrabajadores.trabajadorId) })
        .from(grupos)
        .leftJoin(grupoTrabajadores, eq(grupoTrabajadores.grupoId, grupos.id))
        .groupBy(grupos.id)
        .orderBy(asc(grupos.nombre))
      return c.json({ datos })
    })
    .get('/:id', validar('param', esquemaId), async (c) => {
      const { id } = c.req.valid('param')
      const [grupo] = await db.select().from(grupos).where(eq(grupos.id, id))
      if (!grupo) throw noEncontrado('El grupo')
      const miembros = await db
        .select({
          id: trabajadores.id,
          nombres: trabajadores.nombres,
          apellidos: trabajadores.apellidos,
          dni: trabajadores.dni,
        })
        .from(grupoTrabajadores)
        .innerJoin(trabajadores, eq(trabajadores.id, grupoTrabajadores.trabajadorId))
        .where(eq(grupoTrabajadores.grupoId, id))
        .orderBy(asc(trabajadores.apellidos), asc(trabajadores.nombres))
      return c.json({ ...grupo, miembros })
    })
    .post('/', requiereRol('admin'), validar('json', crearGrupo), async (c) => {
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(grupos).values(c.req.valid('json')).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'grupos', nuevo.id, null, nuevo)
        return nuevo
      })
      return c.json(fila, 201)
    })
    .patch('/:id', requiereRol('admin'), validar('param', esquemaId), validar('json', editarGrupo), async (c) => {
      const { id } = c.req.valid('param')
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(grupos).where(eq(grupos.id, id))
        if (!antes) throw noEncontrado('El grupo')
        const [despues] = await tx.update(grupos).set(c.req.valid('json')).where(eq(grupos.id, id)).returning()
        await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, antes, despues)
        return despues
      })
      return c.json(fila)
    })
    .post(
      '/:id/miembros',
      requiereRol('admin', 'contabilidad'),
      validar('param', esquemaId),
      validar('json', agregarMiembros),
      async (c) => {
        const { id } = c.req.valid('param')
        const { trabajadorIds } = c.req.valid('json')
        await db.transaction(async (tx) => {
          const [grupo] = await tx.select().from(grupos).where(eq(grupos.id, id))
          if (!grupo) throw noEncontrado('El grupo')
          await tx
            .insert(grupoTrabajadores)
            .values(trabajadorIds.map((trabajadorId) => ({ grupoId: id, trabajadorId })))
            .onConflictDoNothing()
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, null, { agregados: trabajadorIds })
        })
        return c.json({ ok: true })
      },
    )
    .delete(
      '/:id/miembros/:trabajadorId',
      requiereRol('admin', 'contabilidad'),
      validar('param', idsMiembro),
      async (c) => {
        const { id, trabajadorId } = c.req.valid('param')
        await db.transaction(async (tx) => {
          await tx
            .delete(grupoTrabajadores)
            .where(and(eq(grupoTrabajadores.grupoId, id), eq(grupoTrabajadores.trabajadorId, trabajadorId)))
          await registrarAuditoria(tx, c.get('usuario').id, 'editar', 'grupos', id, { quitado: trabajadorId }, null)
        })
        return c.json({ ok: true })
      },
    )
```

- [ ] **Step 4: Montar la ruta**

En `backend/src/app.ts`:

```ts
import { rutasGrupos } from './rutas/grupos'
```

```ts
    .route('/grupos', rutasGrupos(deps))
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 52 pruebas en total.

- [ ] **Step 6: Commit**

```bash
git add backend
git commit -m "feat(api): add worker groups and membership"
```

---

### Task 10: Usuarios y alta en Supabase Auth

**Files:**
- Create: `backend/src/rutas/usuarios.ts`, `backend/src/auth/admin.ts`
- Modify: `backend/src/app.ts` (montar la ruta)
- Test: `backend/test/usuarios.test.ts`

**Interfaces:**
- Consumes: `Dependencias.authAdmin`, `validar`, `esquemaId`, `requiereRol`, `registrarAuditoria`, `ErrorApi`, `noEncontrado`, tablas `usuarios`, `usuarioAreas`; `creadosEnAuth` del arnés.
- Produces:
  - `rutasUsuarios` (todo solo para administrador): `GET /` (usuarios con `areaIds`), `POST /` con `{ correo, clave, nombre, rol, areaIds }`, `PATCH /:id` con `{ nombre?, rol?, activo?, areaIds? }`. El administrador no puede desactivarse ni quitarse el rol a sí mismo.
  - `crearAuthAdminSupabase(supabaseUrl, claveSecreta): AuthAdmin`: implementación real con `supabase.auth.admin.createUser`. No tiene prueba unitaria porque solo envuelve la llamada; se prueba en la tarea 12 contra el proyecto real.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/usuarios.test.ts`:

```ts
import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let areaId: string
let nuevoId: string

beforeAll(async () => {
  p = await crearPrueba()
  areaId = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
})

describe('usuarios', () => {
  it('solo el administrador entra a /v1/usuarios', async () => {
    for (const rol of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await p.pedir(rol, 'GET', '/v1/usuarios')).status).toBe(403)
    }
  })

  it('crea el usuario en el proveedor de login y en la base, con sus áreas', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'coordina@prueba.test',
      clave: 'clave-segura-1',
      nombre: 'Pedro Coordinador',
      rol: 'coordinador',
      areaIds: [areaId],
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ correo: 'coordina@prueba.test', rol: 'coordinador', areaIds: [areaId] })
    expect(r.json.clave).toBeUndefined()
    expect(p.creadosEnAuth).toEqual([{ id: r.json.id, correo: 'coordina@prueba.test' }])
    nuevoId = r.json.id
  })

  it('no llama al proveedor de login si el correo ya existe', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'coordina@prueba.test',
      clave: 'clave-segura-2',
      nombre: 'Repetido',
      rol: 'gerencia',
    })
    expect(r.status).toBe(409)
    expect(p.creadosEnAuth).toHaveLength(1)
  })

  it('exige una contraseña de al menos 8 caracteres', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'otro@prueba.test',
      clave: 'corta',
      nombre: 'Otro',
      rol: 'gerencia',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('clave')
  })

  it('lista los usuarios con sus áreas', async () => {
    const { json } = await p.pedir('admin', 'GET', '/v1/usuarios')
    expect(json.datos).toHaveLength(5)
    expect(json.datos.find((u: { id: string }) => u.id === nuevoId).areaIds).toEqual([areaId])
  })

  it('edita rol, áreas y estado', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/usuarios/${nuevoId}`, { rol: 'contabilidad', areaIds: [], activo: false })
    expect(r.json).toMatchObject({ rol: 'contabilidad', areaIds: [], activo: false })
  })

  it('el administrador no puede quitarse su propio acceso', async () => {
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { activo: false })).status).toBe(400)
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { rol: 'gerencia' })).status).toBe(400)
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { nombre: 'Lucía Paredes' })).status).toBe(200)
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/usuarios.test.ts`
Expected: FAIL, `/v1/usuarios` responde 404.

- [ ] **Step 3: Escribir las rutas**

`backend/src/rutas/usuarios.ts`:

```ts
import { asc, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requiereRol } from '../auth/middleware'
import { usuarioAreas, usuarios } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import { ErrorApi, noEncontrado } from '../lib/errores'
import { esquemaId, validar } from '../lib/validar'
import type { Db, Dependencias, Entorno, Tx } from '../tipos'

const rol = z.enum(['admin', 'gerencia', 'contabilidad', 'coordinador'])
const crearUsuario = z.object({
  correo: z.email(),
  clave: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(72),
  nombre: z.string().trim().min(2).max(80),
  rol,
  areaIds: z.array(z.uuid()).default([]),
})
const editarUsuario = z
  .object({ nombre: z.string().trim().min(2).max(80), rol, activo: z.boolean(), areaIds: z.array(z.uuid()) })
  .partial()

async function areasDe(db: Db | Tx, usuarioId: string) {
  const filas = await db.select().from(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuarioId))
  return filas.map((f) => f.areaId)
}

async function fijarAreas(tx: Tx, usuarioId: string, areaIds: string[]) {
  await tx.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, usuarioId))
  if (areaIds.length > 0) {
    await tx.insert(usuarioAreas).values(areaIds.map((areaId) => ({ usuarioId, areaId })))
  }
}

export const rutasUsuarios = ({ db, authAdmin }: Dependencias) =>
  new Hono<Entorno>()
    .use('*', requiereRol('admin'))
    .get('/', async (c) => {
      const filas = await db.select().from(usuarios).orderBy(asc(usuarios.nombre))
      const asignadas = await db.select().from(usuarioAreas)
      const datos = filas.map((u) => ({
        ...u,
        areaIds: asignadas.filter((a) => a.usuarioId === u.id).map((a) => a.areaId),
      }))
      return c.json({ datos })
    })
    .post('/', validar('json', crearUsuario), async (c) => {
      const { correo, clave, nombre, rol, areaIds } = c.req.valid('json')
      const [existente] = await db.select().from(usuarios).where(eq(usuarios.correo, correo))
      if (existente) throw new ErrorApi(409, 'duplicado', 'Ya existe un usuario con ese correo', 'correo')
      const { id } = await authAdmin.crearUsuario(correo, clave)
      const fila = await db.transaction(async (tx) => {
        const [nuevo] = await tx.insert(usuarios).values({ id, correo, nombre, rol }).returning()
        await fijarAreas(tx, id, areaIds)
        await registrarAuditoria(tx, c.get('usuario').id, 'crear', 'usuarios', id, null, { ...nuevo, areaIds })
        return nuevo
      })
      return c.json({ ...fila, areaIds }, 201)
    })
    .patch('/:id', validar('param', esquemaId), validar('json', editarUsuario), async (c) => {
      const { id } = c.req.valid('param')
      const { areaIds, ...datos } = c.req.valid('json')
      const yo = c.get('usuario')
      if (id === yo.id && (datos.activo === false || (datos.rol && datos.rol !== 'admin'))) {
        throw new ErrorApi(400, 'validacion', 'No puedes quitarte tu propio acceso de administrador')
      }
      const fila = await db.transaction(async (tx) => {
        const [antes] = await tx.select().from(usuarios).where(eq(usuarios.id, id))
        if (!antes) throw noEncontrado('El usuario')
        const areasAntes = await areasDe(tx, id)
        const [despues] = await tx.update(usuarios).set(datos).where(eq(usuarios.id, id)).returning()
        if (areaIds) await fijarAreas(tx, id, areaIds)
        const areasDespues = areaIds ?? areasAntes
        await registrarAuditoria(
          tx,
          yo.id,
          'editar',
          'usuarios',
          id,
          { ...antes, areaIds: areasAntes },
          { ...despues, areaIds: areasDespues },
        )
        return { ...despues, areaIds: areasDespues }
      })
      return c.json(fila)
    })
```

- [ ] **Step 4: Escribir el cliente real de administración**

`backend/src/auth/admin.ts`:

```ts
import { createClient } from '@supabase/supabase-js'
import { ErrorApi } from '../lib/errores'
import type { AuthAdmin } from '../tipos'

export function crearAuthAdminSupabase(supabaseUrl: string, claveSecreta: string): AuthAdmin {
  const supabase = createClient(supabaseUrl, claveSecreta, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return {
    async crearUsuario(correo, clave) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: correo,
        password: clave,
        email_confirm: true,
      })
      if (error || !data.user) {
        throw new ErrorApi(409, 'usuario_auth', error?.message ?? 'No se pudo crear el usuario', 'correo')
      }
      return { id: data.user.id }
    },
  }
}
```

- [ ] **Step 5: Montar la ruta**

En `backend/src/app.ts`:

```ts
import { rutasUsuarios } from './rutas/usuarios'
```

```ts
    .route('/usuarios', rutasUsuarios(deps))
```

Al terminar, `backend/src/app.ts` debe quedar así (el orden de las rutas no importa):

```ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { autenticar } from './auth/middleware'
import { manejarError } from './lib/errores'
import { rutasAuditoria } from './rutas/auditoria'
import { rutasCargos } from './rutas/cargos'
import { rutasAreas, rutasCampanas, rutasTurnos } from './rutas/catalogos'
import { rutasGrupos } from './rutas/grupos'
import { rutasMe } from './rutas/me'
import { rutasMetodosPago } from './rutas/metodos-pago'
import { rutasTrabajadores } from './rutas/trabajadores'
import { rutasUsuarios } from './rutas/usuarios'
import type { Dependencias, Entorno } from './tipos'

export function crearApp(deps: Dependencias) {
  const v1 = new Hono<Entorno>()
    .use('*', autenticar(deps))
    .route('/me', rutasMe(deps))
    .route('/areas', rutasAreas(deps))
    .route('/turnos', rutasTurnos(deps))
    .route('/campanas', rutasCampanas(deps))
    .route('/cargos', rutasCargos(deps))
    .route('/grupos', rutasGrupos(deps))
    .route('/trabajadores', rutasTrabajadores(deps))
    .route('/trabajadores', rutasMetodosPago(deps))
    .route('/usuarios', rutasUsuarios(deps))
    .route('/auditoria', rutasAuditoria(deps))

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
```

- [ ] **Step 6: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 59 pruebas en total.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(api): add user management backed by Supabase Auth"
```

---

### Task 11: Entorno, conexión, servidor y scripts

**Files:**
- Create: `backend/src/env.ts`, `backend/src/db/client.ts`, `backend/src/server.ts`
- Create: `backend/scripts/migrar.ts`, `backend/scripts/crear-admin.ts`, `backend/.env.example`
- Test: `backend/test/env.test.ts`

**Interfaces:**
- Consumes: `crearApp`, `crearVerificadorSupabase`, `crearAuthAdminSupabase`, tabla `usuarios`.
- Produces:
  - `leerEnv(origen = process.env): Env` con `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ORIGEN_PANEL` (por defecto `http://localhost:3000`), `PUERTO` (por defecto 8787). Si falta algo, lanza un error que nombra las variables.
  - `crearDb(url)` devuelve `{ db, cerrar }` con postgres.js y `prepare: false`.
  - `npm run dev -w @agrosalas/backend`: API en `http://localhost:8787`.
  - `npm run db:migrar -w @agrosalas/backend` y `npm run crear-admin -w @agrosalas/backend -- <correo> "<nombre>" "<contraseña>"`.

- [ ] **Step 1: Escribir la prueba que falla**

`backend/test/env.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { leerEnv } from '../src/env'

const completo = {
  DATABASE_URL: 'postgres://u:c@host:5432/postgres',
  SUPABASE_URL: 'https://proyecto.supabase.co',
  SUPABASE_SECRET_KEY: 'secreta',
}

describe('leerEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(leerEnv(completo)).toMatchObject({ ORIGEN_PANEL: 'http://localhost:3000', PUERTO: 8787 })
  })

  it('nombra las variables que faltan', () => {
    expect(() => leerEnv({ DATABASE_URL: 'x' })).toThrow(/SUPABASE_URL, SUPABASE_SECRET_KEY/)
  })
})
```

- [ ] **Step 2: Ejecutarla y verla fallar**

Run: `npm test -w @agrosalas/backend -- test/env.test.ts`
Expected: FAIL, no encuentra `../src/env`.

- [ ] **Step 3: Escribir entorno y conexión**

`backend/src/env.ts`:

```ts
import { z } from 'zod'

const esquema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: z.url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ORIGEN_PANEL: z.url().default('http://localhost:3000'),
  PUERTO: z.coerce.number().int().default(8787),
})

export type Env = z.infer<typeof esquema>

export function leerEnv(origen: Record<string, string | undefined> = process.env): Env {
  const resultado = esquema.safeParse(origen)
  if (!resultado.success) {
    const faltan = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variables de entorno inválidas o ausentes: ${faltan}`)
  }
  return resultado.data
}
```

`backend/src/db/client.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { Db } from '../tipos'
import * as schema from './schema'

// prepare: false es obligatorio con el pooler de Supabase en modo transacción.
export function crearDb(url: string): { db: Db; cerrar: () => Promise<void> } {
  const cliente = postgres(url, { prepare: false })
  return { db: drizzle(cliente, { schema }), cerrar: () => cliente.end() }
}
```

- [ ] **Step 4: Escribir el servidor y los scripts**

`backend/src/server.ts`:

```ts
import { serve } from '@hono/node-server'
import { crearApp } from './app'
import { crearAuthAdminSupabase } from './auth/admin'
import { crearVerificadorSupabase } from './auth/verificar'
import { crearDb } from './db/client'
import { leerEnv } from './env'

const env = leerEnv()
const { db } = crearDb(env.DATABASE_URL)

const app = crearApp({
  db,
  verificarToken: crearVerificadorSupabase(env.SUPABASE_URL),
  authAdmin: crearAuthAdminSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY),
  origenPanel: env.ORIGEN_PANEL,
})

serve({ fetch: app.fetch, port: env.PUERTO }, (info) => {
  console.log(`API en http://localhost:${info.port}`)
})
```

`backend/scripts/migrar.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { leerEnv } from '../src/env'

const cliente = postgres(leerEnv().DATABASE_URL, { prepare: false, max: 1 })
await migrate(drizzle(cliente), { migrationsFolder: './drizzle' })
await cliente.end()
console.log('Migraciones aplicadas')
```

`backend/scripts/crear-admin.ts`:

```ts
// Crea el primer administrador: npm run crear-admin -- correo@dominio.com "Nombre Apellido" "contraseña"
import { crearAuthAdminSupabase } from '../src/auth/admin'
import { crearDb } from '../src/db/client'
import { usuarios } from '../src/db/schema'
import { leerEnv } from '../src/env'

const [correo, nombre, clave] = process.argv.slice(2)
if (!correo || !nombre || !clave || clave.length < 8) {
  console.error('Uso: npm run crear-admin -- <correo> "<nombre>" "<contraseña de 8 o más caracteres>"')
  process.exit(1)
}

const env = leerEnv()
const { db, cerrar } = crearDb(env.DATABASE_URL)
const { id } = await crearAuthAdminSupabase(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY).crearUsuario(correo, clave)
await db.insert(usuarios).values({ id, correo, nombre, rol: 'admin' })
await cerrar()
console.log(`Administrador creado: ${correo}`)
```

`backend/.env.example`:

```dotenv
# Cadena "Session pooler" del proyecto Supabase (Connect → Session pooler).
DATABASE_URL=postgresql://postgres.<ref>:<contraseña>@aws-0-<region>.pooler.supabase.com:5432/postgres
SUPABASE_URL=https://<ref>.supabase.co
# Clave secreta del proyecto (sb_secret_… o service_role). Nunca va al frontend.
SUPABASE_SECRET_KEY=
ORIGEN_PANEL=http://localhost:3000
PUERTO=8787
```

- [ ] **Step 5: Ejecutar pruebas y tipos**

Run: `npm test -w @agrosalas/backend && npm run typecheck -w @agrosalas/backend`
Expected: PASS, 61 pruebas en total.

- [ ] **Step 6: Comprobar que el servidor arranca**

Con valores de mentira basta para ver que arranca (la conexión a la base es perezosa):

```bash
cd backend
printf 'DATABASE_URL=postgres://u:c@127.0.0.1:1/x\nSUPABASE_URL=https://proyecto.supabase.co\nSUPABASE_SECRET_KEY=x\n' > .env
npx tsx --env-file=.env src/server.ts &
sleep 3
curl -s http://localhost:8787/salud
curl -s http://localhost:8787/v1/me
kill %1
rm .env
cd ..
```

Expected: `{"ok":true}` y luego `{"error":{"codigo":"no_autenticado","mensaje":"Inicia sesión para continuar"}}`.

- [ ] **Step 7: Commit**

```bash
git add backend
git commit -m "feat(api): add env validation, database client, server entry and scripts"
```

---

### Task 12: Proyecto Supabase de desarrollo y primer administrador

Esta tarea usa la cuenta de Supabase de Gonzalo y define una contraseña real: la hace él, o se hace con él presente. Un agente no debe crear cuentas ni inventar contraseñas por su cuenta. No produce cambios en el repo.

**Files:**
- Create: `backend/.env` (local, ignorado por git)

**Interfaces:**
- Consumes: `npm run db:migrar`, `npm run crear-admin`, `npm run dev:api`.
- Produces: un proyecto Supabase de desarrollo con las 11 tablas, el registro público desactivado y un usuario administrador; los valores `SUPABASE_URL` y la clave pública (publishable) que usará el plan 1B.

- [ ] **Step 1: Crear el proyecto**

En https://supabase.com/dashboard crea un proyecto `agrosalas-admin-dev` en la región `South America (São Paulo)`. Guarda la contraseña de la base en un gestor de contraseñas.

- [ ] **Step 2: Cerrar el registro público**

En Authentication → Sign In / Providers, desactiva "Allow new users to sign up". En Authentication → URL Configuration, pon `http://localhost:3000` como Site URL y agrega `http://localhost:3000/restablecer` a Redirect URLs.

- [ ] **Step 3: Comprobar que los tokens se firman con claves asimétricas**

```bash
curl -s https://<ref>.supabase.co/auth/v1/.well-known/jwks.json
```

Expected: un JSON con al menos una clave en `keys`. Si `keys` está vacío, en Project Settings → JWT Keys migra el proyecto a "JWT signing keys" y rota a una clave asimétrica; la API valida los tokens contra ese JWKS.

- [ ] **Step 4: Llenar `backend/.env`**

Copia `backend/.env.example` a `backend/.env` y completa `DATABASE_URL` (Connect → Session pooler), `SUPABASE_URL` y `SUPABASE_SECRET_KEY` (Project Settings → API Keys → Secret key).

- [ ] **Step 5: Aplicar las migraciones**

Run: `npm run db:migrar -w @agrosalas/backend`
Expected: `Migraciones aplicadas`. En Table Editor aparecen las 11 tablas con el aviso "RLS enabled" y sin políticas. El asesor de seguridad de Supabase mostrará avisos informativos de "RLS activado sin políticas": es lo esperado, porque solo la API accede a la base.

- [ ] **Step 6: Crear el primer administrador**

Run: `npm run crear-admin -w @agrosalas/backend -- <tu correo> "<tu nombre>" "<contraseña de 8 o más caracteres>"`
Expected: `Administrador creado: <tu correo>`.

- [ ] **Step 7: Probar la API de punta a punta**

En una terminal: `npm run dev:api`. En otra, con la clave pública (Project Settings → API Keys → Publishable key):

```bash
TOKEN=$(curl -s "https://<ref>.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: <clave pública>" -H "Content-Type: application/json" \
  -d '{"email":"<tu correo>","password":"<tu contraseña>"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).access_token')
curl -s http://localhost:8787/v1/me -H "Authorization: Bearer $TOKEN"
```

Expected: `{"id":"…","correo":"<tu correo>","nombre":"<tu nombre>","rol":"admin","areaIds":[]}`.

---

### Task 13: Verificación automática y README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: scripts raíz `typecheck` y `test`.
- Produces: un workflow que corre tipos y pruebas en cada PR y en cada push a `master`. El plan 1B le agrega lint y build del frontend.

- [ ] **Step 1: Escribir el workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [master]

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Escribir el README**

`README.md`:

```markdown
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

## Comandos

| Comando | Qué hace |
|---|---|
| `npm test` | Pruebas de todos los workspaces. Las del backend usan una base en memoria: no necesitan Docker ni red. |
| `npm run typecheck` | Tipos de todos los workspaces |
| `npm run db:generar -w @agrosalas/backend -- --name <nombre>` | Genera una migración a partir de `backend/src/db/schema.ts` |
| `npm run db:migrar -w @agrosalas/backend` | Aplica las migraciones a la base de `backend/.env` |

## Reglas

- Los permisos se aplican en la API, no en la pantalla.
- Toda tabla nueva lleva `.enableRLS()` y ninguna política: solo la API accede a la base.
- Todo cambio de datos deja una fila en `auditoria`.
- Nunca se versionan `.env` ni archivos con datos personales.
```

- [ ] **Step 3: Verificar lo mismo que correrá el workflow**

Run: `npm ci && npm run typecheck && npm test`
Expected: PASS, 61 pruebas.

- [ ] **Step 4: Commit**

```bash
git add .github README.md
git commit -m "ci: run typecheck and tests on every pull request"
```

---

## Fuera de este plan

- Pantallas: plan 1B.
- Despliegue (Vercel o Cloudflare Workers), proyecto Supabase de producción y respaldos: se deciden al desplegar (spec, secciones 3, 13 y 16).
- Planillas, asistencia y cálculo: fase 2. Pagos y evidencias (Storage): fase 3.
- El repo aún no tiene remoto en GitHub; crearlo y subir la rama lo decide Gonzalo. El workflow solo corre cuando exista.
