# Planilla fase 2B: pantallas de asistencia y planillas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando las pantallas de la fase 2: asistencia del día (pensada para el celular), lista de planillas, alta de planilla y detalle con la grilla semanal y sus trabajadores, más el menú con las entradas nuevas y un menú lateral desplegable en celular.

**Architecture:** Las pantallas consumen la API del plan 2A con el cliente tipado de Hono y TanStack Query, igual que las de la fase 1. Todo lo que es cálculo de presentación (hora de Lima, siguiente marca, grilla, totales, estado visible de la planilla, nombre sugerido) vive en módulos puros con pruebas; los componentes solo los llaman. Un único diálogo de registro sirve a la asistencia del día y a la grilla.

**Tech Stack:** el de la fase 1B (Next.js 16, React 19, Tailwind 4, shadcn/ui sobre Base UI, TanStack Query 5, hono/client, sonner, Vitest 5). No se agrega ninguna dependencia.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, secciones 4 (permisos), 7 (planillas), 10 (pantallas 2, 3 y 4, y el menú) y 17 (nombres y direcciones). Fase 2 de la sección 15.

**Plan previo:** `2026-10-02-planilla-fase-2a-attendance-api.md` (ejecutado y mergeado). Su sección "Estado de ejecución" y su lista "Pendiente para el plan 2B" son parte de los requisitos de este plan.

## Decisiones tomadas

1. **Menú en celular: lateral desplegable.** Lo pidió Gonzalo el 2026-10-02. En celular hay una barra superior con un botón que abre el menú desde la izquierda; desaparece la barra inferior. En PC el menú lateral fijo sigue igual.
2. **Entrada del panel.** `/` lleva a `/attendance`, que es lo que más se usa. Reportes llega en la fase 4 y no aparece todavía en el menú.
3. **Pagado y pendiente no se muestran.** Dependen de los pagos (fase 3). La lista de planillas muestra personas y total; la grilla, horas y total.
4. **Estado visible de la planilla.** Además de los tres del spec (En curso, Por pagar, Cerrada) se muestra "Por iniciar" cuando la planilla está abierta y todavía no empieza.
5. **Trabajadores al crear la planilla.** El formulario ofrece una sola forma de cargarlos (uno por uno, un grupo, otra planilla, todos los temporales activos o ninguno), que es lo que acepta la API en el alta. Después se pueden agregar más desde la pestaña Trabajadores.
6. **Trabajadores cesados.** El buscador para agregar a una planilla solo ofrece trabajadores activos. Un cesado puede llegar por un grupo o por otra planilla; se muestra con su etiqueta "Cesado" y se puede quitar.
7. **Turno de noche abierto.** La asistencia de hoy avisa si ayer quedaron registros sin salida y lleva a ese día con un toque.
8. **Marca al instante.** Al tocar el botón la fila muestra la hora de inmediato con el texto "guardando…"; si la API falla, la fila vuelve a su estado y se avisa. **Cambiada durante la ejecución:** la petición NO se reintenta sola (`retry: false`, `networkMode: 'always'`), porque un reintento puede correr más tarde y la marca quedaría con la hora de ese momento; cada marca se envía una sola vez, en el momento del toque, y si falla la persona vuelve a tocar el botón (marcar es idempotente). El texto original decía que se reintentaba hasta tres veces cuando el fallo era de conexión.
9. **Pruebas.** La lógica de la grilla y del flujo de marcar se extrae a módulos puros con pruebas unitarias. Las pruebas de componentes con DOM que menciona el spec quedan para después: el frontend no tiene ese arnés y montarlo es una dependencia nueva. A cambio, el plan termina con una verificación en el navegador contra la base de desarrollo.
10. **Horas en pantalla.** Siempre en hora de Lima, calculada con un desfase fijo de −5 horas; nunca con la zona horaria del dispositivo.

## Estado de ejecución

Ejecutado el 2026-10-02 en la rama `feat/phase-2b-attendance-screens`. Las siete tareas están hechas y sus pasos marcados. El Step 4 de la Tarea 7 (verificación en el navegador) lo hizo el controlador con la sesión de Gonzalo; su resultado está en esa tarea.

Commits (`git log --oneline --reverse --no-merges 149df56..HEAD`; el último es este commit, que registra esta sección):

- `50a5b3e` feat(web): add Lima time, attendance and payroll view helpers
- `812db6d` feat(web): add the payroll grid builder with its totals
- `851f6c8` feat(web): add attendance and payrolls to the menu, with a slide-in menu on phones
- `da7670d` feat(web): add the payroll list and the new payroll form
- `0d3e2a4` fix(web): do not reopen the phone menu by itself after going back
- `5596521` feat(web): add the daily attendance screen with one-tap marks and the record dialog
- `f7220ec` feat(web): add the payroll detail with the weekly grid and its workers
- `124b25f` fix(web): do not queue attendance marks offline, keep sibling lists in sync and pin the dialog to its date
- `c7ee986` fix(web): show money read-only to management and name the mark button after its worker
- `fa438e3` fix(web): send each attendance mark once, at the moment of the tap
- este commit: docs(planilla): record the execution of plan 2B

Pruebas del frontend, en total, al terminar cada paso:

| Después de | Pruebas |
|---|---|
| Base (fin de la fase 2A) | 94 |
| Tarea 1 | 121 |
| Tarea 2 | 131 |
| Tarea 3 | 131 |
| Tarea 4 | 131 |
| Tarea 5 | 169 |
| Tarea 6 | 190 |
| Tanda de correcciones de la Tarea 5 | 193 |

Las del backend siguen en 285 en todos los pasos (el backend no cambia en este plan).

Verificación final, desde la raíz y sin `frontend/.env.local` (como en CI): `npm ci && npm run lint && npm run typecheck && npm test && npm run build`, todo en verde. Pruebas: backend 285 (17 archivos), frontend 193 (21 archivos). El build lista 20 rutas: `/_not-found`, `/attendance`, `/forgot-password`, `/login`, `/payrolls`, `/payrolls/[id]`, `/payrolls/new`, `/profile`, `/reset-password`, `/settings/areas`, `/settings/audit-log`, `/settings/campaigns`, `/settings/groups`, `/settings/groups/[id]`, `/settings/positions`, `/settings/shifts`, `/settings/users`, `/workers`, `/workers/[id]` y `/workers/new` (más el proxy). Las nuevas respecto de la fase 1 son `/attendance`, `/payrolls`, `/payrolls/new` y `/payrolls/[id]`.

Lo que difirió del texto del plan:

