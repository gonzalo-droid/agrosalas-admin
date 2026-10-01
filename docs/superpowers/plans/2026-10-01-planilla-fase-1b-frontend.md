# Planilla fase 1B: pantallas base — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando las pantallas de la base del panel: inicio de sesión, recuperación de contraseña, perfil, menú, Configuración (cargos y tarifas, grupos, áreas, turnos, campañas, usuarios, auditoría) y Trabajadores (lista con filtros y paginador, ficha con métodos de pago y grupos).

**Architecture:** `frontend/` es una app Next.js 16 (App Router) dentro del mismo workspace. Inicia sesión con Supabase Auth en el navegador y llama a la API del plan 1A con el cliente tipado de Hono (`hc<AppType>`), enviando el token de sesión como `Authorization: Bearer`. `src/proxy.ts` refresca la sesión y redirige al login. Los datos se leen y escriben con TanStack Query. El frontend nunca toca la base de datos.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui (estilo `base-nova`, sobre Base UI), @supabase/ssr, @tanstack/react-query 5, hono/client, sonner, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md` (secciones 3, 4, 10 y fase 1 de la sección 15). Prototipo visual de referencia: https://claude.ai/artifact/CQCMfcsgQu5ceS96UMBXmU

**Plan previo:** `docs/superpowers/plans/2026-10-01-planilla-fase-1a-backend.md`. Debe estar terminado: este plan importa el tipo `AppType` de `@agrosalas/backend/app` y usa sus endpoints. El plan 1A ya se ejecutó; su sección "Estado de ejecución" lista lo que cambió respecto de su texto. Lo que afecta a las pantallas: los mensajes de validación de la API ya llegan en español, un PATCH sin campos responde 400, y `GET /v1/grupos/:id` solo devuelve al coordinador los miembros de sus áreas.

## Global Constraints

- El frontend solo habla con la API. No importa Drizzle ni se conecta a Postgres.
- En el frontend solo existen variables `NEXT_PUBLIC_*`: URL de Supabase, clave pública y URL de la API. La clave secreta nunca aparece aquí.
- Ocultar botones según el rol es comodidad; el permiso real lo aplica la API.
- Toda la interfaz en español. Montos como `S/ 1,800.00`.
- Identidad: verde de marca `#15803d` como color primario, menú `#0f3d24`, tipografía Inter, fondo claro.
- Todo control de formulario lleva etiqueta (`<label>` o `aria-label`).
- Next.js 16: el middleware se llama `src/proxy.ts` y exporta `proxy`. Antes de desviarte de este plan, lee la guía correspondiente en `node_modules/next/dist/docs/`.
- Los componentes de shadcn/ui que genera hoy la CLI están hechos sobre Base UI, no sobre Radix: `Dialog` recibe `open` y `onOpenChange(open)`, y no existe `asChild`. Para un enlace con aspecto de botón se usa `buttonVariants(...)` en el `className` de `Link`.
- Las llamadas a la API pasan siempre por `leer(api.v1...)`, que lanza `ErrorApiCliente` con el mensaje del servidor.
- Rama `feat/fase-1-base`; commits con Conventional Commits y scope (`feat(web): …`).
- Los comandos se ejecutan desde la raíz del repo salvo que se indique otra carpeta.

## Estado de verificación

El código de este plan se compiló en una carpeta temporal el 2026-10-01 junto con el backend del plan 1A: `eslint` sin avisos, `tsc --noEmit` sin errores, `next build` correcto con las 18 rutas, 4 pruebas unitarias en verde y la redirección al login comprobada con `curl`. No se probó contra un proyecto Supabase real: eso es la verificación manual de la tarea 11.

Las pantallas no llevan pruebas automáticas en esta fase; se prueban las utilidades puras. El spec deja las pruebas de componentes para la grilla semanal y el marcado de asistencia (fase 2).

## Estado de ejecución (2026-10-01)

Ejecutado en la rama `feat/fase-1b-frontend` (creada desde `feat/fase-1-base`), tareas 1 a 11. Queda pendiente el paso 4 de la tarea 11: la prueba manual contra un proyecto Supabase real, que hace Gonzalo. Nada de esta rama se ha probado aún en un navegador contra Supabase; se verificó con lint, tipos, build, pruebas unitarias (91 en el frontend, 148 en el backend), `curl` contra `next start` y, en la revisión final, 35 llamadas con los cuerpos de cada pantalla contra la API real en memoria.

**El código del repo manda sobre los bloques de código de este plan.** Las revisiones encontraron defectos en el código del propio plan y se corrigieron. Diferencias principales:

| Dónde | Qué cambió y por qué |
|---|---|
| `src/app/restablecer/page.tsx`, `src/lib/errores-acceso.ts` | El formulario de nueva contraseña solo aparece tras verificar una recuperación real (enlace con `token_hash`, o el evento de recuperación del enlace por defecto). Antes podía cambiar la contraseña de quien tuviera sesión abierta en ese navegador. |
| `src/proxy.ts` | La cookie de sesión refrescada sale con cabeceras `no-store` y no se pierde en las redirecciones. |
| `src/components/proveedores.tsx`, `src/lib/sesion.ts`, `src/app/(panel)/layout.tsx` | La caché de datos se vacía al cambiar de usuario; una sesión vencida (401) se maneja en un solo sitio; el panel siempre ofrece "Reintentar" y "Cerrar sesión" (antes un usuario desactivado quedaba atrapado); cerrar sesión ya no la cierra en los demás dispositivos. |
| `src/lib/api.ts` | Un fallo de red se muestra en español ("No se pudo conectar…") y no con el texto del navegador; solo se muestran mensajes de la API. |
| `src/app/login`, `src/app/recuperar`, `src/app/(panel)/perfil` | Distinguen falta de conexión, demasiados intentos y credenciales incorrectas. |
| `src/components/catalogo.tsx`, `src/lib/catalogo-valores.ts` | Los errores de todo tipo de campo se muestran; los vacíos viajan como `null`; un campo puede ocultarse según otro (`visibleSi`): en Cargos, las tarifas que no aplican se ocultan y se limpian; `derivar` solo actúa al crear; el diálogo puede desplazarse. |
| `configuracion/usuarios` | El rol preseleccionado es Coordinador (antes Administrador); se ven las áreas inactivas ya asignadas. |
| `configuracion/auditoria`, `src/lib/auditoria.ts` | La columna "Cambio" muestra solo lo que cambió y enmascara DNI, teléfonos, dirección, número de cuenta y CCI (antes volcaba el JSON completo); tiene estados de error y vacío. |
| `configuracion/grupos/[id]` | El buscador de miembros indica mínimo de letras, búsqueda en curso, sin resultados y error. |
| `trabajadores` (lista) | La búsqueda espera 300 ms antes de pedir datos y la tabla conserva las filas mientras carga. |
| `trabajadores/[id]`, `src/components/trabajadores/*` | Gerencia ve métodos de pago y grupos en solo lectura; el coordinador ve grupos en solo lectura y ningún método de pago; la ficha de solo lectura es legible y copiable; quitar un método de pago pide confirmación; se evita el doble clic; un DNI duplicado se indica bajo el campo DNI. |
| `src/app/not-found.tsx`, `src/app/error.tsx`, `next.config.ts` | Páginas de error en español, cabeceras de seguridad y redirecciones de `/` y `/configuracion` en el servidor (se eliminaron las dos páginas que solo redirigían). |
| `README.md` | Lista de comprobación de despliegue y Supabase, incluida la plantilla del correo de recuperación con `token_hash`. |

Pendiente para la fase 2 (lo dejó anotado la revisión final): hacer `Catalogo` genérico por tipo de fila y usarlo solo para catálogos planos; un registro de claves de consulta; una prueba de contrato permanente para los cuerpos que hoy se envían con `as never`; títulos por página; identificadores crudos en la auditoría; unificar la versión de TypeScript; el menú inferior del celular cuando haya seis entradas; un tamaño táctil para los botones.

A la lista de la prueba manual (tarea 11, paso 4) hay que sumar: abrir el enlace de recuperación en otro navegador o dispositivo; abrirlo con otro usuario ya logueado; entrar con un usuario distinto después de que la sesión terminó sin usar el botón; ver la ficha como Gerencia y como Coordinador a 390 px; y arrancar `dev:web` con el puerto 3000 ocupado.

**Nombres en inglés (regla nueva del 2026-10-01).** Este plan se ejecutó con identificadores en español (`proveedores.tsx`, `/trabajadores`, `leer`, `ErrorApiCliente`). El spec, sección 17, pide todo el código en inglés y deja en español solo el texto que ve el usuario. Ese cambio de nombres ya se hizo: lo ejecutó el plan `2026-10-01-planilla-fase-1c-english-naming.md`, en la rama `refactor/english-naming`. **El código del repo manda sobre los nombres de este texto**: los archivos, identificadores, rutas y direcciones que aparecen aquí son los de la época y hoy se llaman distinto (la equivalencia está en la sección 17 del spec y en las tablas del plan 1C). La prueba manual contra Supabase va después de ese plan.

**Revisión de la tanda final de arreglos.** Dio por resueltos todos los hallazgos (grupos A a H) y no encontró fallos críticos ni importantes. Dejó dos mejoras menores en `src/lib/recuperacion.ts`, sin aplicar aquí para no chocar con el cambio de nombres en curso; se aplican sobre el plan 1C:

- `verificarToken` da el enlace por válido si `verifyOtp` responde sin error, aunque no devuelva sesión. Debe exigir `data.session`. Supabase siempre devuelve sesión en una recuperación, así que hoy no falla; es una segunda barrera.
- Si `verifyOtp` o la creación del cliente lanzan un error que no es de autenticación, la página se queda en "Comprobando el enlace…". Debe tratarse como enlace no válido. No muestra el formulario, así que no hay riesgo, solo una pantalla sin salida.

## Mapa de archivos

Todas las rutas son relativas a `frontend/`.

| Archivo | Responsabilidad |
|---|---|
| `src/app/layout.tsx`, `src/app/globals.css` | Documento raíz, tipografía y color de marca |
| `src/components/proveedores.tsx` | TanStack Query y avisos (toasts) |
| `src/lib/paginas.ts`, `src/lib/formato.ts` | Utilidades puras, con pruebas |
| `src/components/campo.tsx`, `src/components/paginador.tsx` | Campo con etiqueta y error; paginador |
| `src/lib/supabase/navegador.ts`, `src/proxy.ts` | Sesión de Supabase y redirección al login |
| `src/components/marco-acceso.tsx`, `src/app/login`, `src/app/recuperar`, `src/app/restablecer` | Pantallas sin sesión |
| `src/lib/api.ts`, `src/lib/yo.ts`, `src/lib/catalogos.ts` | Cliente tipado, usuario actual, catálogos compartidos |
| `src/components/panel/menu.tsx`, `src/app/(panel)/layout.tsx` | Menú lateral (PC) e inferior (celular) |
| `src/app/(panel)/perfil/page.tsx` | Mi perfil |
| `src/components/catalogo.tsx` | Tabla + formulario genérico para catálogos |
| `src/app/(panel)/configuracion/**` | Cargos, grupos, áreas, turnos, campañas, usuarios, auditoría |
| `src/app/(panel)/trabajadores/**`, `src/components/trabajadores/*` | Lista, alta y ficha del trabajador |

---

### Task 1: Andamiaje del frontend

**Files:**
- Create: `frontend/` (generado por `create-next-app` y `shadcn`)
- Create: `frontend/src/components/proveedores.tsx`, `frontend/.env.example`, `frontend/.env.local`
- Modify: `package.json` (raíz), `frontend/package.json`, `frontend/.gitignore`, `frontend/src/app/globals.css`, `frontend/src/app/layout.tsx`

**Interfaces:**
- Consumes: el workspace raíz del plan 1A y el paquete `@agrosalas/backend`.
- Produces:
  - Workspace `@agrosalas/frontend` con scripts `dev`, `build`, `lint`, `typecheck`, `test`.
  - Scripts raíz `dev:web`, `lint`, `build`.
  - `Proveedores` (`@/components/proveedores`): envuelve la app con `QueryClientProvider` y `Toaster`.
  - Componentes de shadcn en `@/components/ui`: `button`, `input`, `label`, `badge`, `dialog`, `table`, `sonner`. `cn` en `@/lib/utils`.