- **Decisión 8 reemplazada.** Las marcas no se reintentan solas (`retry: false`, `networkMode: 'always'`, también en "Marcar ingreso a todos"), porque un reintento puede correr más tarde y la marca quedaría con la hora de ese momento. Con el modo de red por defecto, además, una marca tocada sin conexión quedaba en pausa y se enviaba al volver la señal. Ahora cada marca se envía una sola vez, en el momento del toque; si falla, la fila vuelve a su estado, se avisa con "Vuelve a tocar el botón." y se vuelve a pedir la lista, porque el servidor pudo haber aplicado una marca cuya respuesta se perdió.
- **Menú.** El estado abierto del panel se deriva de la ruta, con un reinicio durante el render (`openedOn` se compara con `pathname`), así que no puede reabrirse solo al volver atrás; un efecto lo cierra si la ventana crece al ancho de PC (si no, el bloqueo de scroll del diálogo seguiría activo con el panel oculto por CSS). El panel muestra además la marca "Agrosalas Admin" junto al botón de cerrar.
- **Archivos que no estaban en el mapa.** La Tarea 5 agregó `lib/record-changes.ts` (qué se envía al guardar un registro) con 38 pruebas, y un validador de fecha, `isRealDate` en `lib/lima-time.ts`, con 3 pruebas (la URL de asistencia puede traer una fecha imposible como `2026-02-30`). La Tarea 6 agregó `lib/payroll-detail.ts` con 21 pruebas. La Tarea 4 agregó `useCampaigns` en `lib/catalogs.ts`.
- **Cachés de las marcas.** Una marca actualiza todas las listas en caché de esa planilla y esa fecha (`setQueriesData` sobre el prefijo `['attendance', payrollId, date]`), no solo la de la vista actual: así el filtro por área no muestra "Sin marcar" tras marcar desde "Todas las áreas". El diálogo del registro queda fijado a la fecha y a la planilla con las que se abrió: si la URL cambia (por ejemplo, con Atrás) el diálogo se cierra, y no puede guardar un registro en otro día.
- **Dinero para gerencia.** Gerencia ve el dinero solo en lectura en el diálogo del registro (resumen y tarifas con campos de solo lectura); el plan lo ataba a `canEditMoney`, con lo que gerencia no veía nada. El coordinador sigue sin ver ningún monto.
- **Tareas 1 y 2** se ejecutaron en un solo envío.
- **Verificación.** Los implementadores no pudieron verificar nada en un navegador (no tenían sesión). Todo lo visual y de interacción (menú, anchos a 375 px, diálogos, flujos de marcar, grilla, roles) está comprobado solo por lectura, lint, tipos, pruebas de módulos puros y build. La verificación en el navegador es el Step 4 de la Tarea 7, a cargo del controlador.
- **Textos que el plan no daba y los implementadores escribieron.** "Elige un grupo." y "Elige la planilla de la que copiar." en el formulario de alta (en vez de enviar un cuerpo inválido); "Es el resumen de lo guardado; se actualiza al guardar.", "Vacío: se calculan las sugeridas." y "Vacío: se toma del cargo, si es por hora." en el diálogo; "Ver ayer"; "Agregar trabajadores a la planilla" (enlace a la planilla, solo para administración y contabilidad con "Todas las áreas"); "Marcando…" y "Guardando…".
- **Otros ajustes menores.** "Marcar ingreso a todos" se oculta cuando no hay a quién marcar y excluye a quien ya tiene una marca en vuelo. Los nombres se muestran como "Apellido, Nombre", igual que en la lista de trabajadores. En la fila, "+1 día" va una vez tras el resumen si alguna marca guardada cae al día siguiente. El botón principal de la fila lleva `aria-label` "<acción> de <Apellido, Nombre>". En la grilla, el aviso "Se muestran los primeros 62 días de la planilla." aparece si el periodo es más largo; las celdas vacías no tienen botón para gerencia; el diálogo de edición de la planilla vive en `payrolls/[id]/page.tsx` y no en un cuarto archivo. El filtro de área de la asistencia es estado local (no va en la URL).

### Revisión final y tanda de correcciones

La revisión de toda la rama no encontró nada Crítico. Encontró tres Importantes, corregidos en esta tanda:

- La pantalla de asistencia podía quedarse en el día de ayer si se dejaba abierta pasada la medianoche, y marcar entonces ponía la hora de hoy en el registro de ayer. Ahora `hoy` se refresca al volver a la pantalla y cada minuto, la dirección no lleva la fecha cuando es hoy, hay un enlace "Ir a hoy" y no se envía ninguna marca si el día cambió.
- "Marcar ingreso a todos" no mostraba las marcas hasta que terminaba de recargarse la lista, y el botón seguía en "Marcando…" durante esa recarga. Ahora cada tanda se escribe en la caché al responder y la recarga corre en segundo plano.
- Enter (o "Ir" del teclado del celular) en el buscador de trabajadores enviaba el formulario: creaba una planilla vacía o agregaba y cerraba el diálogo. Ahora Enter no envía.

Además: una petición de marca se corta a los 15 segundos y termina como un fallo de conexión (`lib/api.ts` también trata un cuerpo cortado como fallo de conexión); el aviso de error añade "Vuelve a tocar el botón." solo si volver a tocar puede servir (`network_error` y `conflict`); un día con un solo tramo cerrado está completo (`hasOpenStretch`); la búsqueda de trabajadores distingue "Sin resultados", "Ya están elegidos" y "Hay más resultados: escribe más letras."; agregar o quitar trabajadores y guardar o marcar refrescan también `['attendance']` y `['payrolls']`; la tarifa vaciada es un error de campo ("Escribe la tarifa."); pasar un día con marcas a falta pide confirmación; la grilla se desplaza al día de hoy y muestra el monto de un día con horas aunque sea 0.

Commits de la tanda (después de `d21937d`):

- `dfbc677` fix(web): keep the attendance screen on the right day and show bulk marks at once
- `54ef278` fix(web): stop Enter in the worker search from submitting the form
- `eb6001e` fix(web): refresh related lists after saving and polish attendance details
- `5765f22` docs(planilla): record the final review of plan 2B
- `629ba4b` fix(web): open the payroll grid on today's column without hiding it under the names
- el commit siguiente: fix(web): ask before any change that discards the marks of a day

La segunda revisión, limitada a la tanda, dio las tres correcciones por buenas y la rama por lista para fusionar. De ella y de la comprobación en el navegador salieron los dos últimos commits:

- En el celular la columna de hoy de la grilla quedaba en parte bajo la columna de nombres: esa columna es fija y crece con el nombre más largo, así que ahora se mide en vez de suponer su ancho.
- Pasar un día trabajado con marcas a "Permiso" o "Descanso médico" también borra las horas: la confirmación cubre cualquier tipo que no sea "Trabajado" y pregunta "¿Guardar de todos modos?".
- Una marca ya no vuelve a pedir la lista de planillas de la pantalla de asistencia: solo la da por vencida, y se recarga al entrar a Planillas.
- La celda de un día trabajado sin ninguna marca se lee "sin horas" en un lector de pantalla.

Comprobado en el navegador a 375 px tras la tanda: la dirección sin fecha para hoy, "Ir a hoy", Enter en el buscador, "Ya están elegidos", el botón de quitar de 44 px, "Marcar ingreso a todos" con las filas al día junto con el aviso, y la columna de hoy pegada a la de nombres sin mover la página.

Pruebas del frontend: 193 antes de la tanda; 211 tras el primer commit, 220 tras el segundo, 232 tras el tercero y 234 al final. Las del backend siguen en 285.

### Pendiente

Lo que queda abierto después de esta tanda:

- Una planilla cerrada todavía muestra sus controles de edición ("Editar", "Quitar", "Agregar trabajadores", el diálogo del registro); la API responde `payroll_closed` y el mensaje se ve, pero conviene ocultarlos cuando llegue el cierre en la fase 3.
- Mensajes por campo y textos de carga en los selectores del formulario de alta (campañas, grupos, planillas recientes); "Elige un grupo." aparece en el aviso general y no junto al selector.
- Detalles de ARIA de las pestañas de la planilla y de la tabla de la grilla.
- El tope de 62 días de la grilla (hoy solo se avisa).
- Pruebas de borde: año ISO, medianoche de Lima y mezcla de null y número en `buildGrid`.
- Ctrl+clic y el botón Atrás de Android en el menú del celular.
- El aviso de "registros de ayer sin salida" no mira antes del primer día de la planilla: un turno de noche abierto un domingo no se avisa el lunes si la planilla empieza el lunes.
- Pruebas de componentes con DOM (decisión 9).
- Raya larga y raya corta entre `formatCents` y `formatSoles` para "sin monto".
- Las vistas de coordinador y de gerencia, el uso sin conexión y la planilla mensual se comprobaron solo por lectura, no en un navegador.
- Una recarga de la lista del día que ya estaba en camino puede llegar después de una marca y devolver esa fila a su estado anterior por un momento; tocar de nuevo no duplica nada. Se cierra cancelando esa recarga antes de escribir en la caché.
- `AbortSignal.timeout` no tiene alternativa para navegadores anteriores a Safari 16 o Chrome 103.
- Los botones "Cancelar" y "Agregar" de los diálogos miden 36 px de alto en el celular.

## Global Constraints