- [ ] **Step 1: Generar la app**

```bash
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
rm -rf frontend/.git frontend/node_modules frontend/package-lock.json frontend/README.md
```

Si el generador pregunta algo más, acepta el valor por defecto. Los archivos `frontend/AGENTS.md` y `frontend/CLAUDE.md` que crea Next se conservan y se versionan.

- [ ] **Step 2: Sumar el frontend al workspace**

Reemplaza `package.json` de la raíz:

```json
{
  "name": "agrosalas-admin",
  "private": true,
  "workspaces": [
    "backend",
    "frontend"
  ],
  "scripts": {
    "dev:api": "npm run dev -w @agrosalas/backend",
    "dev:web": "npm run dev -w @agrosalas/frontend",
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present",
    "lint": "npm run lint -w @agrosalas/frontend",
    "build": "npm run build -w @agrosalas/frontend"
  },
  "engines": {
    "node": ">=22"
  }
}
```

En `frontend/package.json` cambia `"name": "frontend"` por `"name": "@agrosalas/frontend"` y agrega dos scripts:

```json
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
```

En `frontend/.gitignore`, debajo de la línea `.env*`, agrega:

```gitignore
!.env.example
```

- [ ] **Step 3: Instalar dependencias**

```bash
npm install
npm install -w @agrosalas/frontend @supabase/ssr @supabase/supabase-js @tanstack/react-query hono
npm install -w @agrosalas/frontend -D @agrosalas/backend@0.1.0 vitest
```

Expected: `node_modules/@agrosalas/backend` es un enlace a `backend/`.

- [ ] **Step 4: Instalar shadcn/ui y sus componentes**

```bash
cd frontend
npx shadcn@latest init -d
npx shadcn@latest add input label badge dialog table sonner -y
cd ..
```

Expected: crea `frontend/components.json`, `frontend/src/lib/utils.ts` y los componentes en `frontend/src/components/ui/`.

- [ ] **Step 5: Aplicar el color de marca**

En `frontend/src/app/globals.css`, dentro del bloque `:root { … }` (no en `.dark`), deja estas tres variables con estos valores:

```css
  --primary: #15803d;
  --primary-foreground: #ffffff;
  --ring: #15803d;
```

- [ ] **Step 6: Escribir proveedores y layout raíz**

`frontend/src/components/proveedores.tsx`:

```tsx
'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'

export function Proveedores({ children }: { children: React.ReactNode }) {
  const [cliente] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } } }),
  )
  return (
    <QueryClientProvider client={cliente}>
      {children}
      <Toaster position="top-center" />
    </QueryClientProvider>
  )
}
```

Reemplaza `frontend/src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Proveedores } from '@/components/proveedores'
import './globals.css'

const inter = Inter({ variable: '--font-sans', subsets: ['latin'] })

export const metadata: Metadata = {
  title: { default: 'Agrosalas Admin', template: '%s · Agrosalas Admin' },
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-muted/40">
        <Proveedores>{children}</Proveedores>
      </body>
    </html>
  )
}
```

- [ ] **Step 7: Variables de entorno**

`frontend/.env.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
# Clave pública (publishable) del proyecto. La secreta nunca va aquí.
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8787
```

Copia ese archivo a `frontend/.env.local` y complétalo con los valores del proyecto Supabase de desarrollo (plan 1A, tarea 12).

- [ ] **Step 8: Verificar**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sin errores; el build lista la ruta `/`.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json frontend
git commit -m "chore(web): scaffold Next.js frontend with shadcn/ui and brand theme"
```

---

### Task 2: Utilidades de interfaz

**Files:**
- Create: `frontend/src/lib/paginas.ts`, `frontend/src/lib/formato.ts`
- Create: `frontend/src/components/campo.tsx`, `frontend/src/components/paginador.tsx`
- Test: `frontend/src/lib/paginas.test.ts`, `frontend/src/lib/formato.test.ts`

**Interfaces:**
- Consumes: `Button`, `Label` de shadcn; `cn`.
- Produces:
  - `totalPaginas(total, tamano): number` y `rangoMostrado(pagina, tamano, total): string`.
  - `formatoSoles(monto: number | null | undefined): string` y `horaExtraPropuesta(tarifaHora: number): number`.
  - `Campo({ id, etiqueta, ayuda?, error?, className?, children })` y la constante `claseControl` (clases para `<select>` nativo).
  - `Paginador({ pagina, tamano, total, alCambiar })`, donde `alCambiar` recibe `{ pagina, tamano }`.

- [ ] **Step 1: Escribir las pruebas que fallan**

`frontend/src/lib/paginas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { rangoMostrado, totalPaginas } from './paginas'

describe('totalPaginas', () => {
  it('redondea hacia arriba y nunca baja de 1', () => {
    expect(totalPaginas(0, 25)).toBe(1)
    expect(totalPaginas(25, 25)).toBe(1)
    expect(totalPaginas(26, 25)).toBe(2)
  })
})

describe('rangoMostrado', () => {
  it('describe el tramo visible', () => {
    expect(rangoMostrado(1, 25, 73)).toBe('Mostrando 1–25 de 73')
    expect(rangoMostrado(3, 25, 73)).toBe('Mostrando 51–73 de 73')
    expect(rangoMostrado(1, 25, 0)).toBe('Sin resultados')
  })
})
```

`frontend/src/lib/formato.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatoSoles, horaExtraPropuesta } from './formato'

describe('formatoSoles', () => {
  it('muestra dos decimales y un guion cuando no hay monto', () => {
    expect(formatoSoles(7.8125)).toBe('S/ 7.81')
    expect(formatoSoles(1800)).toBe('S/ 1,800.00')
    expect(formatoSoles(null)).toBe('–')
  })
})

describe('horaExtraPropuesta', () => {
  it('es la hora normal más 25 %', () => {
    expect(horaExtraPropuesta(6.25)).toBe(7.8125)
    expect(horaExtraPropuesta(10)).toBe(12.5)
    expect(horaExtraPropuesta(30)).toBe(37.5)
  })
})
```

- [ ] **Step 2: Ejecutarlas y verlas fallar**

Run: `npm test -w @agrosalas/frontend`
Expected: FAIL, no encuentra `./paginas` ni `./formato`.

- [ ] **Step 3: Implementar las utilidades**

`frontend/src/lib/paginas.ts`:

```ts
export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / tamano))

// "Mostrando 26–50 de 73"
export function rangoMostrado(pagina: number, tamano: number, total: number) {
  if (total === 0) return 'Sin resultados'
  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)
  return `Mostrando ${desde}–${hasta} de ${total}`
}
```

`frontend/src/lib/formato.ts`:

```ts
const soles = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// 7.8125 → "S/ 7.81"; null → "–"
export const formatoSoles = (monto: number | null | undefined) => (monto == null ? '–' : `S/ ${soles.format(monto)}`)

// Hora extra propuesta: la normal más 25 %, con cuatro decimales como máximo.
export const horaExtraPropuesta = (tarifaHora: number) => Math.round(tarifaHora * 1.25 * 10000) / 10000
```

- [ ] **Step 4: Ejecutar las pruebas**

Run: `npm test -w @agrosalas/frontend`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Escribir `Campo` y `Paginador`**

`frontend/src/components/campo.tsx`:

```tsx
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export const claseControl =
  'h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

// Etiqueta + control + ayuda o error, siempre en el mismo orden.
export function Campo({
  id,
  etiqueta,
  ayuda,
  error,
  className,
  children,
}: {
  id: string
  etiqueta: string
  ayuda?: string
  error?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{etiqueta}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : ayuda ? <p className="text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  )
}
```

`frontend/src/components/paginador.tsx`:

```tsx
'use client'

import { Button } from '@/components/ui/button'
import { rangoMostrado, totalPaginas } from '@/lib/paginas'
import { claseControl } from './campo'

const TAMANOS = [10, 25, 50]

export function Paginador({
  pagina,
  tamano,
  total,
  alCambiar,
}: {
  pagina: number
  tamano: number
  total: number
  alCambiar: (cambio: { pagina: number; tamano: number }) => void
}) {
  const paginas = totalPaginas(total, tamano)
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">{rangoMostrado(pagina, tamano, total)}</p>
      <nav aria-label="Paginación" className="flex items-center gap-2">
        <label htmlFor="filas-por-pagina" className="text-muted-foreground">
          Filas por página
        </label>
        <select
          id="filas-por-pagina"
          className={`${claseControl} w-20`}
          value={tamano}
          onChange={(e) => alCambiar({ pagina: 1, tamano: Number(e.target.value) })}
        >
          {TAMANOS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <Button variant="outline" size="lg" disabled={pagina <= 1} onClick={() => alCambiar({ pagina: pagina - 1, tamano })}>
          Anterior
        </Button>
        <span aria-current="page" className="px-1 tabular-nums">
          {pagina} de {paginas}
        </span>
        <Button variant="outline" size="lg" disabled={pagina >= paginas} onClick={() => alCambiar({ pagina: pagina + 1, tamano })}>
          Siguiente
        </Button>
      </nav>
    </div>
  )
}
```

- [ ] **Step 6: Verificar y commit**

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

```bash
git add frontend
git commit -m "feat(web): add field, paginator and formatting helpers"
```

---

### Task 3: Sesión: login, recuperación y redirección

**Files:**
- Create: `frontend/src/lib/supabase/navegador.ts`, `frontend/src/proxy.ts`
- Create: `frontend/src/components/marco-acceso.tsx`
- Create: `frontend/src/app/login/page.tsx`, `frontend/src/app/recuperar/page.tsx`, `frontend/src/app/restablecer/page.tsx`

**Interfaces:**
- Consumes: `Campo`, `Button`, `Input`, `toast` de sonner.
- Produces:
  - `supabaseNavegador()`: cliente de Supabase para el navegador (una sola instancia).
  - `proxy(request)`: sin sesión redirige a `/login` salvo en `/login`, `/recuperar` y `/restablecer`; con sesión, `/login` redirige a `/`.
  - `MarcoAcceso({ titulo, children })`.
  - Rutas `/login`, `/recuperar`, `/restablecer`.

- [ ] **Step 1: Cliente de Supabase y proxy**

`frontend/src/lib/supabase/navegador.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr'

// En el navegador, createBrowserClient devuelve siempre la misma instancia.
export const supabaseNavegador = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
```

`frontend/src/proxy.ts`:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLICAS = ['/login', '/recuperar', '/restablecer']

// Refresca la sesión de Supabase y manda al login a quien no la tiene.
// Los permisos reales los aplica la API; esto solo decide qué pantalla se muestra.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          cookies.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookies.forEach(({ name, value, options }) => respuesta.cookies.set(name, value, options))
        },
      },
    },
  )

  const { data } = await supabase.auth.getClaims()
  const conSesion = Boolean(data?.claims)
  const ruta = request.nextUrl.pathname
  const esPublica = PUBLICAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))

  if (!conSesion && !esPublica) {
    const destino = request.nextUrl.clone()
    destino.pathname = '/login'
    destino.search = ''
    return NextResponse.redirect(destino)
  }
  if (conSesion && ruta === '/login') {
    const destino = request.nextUrl.clone()
    destino.pathname = '/'
    return NextResponse.redirect(destino)
  }
  return respuesta
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)'],
}
```

- [ ] **Step 2: Marco de las pantallas sin sesión**

`frontend/src/components/marco-acceso.tsx`:

```tsx
// Marco de las pantallas sin sesión: login, recuperar y restablecer contraseña.
export function MarcoAcceso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="hidden flex-col justify-between bg-[#0f3d24] p-14 text-white lg:flex">
        <p className="text-xl font-semibold">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        <div className="space-y-3">
          <p className="text-3xl leading-tight font-semibold">Panel interno de Agrosalas Perú</p>
          <p className="text-[#cfe8d8]">Planilla, inventario, compras y ventas.</p>
        </div>
        <p className="text-sm text-[#a7e3bd]">Acceso solo para personal autorizado</p>
      </div>
      <div className="flex items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm space-y-5">
          <h1 className="text-2xl font-semibold">{titulo}</h1>
          {children}
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Las tres pantallas**

`frontend/src/app/login/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export default function PaginaLogin() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    setEnviando(true)
    setError('')
    const { error } = await supabaseNavegador().auth.signInWithPassword({
      email: String(datos.get('correo')),
      password: String(datos.get('clave')),
    })
    setEnviando(false)
    if (error) return setError('Correo o contraseña incorrectos')
    router.replace('/')
    router.refresh()
  }

  return (
    <MarcoAcceso titulo="Iniciar sesión">
      <form onSubmit={entrar} className="space-y-4">
        <Campo id="correo" etiqueta="Correo">
          <Input id="correo" name="correo" type="email" autoComplete="email" required className="h-11" />
        </Campo>
        <Campo id="clave" etiqueta="Contraseña" error={error}>
          <Input id="clave" name="clave" type="password" autoComplete="current-password" required className="h-11" />
        </Campo>
        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
      <Link href="/recuperar" className="inline-block py-2 text-sm font-medium text-primary">
        Olvidé mi contraseña
      </Link>
      <p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
        Las cuentas las crea el administrador. No hay registro público.
      </p>
    </MarcoAcceso>
  )
}
```

`frontend/src/app/recuperar/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseNavegador } from '@/lib/supabase/navegador'

export default function PaginaRecuperar() {
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const correo = String(new FormData(e.currentTarget).get('correo'))
    setEnviando(true)
    // No se revela si el correo existe: la respuesta es la misma en ambos casos.
    await supabaseNavegador().auth.resetPasswordForEmail(correo, {
      redirectTo: `${window.location.origin}/restablecer`,
    })
    setEnviando(false)
    setEnviado(true)
  }

  return (
    <MarcoAcceso titulo="Recuperar contraseña">
      {enviado ? (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          Si el correo pertenece a una cuenta, te llegará un enlace para crear una contraseña nueva.
        </p>
      ) : (
        <form onSubmit={enviar} className="space-y-4">
          <Campo id="correo" etiqueta="Correo" ayuda="Te enviaremos un enlace para crear una contraseña nueva.">
            <Input id="correo" name="correo" type="email" autoComplete="email" required className="h-11" />
          </Campo>
          <Button type="submit" disabled={enviando} className="h-11 w-full">
            {enviando ? 'Enviando…' : 'Enviar enlace'}
          </Button>
        </form>
      )}
      <Link href="/login" className="inline-block py-2 text-sm font-medium text-primary">
        Volver a iniciar sesión
      </Link>
    </MarcoAcceso>
  )
}
```

`frontend/src/app/restablecer/page.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo } from '@/components/campo'
import { MarcoAcceso } from '@/components/marco-acceso'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabaseNavegador } from '@/lib/supabase/navegador'

// Se llega aquí desde el enlace del correo; Supabase ya dejó una sesión temporal.
export default function PaginaRestablecer() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const datos = new FormData(e.currentTarget)
    const clave = String(datos.get('clave'))
    if (clave.length < 8) return setError('Usa al menos 8 caracteres')
    if (clave !== String(datos.get('repetir'))) return setError('Las contraseñas no coinciden')
    setEnviando(true)
    const { error } = await supabaseNavegador().auth.updateUser({ password: clave })
    setEnviando(false)
    if (error) return setError('El enlace venció o ya se usó. Pide uno nuevo.')
    toast.success('Contraseña actualizada')
    router.replace('/')
  }

  return (
    <MarcoAcceso titulo="Nueva contraseña">
      <form onSubmit={guardar} className="space-y-4">
        <Campo id="clave" etiqueta="Nueva contraseña">
          <Input id="clave" name="clave" type="password" autoComplete="new-password" required className="h-11" />
        </Campo>
        <Campo id="repetir" etiqueta="Repetir contraseña" error={error}>
          <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="h-11" />
        </Campo>
        <Button type="submit" disabled={enviando} className="h-11 w-full">
          {enviando ? 'Guardando…' : 'Guardar contraseña'}
        </Button>
      </form>
    </MarcoAcceso>
  )
}
```

- [ ] **Step 4: Verificar la redirección**

```bash
npm run lint && npm run typecheck && npm run build
cd frontend
npx next start -p 3999 &
sleep 5
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3999/
curl -s http://localhost:3999/login | grep -o "Iniciar sesión" | head -1
kill %1
cd ..
```

Expected: `307 http://localhost:3999/login` y luego `Iniciar sesión`.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat(web): add login, password recovery and session proxy"
```

---

### Task 4: Cliente de la API y marco del panel

**Files:**
- Create: `frontend/src/lib/api.ts`, `frontend/src/lib/yo.ts`
- Create: `frontend/src/components/panel/menu.tsx`, `frontend/src/app/(panel)/layout.tsx`, `frontend/src/app/(panel)/page.tsx`
- Delete: `frontend/src/app/page.tsx`

**Interfaces:**
- Consumes: `AppType` de `@agrosalas/backend/app`, `supabaseNavegador`, `cn`.
- Produces:
  - `api`: cliente tipado; cada llamada lleva el token de la sesión. Ejemplo: `api.v1.trabajadores.$get({ query })`.
  - `leer(promesa)`: devuelve el cuerpo JSON de una respuesta correcta o lanza `ErrorApiCliente` (`message`, `codigo`, `campo?`).
  - `Datos<typeof api.v1.x.$get>`: tipo del cuerpo correcto de una llamada.
  - `mensajeDeError(e: unknown): string`.
  - `useYo()`: consulta de `GET /v1/me`; `ETIQUETA_ROL`.
  - `Menu`: menú lateral en PC e inferior en celular. Las fases siguientes agregan entradas a `ENLACES`.
  - Grupo de rutas `(panel)`: todo lo que esté dentro lleva el menú y espera a `useYo()`.

- [ ] **Step 1: Cliente de la API**

`frontend/src/lib/api.ts`:

```ts
import type { AppType } from '@agrosalas/backend/app'
import { hc, type ClientResponse } from 'hono/client'
import { supabaseNavegador } from './supabase/navegador'

type ErrorCuerpo = { error: { codigo: string; mensaje: string; campo?: string } }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RespuestaJson = ClientResponse<any, any, any>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cuerpo<R> = R extends ClientResponse<infer T, any, any> ? T : never

// Datos<typeof api.v1.areas.$get> = el cuerpo de la respuesta correcta de esa llamada.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Datos<F extends (...args: any[]) => Promise<RespuestaJson>> = Exclude<
  Cuerpo<Awaited<ReturnType<F>>>,
  ErrorCuerpo
>

export class ErrorApiCliente extends Error {
  codigo: string
  campo?: string

  constructor(error: ErrorCuerpo['error']) {
    super(error.mensaje)
    this.codigo = error.codigo
    this.campo = error.campo
  }
}

// Espera la respuesta de la API; si es un error, lo lanza con el mensaje que mandó el servidor.
export async function leer<R extends RespuestaJson>(promesa: Promise<R>): Promise<Exclude<Cuerpo<R>, ErrorCuerpo>> {
  const respuesta = await promesa
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new ErrorApiCliente(cuerpo?.error ?? { codigo: 'desconocido', mensaje: 'No se pudo completar la acción' })
  }
  return cuerpo
}

export const api = hc<AppType>(process.env.NEXT_PUBLIC_API_URL!, {
  headers: async (): Promise<Record<string, string>> => {
    const { data } = await supabaseNavegador().auth.getSession()
    return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}
  },
})

export const mensajeDeError = (e: unknown) => (e instanceof Error ? e.message : 'No se pudo completar la acción')
```

`frontend/src/lib/yo.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api, leer } from './api'

export const useYo = () => useQuery({ queryKey: ['yo'], queryFn: () => leer(api.v1.me.$get()), staleTime: 5 * 60_000 })

export const ETIQUETA_ROL = {
  admin: 'Administrador',
  gerencia: 'Gerencia',
  contabilidad: 'Contabilidad',
  coordinador: 'Coordinador',
} as const
```

- [ ] **Step 2: Menú y layout del panel**

`frontend/src/components/panel/menu.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ETIQUETA_ROL, useYo } from '@/lib/yo'

// Las fases siguientes agregan aquí Asistencia, Planillas y Reportes.
const ENLACES = [
  { href: '/trabajadores', etiqueta: 'Trabajadores', soloAdmin: false },
  { href: '/configuracion', etiqueta: 'Configuración', soloAdmin: true },
]