- El frontend solo habla con la API, siempre con `unwrap(api.v1…)`. No importa Drizzle ni toca la base.
- Todo nombre de código, archivo, carpeta, dirección y clave de consulta va en inglés (spec, sección 17). Todo texto que lee el usuario va en español. Ningún valor del contrato se muestra crudo: pasa por un mapa de etiquetas.
- Ocultar según el rol es comodidad; el permiso real lo aplica la API. Para el coordinador el dinero llega en `null`: las columnas y los campos de dinero se ocultan, no se pinta "S/ 0.00".
- Roles: gerencia solo lee; crear y editar planillas, `admin` y `accounting`; registrar y corregir asistencia, `admin`, `accounting` y `coordinator`.
- Al editar un registro se envían solo los campos que cambiaron: una hora que no se envía conserva lo guardado. Una falta o un permiso no envía horas ni horas extra. Al fijar una tarifa se envía también `needsReview: false`.
- Todo control de formulario lleva etiqueta (`<label>` o `aria-label`). Los controles miden al menos 44 px de alto en la pantalla de asistencia.
- Ninguna pantalla puede ensanchar la página en un celular de 375 px: las tablas anchas se desplazan dentro de su contenedor.
- Next.js 16: antes de usar una convención del framework, leer su guía en `node_modules/next/dist/docs/` (ver `frontend/AGENTS.md`). Los componentes de shadcn/ui están hechos sobre Base UI: `Dialog` recibe `open` y `onOpenChange`, y no existe `asChild`.
- No se toca `frontend/src/components/ui/` salvo para agregar un componente nuevo.
- Las pruebas del frontend son de módulos puros (sin DOM). No bajan de las 94 actuales.
- Rama `feat/phase-2b-attendance-screens`; Conventional Commits con scope (`feat(web): …`). No se hace `git push` sin que Gonzalo lo pida.
- Los comandos se ejecutan desde la raíz del repo salvo que se indique otra carpeta.

## Mapa de archivos

Todas las rutas son relativas a `frontend/src/`.

| Archivo | Responsabilidad |
|---|---|
| `lib/lima-time.ts` (nuevo) | Fecha y hora de Lima, sumar días, semana, mes, número de semana |
| `lib/attendance.ts` (nuevo) | Marcas y su orden, siguiente paso, etiquetas, formato de minutos, resumen de horas |
| `lib/payroll-view.ts` (nuevo) | Etiquetas de planilla, estado visible, nombre y fechas sugeridos |
| `lib/payroll-grid.ts` (nuevo) | Grilla de trabajadores × días y sus totales |
| `lib/format.ts` | `formatCents` |
| `components/panel/menu.tsx` | Entradas nuevas y menú lateral desplegable en celular |
| `app/(panel)/layout.tsx`, `next.config.ts` (en `frontend/`) | Relleno del contenido; `/` → `/attendance` |
| `app/(panel)/payrolls/page.tsx` (nuevo) | Lista de planillas |
| `app/(panel)/payrolls/new/page.tsx`, `components/payrolls/payroll-form.tsx`, `components/payrolls/worker-picker.tsx` (nuevos) | Alta de planilla |
| `app/(panel)/attendance/page.tsx`, `components/attendance/day-row.tsx`, `components/attendance/record-dialog.tsx` (nuevos) | Asistencia del día y diálogo de registro |
| `app/(panel)/payrolls/[id]/page.tsx`, `components/payrolls/attendance-grid.tsx`, `components/payrolls/payroll-workers.tsx` (nuevos) | Detalle: grilla y trabajadores |

---

### Task 1: Utilidades puras de hora, asistencia y planilla

**Files:**
- Create: `frontend/src/lib/lima-time.ts`, `frontend/src/lib/attendance.ts`, `frontend/src/lib/payroll-view.ts`
- Modify: `frontend/src/lib/format.ts`
- Test: `frontend/src/lib/lima-time.test.ts`, `frontend/src/lib/attendance.test.ts`, `frontend/src/lib/payroll-view.test.ts`, `frontend/src/lib/format.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `limaDate`, `limaTime`, `addDays`, `dayOffset`, `datesBetween`, `weekdayOf`, `weekOf`, `monthOf`, `isoWeek`; `MARKS`, `Mark`, `MARK_ACTION`, `MARK_LABEL`, `ATTENDANCE_TYPE_LABEL`, `AttendanceType`, `nextMark`, `formatMinutes`, `formatHours`, `marksSummary`; `PAYROLL_TYPE_LABEL`, `PAYROLL_STATUS_LABEL`, `PayrollDisplayStatus`, `payrollDisplayStatus`, `suggestedPayroll`; `formatCents`.

- [x] **Step 1: Escribir las pruebas**

`frontend/src/lib/lima-time.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays, datesBetween, dayOffset, isoWeek, limaDate, limaTime, monthOf, weekOf, weekdayOf } from './lima-time'

describe('Lima time', () => {
  it('gives the Lima date of an instant, five hours behind UTC', () => {
    expect(limaDate(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05')
    expect(limaDate(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06')
  })

  it('gives the Lima wall-clock time of a stored mark, or nothing when there is none', () => {
    expect(limaTime('2026-10-05T12:10:00.000Z')).toBe('07:10')
    expect(limaTime(null)).toBe('')
  })

  it('adds days across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-05', -1)).toBe('2026-10-04')
  })

  it('tells how many days after the record date a mark falls', () => {
    expect(dayOffset('2026-10-05', '2026-10-05T12:10:00.000Z')).toBe(0)
    expect(dayOffset('2026-10-05', '2026-10-06T09:00:00.000Z')).toBe(1)
  })

  it('lists the dates of a range, both ends included', () => {
    expect(datesBetween('2026-10-05', '2026-10-11')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ])
    expect(datesBetween('2026-10-11', '2026-10-05')).toEqual([])
  })

  it('names the weekday in Spanish', () => {
    expect(weekdayOf('2026-10-05')).toBe('lun')
    expect(weekdayOf('2026-10-11')).toBe('dom')
  })

  it('gives the Monday-to-Sunday week of a date', () => {
    const week = { start: '2026-10-05', end: '2026-10-11' }
    expect(weekOf('2026-10-05')).toEqual(week)
    expect(weekOf('2026-10-07')).toEqual(week)
    expect(weekOf('2026-10-11')).toEqual(week)
  })

  it('gives the whole month of a date, leap years included', () => {
    expect(monthOf('2026-10-07')).toEqual({ start: '2026-10-01', end: '2026-10-31' })
    expect(monthOf('2028-02-10')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
  })

  it('numbers the weeks the ISO way', () => {
    expect(isoWeek('2026-10-05')).toBe(41)
    expect(isoWeek('2026-01-01')).toBe(1)
    expect(isoWeek('2027-01-01')).toBe(53)
  })
})
```

`frontend/src/lib/attendance.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { formatHours, formatMinutes, marksSummary, nextMark } from './attendance'

const record = (clockIn1: string | null, clockOut1: string | null, clockIn2: string | null, clockOut2: string | null) => ({
  type: 'worked' as const,
  clockIn1,
  clockOut1,
  clockIn2,
  clockOut2,
})
const T = ['2026-10-05T12:10:00.000Z', '2026-10-05T18:00:00.000Z', '2026-10-05T19:00:00.000Z', '2026-10-05T23:30:00.000Z']

describe('nextMark', () => {
  it('starts with the clock-in when there is no record', () => {
    expect(nextMark(null)).toBe('clockIn1')
  })

  it('follows the order: clock-in, break, return, exit', () => {
    expect(nextMark(record(T[0], null, null, null))).toBe('clockOut1')
    expect(nextMark(record(T[0], T[1], null, null))).toBe('clockIn2')
    expect(nextMark(record(T[0], T[1], T[2], null))).toBe('clockOut2')
  })

  it('has no next step once the four marks are set', () => {
    expect(nextMark(record(T[0], T[1], T[2], T[3]))).toBeNull()
  })

  it('has no next step on an absence or a leave', () => {
    expect(nextMark({ ...record(null, null, null, null), type: 'absence' })).toBeNull()
    expect(nextMark({ ...record(null, null, null, null), type: 'medical_leave' })).toBeNull()
  })
})

describe('formatMinutes', () => {
  it('writes hours and minutes in words', () => {
    expect(formatMinutes(620)).toBe('10 h 20 min')
    expect(formatMinutes(480)).toBe('8 h')
    expect(formatMinutes(45)).toBe('45 min')
    expect(formatMinutes(0)).toBe('0 min')
  })
})

describe('formatHours', () => {
  it('writes minutes as h:mm for the grid', () => {
    expect(formatHours(620)).toBe('10:20')
    expect(formatHours(5)).toBe('0:05')
  })
})

describe('marksSummary', () => {
  it('shows both stretches in Lima time', () => {
    expect(marksSummary(record(T[0], T[1], T[2], T[3]))).toBe('07:10 – 13:00 · 14:00 – 18:30')
  })

  it('shows an open stretch with an ellipsis', () => {
    expect(marksSummary(record(T[0], null, null, null))).toBe('07:10 – …')
    expect(marksSummary(record(T[0], T[1], T[2], null))).toBe('07:10 – 13:00 · 14:00 – …')
  })

  it('is empty when there are no marks', () => {
    expect(marksSummary(record(null, null, null, null))).toBe('')
  })
})
```

`frontend/src/lib/payroll-view.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { payrollDisplayStatus, suggestedPayroll } from './payroll-view'

const week = { status: 'open' as const, startDate: '2026-10-05', endDate: '2026-10-11' }

describe('payrollDisplayStatus', () => {
  it('is in progress while today is inside the period', () => {
    expect(payrollDisplayStatus(week, '2026-10-05')).toBe('in_progress')
    expect(payrollDisplayStatus(week, '2026-10-11')).toBe('in_progress')
  })

  it('is to pay once the period has ended and it is still open', () => {
    expect(payrollDisplayStatus(week, '2026-10-12')).toBe('to_pay')
  })

  it('is upcoming before the period starts', () => {
    expect(payrollDisplayStatus(week, '2026-10-04')).toBe('upcoming')
  })

  it('is closed whatever the dates', () => {
    expect(payrollDisplayStatus({ ...week, status: 'closed' }, '2026-10-07')).toBe('closed')
  })
})

describe('suggestedPayroll', () => {
  it('suggests the current Monday-to-Sunday week and its number', () => {
    expect(suggestedPayroll('weekly', '2026-10-07')).toEqual({
      name: 'Semana 41',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
    })
  })

  it('adds the campaign to the name', () => {
    expect(suggestedPayroll('weekly', '2026-10-07', 'Contenedor Chile').name).toBe('Semana 41 · Contenedor Chile')
  })

  it('suggests the whole month for a monthly payroll', () => {
    expect(suggestedPayroll('monthly', '2026-10-07')).toEqual({
      name: 'Octubre 2026',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })
  })
})
```

Agregar a `frontend/src/lib/format.test.ts`:

```ts
describe('formatCents', () => {
  it('writes cents as soles', () => {
    expect(formatCents(6823)).toBe('S/ 68.23')
    expect(formatCents(180000)).toBe('S/ 1,800.00')
    expect(formatCents(0)).toBe('S/ 0.00')
  })

  it('shows a dash when there is no amount', () => {
    expect(formatCents(null)).toBe('—')
    expect(formatCents(undefined)).toBe('—')
  })
})
```

(con `formatCents` agregado al `import` de ese archivo).

- [x] **Step 2: Ver que fallan**

Run: `npx vitest run src/lib/lima-time.test.ts src/lib/attendance.test.ts src/lib/payroll-view.test.ts src/lib/format.test.ts` (desde `frontend/`)
Expected: FAIL. Los tres módulos nuevos no existen y `formatCents` no está exportado.

- [x] **Step 3: Escribir `frontend/src/lib/lima-time.ts`**

```ts
// Lima has no daylight saving time: it is always five hours behind UTC. The device's time zone is never used.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const inLima = (instant: Date) => new Date(instant.getTime() - LIMA_OFFSET_MS).toISOString()
const utcMidnight = (date: string) => Date.parse(`${date}T00:00:00Z`)

// 'YYYY-MM-DD' of an instant, in Lima.
export const limaDate = (instant: Date): string => inLima(instant).slice(0, 10)

// 'HH:MM' in Lima of a mark as the API sends it (an ISO instant); '' when there is no mark.
export const limaTime = (iso: string | null | undefined): string => (iso ? inLima(new Date(iso)).slice(11, 16) : '')

export const addDays = (date: string, days: number): string => new Date(utcMidnight(date) + days * DAY_MS).toISOString().slice(0, 10)

// How many days after the record date a mark falls: 0 the same day, 1 the next one (night shift).
export const dayOffset = (recordDate: string, iso: string): number =>
  Math.round((utcMidnight(limaDate(new Date(iso))) - utcMidnight(recordDate)) / DAY_MS)

// Every date from start to end, both included. Capped at 62 days: a payroll is a week or a month.
export function datesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  for (let date = start; date <= end && dates.length < 62; date = addDays(date, 1)) dates.push(date)
  return dates
}