export function Menu() {
  const ruta = usePathname()
  const { data: yo } = useYo()
  const enlaces = ENLACES.filter((e) => !e.soloAdmin || yo?.rol === 'admin')
  const activo = (href: string) => ruta === href || ruta.startsWith(`${href}/`)

  return (
    <>
      <nav aria-label="Principal" className="hidden w-52 shrink-0 flex-col gap-1 bg-[#0f3d24] p-3 md:flex">
        <p className="px-3 pt-2 pb-5 font-semibold text-white">
          Agrosalas <span className="font-normal text-[#a7e3bd]">Admin</span>
        </p>
        {enlaces.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo(e.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 items-center rounded-lg px-3 text-sm text-[#cfe8d8]',
              activo(e.href) && 'bg-[#1c5a37] font-semibold text-white',
            )}
          >
            {e.etiqueta}
          </Link>
        ))}
        <Link
          href="/perfil"
          className={cn(
            'mt-auto rounded-lg border-t border-[#1c5a37] p-3 text-sm text-[#cfe8d8]',
            activo('/perfil') && 'border-transparent bg-[#1c5a37] text-white',
          )}
        >
          {yo?.nombre ?? '…'}
          <span className="block text-[#a7e3bd]">{yo ? `${ETIQUETA_ROL[yo.rol]} · mi perfil` : ''}</span>
        </Link>
      </nav>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t bg-background md:hidden"
      >
        {[...enlaces, { href: '/perfil', etiqueta: 'Perfil' }].map((e) => (
          <Link
            key={e.href}
            href={e.href}
            aria-current={activo(e.href) ? 'page' : undefined}
            className={cn(
              'flex h-14 items-center justify-center border-t-2 border-transparent text-sm text-muted-foreground',
              activo(e.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {e.etiqueta}
          </Link>
        ))}
      </nav>
    </>
  )
}
```

`frontend/src/app/(panel)/layout.tsx`:

```tsx
'use client'

import { Menu } from '@/components/panel/menu'
import { mensajeDeError } from '@/lib/api'
import { useYo } from '@/lib/yo'

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const { isPending, error } = useYo()

  return (
    <div className="flex min-h-screen">
      <Menu />
      <main className="min-w-0 flex-1 p-4 pb-20 md:p-8 md:pb-8">
        {isPending ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : error ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {mensajeDeError(error)}
          </p>
        ) : (
          children
        )}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Página de inicio del panel**

Borra la página de ejemplo y crea la del panel:

```bash
rm frontend/src/app/page.tsx
```

`frontend/src/app/(panel)/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

// Hasta que exista Planillas (fase 2), la entrada del panel es Trabajadores.
export default function PaginaInicio() {
  redirect('/trabajadores')
}
```

`/trabajadores` todavía no existe (tarea 9); hasta entonces el inicio responde 404 tras iniciar sesión.

- [ ] **Step 4: Verificar y commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sin errores. Si `tsc` se queja de `.next/types/validator.ts`, borra `frontend/.next` y repite: son tipos generados por un build anterior.

```bash
git add -A frontend
git commit -m "feat(web): add typed API client and panel shell"
```

---

### Task 5: Mi perfil

**Files:**
- Create: `frontend/src/app/(panel)/perfil/page.tsx`

**Interfaces:**
- Consumes: `useYo`, `ETIQUETA_ROL`, `api.v1.me.$patch`, `leer`, `mensajeDeError`, `supabaseNavegador`, `Campo`, `Badge`, `Button`, `Input`.
- Produces: ruta `/perfil`: cambiar el nombre (API), cambiar la contraseña (Supabase, confirmando la actual) y cerrar sesión.

- [ ] **Step 1: Escribir la página**

`frontend/src/app/(panel)/perfil/page.tsx`:

```tsx
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo } from '@/components/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import { supabaseNavegador } from '@/lib/supabase/navegador'
import { ETIQUETA_ROL, useYo } from '@/lib/yo'

export default function PaginaPerfil() {
  const router = useRouter()
  const cliente = useQueryClient()
  const { data: yo } = useYo()
  const [errorClave, setErrorClave] = useState('')
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: () => leer(api.v1.areas.$get()) })

  const guardarNombre = useMutation({
    mutationFn: (nombre: string) => leer(api.v1.me.$patch({ json: { nombre } })),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['yo'] })
      toast.success('Nombre actualizado')
    },
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  async function cambiarClave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formulario = e.currentTarget
    const datos = new FormData(formulario)
    const nueva = String(datos.get('nueva'))
    if (nueva.length < 8) return setErrorClave('Usa al menos 8 caracteres')
    if (nueva !== String(datos.get('repetir'))) return setErrorClave('Las contraseñas no coinciden')
    setErrorClave('')
    const supabase = supabaseNavegador()
    // Se vuelve a pedir la contraseña actual para confirmar que quien la cambia es el dueño de la cuenta.
    const { error: errorActual } = await supabase.auth.signInWithPassword({
      email: yo!.correo,
      password: String(datos.get('actual')),
    })
    if (errorActual) return setErrorClave('La contraseña actual no es correcta')
    const { error } = await supabase.auth.updateUser({ password: nueva })
    if (error) return setErrorClave('No se pudo cambiar la contraseña')
    formulario.reset()
    toast.success('Contraseña actualizada')
  }

  async function cerrarSesion() {
    await supabaseNavegador().auth.signOut()
    cliente.clear()
    router.replace('/login')
    router.refresh()
  }

  if (!yo) return null

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <div className="grid items-start gap-4 lg:grid-cols-2">
        <form
          className="space-y-4 rounded-xl border bg-background p-5"
          onSubmit={(e) => {
            e.preventDefault()
            guardarNombre.mutate(String(new FormData(e.currentTarget).get('nombre')))
          }}
        >
          <h2 className="font-semibold">Mis datos</h2>
          <Campo id="nombre" etiqueta="Nombre">
            <Input id="nombre" name="nombre" defaultValue={yo.nombre} required minLength={2} className="h-10" />
          </Campo>
          <Campo id="correo" etiqueta="Correo" ayuda="Lo cambia el administrador.">
            <Input id="correo" value={yo.correo} readOnly className="h-10 bg-muted text-muted-foreground" />
          </Campo>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Rol</span>
            <Badge variant="secondary">{ETIQUETA_ROL[yo.rol]}</Badge>
          </div>
          <p className="text-sm">
            <span className="text-muted-foreground">Áreas asignadas: </span>
            {yo.areaIds.length === 0
              ? 'Todas'
              : yo.areaIds.map((id) => areas?.datos.find((a) => a.id === id)?.nombre ?? '…').join(', ')}
          </p>
          <Button type="submit" size="lg" disabled={guardarNombre.isPending}>
            Guardar
          </Button>
        </form>

        <div className="space-y-4">
          <form onSubmit={cambiarClave} className="space-y-4 rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Cambiar contraseña</h2>
            <Campo id="actual" etiqueta="Contraseña actual">
              <Input id="actual" name="actual" type="password" autoComplete="current-password" required className="h-10" />
            </Campo>
            <Campo id="nueva" etiqueta="Nueva contraseña">
              <Input id="nueva" name="nueva" type="password" autoComplete="new-password" required className="h-10" />
            </Campo>
            <Campo id="repetir" etiqueta="Repetir nueva contraseña" error={errorClave}>
              <Input id="repetir" name="repetir" type="password" autoComplete="new-password" required className="h-10" />
            </Campo>
            <Button type="submit" variant="outline" size="lg">
              Cambiar contraseña
            </Button>
          </form>

          <div className="flex items-center justify-between rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Sesión</h2>
            <Button variant="destructive" size="lg" onClick={cerrarSesion}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar y commit**

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

```bash
git add frontend
git commit -m "feat(web): add profile page with password change and sign-out"
```

---

### Task 6: Catálogo genérico y Configuración (áreas, turnos, campañas, cargos)

**Files:**
- Create: `frontend/src/components/catalogo.tsx`
- Create: `frontend/src/app/(panel)/configuracion/layout.tsx`, `frontend/src/app/(panel)/configuracion/page.tsx`
- Create: `frontend/src/app/(panel)/configuracion/areas/page.tsx`, `.../turnos/page.tsx`, `.../campanas/page.tsx`, `.../cargos/page.tsx`

**Interfaces:**
- Consumes: `api`, `leer`, `ErrorApiCliente`, `mensajeDeError`, `Campo`, `claseControl`, `formatoSoles`, `horaExtraPropuesta`, `useYo`, componentes de shadcn.
- Produces:
  - `Catalogo(props)`: tabla con columna de estado, botón de alta y diálogo de edición. Props: `titulo`, `descripcion?`, `textoNuevo`, `claveConsulta`, `puedeEditar`, `columnas`, `campos: CampoCatalogo[]`, `listar`, `crear`, `editar`, `derivar?`, `accionesFila?`.
  - `CampoCatalogo = { nombre, etiqueta, tipo: 'texto' | 'correo' | 'clave' | 'hora' | 'fecha' | 'numero' | 'casilla' | 'opcion' | 'opciones', opciones?, obligatorio?, soloAlCrear?, ayuda? }`.
  - `FilaCatalogo = { id: string } & Record<string, unknown>`.
  - El formulario envía números como número y vacíos como `null`. Como `Catalogo` trabaja con claves dinámicas, las páginas pasan el cuerpo como `json as never`; la API lo valida.
  - Rutas `/configuracion` (redirige a cargos), `/configuracion/areas`, `/turnos`, `/campanas`, `/cargos`. Solo el administrador ve su contenido.

- [ ] **Step 1: Escribir el componente genérico**

`frontend/src/components/catalogo.tsx`:

```tsx
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ErrorApiCliente, mensajeDeError } from '@/lib/api'
import { Campo, claseControl } from './campo'

type Valor = string | boolean | string[]
type Valores = Record<string, Valor>
export type FilaCatalogo = { id: string } & Record<string, unknown>

export type CampoCatalogo = {
  nombre: string
  etiqueta: string
  tipo: 'texto' | 'correo' | 'clave' | 'hora' | 'fecha' | 'numero' | 'casilla' | 'opcion' | 'opciones'
  opciones?: { valor: string; etiqueta: string }[]
  obligatorio?: boolean
  soloAlCrear?: boolean
  ayuda?: string
}

type Props = {
  titulo: string
  descripcion?: string
  textoNuevo: string
  claveConsulta: string
  puedeEditar: boolean
  columnas: { titulo: string; derecha?: boolean; celda: (fila: FilaCatalogo) => React.ReactNode }[]
  campos: CampoCatalogo[]
  listar: () => Promise<{ datos: FilaCatalogo[] }>
  crear: (valores: Record<string, unknown>) => Promise<unknown>
  editar: (id: string, valores: Record<string, unknown>) => Promise<unknown>
  // Permite proponer un campo a partir de otro (por ejemplo, la hora extra desde la hora normal).
  derivar?: (campo: string, valores: Valores) => Partial<Valores>
  accionesFila?: (fila: FilaCatalogo) => React.ReactNode
}

const TIPO_INPUT = { texto: 'text', correo: 'email', clave: 'password', hora: 'time', fecha: 'date', numero: 'number' } as const

function valorInicial(campo: CampoCatalogo, fila: FilaCatalogo | null): Valor {
  const crudo = fila?.[campo.nombre]
  if (campo.tipo === 'casilla') return Boolean(crudo)
  if (campo.tipo === 'opciones') return Array.isArray(crudo) ? (crudo as string[]) : []
  if (crudo == null) return campo.tipo === 'opcion' ? (campo.opciones?.[0]?.valor ?? '') : ''
  return campo.tipo === 'hora' ? String(crudo).slice(0, 5) : String(crudo)
}

// Lo que se manda a la API: números como número y vacíos como null.
function paraEnviar(campo: CampoCatalogo, valor: Valor): unknown {
  if (typeof valor !== 'string') return valor
  const texto = valor.trim()
  if (campo.tipo === 'numero') return texto === '' ? null : Number(texto)
  if (campo.tipo === 'fecha') return texto === '' ? null : texto
  return texto
}