const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
export const weekdayOf = (date: string): string => WEEKDAYS[new Date(utcMidnight(date)).getUTCDay()]

// Monday = 1 … Sunday = 7.
const isoDay = (date: string) => new Date(utcMidnight(date)).getUTCDay() || 7

// The Monday-to-Sunday week that contains the date.
export function weekOf(date: string): { start: string; end: string } {
  const start = addDays(date, 1 - isoDay(date))
  return { start, end: addDays(start, 6) }
}

// The whole month that contains the date.
export function monthOf(date: string): { start: string; end: string } {
  const [year, month] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = date.slice(0, 7)
  return { start: `${prefix}-01`, end: `${prefix}-${String(lastDay).padStart(2, '0')}` }
}

// ISO week number: the week belongs to the year of its Thursday.
export function isoWeek(date: string): number {
  const thursday = new Date(utcMidnight(addDays(date, 4 - isoDay(date))))
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1)
  return Math.ceil(((thursday.getTime() - yearStart) / DAY_MS + 1) / 7)
}
```

- [x] **Step 4: Escribir `frontend/src/lib/attendance.ts`**

```ts
import { limaTime } from './lima-time'

// The four marks of a day, in the order they happen.
export const MARKS = ['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'] as const
export type Mark = (typeof MARKS)[number]

// Text of the button that sets each mark.
export const MARK_ACTION: Record<Mark, string> = {
  clockIn1: 'Marcar ingreso',
  clockOut1: 'Salida a refrigerio',
  clockIn2: 'Regreso',
  clockOut2: 'Marcar salida',
}

// Name of each mark as a field of the record.
export const MARK_LABEL: Record<Mark, string> = {
  clockIn1: 'Ingreso',
  clockOut1: 'Salida a refrigerio',
  clockIn2: 'Regreso',
  clockOut2: 'Salida',
}

export const ATTENDANCE_TYPE_LABEL = {
  worked: 'Trabajado',
  absence: 'Falta',
  leave: 'Permiso',
  medical_leave: 'Descanso médico',
} as const
export type AttendanceType = keyof typeof ATTENDANCE_TYPE_LABEL

type Marks = Record<Mark, string | null>

// The next step of the day: the first mark without a time. None when the day is complete or was not worked.
export function nextMark(record: (Marks & { type: AttendanceType }) | null): Mark | null {
  if (!record) return 'clockIn1'
  if (record.type !== 'worked') return null
  return MARKS.find((mark) => record[mark] === null) ?? null
}

// 620 → "10 h 20 min"; 480 → "8 h"; 45 → "45 min".
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest} min`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// 620 → "10:20": the short form for the grid.
export const formatHours = (minutes: number): string => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`

const stretch = (from: string | null, to: string | null) => (from ? `${limaTime(from)} – ${to ? limaTime(to) : '…'}` : '')

// "07:10 – 13:00 · 14:00 – 18:30", in Lima time; an open stretch ends in "…".
export const marksSummary = (record: Marks): string =>
  [stretch(record.clockIn1, record.clockOut1), stretch(record.clockIn2, record.clockOut2)].filter(Boolean).join(' · ')
```

- [x] **Step 5: Escribir `frontend/src/lib/payroll-view.ts` y `formatCents`**

`frontend/src/lib/payroll-view.ts`:

```ts
import { isoWeek, monthOf, weekOf } from './lima-time'

export const PAYROLL_TYPE_LABEL = { weekly: 'Semanal', monthly: 'Mensual' } as const
export type PayrollType = keyof typeof PAYROLL_TYPE_LABEL

export const PAYROLL_STATUS_LABEL = {
  upcoming: 'Por iniciar',
  in_progress: 'En curso',
  to_pay: 'Por pagar',
  closed: 'Cerrada',
} as const
export type PayrollDisplayStatus = keyof typeof PAYROLL_STATUS_LABEL

// What the user sees: an open payroll is upcoming, in progress or to pay, depending on today's date in Lima.
export function payrollDisplayStatus(
  payroll: { status: 'open' | 'closed'; startDate: string; endDate: string },
  today: string,
): PayrollDisplayStatus {
  if (payroll.status === 'closed') return 'closed'
  if (today > payroll.endDate) return 'to_pay'
  if (today < payroll.startDate) return 'upcoming'
  return 'in_progress'
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Name and dates proposed in the new payroll form: this week (Monday to Sunday) or this month.
export function suggestedPayroll(type: PayrollType, today: string, campaignName?: string): { name: string; startDate: string; endDate: string } {
  const range = type === 'weekly' ? weekOf(today) : monthOf(today)
  const period = type === 'weekly' ? `Semana ${isoWeek(today)}` : `${MONTHS[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`
  return { name: campaignName ? `${period} · ${campaignName}` : period, startDate: range.start, endDate: range.end }
}
```

En `frontend/src/lib/format.ts`, después de `formatSoles`:

```ts
// 6823 → "S/ 68.23"; null (the coordinator never receives money) → "—"
export const formatCents = (cents: number | null | undefined) => (cents == null ? '—' : `S/ ${soles.format(cents / 100)}`)
```

- [x] **Step 6: Verificar**

Run: `npm run lint && npm run typecheck && npm test`
Expected: sin avisos ni errores; backend 285; frontend 94 + 9 + 9 + 7 + 2 = 121.

- [x] **Step 7: Commit**

```bash
git add frontend/src/lib
git commit -m "feat(web): add Lima time, attendance and payroll view helpers"
```

---

### Task 2: Grilla de la planilla

**Files:**
- Create: `frontend/src/lib/payroll-grid.ts`
- Test: `frontend/src/lib/payroll-grid.test.ts`

**Interfaces:**
- Consumes: `AttendanceType`, `formatHours` de `lib/attendance.ts`.
- Produces: `GridRecord`, `Totals`, `buildGrid(workers, dates, records)`, `cellLabel(record)`.

- [x] **Step 1: Escribir las pruebas**

`frontend/src/lib/payroll-grid.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildGrid, cellLabel, type GridRecord } from './payroll-grid'

const DATES = ['2026-10-05', '2026-10-06', '2026-10-07']
const WORKERS = [{ id: 'a' }, { id: 'b' }]

const worked = (workerId: string, date: string, regularMinutes: number, overtimeMinutes: number, amountCents: number | null): GridRecord => ({
  workerId,
  date,
  type: 'worked',
  workedMinutes: regularMinutes + overtimeMinutes,
  regularMinutes,
  overtimeMinutes,
  amountCents,
})
const absence = (workerId: string, date: string): GridRecord => ({
  workerId,
  date,
  type: 'absence',
  workedMinutes: 0,
  regularMinutes: 0,
  overtimeMinutes: 0,
  amountCents: 0,
})

describe('buildGrid', () => {
  const records = [worked('a', '2026-10-05', 480, 140, 6823), absence('a', '2026-10-06'), worked('b', '2026-10-05', 240, 0, 2500)]
  const grid = buildGrid(WORKERS, DATES, records)

  it('puts each record in the cell of its worker and date, and leaves the rest empty', () => {
    expect(grid.rows[0].cells).toEqual([records[0], records[1], null])
    expect(grid.rows[1].cells).toEqual([records[2], null, null])
  })

  it('totals each worker', () => {
    expect(grid.rows[0].totals).toEqual({ regularMinutes: 480, overtimeMinutes: 140, amountCents: 6823 })
    expect(grid.rows[1].totals).toEqual({ regularMinutes: 240, overtimeMinutes: 0, amountCents: 2500 })
  })

  it('totals each day and the whole payroll', () => {
    expect(grid.dayTotals).toEqual([
      { regularMinutes: 720, overtimeMinutes: 140, amountCents: 9323 },
      { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 },
      { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 },
    ])
    expect(grid.total).toEqual({ regularMinutes: 720, overtimeMinutes: 140, amountCents: 9323 })
  })

  it('has no amount when the records come without money (coordinator)', () => {
    const redacted = buildGrid(WORKERS, DATES, [worked('a', '2026-10-05', 480, 140, null)])
    expect(redacted.rows[0].totals).toEqual({ regularMinutes: 480, overtimeMinutes: 140, amountCents: null })
    expect(redacted.dayTotals[0].amountCents).toBeNull()
    expect(redacted.total.amountCents).toBeNull()
  })

  it('ignores records of workers or dates that are not in the grid', () => {
    const stray = buildGrid(WORKERS, DATES, [worked('zzz', '2026-10-05', 60, 0, 625), worked('a', '2026-11-01', 60, 0, 625)])
    expect(stray.total).toEqual({ regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 })
  })

  it('keeps the order of the workers and the dates it was given', () => {
    expect(grid.rows.map((row) => row.worker.id)).toEqual(['a', 'b'])
  })
})

describe('cellLabel', () => {
  it('is empty when there is no record', () => {
    expect(cellLabel(null)).toBe('')
  })

  it('shows the regular hours, and the overtime after a plus sign', () => {
    expect(cellLabel(worked('a', '2026-10-05', 480, 140, 6823))).toBe('8:00 +2:20')
    expect(cellLabel(worked('a', '2026-10-05', 240, 0, 2500))).toBe('4:00')
  })

  it('shows an ellipsis for a day in progress', () => {
    expect(cellLabel(worked('a', '2026-10-05', 0, 0, 0))).toBe('…')
  })

  it('abbreviates the days not worked', () => {
    expect(cellLabel(absence('a', '2026-10-05'))).toBe('F')
    expect(cellLabel({ ...absence('a', '2026-10-05'), type: 'leave' })).toBe('P')
    expect(cellLabel({ ...absence('a', '2026-10-05'), type: 'medical_leave' })).toBe('DM')
  })
})
```

Run: `npx vitest run src/lib/payroll-grid.test.ts` (desde `frontend/`)
Expected: FAIL, el módulo no existe.

- [x] **Step 2: Escribir `frontend/src/lib/payroll-grid.ts`**

```ts
import { formatHours, type AttendanceType } from './attendance'

// What the grid needs from an attendance record.
export type GridRecord = {
  workerId: string
  date: string
  type: AttendanceType
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  // null for the coordinator, who never receives money.
  amountCents: number | null
}

export type Totals = { regularMinutes: number; overtimeMinutes: number; amountCents: number | null }

const ZERO: Totals = { regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }

// An amount that is missing (null) makes the whole sum unknown: it is never shown as zero.
const add = (totals: Totals, record: GridRecord): Totals => ({
  regularMinutes: totals.regularMinutes + record.regularMinutes,
  overtimeMinutes: totals.overtimeMinutes + record.overtimeMinutes,
  amountCents: totals.amountCents === null || record.amountCents === null ? null : totals.amountCents + record.amountCents,
})

// Workers in rows, dates in columns, with the totals of each row, each column and the whole payroll.
export function buildGrid<W extends { id: string }, R extends GridRecord>(workers: W[], dates: string[], records: R[]) {
  const byCell = new Map(records.map((record) => [`${record.workerId}|${record.date}`, record]))
  const rows = workers.map((worker) => {
    const cells = dates.map((date) => byCell.get(`${worker.id}|${date}`) ?? null)
    return { worker, cells, totals: cells.reduce<Totals>((totals, cell) => (cell ? add(totals, cell) : totals), ZERO) }
  })
  const dayTotals = dates.map((_, column) =>
    rows.reduce<Totals>((totals, row) => {
      const cell = row.cells[column]
      return cell ? add(totals, cell) : totals
    }, ZERO),
  )
  const total = rows.reduce<Totals>(
    (totals, row) => ({
      regularMinutes: totals.regularMinutes + row.totals.regularMinutes,
      overtimeMinutes: totals.overtimeMinutes + row.totals.overtimeMinutes,
      amountCents: totals.amountCents === null || row.totals.amountCents === null ? null : totals.amountCents + row.totals.amountCents,
    }),
    ZERO,
  )
  return { rows, dayTotals, total }
}

const NOT_WORKED: Record<Exclude<AttendanceType, 'worked'>, string> = { absence: 'F', leave: 'P', medical_leave: 'DM' }