export function Catalogo(props: Props) {
  const cliente = useQueryClient()
  const { data, isPending, error } = useQuery({ queryKey: [props.claveConsulta], queryFn: props.listar })
  const [abierto, setAbierto] = useState(false)
  const [fila, setFila] = useState<FilaCatalogo | null>(null)
  const [valores, setValores] = useState<Valores>({})
  const [errorCampo, setErrorCampo] = useState<{ campo?: string; mensaje: string } | null>(null)

  const campos = props.campos.filter((c) => !(fila && c.soloAlCrear))
  const tieneActivo = fila !== null && typeof fila.activo === 'boolean'

  function abrir(paraEditar: FilaCatalogo | null) {
    const iniciales: Valores = Object.fromEntries(props.campos.map((c) => [c.nombre, valorInicial(c, paraEditar)]))
    if (paraEditar && typeof paraEditar.activo === 'boolean') iniciales.activo = paraEditar.activo
    setFila(paraEditar)
    setValores(iniciales)
    setErrorCampo(null)
    setAbierto(true)
  }

  function cambiar(campo: string, valor: Valor) {
    setValores((v) => {
      const siguiente = { ...v, [campo]: valor }
      return { ...siguiente, ...props.derivar?.(campo, siguiente) } as Valores
    })
  }

  const guardar = useMutation({
    mutationFn: () => {
      const cuerpo: Record<string, unknown> = Object.fromEntries(campos.map((c) => [c.nombre, paraEnviar(c, valores[c.nombre])]))
      if (tieneActivo) cuerpo.activo = valores.activo
      return fila ? props.editar(fila.id, cuerpo) : props.crear(cuerpo)
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: [props.claveConsulta] })
      setAbierto(false)
      toast.success('Guardado')
    },
    onError: (e) => setErrorCampo({ campo: e instanceof ErrorApiCliente ? e.campo : undefined, mensaje: mensajeDeError(e) }),
  })

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{props.titulo}</h2>
          {props.descripcion && <p className="text-sm text-muted-foreground">{props.descripcion}</p>}
        </div>
        {props.puedeEditar && (
          <Button size="lg" onClick={() => abrir(null)}>
            {props.textoNuevo}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              {props.columnas.map((c) => (
                <TableHead key={c.titulo} className={c.derecha ? 'text-right' : undefined}>
                  {c.titulo}
                </TableHead>
              ))}
              <TableHead>Estado</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2} className="text-destructive">
                  {mensajeDeError(error)}
                </TableCell>
              </TableRow>
            )}
            {data?.datos.length === 0 && (
              <TableRow>
                <TableCell colSpan={props.columnas.length + 2} className="text-muted-foreground">
                  Aún no hay registros.
                </TableCell>
              </TableRow>
            )}
            {data?.datos.map((f) => (
              <TableRow key={f.id}>
                {props.columnas.map((c) => (
                  <TableCell key={c.titulo} className={c.derecha ? 'text-right tabular-nums' : undefined}>
                    {c.celda(f)}
                  </TableCell>
                ))}
                <TableCell>
                  <Badge variant={f.activo === false ? 'outline' : 'secondary'}>{f.activo === false ? 'Inactivo' : 'Activo'}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {props.accionesFila?.(f)}
                  {props.puedeEditar && (
                    <Button variant="ghost" size="lg" onClick={() => abrir(f)}>
                      Editar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={abierto} onOpenChange={(o) => setAbierto(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fila ? 'Editar' : props.textoNuevo}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              setErrorCampo(null)
              guardar.mutate()
            }}
          >
            {campos.map((c) => {
              const id = `campo-${c.nombre}`
              const error = errorCampo?.campo === c.nombre ? errorCampo.mensaje : undefined
              const valor = valores[c.nombre]
              if (c.tipo === 'casilla') {
                return (
                  <label key={c.nombre} className="flex h-10 items-center gap-2 text-sm">
                    <input type="checkbox" checked={Boolean(valor)} onChange={(e) => cambiar(c.nombre, e.target.checked)} />
                    {c.etiqueta}
                  </label>
                )
              }
              if (c.tipo === 'opciones') {
                const elegidas = (valor as string[]) ?? []
                return (
                  <fieldset key={c.nombre} className="space-y-1">
                    <legend className="text-sm font-medium">{c.etiqueta}</legend>
                    {c.opciones?.map((o) => (
                      <label key={o.valor} className="flex h-9 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={elegidas.includes(o.valor)}
                          onChange={(e) =>
                            cambiar(c.nombre, e.target.checked ? [...elegidas, o.valor] : elegidas.filter((v) => v !== o.valor))
                          }
                        />
                        {o.etiqueta}
                      </label>
                    ))}
                    {c.ayuda && <p className="text-xs text-muted-foreground">{c.ayuda}</p>}
                  </fieldset>
                )
              }
              return (
                <Campo key={c.nombre} id={id} etiqueta={c.etiqueta} ayuda={c.ayuda} error={error}>
                  {c.tipo === 'opcion' ? (
                    <select id={id} className={claseControl} value={String(valor ?? '')} onChange={(e) => cambiar(c.nombre, e.target.value)}>
                      {c.opciones?.map((o) => (
                        <option key={o.valor} value={o.valor}>
                          {o.etiqueta}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={id}
                      className="h-10"
                      type={TIPO_INPUT[c.tipo]}
                      step={c.tipo === 'numero' ? 'any' : undefined}
                      required={c.obligatorio}
                      value={String(valor ?? '')}
                      onChange={(e) => cambiar(c.nombre, e.target.value)}
                    />
                  )}
                </Campo>
              )
            })}
            {tieneActivo && (
              <label className="flex h-10 items-center gap-2 text-sm">
                <input type="checkbox" checked={Boolean(valores.activo)} onChange={(e) => cambiar('activo', e.target.checked)} />
                Activo
              </label>
            )}
            {errorCampo && !campos.some((c) => c.nombre === errorCampo.campo) && (
              <p role="alert" className="text-sm text-destructive">
                {errorCampo.mensaje}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" size="lg" onClick={() => setAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit" size="lg" disabled={guardar.isPending}>
                Guardar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  )
}
```

- [ ] **Step 2: Layout y entrada de Configuración**

`frontend/src/app/(panel)/configuracion/layout.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useYo } from '@/lib/yo'

const PESTANAS = [
  { href: '/configuracion/cargos', etiqueta: 'Cargos y tarifas' },
  { href: '/configuracion/grupos', etiqueta: 'Grupos' },
  { href: '/configuracion/areas', etiqueta: 'Áreas' },
  { href: '/configuracion/turnos', etiqueta: 'Turnos' },
  { href: '/configuracion/campanas', etiqueta: 'Campañas' },
  { href: '/configuracion/usuarios', etiqueta: 'Usuarios y roles' },
  { href: '/configuracion/auditoria', etiqueta: 'Auditoría' },
]

export default function LayoutConfiguracion({ children }: { children: React.ReactNode }) {
  const ruta = usePathname()
  const { data: yo } = useYo()

  if (yo && yo.rol !== 'admin') {
    return <p className="text-sm text-muted-foreground">Solo el administrador puede entrar a Configuración.</p>
  }

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Configuración</h1>
      <nav aria-label="Secciones de configuración" className="flex gap-1 overflow-x-auto border-b">
        {PESTANAS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            aria-current={ruta.startsWith(p.href) ? 'page' : undefined}
            className={cn(
              'flex h-11 shrink-0 items-center border-b-2 border-transparent px-4 text-sm text-muted-foreground',
              ruta.startsWith(p.href) && 'border-primary font-semibold text-primary',
            )}
          >
            {p.etiqueta}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
```

`frontend/src/app/(panel)/configuracion/page.tsx`:

```tsx
import { redirect } from 'next/navigation'

export default function PaginaConfiguracion() {
  redirect('/configuracion/cargos')
}
```

- [ ] **Step 3: Áreas, turnos y campañas**

`frontend/src/app/(panel)/configuracion/areas/page.tsx`:

```tsx
'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

export default function PaginaAreas() {
  return (
    <Catalogo
      titulo="Áreas"
      descripcion="Sirven para organizar a los trabajadores y para limitar lo que ve cada coordinador."
      textoNuevo="Nueva área"
      claveConsulta="areas"
      puedeEditar
      columnas={[{ titulo: 'Área', celda: (f) => String(f.nombre) }]}
      campos={[{ nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true }]}
      listar={() => leer(api.v1.areas.$get())}
      crear={(json) => leer(api.v1.areas.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.areas[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

`frontend/src/app/(panel)/configuracion/turnos/page.tsx`:

```tsx
'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

const hora = (valor: unknown) => String(valor).slice(0, 5)

export default function PaginaTurnos() {
  return (
    <Catalogo
      titulo="Turnos"
      descripcion="Son referenciales: no intervienen en el cálculo de horas."
      textoNuevo="Nuevo turno"
      claveConsulta="turnos"
      puedeEditar
      columnas={[
        { titulo: 'Turno', celda: (f) => String(f.nombre) },
        { titulo: 'Horario', celda: (f) => `${hora(f.horaInicio)} – ${hora(f.horaFin)}` },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'horaInicio', etiqueta: 'Hora de inicio', tipo: 'hora', obligatorio: true },
        { nombre: 'horaFin', etiqueta: 'Hora de fin', tipo: 'hora', obligatorio: true },
      ]}
      listar={() => leer(api.v1.turnos.$get())}
      crear={(json) => leer(api.v1.turnos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.turnos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

`frontend/src/app/(panel)/configuracion/campanas/page.tsx`:

```tsx
'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'

export default function PaginaCampanas() {
  return (
    <Catalogo
      titulo="Campañas"
      descripcion="Cada planilla puede llevar una campaña; los reportes suman el costo por campaña."
      textoNuevo="Nueva campaña"
      claveConsulta="campanas"
      puedeEditar
      columnas={[
        { titulo: 'Campaña', celda: (f) => String(f.nombre) },
        { titulo: 'Fechas', celda: (f) => (f.fechaInicio ? `${f.fechaInicio} a ${f.fechaFin ?? '…'}` : 'Sin fechas') },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'fechaInicio', etiqueta: 'Fecha de inicio', tipo: 'fecha' },
        { nombre: 'fechaFin', etiqueta: 'Fecha de fin', tipo: 'fecha' },
      ]}
      listar={() => leer(api.v1.campanas.$get())}
      crear={(json) => leer(api.v1.campanas.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.campanas[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

- [ ] **Step 4: Cargos y tarifas**

`frontend/src/app/(panel)/configuracion/cargos/page.tsx`:

```tsx
'use client'

import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { formatoSoles, horaExtraPropuesta } from '@/lib/formato'

export default function PaginaCargos() {
  return (
    <Catalogo
      titulo="Cargos y tarifas de referencia"
      descripcion="Al registrar un día, las tarifas del cargo se copian al registro y ahí se pueden cambiar sin afectar al cargo."
      textoNuevo="Nuevo cargo"
      claveConsulta="cargos"
      puedeEditar
      columnas={[
        { titulo: 'Cargo', celda: (f) => String(f.nombre) },
        { titulo: 'Pago', celda: (f) => (f.tipoPago === 'mensual' ? 'Sueldo mensual' : 'Por hora') },
        { titulo: 'Hora normal', derecha: true, celda: (f) => formatoSoles(f.tarifaHora as number | null) },
        { titulo: 'Hora extra', derecha: true, celda: (f) => formatoSoles(f.tarifaHoraExtra as number | null) },
        { titulo: 'Sueldo', derecha: true, celda: (f) => formatoSoles(f.sueldoMensual as number | null) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        {
          nombre: 'tipoPago',
          etiqueta: 'Forma de pago',
          tipo: 'opcion',
          opciones: [
            { valor: 'por_hora', etiqueta: 'Por hora' },
            { valor: 'mensual', etiqueta: 'Sueldo mensual' },
          ],
        },
        { nombre: 'tarifaHora', etiqueta: 'Hora normal (S/)', tipo: 'numero' },
        { nombre: 'tarifaHoraExtra', etiqueta: 'Hora extra (S/)', tipo: 'numero', ayuda: 'Se propone la normal más 25 %; puedes cambiarla.' },
        { nombre: 'sueldoMensual', etiqueta: 'Sueldo mensual (S/)', tipo: 'numero', ayuda: 'Solo para cargos de sueldo mensual.' },
      ]}
      derivar={(campo, valores) => {
        const normal = Number(valores.tarifaHora)
        return campo === 'tarifaHora' && normal > 0 ? { tarifaHoraExtra: String(horaExtraPropuesta(normal)) } : {}
      }}
      listar={() => leer(api.v1.cargos.$get())}
      crear={(json) => leer(api.v1.cargos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.cargos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

- [ ] **Step 5: Verificar y commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sin errores; el build lista `/configuracion/areas`, `/turnos`, `/campanas` y `/cargos`.

```bash
git add frontend
git commit -m "feat(web): add generic catalog and settings for areas, shifts, campaigns and rates"
```

---

### Task 7: Configuración: usuarios y auditoría

**Files:**
- Create: `frontend/src/app/(panel)/configuracion/usuarios/page.tsx`, `frontend/src/app/(panel)/configuracion/auditoria/page.tsx`

**Interfaces:**
- Consumes: `Catalogo`, `Paginador`, `claseControl`, `api`, `leer`, `ETIQUETA_ROL`, tabla de shadcn.
- Produces: rutas `/configuracion/usuarios` (alta con correo y contraseña inicial; edición de nombre, rol, áreas y estado) y `/configuracion/auditoria` (lista paginada con filtro por tabla).

- [ ] **Step 1: Usuarios**

`frontend/src/app/(panel)/configuracion/usuarios/page.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { Catalogo } from '@/components/catalogo'
import { api, leer } from '@/lib/api'
import { ETIQUETA_ROL } from '@/lib/yo'

const ROLES = (Object.keys(ETIQUETA_ROL) as (keyof typeof ETIQUETA_ROL)[]).map((valor) => ({
  valor,
  etiqueta: ETIQUETA_ROL[valor],
}))

export default function PaginaUsuarios() {
  const { data: areas } = useQuery({ queryKey: ['areas'], queryFn: () => leer(api.v1.areas.$get()) })
  const nombreArea = (id: string) => areas?.datos.find((a) => a.id === id)?.nombre ?? '…'

  return (
    <Catalogo
      titulo="Usuarios y roles"
      descripcion="Las cuentas solo se crean aquí. El coordinador ve únicamente las áreas que se le asignen."
      textoNuevo="Nuevo usuario"
      claveConsulta="usuarios"
      puedeEditar
      columnas={[
        { titulo: 'Nombre', celda: (f) => String(f.nombre) },
        { titulo: 'Correo', celda: (f) => String(f.correo) },
        { titulo: 'Rol', celda: (f) => ETIQUETA_ROL[f.rol as keyof typeof ETIQUETA_ROL] },
        { titulo: 'Áreas', celda: (f) => (f.areaIds as string[]).map(nombreArea).join(', ') || 'Todas' },
      ]}
      campos={[
        { nombre: 'correo', etiqueta: 'Correo', tipo: 'correo', obligatorio: true, soloAlCrear: true },
        { nombre: 'clave', etiqueta: 'Contraseña inicial', tipo: 'clave', obligatorio: true, soloAlCrear: true, ayuda: 'Mínimo 8 caracteres. La persona puede cambiarla en su perfil.' },
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'rol', etiqueta: 'Rol', tipo: 'opcion', opciones: ROLES },
        {
          nombre: 'areaIds',
          etiqueta: 'Áreas (solo para coordinador)',
          tipo: 'opciones',
          opciones: (areas?.datos ?? []).filter((a) => a.activo).map((a) => ({ valor: a.id, etiqueta: a.nombre })),
        },
      ]}
      listar={() => leer(api.v1.usuarios.$get())}
      crear={(json) => leer(api.v1.usuarios.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.usuarios[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

- [ ] **Step 2: Auditoría**

`frontend/src/app/(panel)/configuracion/auditoria/page.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { Paginador } from '@/components/paginador'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer } from '@/lib/api'

const ENTIDADES = ['trabajadores', 'trabajador_metodos_pago', 'usuarios', 'cargos', 'grupos', 'areas', 'turnos', 'campanas']
const ACCION = { crear: 'Creó', editar: 'Editó', eliminar: 'Eliminó' } as const
const fechaHora = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' })

export default function PaginaAuditoria() {
  const [entidad, setEntidad] = useState('')
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  const { data, isPending } = useQuery({
    queryKey: ['auditoria', entidad, pagina],
    queryFn: () =>
      leer(
        api.v1.auditoria.$get({
          query: { pagina: String(pagina.pagina), tamano: String(pagina.tamano), ...(entidad ? { entidad } : {}) },
        }),
      ),
  })

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-semibold">Auditoría</h2>
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="filtro-entidad" className="text-muted-foreground">
            Tabla
          </label>
          <select
            id="filtro-entidad"
            className={`${claseControl} w-56`}
            value={entidad}
            onChange={(e) => {
              setEntidad(e.target.value)
              setPagina((p) => ({ ...p, pagina: 1 }))
            }}
          >
            <option value="">Todas</option>
            {ENTIDADES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Usuario</TableHead>
              <TableHead>Acción</TableHead>
              <TableHead>Tabla</TableHead>
              <TableHead>Cambio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            )}
            {data?.datos.map((f) => (
              <TableRow key={f.id}>
                <TableCell className="whitespace-nowrap">{fechaHora.format(new Date(f.creadoEn))}</TableCell>
                <TableCell>{f.usuarioNombre}</TableCell>
                <TableCell>{ACCION[f.accion]}</TableCell>
                <TableCell>{f.entidad}</TableCell>
                <TableCell className="max-w-md truncate font-mono text-xs" title={JSON.stringify(f.despues ?? f.antes)}>
                  {JSON.stringify(f.despues ?? f.antes)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Paginador pagina={pagina.pagina} tamano={pagina.tamano} total={data?.total ?? 0} alCambiar={setPagina} />
    </section>
  )
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

```bash
git add frontend
git commit -m "feat(web): add users and audit log settings pages"
```

---

### Task 8: Configuración: grupos y sus miembros

**Files:**
- Create: `frontend/src/app/(panel)/configuracion/grupos/page.tsx`, `frontend/src/app/(panel)/configuracion/grupos/[id]/page.tsx`

**Interfaces:**
- Consumes: `Catalogo`, `buttonVariants`, `Button`, `Input`, `api`, `leer`, `mensajeDeError`.
- Produces: rutas `/configuracion/grupos` (alta y edición; enlace "Miembros") y `/configuracion/grupos/[id]` (buscador de trabajadores activos para agregar, y miembros como etiquetas que se pueden quitar).

- [ ] **Step 1: Lista de grupos**

`frontend/src/app/(panel)/configuracion/grupos/page.tsx`:

```tsx
'use client'

import Link from 'next/link'
import { Catalogo } from '@/components/catalogo'
import { buttonVariants } from '@/components/ui/button'
import { api, leer } from '@/lib/api'

export default function PaginaGrupos() {
  return (
    <Catalogo
      titulo="Grupos de trabajadores"
      descripcion="Un grupo sirve para cargar varios trabajadores a una planilla de una sola vez. Un trabajador puede estar en varios."
      textoNuevo="Nuevo grupo"
      claveConsulta="grupos"
      puedeEditar
      columnas={[
        { titulo: 'Grupo', celda: (f) => String(f.nombre) },
        {
          titulo: 'Tipo',
          celda: (f) => (f.temporal ? `Temporal${f.fechaInicio ? ` · ${f.fechaInicio} a ${f.fechaFin ?? '…'}` : ''}` : 'Fijo'),
        },
        { titulo: 'Miembros', derecha: true, celda: (f) => String(f.miembros) },
      ]}
      campos={[
        { nombre: 'nombre', etiqueta: 'Nombre', tipo: 'texto', obligatorio: true },
        { nombre: 'temporal', etiqueta: 'Es temporal (armado por unos días)', tipo: 'casilla' },
        { nombre: 'fechaInicio', etiqueta: 'Desde', tipo: 'fecha' },
        { nombre: 'fechaFin', etiqueta: 'Hasta', tipo: 'fecha' },
      ]}
      accionesFila={(f) => (
        <Link href={`/configuracion/grupos/${f.id}`} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
          Miembros
        </Link>
      )}
      listar={() => leer(api.v1.grupos.$get())}
      crear={(json) => leer(api.v1.grupos.$post({ json: json as never }))}
      editar={(id, json) => leer(api.v1.grupos[':id'].$patch({ param: { id }, json: json as never }))}
    />
  )
}
```

- [ ] **Step 2: Miembros de un grupo**

`frontend/src/app/(panel)/configuracion/grupos/[id]/page.tsx`:

```tsx
'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'

export default function PaginaMiembrosGrupo() {
  const { id } = useParams<{ id: string }>()
  const cliente = useQueryClient()
  const [texto, setTexto] = useState('')

  const grupo = useQuery({ queryKey: ['grupos', id], queryFn: () => leer(api.v1.grupos[':id'].$get({ param: { id } })) })
  const busqueda = useQuery({
    queryKey: ['trabajadores', 'buscar', texto],
    queryFn: () => leer(api.v1.trabajadores.$get({ query: { texto, estado: 'activo', tamano: '10' } })),
    enabled: texto.trim().length >= 2,
  })

  const refrescar = () => {
    cliente.invalidateQueries({ queryKey: ['grupos'] })
  }
  const agregar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.grupos[':id'].miembros.$post({ param: { id }, json: { trabajadorIds: [trabajadorId] } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })
  const quitar = useMutation({
    mutationFn: (trabajadorId: string) =>
      leer(api.v1.grupos[':id'].miembros[':trabajadorId'].$delete({ param: { id, trabajadorId } })),
    onSuccess: refrescar,
    onError: (e) => toast.error(mensajeDeError(e)),
  })

  const yaEsta = (trabajadorId: string) => grupo.data?.miembros.some((m) => m.id === trabajadorId)

  return (
    <section className="space-y-4">
      <Link href="/configuracion/grupos" className="text-sm font-medium text-primary">
        ← Grupos
      </Link>
      <h2 className="text-lg font-semibold">{grupo.data?.nombre ?? 'Cargando…'}</h2>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border bg-background p-4">
          <label htmlFor="buscar-miembro" className="text-sm font-medium">
            Agregar trabajadores
          </label>
          <Input
            id="buscar-miembro"
            className="h-10"
            placeholder="Buscar por nombre o DNI"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
          <ul className="divide-y">
            {busqueda.data?.datos.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                <span>
                  {t.apellidos}, {t.nombres}
                </span>
                <Button variant="outline" size="lg" disabled={yaEsta(t.id) || agregar.isPending} onClick={() => agregar.mutate(t.id)}>
                  {yaEsta(t.id) ? 'Ya está' : 'Agregar'}
                </Button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 rounded-xl border bg-background p-4">
          <h3 className="text-sm font-medium">Miembros ({grupo.data?.miembros.length ?? 0})</h3>
          <ul className="flex flex-wrap gap-2">
            {grupo.data?.miembros.map((m) => (
              <li key={m.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
                {m.apellidos}, {m.nombres}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="rounded-full"
                  aria-label={`Quitar a ${m.nombres} ${m.apellidos}`}
                  onClick={() => quitar.mutate(m.id)}
                >
                  ×
                </Button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

```bash
git add frontend
git commit -m "feat(web): add worker groups and membership management"
```

---

### Task 9: Trabajadores: lista con filtros y paginador

**Files:**
- Create: `frontend/src/lib/catalogos.ts`, `frontend/src/app/(panel)/trabajadores/page.tsx`

**Interfaces:**
- Consumes: `api`, `leer`, `mensajeDeError`, `useYo`, `Paginador`, `claseControl`, `Badge`, `buttonVariants`, `Input`, tabla de shadcn.
- Produces:
  - `useAreas()`, `useCargos()`, `useTurnos()`, `useGrupos()`: consultas de catálogos con 5 minutos de caché. Claves de consulta: `['areas']`, `['cargos']`, `['turnos']`, `['grupos']` (las mismas que usa `Catalogo`, para que una edición en Configuración las refresque).
  - Ruta `/trabajadores`: filtros por texto, área, modalidad y estado; paginador; "Nuevo trabajador" solo para administrador y contabilidad.

- [ ] **Step 1: Consultas de catálogos**

`frontend/src/lib/catalogos.ts`:

```ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { api, leer } from './api'

// Catálogos que usan varias pantallas; cambian poco, así que se guardan 5 minutos.
const opciones = { staleTime: 5 * 60_000 }

export const useAreas = () => useQuery({ queryKey: ['areas'], queryFn: () => leer(api.v1.areas.$get()), ...opciones })
export const useCargos = () => useQuery({ queryKey: ['cargos'], queryFn: () => leer(api.v1.cargos.$get()), ...opciones })
export const useTurnos = () => useQuery({ queryKey: ['turnos'], queryFn: () => leer(api.v1.turnos.$get()), ...opciones })
export const useGrupos = () => useQuery({ queryKey: ['grupos'], queryFn: () => leer(api.v1.grupos.$get()), ...opciones })
```

- [ ] **Step 2: La lista**

`frontend/src/app/(panel)/trabajadores/page.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { useState } from 'react'
import { claseControl } from '@/components/campo'
import { Paginador } from '@/components/paginador'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useAreas, useCargos } from '@/lib/catalogos'
import { useYo } from '@/lib/yo'

const FILTROS_INICIALES = { texto: '', areaId: '', modalidad: '', estado: 'activo' }

export default function PaginaTrabajadores() {
  const { data: yo } = useYo()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [pagina, setPagina] = useState({ pagina: 1, tamano: 25 })

  const { data, isPending, error } = useQuery({
    queryKey: ['trabajadores', filtros, pagina],
    queryFn: () =>
      leer(
        api.v1.trabajadores.$get({
          query: {
            pagina: String(pagina.pagina),
            tamano: String(pagina.tamano),
            // Solo se mandan los filtros con valor.
            ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v.trim() !== '')),
          },
        }),
      ),
  })

  function filtrar(campo: keyof typeof FILTROS_INICIALES, valor: string) {
    setFiltros((f) => ({ ...f, [campo]: valor }))
    setPagina((p) => ({ ...p, pagina: 1 }))
  }

  const puedeCrear = yo?.rol === 'admin' || yo?.rol === 'contabilidad'
  const nombreDe = (lista: { id: string; nombre: string }[] | undefined, id: string | null) =>
    lista?.find((x) => x.id === id)?.nombre ?? '–'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trabajadores</h1>
        {puedeCrear && (
          <Link href="/trabajadores/nuevo" className={buttonVariants({ size: 'lg' })}>
            Nuevo trabajador
          </Link>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_10rem_10rem]">
        <Input
          aria-label="Buscar por nombre o DNI"
          placeholder="Buscar por nombre o DNI"
          className="h-9"
          value={filtros.texto}
          onChange={(e) => filtrar('texto', e.target.value)}
        />
        <select aria-label="Área" className={claseControl} value={filtros.areaId} onChange={(e) => filtrar('areaId', e.target.value)}>
          <option value="">Todas las áreas</option>
          {areas?.datos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre}
            </option>
          ))}
        </select>
        <select aria-label="Modalidad" className={claseControl} value={filtros.modalidad} onChange={(e) => filtrar('modalidad', e.target.value)}>
          <option value="">Toda modalidad</option>
          <option value="temporal">Temporal</option>
          <option value="contrato">Contrato</option>
        </select>
        <select aria-label="Estado" className={claseControl} value={filtros.estado} onChange={(e) => filtrar('estado', e.target.value)}>
          <option value="activo">Activos</option>
          <option value="cesado">Cesados</option>
          <option value="">Todos</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Trabajador</TableHead>
              <TableHead>Área</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Modalidad</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending && (
              <TableRow>
                <TableCell colSpan={5}>Cargando…</TableCell>
              </TableRow>
            )}
            {error && (
              <TableRow>
                <TableCell colSpan={5} className="text-destructive">
                  {mensajeDeError(error)}
                </TableCell>
              </TableRow>
            )}
            {data?.datos.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground">
                  Ningún trabajador coincide con los filtros.
                </TableCell>
              </TableRow>
            )}
            {data?.datos.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <Link href={`/trabajadores/${t.id}`} className="font-medium text-primary">
                    {t.apellidos}, {t.nombres}
                  </Link>
                  <span className={`block text-xs ${t.dni ? 'text-muted-foreground' : 'font-semibold text-amber-800'}`}>
                    {t.dni ? `DNI ${t.dni}` : 'DNI pendiente'}
                  </span>
                </TableCell>
                <TableCell>{nombreDe(areas?.datos, t.areaId)}</TableCell>
                <TableCell>{nombreDe(cargos?.datos, t.cargoId)}</TableCell>
                <TableCell>{t.modalidad === 'contrato' ? 'Contrato' : 'Temporal'}</TableCell>
                <TableCell>
                  <Badge variant={t.estado === 'activo' ? 'secondary' : 'outline'}>{t.estado === 'activo' ? 'Activo' : 'Cesado'}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Paginador pagina={pagina.pagina} tamano={pagina.tamano} total={data?.total ?? 0} alCambiar={setPagina} />
    </div>
  )
}
```

- [ ] **Step 3: Verificar y commit**

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

```bash
git add frontend
git commit -m "feat(web): add workers list with filters and pagination"
```

---

### Task 10: Trabajadores: alta y ficha con métodos de pago y grupos

**Files:**
- Create: `frontend/src/components/trabajadores/formulario.tsx`, `frontend/src/components/trabajadores/metodos-pago.tsx`, `frontend/src/components/trabajadores/grupos-trabajador.tsx`
- Create: `frontend/src/app/(panel)/trabajadores/nuevo/page.tsx`, `frontend/src/app/(panel)/trabajadores/[id]/page.tsx`

**Interfaces:**
- Consumes: `api`, `leer`, `Datos`, `ErrorApiCliente`, `mensajeDeError`, `useAreas`, `useCargos`, `useTurnos`, `useGrupos`, `useYo`, `formatoSoles`, `Campo`, `claseControl`, componentes de shadcn.
- Produces:
  - `FichaTrabajador`: tipo de `GET /v1/trabajadores/:id`.
  - `FormularioTrabajador({ ficha?, puedeEditar })`: sin `ficha` crea (DNI obligatorio) y redirige a la ficha; con `ficha` edita, incluido el estado. Muestra la tarifa de referencia del cargo elegido y el aviso de DNI pendiente.
  - `MetodosPago({ ficha })`: lista, "Hacer principal", "Quitar" y formulario para agregar Yape, Plin o cuenta bancaria.
  - `GruposTrabajador({ ficha })`: grupos como etiquetas, con alta y baja.
  - Rutas `/trabajadores/nuevo` y `/trabajadores/[id]`.

- [ ] **Step 1: Formulario**

`frontend/src/components/trabajadores/formulario.tsx`:

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, claseControl } from '@/components/campo'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, ErrorApiCliente, leer, mensajeDeError, type Datos } from '@/lib/api'
import { useAreas, useCargos, useTurnos } from '@/lib/catalogos'
import { formatoSoles } from '@/lib/formato'

export type FichaTrabajador = Datos<(typeof api.v1.trabajadores)[':id']['$get']>

const TEXTOS = ['dni', 'nombres', 'apellidos', 'telefono', 'correo', 'direccion', 'emergenciaNombre', 'emergenciaTelefono', 'fechaIngreso', 'notas'] as const
const SELECTORES = ['areaId', 'cargoId', 'turnoId'] as const
type CampoTexto = (typeof TEXTOS)[number] | (typeof SELECTORES)[number]

function valoresIniciales(ficha?: FichaTrabajador) {
  const texto = Object.fromEntries([...TEXTOS, ...SELECTORES].map((c) => [c, ficha?.[c] ?? ''])) as Record<CampoTexto, string>
  return { ...texto, modalidad: ficha?.modalidad ?? 'temporal', estado: ficha?.estado ?? 'activo' }
}

export function FormularioTrabajador({ ficha, puedeEditar }: { ficha?: FichaTrabajador; puedeEditar: boolean }) {
  const router = useRouter()
  const cliente = useQueryClient()
  const { data: areas } = useAreas()
  const { data: cargos } = useCargos()
  const { data: turnos } = useTurnos()
  const [v, setV] = useState(() => valoresIniciales(ficha))
  const [error, setError] = useState<{ campo?: string; mensaje: string } | null>(null)

  const cargo = cargos?.datos.find((c) => c.id === v.cargoId)
  const fijar = (campo: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((actual) => ({ ...actual, [campo]: e.target.value }))
  const errorDe = (campo: string) => (error?.campo === campo ? error.mensaje : undefined)

  const guardar = useMutation({
    mutationFn: () => {
      // Los campos vacíos viajan como null; el DNI vacío no se manda al editar (queda pendiente).
      const opcionales = Object.fromEntries(
        [...TEXTOS, ...SELECTORES].filter((c) => !['dni', 'nombres', 'apellidos'].includes(c)).map((c) => [c, v[c].trim() || null]),
      )
      const json = {
        ...opcionales,
        nombres: v.nombres.trim(),
        apellidos: v.apellidos.trim(),
        modalidad: v.modalidad,
        ...(v.dni.trim() ? { dni: v.dni.trim() } : {}),
      }
      return ficha
        ? leer(api.v1.trabajadores[':id'].$patch({ param: { id: ficha.id }, json: { ...json, estado: v.estado } as never }))
        : leer(api.v1.trabajadores.$post({ json: json as never }))
    },
    onSuccess: (guardado) => {
      cliente.invalidateQueries({ queryKey: ['trabajadores'] })
      toast.success('Trabajador guardado')
      if (!ficha) router.replace(`/trabajadores/${guardado.id}`)
    },
    onError: (e) => setError({ campo: e instanceof ErrorApiCliente ? e.campo : undefined, mensaje: mensajeDeError(e) }),
  })

  const entrada = (campo: CampoTexto, etiqueta: string, extra: React.ComponentProps<typeof Input> = {}) => (
    <Campo id={campo} etiqueta={etiqueta} error={errorDe(campo)}>
      <Input id={campo} className="h-10" value={v[campo]} onChange={fijar(campo)} disabled={!puedeEditar} {...extra} />
    </Campo>
  )
  const selector = (campo: (typeof SELECTORES)[number], etiqueta: string, lista?: { id: string; nombre: string; activo: boolean }[]) => (
    <Campo id={campo} etiqueta={etiqueta}>
      <select id={campo} className={`${claseControl} h-10`} value={v[campo]} onChange={fijar(campo)} disabled={!puedeEditar}>
        <option value="">Sin asignar</option>
        {lista?.filter((x) => x.activo || x.id === v[campo]).map((x) => (
          <option key={x.id} value={x.id}>
            {x.nombre}
          </option>
        ))}
      </select>
    </Campo>
  )

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        setError(null)
        guardar.mutate()
      }}
    >
      {ficha && !ficha.dni && (
        <p className="rounded-lg border border-amber-300 bg-amber-100 p-3 text-sm font-medium text-amber-900">
          Falta el DNI. Este trabajador se registró solo con su nombre.
        </p>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Datos personales</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {entrada('dni', ficha ? 'DNI' : 'DNI (obligatorio)', { inputMode: 'numeric', maxLength: 8, required: !ficha })}
            {entrada('telefono', 'Teléfono', { inputMode: 'tel' })}
            {entrada('nombres', 'Nombres (obligatorio)', { required: true })}
            {entrada('apellidos', 'Apellidos (obligatorio)', { required: true })}
            {entrada('correo', 'Correo', { type: 'email' })}
            {entrada('direccion', 'Dirección')}
            {entrada('emergenciaNombre', 'Contacto de emergencia')}
            {entrada('emergenciaTelefono', 'Teléfono de emergencia', { inputMode: 'tel' })}
          </div>
        </section>

        <section className="space-y-3 rounded-xl border bg-background p-4">
          <h2 className="font-semibold">Trabajo</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {selector('areaId', 'Área', areas?.datos)}
            {selector('cargoId', 'Cargo', cargos?.datos)}
            {selector('turnoId', 'Turno (referencial)', turnos?.datos)}
            <Campo id="modalidad" etiqueta="Modalidad">
              <select id="modalidad" className={`${claseControl} h-10`} value={v.modalidad} onChange={fijar('modalidad')} disabled={!puedeEditar}>
                <option value="temporal">Temporal (pago semanal)</option>
                <option value="contrato">Contrato (pago mensual)</option>
              </select>
            </Campo>
            {entrada('fechaIngreso', 'Fecha de ingreso', { type: 'date' })}
            {ficha && (
              <Campo id="estado" etiqueta="Estado">
                <select id="estado" className={`${claseControl} h-10`} value={v.estado} onChange={fijar('estado')} disabled={!puedeEditar}>
                  <option value="activo">Activo</option>
                  <option value="cesado">Cesado</option>
                </select>
              </Campo>
            )}
          </div>
          {cargo && (cargo.tarifaHora != null || cargo.sueldoMensual != null) && (
            <p className="rounded-lg bg-muted p-3 text-sm">
              Tarifa de referencia del cargo {cargo.nombre}:{' '}
              {cargo.tipoPago === 'mensual'
                ? `${formatoSoles(cargo.sueldoMensual)} al mes`
                : `${formatoSoles(cargo.tarifaHora)} hora normal · ${formatoSoles(cargo.tarifaHoraExtra)} hora extra`}
              <span className="block text-xs text-muted-foreground">Se define en Configuración. En cada planilla se puede cambiar por registro.</span>
            </p>
          )}
          {entrada('notas', 'Notas')}
        </section>
      </div>

      {/* Los errores de un campo de texto se muestran bajo ese campo; el resto, aquí. */}
      {error && !(TEXTOS as readonly string[]).includes(error.campo ?? '') && (
        <p role="alert" className="text-sm text-destructive">
          {error.mensaje}
        </p>
      )}

      <div className="flex gap-3">
        {puedeEditar && (
          <Button type="submit" size="lg" disabled={guardar.isPending}>
            Guardar
          </Button>
        )}
        <Link href="/trabajadores" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
          Volver
        </Link>
      </div>
    </form>
  )
}
```

- [ ] **Step 2: Métodos de pago**

`frontend/src/components/trabajadores/metodos-pago.tsx`:

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import { Campo, claseControl } from '@/components/campo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api, leer, mensajeDeError } from '@/lib/api'
import type { FichaTrabajador } from './formulario'

const TIPO = { yape: 'Yape', plin: 'Plin', cuenta_bancaria: 'Cuenta bancaria' } as const
type Tipo = keyof typeof TIPO

export function MetodosPago({ ficha }: { ficha: FichaTrabajador }) {
  const cliente = useQueryClient()
  const [agregando, setAgregando] = useState(false)
  const [tipo, setTipo] = useState<Tipo>('yape')
  const id = ficha.id

  const opciones = {
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['trabajadores', id] })
      setAgregando(false)
    },
    onError: (e: unknown) => {
      toast.error(mensajeDeError(e))
    },
  }
  const agregar = useMutation({
    mutationFn: (datos: FormData) => {
      const texto = (campo: string) => String(datos.get(campo) ?? '').trim()
      return leer(
        api.v1.trabajadores[':id']['metodos-pago'].$post({
          param: { id },
          json: {
            tipo,
            numero: texto('numero'),
            titular: texto('titular'),
            banco: texto('banco') || null,
            cci: texto('cci') || null,
          },
        }),
      )
    },
    ...opciones,
  })
  const hacerPrincipal = useMutation({
    mutationFn: (metodoId: string) =>
      leer(api.v1.trabajadores[':id']['metodos-pago'][':metodoId'].$patch({ param: { id, metodoId }, json: { principal: true } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (metodoId: string) =>
      leer(api.v1.trabajadores[':id']['metodos-pago'][':metodoId'].$delete({ param: { id, metodoId } })),
    ...opciones,
  })

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Métodos de pago</h2>
        <span className="text-xs text-muted-foreground">Opcional</span>
      </div>

      {ficha.metodosPago.length === 0 && <p className="text-sm text-muted-foreground">Aún no tiene métodos de pago.</p>}
      <ul className="space-y-2">
        {ficha.metodosPago.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {TIPO[m.tipo]} · {m.banco ? `${m.banco} ` : ''}
                {m.numero} {m.principal && <Badge variant="secondary">Principal</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {m.cci ? `CCI ${m.cci} · ` : ''}Titular: {m.titular}
              </p>
            </div>
            {!m.principal && (
              <Button variant="ghost" size="lg" onClick={() => hacerPrincipal.mutate(m.id)}>
                Hacer principal
              </Button>
            )}
            <Button variant="destructive" size="lg" onClick={() => quitar.mutate(m.id)}>
              Quitar
            </Button>
          </li>
        ))}
      </ul>

      {agregando ? (
        <form
          className="grid gap-3 rounded-lg border border-dashed p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            agregar.mutate(new FormData(e.currentTarget))
          }}
        >
          <Campo id="metodo-tipo" etiqueta="Tipo">
            <select id="metodo-tipo" className={`${claseControl} h-10`} value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)}>
              {(Object.keys(TIPO) as Tipo[]).map((t) => (
                <option key={t} value={t}>
                  {TIPO[t]}
                </option>
              ))}
            </select>
          </Campo>
          <Campo id="metodo-numero" etiqueta={tipo === 'cuenta_bancaria' ? 'Número de cuenta' : 'Celular'}>
            <Input id="metodo-numero" name="numero" required minLength={6} className="h-10" />
          </Campo>
          {tipo === 'cuenta_bancaria' && (
            <>
              <Campo id="metodo-banco" etiqueta="Banco">
                <Input id="metodo-banco" name="banco" className="h-10" />
              </Campo>
              <Campo id="metodo-cci" etiqueta="CCI">
                <Input id="metodo-cci" name="cci" className="h-10" />
              </Campo>
            </>
          )}
          <Campo id="metodo-titular" etiqueta="Titular" ayuda="Puede ser otra persona." className="sm:col-span-2">
            <Input id="metodo-titular" name="titular" required minLength={2} defaultValue={`${ficha.nombres} ${ficha.apellidos}`} className="h-10" />
          </Campo>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" size="lg" disabled={agregar.isPending}>
              Agregar
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => setAgregando(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="lg" className="w-full border-dashed" onClick={() => setAgregando(true)}>
          + Agregar método de pago (Yape, Plin o cuenta bancaria)
        </Button>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Grupos del trabajador**

`frontend/src/components/trabajadores/grupos-trabajador.tsx`:

```tsx
'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { claseControl } from '@/components/campo'
import { Button } from '@/components/ui/button'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useGrupos } from '@/lib/catalogos'
import type { FichaTrabajador } from './formulario'

export function GruposTrabajador({ ficha }: { ficha: FichaTrabajador }) {
  const cliente = useQueryClient()
  const { data: grupos } = useGrupos()
  const trabajadorId = ficha.id

  const opciones = {
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['trabajadores', trabajadorId] })
      cliente.invalidateQueries({ queryKey: ['grupos'] })
    },
    onError: (e: unknown) => {
      toast.error(mensajeDeError(e))
    },
  }
  const agregar = useMutation({
    mutationFn: (id: string) => leer(api.v1.grupos[':id'].miembros.$post({ param: { id }, json: { trabajadorIds: [trabajadorId] } })),
    ...opciones,
  })
  const quitar = useMutation({
    mutationFn: (id: string) => leer(api.v1.grupos[':id'].miembros[':trabajadorId'].$delete({ param: { id, trabajadorId } })),
    ...opciones,
  })

  const propios = grupos?.datos.filter((g) => ficha.grupoIds.includes(g.id)) ?? []
  const disponibles = grupos?.datos.filter((g) => g.activo && !ficha.grupoIds.includes(g.id)) ?? []

  return (
    <section className="space-y-3 rounded-xl border bg-background p-4">
      <h2 className="font-semibold">Grupos</h2>
      <ul className="flex flex-wrap gap-2">
        {propios.length === 0 && <li className="text-sm text-muted-foreground">No está en ningún grupo.</li>}
        {propios.map((g) => (
          <li key={g.id} className="flex h-9 items-center gap-1 rounded-full border pr-1 pl-3 text-sm">
            {g.nombre}
            <Button variant="ghost" size="icon-sm" className="rounded-full" aria-label={`Quitar del grupo ${g.nombre}`} onClick={() => quitar.mutate(g.id)}>
              ×
            </Button>
          </li>
        ))}
      </ul>
      {disponibles.length > 0 && (
        <select
          aria-label="Agregar a un grupo"
          className={`${claseControl} h-10 max-w-xs`}
          value=""
          onChange={(e) => e.target.value && agregar.mutate(e.target.value)}
        >
          <option value="">+ Agregar a un grupo</option>
          {disponibles.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nombre}
            </option>
          ))}
        </select>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Las dos páginas**

`frontend/src/app/(panel)/trabajadores/nuevo/page.tsx`:

```tsx
'use client'

import { FormularioTrabajador } from '@/components/trabajadores/formulario'

export default function PaginaNuevoTrabajador() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Nuevo trabajador</h1>
      <FormularioTrabajador puedeEditar />
      <p className="text-sm text-muted-foreground">Los métodos de pago y los grupos se agregan después de guardar.</p>
    </div>
  )
}
```

`frontend/src/app/(panel)/trabajadores/[id]/page.tsx`:

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { FormularioTrabajador } from '@/components/trabajadores/formulario'
import { GruposTrabajador } from '@/components/trabajadores/grupos-trabajador'
import { MetodosPago } from '@/components/trabajadores/metodos-pago'
import { api, leer, mensajeDeError } from '@/lib/api'
import { useYo } from '@/lib/yo'

export default function PaginaTrabajador() {
  const { id } = useParams<{ id: string }>()
  const { data: yo } = useYo()
  const { data: ficha, error } = useQuery({
    queryKey: ['trabajadores', id],
    queryFn: () => leer(api.v1.trabajadores[':id'].$get({ param: { id } })),
  })

  if (error) return <p className="text-sm text-destructive">{mensajeDeError(error)}</p>
  if (!ficha || !yo) return <p className="text-sm text-muted-foreground">Cargando…</p>

  const puedeEditar = yo.rol === 'admin' || yo.rol === 'contabilidad'

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">
        {ficha.nombres} {ficha.apellidos}
      </h1>
      {/* key: al refrescar la ficha, el formulario toma los valores nuevos */}
      <FormularioTrabajador key={ficha.actualizadoEn} ficha={ficha} puedeEditar={puedeEditar} />
      {puedeEditar && (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <MetodosPago ficha={ficha} />
          <GruposTrabajador ficha={ficha} />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verificar y commit**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: sin errores; el build lista las 18 rutas, entre ellas `/trabajadores`, `/trabajadores/nuevo` y `/trabajadores/[id]`.

```bash
git add frontend
git commit -m "feat(web): add worker form with payment methods and groups"
```

---

### Task 11: Verificación automática, README y prueba manual de punta a punta

**Files:**
- Modify: `.github/workflows/ci.yml`, `README.md`

**Interfaces:**
- Consumes: scripts raíz `lint`, `typecheck`, `test`, `build`; el proyecto Supabase de desarrollo y el administrador del plan 1A (tarea 12).
- Produces: workflow que cubre los dos workspaces, y la fase 1 comprobada a mano contra Supabase.

- [ ] **Step 1: Ampliar el workflow**

En `.github/workflows/ci.yml`, reemplaza los tres últimos pasos (`npm ci`, `typecheck`, `test`) por:

```yaml
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 2: Actualizar el README**

En `README.md`, agrega al final de "Puesta en marcha":

```markdown
6. Copia `frontend/.env.example` a `frontend/.env.local` y complétalo con la URL y la clave pública del proyecto Supabase.
7. `npm run dev:web` (panel en http://localhost:3000)
```

Y a la tabla de "Comandos":

```markdown
| `npm run lint` | ESLint del frontend |
| `npm run build` | Build de producción del frontend |
```

- [ ] **Step 3: Verificar lo mismo que correrá el workflow**

Run: `npm ci && npm run lint && npm run typecheck && npm test && npm run build`
Expected: PASS: todas las pruebas del backend (148 al cerrar el plan 1A) y 4 del frontend; build con 18 rutas.

- [ ] **Step 4: Prueba manual contra Supabase**

Con `backend/.env` y `frontend/.env.local` completos, abre dos terminales: `npm run dev:api` y `npm run dev:web`. En http://localhost:3000 comprueba, en orden:

1. Sin sesión, cualquier ruta lleva a `/login`. Una contraseña equivocada muestra "Correo o contraseña incorrectos".
2. Con el administrador de la tarea 12 del plan 1A se entra y se llega a `/trabajadores`.
3. Configuración → Áreas: crear "Producción" y "Almacén". Repetir un nombre muestra "Ya existe un registro con ese valor".
4. Configuración → Cargos: crear "Estibador" por hora con S/ 10; la hora extra se propone en 12.5. Crear un cargo mensual sin sueldo muestra el error bajo "Sueldo mensual".
5. Configuración → Grupos: crear "Turno noche".
6. Trabajadores → Nuevo: sin DNI no deja guardar; con DNI de 8 dígitos guarda y abre la ficha.
7. En la ficha: agregar un Yape (queda "Principal"), agregar una cuenta bancaria, hacerla principal, quitarla; el Yape vuelve a ser principal.
8. En la ficha: agregar al grupo "Turno noche". En Configuración → Grupos → Miembros aparece el trabajador.
9. Configuración → Usuarios: crear un coordinador con el área "Producción". Cerrar sesión y entrar con él: no ve Configuración, solo ve trabajadores de Producción y la ficha no muestra métodos de pago ni el botón Guardar.
10. Perfil: cambiar el nombre (el menú lo refleja), cambiar la contraseña y cerrar sesión.
11. En el login, "Olvidé mi contraseña" envía el correo; el enlace abre `/restablecer` y permite poner una contraseña nueva.
12. Como administrador, Configuración → Auditoría muestra los cambios anteriores con usuario y fecha; el paginador y el filtro por tabla funcionan.
13. En el celular (o con el navegador a 390 px de ancho) el menú pasa a la barra inferior y las tablas se desplazan en horizontal sin romper la página.

Anota lo que falle como tareas nuevas; no se da por cerrada la fase con fallos en los puntos 1, 2, 6 o 9.

- [ ] **Step 5: Commit**

```bash
git add .github README.md
git commit -m "ci: lint, type-check, test and build both workspaces"
```

---

## Fuera de este plan

- Asistencia, Planillas y Reportes: sus entradas de menú y pantallas llegan con las fases 2 a 4.
- Historial de planillas y pagos en la ficha del trabajador: fases 2 y 3.
- Despliegue, dominio `admin.agrosalasperu.com` y proyecto Supabase de producción: se deciden al desplegar.
- Pruebas de punta a punta con Playwright: el spec las deja para después.