// Text of a cell: "8:00 +2:20" (regular and overtime hours), "…" for a day in progress, "F", "P" or "DM".
export function cellLabel(record: GridRecord | null): string {
  if (!record) return ''
  if (record.type !== 'worked') return NOT_WORKED[record.type]
  if (record.workedMinutes === 0) return '…'
  const regular = formatHours(record.regularMinutes)
  return record.overtimeMinutes > 0 ? `${regular} +${formatHours(record.overtimeMinutes)}` : regular
}
```

- [x] **Step 3: Verificar**

Run: `npm run lint && npm run typecheck && npm test`
Expected: sin avisos ni errores; frontend 121 + 10 = 131.

- [x] **Step 4: Commit**

```bash
git add frontend/src/lib/payroll-grid.ts frontend/src/lib/payroll-grid.test.ts
git commit -m "feat(web): add the payroll grid builder with its totals"
```

---

### Task 3: Menú con las entradas nuevas y menú lateral desplegable en celular

**Files:**
- Modify: `frontend/src/components/panel/menu.tsx`, `frontend/src/app/(panel)/layout.tsx`, `frontend/next.config.ts`

**Interfaces:**
- Consumes: `useMe`, `ROLE_LABEL`; el `Dialog` de Base UI (`@base-ui/react/dialog`), del mismo modo que lo usa `components/ui/dialog.tsx`.
- Produces: el menú con `/attendance` y `/payrolls`.

Comportamiento:

- Entradas, en este orden: **Asistencia** (`/attendance`), **Planillas** (`/payrolls`), **Trabajadores** (`/workers`), **Configuración** (`/settings`, solo `admin`). Reportes no aparece (fase 4).
- **PC (desde `md`)**: el menú lateral fijo de hoy, con las entradas nuevas y el enlace de perfil abajo. Sin cambios de aspecto.
- **Celular (menos de `md`)**: desaparece la barra inferior. Arriba queda una barra fija (`sticky top-0`), del mismo verde del menú (`#0f3d24`), con un botón de 44 × 44 px con `aria-label="Abrir menú"` y el texto "Agrosalas Admin". El botón abre un panel que entra desde la izquierda (ancho 16 rem, alto completo, mismo fondo), con las mismas entradas, el enlace de perfil abajo y un botón `aria-label="Cerrar menú"`. Detrás, un fondo oscuro semitransparente.
- El panel se cierra al tocar una entrada, al tocar el fondo, con el botón de cerrar y con Escape. Al cerrarse, el foco vuelve al botón que lo abrió (lo hace el `Dialog` de Base UI). La navegación se marca con `aria-current="page"` igual que hoy.
- La lista de entradas es una sola constante que usan los dos menús; no se duplica.
- `frontend/src/app/(panel)/layout.tsx`: el contenido deja de reservar espacio para la barra inferior (`pb-20` desaparece) y el contenedor pasa a columna en celular (barra arriba, contenido debajo) y fila desde `md`.
- `frontend/next.config.ts`: `/` redirige a `/attendance`; el comentario se actualiza.

- [x] **Step 1: Implementar** lo anterior. Leer antes `components/ui/dialog.tsx` para ver las piezas de Base UI (`Root`, `Trigger`, `Portal`, `Backdrop`, `Popup`, `Close`) y sus clases de animación; el panel lateral usa las piezas directamente con sus propias clases (`fixed inset-y-0 left-0`), sin tocar `ui/dialog.tsx`.

- [x] **Step 2: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todo limpio; mismas pruebas (131). `/attendance` y `/payrolls` todavía no existen: los enlaces darán 404 hasta las tareas 4 y 5; está previsto.

Run (con `frontend/.env.local` presente):

```bash
npm run start -w @agrosalas/frontend -- --port 3111 &
SERVER_PID=$!
sleep 4
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3111/
kill $SERVER_PID
```

Expected: `307 http://localhost:3111/attendance` (y de ahí, sin sesión, al login).

- [x] **Step 3: Commit**

```bash
git add frontend/src/components/panel/menu.tsx "frontend/src/app/(panel)/layout.tsx" frontend/next.config.ts
git commit -m "feat(web): add attendance and payrolls to the menu, with a slide-in menu on phones"
```

---

### Task 4: Lista de planillas y alta de planilla

**Files:**
- Create: `frontend/src/app/(panel)/payrolls/page.tsx`, `frontend/src/app/(panel)/payrolls/new/page.tsx`, `frontend/src/components/payrolls/payroll-form.tsx`, `frontend/src/components/payrolls/worker-picker.tsx`
- Modify: `frontend/src/lib/catalogs.ts` (agregar `useCampaigns`)

**Interfaces:**
- Consumes: `api.v1.payrolls.$get`, `api.v1.payrolls.$post`, `api.v1.campaigns.$get`, `api.v1.groups.$get`, `api.v1.workers.$get`; `payrollDisplayStatus`, `PAYROLL_STATUS_LABEL`, `PAYROLL_TYPE_LABEL`, `suggestedPayroll`, `formatCents`, `dateRange`, `limaDate`; `Paginator`, `Field`, `controlClass`, `ErrorWithRetry`, `useDebouncedValue`, `correctedPage`.
- Produces: `useCampaigns()` en `lib/catalogs.ts` (clave `['campaigns']`, la misma que usa la pantalla de Configuración); `WorkerPicker` (`{ value: Worker[]; onChange(workers: Worker[]): void }`, con `Worker = { id, firstName, lastName, dni }`), que la tarea 6 reutiliza.

**Lista (`/payrolls`)**, con el mismo patrón de `app/(panel)/workers/page.tsx` (filtros, texto con retraso, página anterior visible mientras llega la nueva, corrección de página, paginador):

- Título "Planillas" y, para `admin` y `accounting`, el botón "Nueva planilla" (`/payrolls/new`).
- Filtros: texto (`search`, `aria-label="Buscar por nombre"`), desde y hasta (dos `input type="date"` → `from`, `to`), campaña (`campaignId`, "Todas las campañas"), estado (`status`: "Todas", "Abiertas", "Cerradas"), tipo (`type`: "Todo tipo", "Semanal", "Mensual"). Clave de consulta `['payrolls', filtros, paginación]`.
- Columnas: **Planilla** (nombre como enlace a `/payrolls/<id>`, y debajo el rango con `dateRange`), **Campaña** (`campaignName` o "–"), **Tipo**, **Personas** (`workerCount`), **Total** (`formatCents(totalCents)`, alineado a la derecha), **Estado** (`Badge` con `PAYROLL_STATUS_LABEL[payrollDisplayStatus(p, hoy)]`, donde hoy es `limaDate(new Date())`).
- La columna Total no se muestra al coordinador (`me.role === 'coordinator'`).
- Vacío: "Ninguna planilla coincide con los filtros." La tabla va dentro de un contenedor con `overflow-x-auto`.

**Alta (`/payrolls/new`)**. Un rol que no puede crear ve "Tu rol no permite crear planillas." y un enlace a la lista (como en `workers/new`).

`PayrollForm`:

- **Tipo**: "Semanal (personal temporal)" o "Mensual (personal con contrato)". Por defecto semanal.
- **Campaña**: opcional, "Sin campaña" más las campañas activas.
- **Nombre** y **fechas**: se rellenan con `suggestedPayroll(tipo, hoy, nombreDeCampaña)`. Mientras el usuario no haya escrito en un campo, ese campo se vuelve a sugerir al cambiar el tipo o la campaña; un campo que el usuario ya tocó no se pisa.
- **Trabajadores**, un grupo de opciones (radio) con una sola forma de cargarlos:
  - "Elegir uno por uno" → `WorkerPicker`.
  - "Cargar un grupo" → selector con los grupos activos (`useGroups`), mostrando sus miembros (`members`).
  - "Copiar de otra planilla" → selector con las últimas 20 planillas (`pageSize: '20'`).
  - "Todos los temporales activos".
  - "Agregarlos después" (por defecto).
- Al guardar: `POST /v1/payrolls` con `name`, `type`, `startDate`, `endDate`, `campaignId` (o `null`) y, si corresponde, `workers` con **una sola** clave (`workerIds`, `groupId`, `payrollId` o `allActiveTemporary: true`). Con éxito: aviso "Planilla creada", invalidar `['payrolls']` y navegar a `/payrolls/<id>`.
- Errores: los que traen `field` (`name`, `endDate`, …) se muestran bajo su campo; los demás, en una alerta sobre los botones. El botón "Crear planilla" se desactiva mientras se envía. "Elegir uno por uno" sin ningún trabajador elegido se trata como "Agregarlos después".

`WorkerPicker`:

- Un buscador (`aria-label="Buscar trabajador por nombre o DNI"`) que consulta `GET /v1/workers` con `search`, `status: 'active'` y `pageSize: '8'`, desde dos letras y con retraso (`useDebouncedValue`). Clave `['workers', 'search', texto]`.
- Estados visibles: "Escribe al menos 2 letras", "Buscando…", "Sin resultados", el error.
- Cada resultado es un botón que agrega al trabajador; los ya elegidos no se ofrecen.
- Los elegidos se muestran como etiquetas con su nombre y un botón `aria-label="Quitar a <nombre>"`.

- [x] **Step 1: Implementar** `useCampaigns`, la lista, el formulario y el buscador.

- [x] **Step 2: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todo limpio; 131 pruebas de frontend; el build lista `/payrolls` y `/payrolls/new`.

- [x] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the payroll list and the new payroll form"
```

---

### Task 5: Asistencia del día

**Files:**
- Create: `frontend/src/app/(panel)/attendance/page.tsx`, `frontend/src/components/attendance/day-row.tsx`, `frontend/src/components/attendance/record-dialog.tsx`

**Interfaces:**
- Consumes: `api.v1.attendance.$get`, `api.v1.attendance.clock.$post`, `api.v1.attendance.bulk.$post`, `api.v1.attendance.$post`, `api.v1.attendance[':id'].$patch`, `api.v1.attendance[':id'].$delete`, `api.v1.payrolls.$get`; `nextMark`, `MARK_ACTION`, `MARK_LABEL`, `ATTENDANCE_TYPE_LABEL`, `formatMinutes`, `marksSummary`; `limaDate`, `limaTime`, `addDays`, `dayOffset`; `formatCents`, `formatDate`; `useAreas`, `useMe`.
- Produces: `RecordDialog`, que la tarea 6 reutiliza:

```ts
type RecordDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  payrollId: string
  date: string // 'YYYY-MM-DD'
  worker: { id: string; firstName: string; lastName: string }
  record: DayRecord | null // null = create a record for that worker and date
  canEditMoney: boolean // admin and accounting
  readOnly?: boolean // management
  onSaved: () => void // the caller invalidates its own queries
}
```

con `DayRecord` = el tipo de `record` en `ResponseBody<typeof api.v1.attendance.$get>['items'][number]`, exportado desde `record-dialog.tsx`.

**Pantalla (`/attendance`)**, pensada primero para el celular:

- **Fecha**: por defecto hoy en Lima (`limaDate(new Date())`). Botones "Día anterior" y "Día siguiente" (44 px) y un `input type="date"`. La fecha vive en la dirección (`?date=YYYY-MM-DD`) para poder enlazarla; sin parámetro, es hoy.
- **Planilla**: se piden las planillas abiertas que incluyen la fecha (`GET /v1/payrolls` con `status: 'open'`, `from` y `to` iguales a la fecha, `pageSize: '50'`). Si hay varias, un selector; por defecto la primera, o la que venga en `?payrollId=`. Si no hay ninguna: "No hay una planilla abierta para este día." y, para `admin` y `accounting`, el enlace "Crear planilla".
- **Área**: selector "Todas las áreas" más las áreas (`useAreas`); se envía como `areaId`.
- **Aviso de ayer**: si la fecha es hoy, se consulta también el día anterior de la misma planilla (solo si cae dentro de sus fechas). Si hay registros de tipo trabajado cuya siguiente marca no es nula (les falta la salida), se muestra "N registros de ayer sin salida" con un enlace que lleva a esa fecha.
- **Lista**: `GET /v1/attendance` con `payrollId`, `date` y `areaId`. Clave `['attendance', payrollId, date, areaId]`. Arriba, el resumen "N trabajadores · M con ingreso". Vacío: "Esta planilla no tiene trabajadores en esta área." Sin trabajadores en absoluto: enlace a la planilla para agregarlos.
- **"Marcar ingreso a todos"** (solo roles que registran): manda `POST /v1/attendance/bulk` con `mark: 'clockIn1'` y los trabajadores listados que no tienen registro, en tandas de 200. Pide confirmación ("¿Marcar el ingreso de N trabajadores a las HH:MM?"). Al terminar: aviso "N marcados" y, si hubo fallos, "M no se pudieron marcar" con el primer mensaje. Luego invalida la lista. El botón no aparece si la fecha no es hoy.

`DayRow` (una fila por trabajador):

- Nombre (apellido, nombre) y DNI ("DNI pendiente" si no tiene).
- Estado del día: sin registro, "Sin marcar"; trabajado, `marksSummary(record)` y `formatMinutes(record.workedMinutes)`; no trabajado, un `Badge` con `ATTENDANCE_TYPE_LABEL`. Una marca que cae al día siguiente lleva "+1 día" (`dayOffset`). Un registro con `needsReview` lleva el `Badge` "Por revisar".
- **Un solo botón principal** (44 px, ancho completo en celular) con `MARK_ACTION[nextMark(record)]`. Si no hay siguiente paso, no hay botón: se muestra "Completo" (o el tipo). Al tocarlo: `POST /v1/attendance/clock` con `payrollId`, `workerId`, `date`, `mark` y sin `at` (la hora la pone el servidor).
- **Marca al instante**: mientras la petición está en curso, la fila muestra la hora local de Lima del toque y "guardando…", y el botón queda desactivado. Con éxito, el registro de la respuesta reemplaza al de la fila en la caché de la consulta (`setQueryData`), sin volver a pedir la lista. Con error, la fila vuelve a su estado y se muestra el mensaje en un aviso. (Cambiado durante la ejecución: la mutación no reintenta; ver la decisión 8.)
- Botón secundario "Editar" (o "Registrar", si no hay registro), que abre `RecordDialog`. Gerencia lo ve como "Ver" y el diálogo se abre en solo lectura. Si la fecha no es hoy no hay botón principal: solo el secundario (las marcas con hora actual son para el día en curso).

`RecordDialog`:

- Título: "<Nombre> · <fecha dd/mm/aaaa>".
- **Tipo** (selector con `ATTENDANCE_TYPE_LABEL`).
- Si el tipo es trabajado: cuatro `input type="time"` con `MARK_LABEL` como etiqueta, rellenados con `limaTime` de cada marca; bajo cada hora que cae al día siguiente, "día siguiente". Texto de ayuda: "Si una hora es menor que la anterior, se toma como del día siguiente."
- **Horas extra**: campo numérico en minutos, opcional. Vacío significa "las sugeridas"; la ayuda muestra lo que hay ahora: "Sugeridas: 2 h 20 min" o "Fijadas a mano". Un botón "Usar las sugeridas" lo vacía.
- **Resumen** (solo lectura): trabajado, normales, extra con `formatMinutes`; y, si `canEditMoney`, el monto con `formatCents`.
- Solo con `canEditMoney`: **Tarifa por hora** y **Tarifa por hora extra** (S/, hasta cuatro decimales) y la casilla **Por revisar**.
- **Nota** (hasta 300 caracteres).
- **Guardar**: sin registro, `POST /v1/attendance` con `payrollId`, `workerId`, `date` y los campos; con registro, `PATCH` con **solo los campos que cambiaron** respecto de lo que se cargó. Reglas de envío:
  - una hora vacía que antes tenía valor se envía como `null`; una hora que no se tocó no se envía;
  - con un tipo distinto de trabajado no se envían horas ni `overtimeMinutes`;
  - horas extra vacías se envían como `overtimeMinutes: null` solo si antes estaban fijadas a mano;
  - si cambia una tarifa y no se tocó "Por revisar", se envía `needsReview: false`;
  - si nada cambió, no se llama a la API y el diálogo se cierra.
- Errores con `field` bajo su campo (`clockOut1`, `overtimeMinutes`, `at`, …); el resto en una alerta. Botones desactivados mientras se guarda.
- **Eliminar registro** (solo si existe y el rol registra): pide confirmación y llama a `DELETE`.
- En solo lectura todos los campos son de solo lectura y no hay botones de guardar ni eliminar.
- Tras guardar o eliminar: aviso ("Registro guardado" / "Registro eliminado"), `onSaved()` y cerrar.

La lógica de "qué se envía" (comparar el formulario con el registro cargado y armar el cuerpo) va en un módulo puro `frontend/src/lib/record-changes.ts` con pruebas escritas primero, que cubran al menos: sin cambios → cuerpo vacío; solo una hora cambiada → solo esa clave; hora borrada → `null`; paso a falta → `type` sin horas ni horas extra; horas extra vaciadas estando fijadas → `overtimeMinutes: null`; horas extra vaciadas sin estar fijadas → no se envía; tarifa cambiada → incluye `needsReview: false`; tarifa cambiada con "Por revisar" marcado a mano → respeta lo marcado; alta de una falta → `{ type: 'absence' }` más la nota si la hay.

- [x] **Step 1: Escribir las pruebas de `record-changes.ts`** y verlas fallar.
- [x] **Step 2: Implementar** `record-changes.ts`, `RecordDialog`, `DayRow` y la página.
- [x] **Step 3: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todo limpio; frontend 131 más las pruebas de `record-changes` (anotar el total); el build lista `/attendance`.

- [x] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the daily attendance screen with one-tap marks and the record dialog"
```

---

### Task 6: Detalle de la planilla: grilla y trabajadores

**Files:**
- Create: `frontend/src/app/(panel)/payrolls/[id]/page.tsx`, `frontend/src/components/payrolls/attendance-grid.tsx`, `frontend/src/components/payrolls/payroll-workers.tsx`

**Interfaces:**
- Consumes: `api.v1.payrolls[':id'].$get`, `api.v1.payrolls[':id'].$patch`, `api.v1.payrolls[':id'].workers.$post`, `api.v1.payrolls[':id'].workers[':workerId'].$delete`; `buildGrid`, `cellLabel`; `datesBetween`, `weekdayOf`, `limaDate`; `formatHours`, `formatCents`, `dateRange`; `payrollDisplayStatus`, `PAYROLL_STATUS_LABEL`, `PAYROLL_TYPE_LABEL`; `RecordDialog` (tarea 5); `WorkerPicker`, `useCampaigns` (tarea 4); `useGroups`.
- Produces: la pantalla `/payrolls/[id]`.

**Cabecera**:

- Enlace "← Planillas", el nombre como título, y debajo: rango de fechas, tipo, campaña (o "Sin campaña") y el `Badge` de estado.
- Para `admin` y `accounting`, botón "Editar" que abre un diálogo con nombre, fechas y campaña; envía en `PATCH` solo lo que cambió. Los errores `records_outside_range` y los de `field` se muestran en el diálogo.
- Enlace "Asistencia de hoy" a `/attendance?payrollId=<id>`, visible cuando la planilla está en curso.
- Un id inexistente muestra el error con "Reintentar" y el enlace de vuelta, no "Cargando…" para siempre.

**Pestañas**: "Asistencia" y "Trabajadores" (la pestaña Pagos llega en la fase 3). Son dos botones con `role="tab"` dentro de un `role="tablist"`; la activa vive en la dirección (`?tab=workers`).

**Pestaña Asistencia** (`AttendanceGrid`), pensada para PC:

- Grilla con `buildGrid(workers, datesBetween(startDate, endDate), records)`.
- Primera columna fija al desplazar (`sticky left-0`): el trabajador (apellido, nombre). Una columna por día con el encabezado "lun 05" (`weekdayOf` y el día del mes); el día de hoy va resaltado. Última columna: **Total** con las horas normales y extra, y debajo el monto.
- Cada celda es un botón con `cellLabel(record)` y un `aria-label` completo ("<Nombre>, lun 05/10: 8:00 +2:20" o "… sin registro"). Colores según el diseño: verde suave para trabajado, ámbar cuando hay horas extra, rojo suave para falta; un punto ámbar si `needsReview`.
- Al tocar una celda se abre `RecordDialog` para ese trabajador y esa fecha (con el registro o `null`). Gerencia lo abre en solo lectura; en una celda vacía, gerencia no abre nada.
- Fila final **Totales**: por día y el total general.
- Los montos (en la columna Total y en la fila de totales) solo se muestran si el rol no es coordinador.
- El contenedor tiene `overflow-x-auto`: una planilla mensual tiene hasta 31 columnas y no debe ensanchar la página.
- Sin trabajadores: "Esta planilla todavía no tiene trabajadores." con un botón que lleva a la pestaña Trabajadores.
- Tras guardar en el diálogo se invalida `['payrolls', id]` (y `['payrolls']`, por el total de la lista).

**Pestaña Trabajadores** (`PayrollWorkers`):

- Lista de los trabajadores de la planilla (apellido, nombre, DNI, `Badge` "Cesado" si corresponde) con el número de días registrados de cada uno.
- Para `admin` y `accounting`:
  - Botón "Quitar" por fila (`aria-label="Quitar a <nombre>"`), con confirmación. El error `has_records` se muestra tal cual llega.
  - "Agregar trabajadores", con las mismas formas que el alta: uno por uno (`WorkerPicker`, sin ofrecer a los que ya están), un grupo, otra planilla, o todos los temporales activos. Cada forma llama a `POST /v1/payrolls/:id/workers` con una sola clave. Aviso con el resultado: "3 agregados" o "Ya estaban todos".
- Tras agregar o quitar se invalidan `['payrolls', id]` y `['payrolls']`.
- El coordinador y gerencia ven la lista sin acciones.

- [x] **Step 1: Implementar** la página, la grilla y la pestaña de trabajadores.

- [x] **Step 2: Verificar**

Run: `npm run lint && npm run typecheck && npm test && npm run build`
Expected: todo limpio; mismas pruebas que al final de la tarea 5; el build lista `/payrolls/[id]`.

- [x] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the payroll detail with the weekly grid and its workers"
```

---

### Task 7: Documentación y verificación

**Files:**
- Modify: `README.md`, `docs/superpowers/specs/2026-10-01-planilla-design.md`, este plan.

- [x] **Step 1: Documentación**

- Spec, sección 10: el menú en celular es un panel lateral desplegable (no una barra inferior); el estado "Por iniciar"; en la pantalla 2, el aviso de registros de ayer sin salida.
- Spec, sección 14: las pruebas de componentes con DOM siguen pendientes; la lógica de la grilla y del flujo de marcar está cubierta con pruebas de módulos puros.
- Este plan: sección "Estado de ejecución" con fecha, commits (`git log --oneline --reverse --no-merges <base>..HEAD`), totales de pruebas y lo que difirió del texto.

- [x] **Step 2: Verificación final**

```bash
mv frontend/.env.local /tmp/agrosalas-env-local.bak
npm ci && npm run lint && npm run typecheck && npm test && npm run build
mv /tmp/agrosalas-env-local.bak frontend/.env.local
```

Expected: todo en verde sin variables de entorno, como en CI. El build lista, además de las rutas de la fase 1: `/attendance`, `/payrolls`, `/payrolls/new`, `/payrolls/[id]`. Si un comando falla, restaurar igual el `.env.local`.

- [x] **Step 3: Commit**

```bash
git add README.md docs
git commit -m "docs(planilla): record the execution of plan 2B"
```

- [x] **Step 4: Verificación en el navegador** (la hace el controlador, con la sesión de Gonzalo y los datos de prueba de la base de desarrollo; no un subagente)

A 375 px y a 1280 px: el menú desplegable abre, navega y cierra; crear una planilla semanal con el grupo "Cuadrilla contenedor Chile"; marcar ingreso, refrigerio, regreso y salida de un trabajador y ver que los minutos y el monto coinciden con la API; "Marcar ingreso a todos"; registrar una falta; corregir una hora y fijar horas extra desde el diálogo; ver la grilla con sus totales; agregar y quitar un trabajador; ninguna pantalla ensancha la página en celular.

Resultado: verificado por el controlador el 2026-10-02 a 375 px y en escritorio, con una sesión de administrador contra la base de desarrollo: menú, redirección de `/`, creación de una planilla desde un grupo, marca de un toque, registro completo (620, 480 y 140 min = S/ 68.23), horas extra fijadas en 0 (S/ 64.58), "Marcar ingreso a todos", falta desde una celda de la grilla, agregar y quitar trabajadores, ninguna página más ancha que el celular y ningún error en la consola. No se verificó en un navegador: las vistas de coordinador y de gerencia, el uso sin conexión ni una planilla mensual.

---

## Fuera de este plan

- Pestaña Pagos, conceptos, cierre y reapertura, recibo, y las columnas Pagado y Pendiente: fase 3.
- Reportes y exportación a Excel: fase 4.
- Pruebas de componentes con DOM y de punta a punta con Playwright.
- Uso sin conexión: la marca no se reintenta ni se guarda en el dispositivo; sin señal falla y se vuelve a tocar (decisión 8).
