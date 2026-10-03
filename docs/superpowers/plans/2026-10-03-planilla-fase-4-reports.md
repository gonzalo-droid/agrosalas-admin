# Planilla fase 4: reportes de costo y exportación a Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reportes de costo de la planilla (por semana, por mes, por área, por campaña y por trabajador) en un rango de fechas, con su pantalla y exportación a Excel, y exportar a Excel cada planilla desde su detalle.

**Architecture:** La API agrega con consultas agrupadas en SQL y arma los periodos y los grupos con módulos puros probados (`backend/src/payroll/report-*.ts`). Cinco rutas de lectura bajo `/v1/reports/costs/*`. El Excel se genera en el navegador con `write-excel-file` (cargada solo al exportar), a partir de los mismos datos que muestra la pantalla: la API no cambia según dónde se despliegue y no hay rutas binarias.

**Tech Stack:** el de las fases anteriores. Dependencia nueva solo en el frontend: `write-excel-file` 4.x (MIT; depende solo de `fflate`).

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, secciones 4 (permisos: reportes para administración, gerencia y contabilidad), 7 (campañas; planillas mensuales sin campaña = "Personal con contrato"), 10 (pantallas 4 y 7; menú), 11 (reportes), 14 y 17.

**Rama:** `feat/phase-4-reports`, desde `master` (`d6f1487`). Un solo plan y un solo PR para API y pantallas.

## Decisiones tomadas

Se pueden cambiar antes de fusionar.

1. **Rango.** Todos los reportes reciben `from` y `to` (fechas). `to` no puede ser anterior a `from` y el rango no puede pasar de 366 días. En pantalla el rango por defecto es el mes en curso de Lima.
2. **Semana y mes** (spec §11): la asistencia cuenta por la fecha de cada registro dentro del rango; los conceptos cuentan en la semana (lunes a domingo) o el mes en que empieza su planilla, si ese inicio cae en el rango. Se listan todas las semanas o meses que tocan el rango, también los que suman 0.
3. **Área:** la asistencia por el área copiada en cada registro (`attendance_records.area_id`); sin área, "Sin área". Los conceptos no tienen área: van en una línea aparte "Conceptos (sin área)", con la misma regla de la semana.
4. **Campaña y trabajador:** cuentan las planillas que **empiezan** en el rango, con todos sus días, conceptos y pagos (así cuadran con el total, pagado y pendiente de cada planilla). Una planilla sin campaña va a "Personal con contrato" si es mensual y a "Sin campaña" si es semanal.
5. **Pagado y pendiente** solo en los reportes por campaña y por trabajador (spec §11).
6. **Excel en el navegador** con `write-excel-file`, importada de forma diferida (`await import(...)`) solo al exportar. Montos como números en soles con dos decimales; horas como texto `8:00`.
7. **Exportar planilla:** desde su detalle, para los roles que ven dinero, abierta o cerrada. Tres hojas: Asistencia (trabajadores por días, como el Excel de hoy, con Total, Pagado y Pendiente), Conceptos y Pagos.
8. **Permisos:** el coordinador no ve Reportes ni exporta (403 en las rutas; sin entrada en el menú).
9. **Sin paginar:** los reportes devuelven todas sus filas (como mucho 53 semanas, 13 meses, las áreas, las campañas y los trabajadores del rango).

## Global Constraints

- Todo nombre de código, tabla, columna, ruta, clave JSON, clave de consulta y prueba va en inglés; todo texto que lee una persona, en español y exactamente como lo da la tarea. Ningún valor del contrato se muestra tal cual.
- Permisos en el backend: las cinco rutas de reportes son de `admin`, `accounting` y `management`; el coordinador recibe 403 `forbidden`. En el frontend el dinero se oculta por rol (`seesMoney`).
- Dinero en céntimos enteros en la API; minutos enteros. Las fechas son de Lima (`attendance_records.date` ya lo es).
- Formato único de error; las rutas se encadenan para el cliente tipado; el backend solo usa imports relativos.
- El frontend solo habla con la API por `unwrap(api.v1…)`; tipos de respuesta con `ResponseBody<…>`; sin `as any`.
- Todo control con etiqueta; nada ensancha la página más allá de 375 px; botones táctiles de 44 px (`h-11`) en el celular.
- Next.js 16: leer su guía en `node_modules/next/dist/docs/` antes de usar una convención; `useSearchParams` con `Suspense`.
- El número de pruebas no baja: backend 409, frontend 268.
- Rama `feat/phase-4-reports`; Conventional Commits con scope (`feat(api): …`, `feat(web): …`). No se versiona `.env*`. No se hace `git push` sin que Gonzalo lo pida.

## Mapa de archivos

| Archivo | Responsabilidad |
|---|---|
| `backend/src/payroll/report-periods.ts` (nuevo) | Semanas y meses de un rango; reparto de sumas diarias en periodos |
| `backend/src/payroll/report-groups.ts` (nuevo) | Agrupar líneas planilla × trabajador por campaña y por trabajador |
| `backend/src/routes/reports.ts` (nuevo) | `/v1/reports/costs/weekly`, `/monthly`, `/by-area`, `/by-campaign`, `/by-worker` |
| `backend/src/app.ts` | Montaje |
| `backend/test/report-periods.test.ts`, `report-groups.test.ts`, `reports.test.ts` (nuevos); `permissions.test.ts` | Pruebas |
| `frontend/src/lib/xlsx.ts` (nuevo) | Hojas como datos (puro) y descarga con `write-excel-file` |
| `frontend/src/lib/report-view.ts` (nuevo) | Pestañas, rango por defecto, etiquetas de periodos y grupos |
| `frontend/src/app/(panel)/reports/page.tsx` (nuevo) y `frontend/src/components/reports/*` (nuevos) | Pantalla de reportes |
| `frontend/src/components/panel/menu.tsx` | Entrada "Reportes" |
| `frontend/src/app/(panel)/payrolls/[id]/page.tsx` | Botón "Exportar a Excel" |

---

### Task 1: Periodos y grupos (módulos puros del backend)

**Files:**
- Create: `backend/src/payroll/report-periods.ts`, `backend/src/payroll/report-groups.ts`
- Test: `backend/test/report-periods.test.ts`, `backend/test/report-groups.test.ts`

**Interfaces (nombres exactos; las tareas 2 y 3 los usan):**

```ts
// report-periods.ts
export const daysInRange: (from: string, to: string) => number // inclusive: same day → 1
export const weekStart: (date: string) => string // the Monday of the week of the date
export function weeksInRange(from: string, to: string): { start: string; end: string }[] // every Mon–Sun week that touches the range
export function monthsInRange(from: string, to: string): string[] // 'YYYY-MM'
export type DayTotals = { date: string; regularMinutes: number; overtimeMinutes: number; cents: number }
export type PeriodTotals = { regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number; totalCents: number }
export function sumByPeriod(
  periods: string[],
  periodOf: (date: string) => string,
  attendance: DayTotals[],
  items: { date: string; cents: number }[],
): (PeriodTotals & { period: string })[]

// report-groups.ts
export type ReportPayroll = { id: string; name: string; type: 'weekly' | 'monthly'; startDate: string; endDate: string; status: 'open' | 'closed'; campaignId: string | null; campaignName: string | null }
export type ReportLine = {
  payrollId: string
  workerId: string
  workedDays: number
  regularMinutes: number
  overtimeMinutes: number
  attendanceCents: number
  itemsCents: number // signed: additions − deductions
  paidCents: number
}
export type ReportWorker = { id: string; firstName: string; lastName: string; dni: string | null }
export type Money = { totalCents: number; paidCents: number; pendingCents: number }
export type WorkerRow = { workerId: string; firstName: string; lastName: string; dni: string | null; workedDays: number; regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number } & Money
export type CampaignRow = {
  key: string // the campaign id, 'contract' or 'none'
  campaignId: string | null
  name: string // the campaign name, 'Personal con contrato' or 'Sin campaña'
  payrollCount: number
  people: number
  workedDays: number
  regularMinutes: number
  overtimeMinutes: number
  payrolls: ({ id: string; name: string; startDate: string; endDate: string; status: 'open' | 'closed' } & Money)[]
  workers: WorkerRow[]
} & Money
export const campaignKeyOf: (payroll: ReportPayroll) => { key: string; name: string }
export function groupByWorker(lines: ReportLine[], workers: ReportWorker[]): WorkerRow[]
export function groupByCampaign(payrolls: ReportPayroll[], lines: ReportLine[], workers: ReportWorker[]): CampaignRow[]
```

**`report-periods.ts`** (código completo):

```ts
const DAY_MS = 24 * 60 * 60 * 1000
const utc = (date: string) => Date.parse(`${date}T00:00:00Z`)
const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const daysInRange = (from: string, to: string): number => Math.round((utc(to) - utc(from)) / DAY_MS) + 1

// Weeks run from Monday to Sunday, like the payrolls.
export function weekStart(date: string): string {
  const ms = utc(date)
  const fromMonday = (new Date(ms).getUTCDay() + 6) % 7
  return iso(ms - fromMonday * DAY_MS)
}

export function weeksInRange(from: string, to: string): { start: string; end: string }[] {
  const weeks: { start: string; end: string }[] = []
  for (let ms = utc(weekStart(from)); ms <= utc(to); ms += 7 * DAY_MS) {
    weeks.push({ start: iso(ms), end: iso(ms + 6 * DAY_MS) })
  }
  return weeks
}

export function monthsInRange(from: string, to: string): string[] {
  const months: string[] = []
  let [year, month] = from.split('-').map(Number)
  const last = to.slice(0, 7)
  for (;;) {
    const key = `${year}-${String(month).padStart(2, '0')}`
    months.push(key)
    if (key >= last) return months
    month += 1
    if (month === 13) {
      month = 1
      year += 1
    }
  }
}

export type DayTotals = { date: string; regularMinutes: number; overtimeMinutes: number; cents: number }
export type PeriodTotals = { regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number; totalCents: number }

// One row per period, in the order given, also the ones that add up to nothing. Amounts outside the periods are ignored.
export function sumByPeriod(
  periods: string[],
  periodOf: (date: string) => string,
  attendance: DayTotals[],
  items: { date: string; cents: number }[],
): (PeriodTotals & { period: string })[] {
  const rows = new Map(periods.map((period) => [period, { period, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 }]))
  for (const day of attendance) {
    const row = rows.get(periodOf(day.date))
    if (!row) continue
    row.regularMinutes += day.regularMinutes
    row.overtimeMinutes += day.overtimeMinutes
    row.attendanceCents += day.cents
  }
  for (const item of items) {
    const row = rows.get(periodOf(item.date))
    if (row) row.itemsCents += item.cents
  }
  for (const row of rows.values()) row.totalCents = row.attendanceCents + row.itemsCents
  return [...rows.values()]
}
```

**`report-groups.ts`**, reglas (el código lo escribe quien implementa, con estas pruebas):

- `campaignKeyOf`: con `campaignId` → `{ key: campaignId, name: campaignName ?? '' }`; sin campaña y `type === 'monthly'` → `{ key: 'contract', name: 'Personal con contrato' }`; sin campaña y semanal → `{ key: 'none', name: 'Sin campaña' }`.
- `groupByWorker`: una fila por trabajador presente en las líneas, sumando sus líneas de todas las planillas; `totalCents = attendanceCents + itemsCents`; `pendingCents = totalCents − paidCents`. Nombres y DNI de `workers` por id. Orden: apellido, nombre, id (con `localeCompare(…, 'es')`).
- `groupByCampaign`: un grupo por `campaignKeyOf` de cada planilla. `payrollCount` = planillas del grupo; `payrolls` = cada planilla con su total, pagado y pendiente (suma de sus líneas), ordenadas por `startDate` y luego `id`; `workers` = `groupByWorker` de las líneas del grupo; `people` = cantidad de trabajadores distintos en las líneas del grupo; `workedDays`, minutos y dinero = suma de las líneas del grupo. Orden de los grupos: las campañas por nombre (`localeCompare(…, 'es')`), luego "Personal con contrato", luego "Sin campaña". Una planilla sin líneas cuenta en `payrollCount` y aparece en `payrolls` con montos 0.

- [ ] **Step 1: Pruebas (fallan).** `report-periods.test.ts`:
  - `daysInRange('2026-10-01', '2026-10-01')` → 1; `('2026-01-01', '2026-12-31')` → 365; `('2028-01-01', '2028-12-31')` → 366.
  - `weekStart('2026-10-05')` (lunes) → `'2026-10-05'`; `('2026-10-04')` (domingo) → `'2026-09-28'`; `('2026-01-01')` (jueves) → `'2025-12-29'`.
  - `weeksInRange('2026-10-01', '2026-10-14')` → `[{ start: '2026-09-28', end: '2026-10-04' }, { start: '2026-10-05', end: '2026-10-11' }, { start: '2026-10-12', end: '2026-10-18' }]`.
  - `monthsInRange('2026-11-15', '2027-02-02')` → `['2026-11', '2026-12', '2027-01', '2027-02']`; `('2026-10-01', '2026-10-31')` → `['2026-10']`.
  - `sumByPeriod` con dos semanas, asistencia en ambas (incluido un día fuera de todos los periodos, que se ignora) y un concepto negativo: comprueba cada campo de cada fila, una semana sin nada con todo en 0, y `totalCents = attendanceCents + itemsCents`.

  `report-groups.test.ts`: con dos planillas de una campaña "Contenedor Chile", una mensual sin campaña y una semanal sin campaña, y líneas de tres trabajadores (uno en dos planillas de la misma campaña, uno con pago mayor que el total):
  - `campaignKeyOf` para los tres casos.
  - `groupByWorker`: sumas, pendiente negativo, orden por apellido.
  - `groupByCampaign`: tres grupos en el orden de la regla; en la campaña, `payrollCount` 2, `people` correcto (el trabajador repetido cuenta una vez), sumas, `payrolls` con su dinero y en orden, `workers` sumados; una planilla sin líneas aparece con 0.

  Run: `npx vitest run test/report-periods.test.ts test/report-groups.test.ts` (desde `backend/`). Expected: FAIL.
- [ ] **Step 2: Implementar** los dos módulos.
- [ ] **Step 3: Verificar** — Run: `npm test -w @agrosalas/backend && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add backend/src/payroll/report-periods.ts backend/src/payroll/report-groups.ts backend/test/report-periods.test.ts backend/test/report-groups.test.ts
git commit -m "feat(api): add the pure period and grouping modules of the cost reports"
```

---

### Task 2: Rutas de reportes por semana, mes y área

**Files:**
- Create: `backend/src/routes/reports.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/test/reports.test.ts`

**Interfaces:**
- Consumes: `daysInRange`, `weekStart`, `weeksInRange`, `monthsInRange`, `sumByPeriod` (tarea 1); tablas `attendanceRecords`, `payrollItems`, `payrolls`, `areas`; `requireRole`, `validate`.
- Produces: `reportsRoutes(deps)` montado en `/v1/reports`; el esquema `rangeQuery` y la función de conceptos por inicio de planilla (la tarea 3 agrega sus rutas en el mismo archivo).

**Rango** (todas las rutas):

```ts
const isoDate = z.iso.date()
const rangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.to >= r.from, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['to'] })
  .refine((r) => r.to < r.from || daysInRange(r.from, r.to) <= 366, { message: 'El rango no puede pasar de un año', path: ['to'] })
```

**Contrato** (todas con `requireRole('admin', 'accounting', 'management')` y `validate('query', rangeQuery)`):

| Ruta | Respuesta |
|---|---|
| `GET /v1/reports/costs/weekly` | `{ items: { weekStart, weekEnd, regularMinutes, overtimeMinutes, attendanceCents, itemsCents, totalCents }[], totals: PeriodTotals }` — una fila por semana de `weeksInRange` |
| `GET /v1/reports/costs/monthly` | `{ items: { month, ...PeriodTotals }[], totals }` — una fila por mes de `monthsInRange` |
| `GET /v1/reports/costs/by-area` | `{ items: { areaId: string \| null, areaName: string, workedDays, regularMinutes, overtimeMinutes, attendanceCents }[], itemsCents, totals: { workedDays, regularMinutes, overtimeMinutes, attendanceCents, itemsCents, totalCents } }` |

Consultas:

- **Asistencia por día:** `date`, `sum(regular_minutes)`, `sum(overtime_minutes)`, `sum(amount_cents)` de `attendance_records` con `date` entre `from` y `to`, agrupado por `date`. Sumas con ``sql<number>`coalesce(sum(...), 0)::bigint`.mapWith(Number)``.
- **Conceptos por inicio de planilla:** `payrolls.start_date` y la suma con signo (`case when type = 'deduction' then -amount_cents else amount_cents end`) de `payroll_items` unida a `payrolls`, con `start_date` entre `from` y `to`, agrupado por `start_date`. Semana: `periodOf = weekStart`; mes: `periodOf = (d) => d.slice(0, 7)`.
- **Área:** `attendance_records.area_id`, `areas.name` (unión izquierda), `count(*) filter (where type = 'worked')`, las tres sumas, con `date` en el rango, agrupado por área; `areaName` `'Sin área'` cuando no hay área; orden por nombre, "Sin área" al final. `itemsCents` = suma con signo de los conceptos de planillas que empiezan en el rango.
- `totals` suma las filas (y, en área, `itemsCents`; `totalCents = attendanceCents + itemsCents`).

- [ ] **Step 1: Pruebas (fallan).** `reports.test.ts`, preparación por la API: dos áreas (Producción, Almacén), un cargo por hora (6.25 / 7.8125), trabajadores temporales `w1` (Producción), `w2` (Almacén), `w3` (sin área); el coordinador con un área. Planilla A semanal del `2026-09-28` al `2026-10-04` y planilla B del `2026-10-05` al `2026-10-11` con los tres; registros completos (las cuatro marcas, como en `balances.test.ts`: 620 min → 6823 céntimos) de `w1` el `2026-10-02` (A) y el `2026-10-06` (B), de `w2` el `2026-10-06` (B), una falta de `w3` el `2026-10-07` (B); un `bonus` de 2000 a `w1` en A y un `deduction` de 500 a `w2` en B.
  1. `weekly?from=2026-10-01&to=2026-10-11` → dos semanas (28/09 y 05/10); la primera con la asistencia del 02/10 (6823) y el bono de A (A empieza el 28/09, fuera del rango: **no** cuenta); la segunda con 2 × 6823, `itemsCents` −500 y su total. Comprobar minutos (480 y 140 por registro) y `totals`.
  2. `weekly?from=2026-09-28&to=2026-10-11` → ahora el bono de A sí cuenta en la primera semana.
  3. `monthly?from=2026-09-01&to=2026-10-31` → septiembre en 0 salvo el bono de A (empieza el 28/09); octubre con los tres registros trabajados y −500.
  4. `by-area?from=2026-09-28&to=2026-10-11` → Almacén (1 día) y Producción (2 días) por nombre, "Sin área" con 0 días trabajados y 0 céntimos (la falta no cuenta como día trabajado); `itemsCents` 1500; `totals.totalCents` = 3 × 6823 + 1500.
  5. Rango inválido: `to` antes de `from` → 400 `validation` con `field` `'to'`; más de 366 días → 400 con el mensaje del rango; sin `from` → 400.
  6. Permisos: `coordinator` → 403 en las tres; `management` → 200.

  Run: `npx vitest run test/reports.test.ts` (desde `backend/`). Expected: FAIL.
- [ ] **Step 2: Implementar** `routes/reports.ts` y montarlo en `app.ts` (`.route('/reports', reportsRoutes(deps))`).
- [ ] **Step 3: Verificar** — Run: `npm test -w @agrosalas/backend && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add weekly, monthly and by-area cost reports"
```

---

### Task 3: Reportes por campaña y por trabajador; permisos

**Files:**
- Modify: `backend/src/routes/reports.ts`, `backend/test/reports.test.ts`, `backend/test/permissions.test.ts`

**Interfaces:**
- Consumes: `groupByCampaign`, `groupByWorker`, `ReportLine`, `ReportPayroll`, `ReportWorker` (tarea 1); `rangeQuery` (tarea 2).
- Produces:

| Ruta | Respuesta |
|---|---|
| `GET /v1/reports/costs/by-campaign` | `{ items: CampaignRow[], totals: { payrollCount, people, workedDays, regularMinutes, overtimeMinutes, totalCents, paidCents, pendingCents } }` |
| `GET /v1/reports/costs/by-worker` | `{ items: WorkerRow[], totals: { people, workedDays, regularMinutes, overtimeMinutes, attendanceCents, itemsCents, totalCents, paidCents, pendingCents } }` |

Las dos parten de las planillas con `start_date` entre `from` y `to` (decisión 4) y de sus líneas planilla × trabajador, armadas con tres consultas agrupadas por `payroll_id` y `worker_id` sobre esas planillas:

- asistencia: `count(*) filter (where type = 'worked')`, las sumas de minutos y de `amount_cents`;
- conceptos: la suma con signo;
- pagos: la suma de `amount_cents`.

Una línea existe si el trabajador aparece en cualquiera de las tres. Los trabajadores (`id`, `first_name`, `last_name`, `dni`) se leen de una vez para los ids de las líneas. `people` de `totals` cuenta trabajadores distintos de todas las líneas (en campaña, no la suma de los grupos).

- [ ] **Step 1: Pruebas (fallan)**, en `reports.test.ts`, con la misma preparación de la tarea 2 más: una campaña "Contenedor Chile" asignada a A y B; una planilla mensual C sin campaña del `2026-10-01` al `2026-10-31` con un trabajador de contrato `w4` cuyo cargo mensual tiene sueldo 1500 (concepto automático de 150000); un pago de 3000 a `w1` en A y uno de 9999 a `w2` en B (más que su total).
  1. `by-campaign?from=2026-09-28&to=2026-10-31` → dos grupos en orden: "Contenedor Chile" (2 planillas, 3 personas, 3 días trabajados, total = 3 × 6823 + 2000 − 500, pagado 12999, pendiente = total − 12999, `payrolls` A y B con su dinero, `workers` con w1, w2, w3) y "Personal con contrato" (1 planilla, 1 persona, total 150000, pagado 0).
  2. `by-campaign?from=2026-10-05&to=2026-10-31` → A no entra (empieza el 28/09): la campaña tiene 1 planilla.
  3. `by-worker?from=2026-09-28&to=2026-10-31` → w1, w2, w3, w4 ordenados por apellido, con días, minutos, asistencia, conceptos, total, pagado y pendiente (w2 con pendiente negativo); `totals` con `people` 4.
  4. Rango inválido → 400; `coordinator` → 403 en las dos; `management` → 200.

  En `permissions.test.ts`, agregar a la matriz las cinco rutas de reportes (con `?from=2026-10-01&to=2026-10-31`) con `coordinator` como rol prohibido.

  Run: `npx vitest run test/reports.test.ts test/permissions.test.ts` (desde `backend/`). Expected: FAIL.
- [ ] **Step 2: Implementar** las dos rutas.
- [ ] **Step 3: Verificar** — Run: `npm test -w @agrosalas/backend && npm run lint && npm run typecheck`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add cost reports by campaign and by worker"
```

---

### Task 4: Excel en el navegador y "Exportar a Excel" de la planilla

**Files:**
- Modify: `frontend/package.json`, `package-lock.json` (dependencia `write-excel-file`), `frontend/src/app/(panel)/payrolls/[id]/page.tsx`
- Create: `frontend/src/lib/xlsx.ts`, `frontend/src/lib/xlsx.test.ts`

**Interfaces:**
- Consumes: `GET /v1/payrolls/:id` (planilla, `workers`, `records`), `['payrolls', id, 'balances']`, `['payroll-items', id]`, los pagos de la planilla (`GET /v1/payments?payrollId=&pageSize=100`, todas las páginas); `buildGrid`, `cellLabel` (`lib/payroll-grid.ts`), `datesBetween`, `dayHeader`, `formatHours`, `ITEM_TYPE_LABEL`, `PAYMENT_MEDIUM_LABEL`, `signedItemCents`, `workerName`.
- Produces:

```ts
// lib/xlsx.ts
export type Cell = string | number | null
export type Column = { header: string; width?: number; money?: boolean } // money: number in soles with two decimals
export type Sheet = { name: string; columns: Column[]; rows: Cell[][] }
export const solesOf: (cents: number) => number // 6823 → 68.23
export const safeFileName: (text: string) => string // removes / \ : * ? " < > |, collapses spaces, trims; never empty ('reporte')
export function payrollSheets(input: PayrollExportInput): Sheet[] // [Asistencia, Conceptos, Pagos]
export async function downloadXlsx(sheets: Sheet[], fileName: string): Promise<void> // imports write-excel-file on demand
```

`PayrollExportInput` = `{ payroll, balances, items, payments }` con los tipos de las respuestas de la API (`ResponseBody<…>`).

Hojas de `payrollSheets`:

- **Asistencia:** columnas `Trabajador`, `DNI`, un día por columna con `dayHeader` (`lun 05`), `Horas normales`, `Horas extra`, `Total (S/)`, `Pagado (S/)`, `Pendiente (S/)` (las tres de dinero con `money: true`, desde los saldos). Cada celda de día: `cellLabel` del registro (`8:00 +2:20`, `F`, `P`, `DM`) o vacía. Una última fila `Totales` con las horas y el dinero de `totals`.
- **Conceptos:** `Trabajador`, `Tipo`, `Monto (S/)` (con signo), `Nota`.
- **Pagos:** `Fecha` (`dd/mm/aaaa`), `Trabajador`, `Medio`, `Detalle`, `Monto (S/)`, `Evidencia` (`Sí`/`No`).

`downloadXlsx`: `const { default: writeXlsxFile } = await import('write-excel-file')` y una llamada con todas las hojas a la vez, la fila de encabezado en negrita y el formato `#,##0.00` en las columnas de dinero. Antes de escribirla, leer el README de `node_modules/write-excel-file` (versión 4.x) para la forma exacta de varias hojas, columnas y formatos en el navegador; si difiere de lo esperado, se sigue lo instalado y se anota en el reporte.

**Botón** en el detalle de la planilla, junto a los demás, para los roles que ven dinero: **Exportar a Excel** (`h-11`). Al pulsarlo: dice "Preparando…" y queda deshabilitado; reúne los datos (los saldos y los conceptos de la caché o pidiéndolos; los pagos pidiendo todas las páginas de 100); arma las hojas y descarga `Planilla <nombre>.xlsx` (con `safeFileName`). Un error: `toast.error(errorMessage(e))`.

- [ ] **Step 1: Pruebas (fallan)** en `xlsx.test.ts`: `solesOf(6823)` → 68.23 y `solesOf(-500)` → −5; `safeFileName` quita `/ \ : * ? " < > |`, junta los espacios repetidos en uno y recorta: `safeFileName('Semana 40 / Chile: "A"')` → `'Semana 40 Chile A'`, y `safeFileName('???')` → `'reporte'`; `payrollSheets` con una planilla de dos días, dos trabajadores (uno con registro y otro con falta), un concepto de descuento y un pago con evidencia: nombres de hojas, encabezados exactos, una fila por trabajador más `Totales`, montos en soles con signo, `Sí`.
- [ ] **Step 2: Instalar** `npm install write-excel-file@^4 -w @agrosalas/frontend`.
- [ ] **Step 3: Implementar** `lib/xlsx.ts` y el botón.
- [ ] **Step 4: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend && npm run build`. Expected: PASS; el build no incluye `write-excel-file` en el paquete inicial de la página (se importa al exportar).
- [ ] **Step 5: Commit**

```bash
git add frontend/package.json package-lock.json frontend/src
git commit -m "feat(web): export a payroll to Excel"
```

---

### Task 5: Pantalla de reportes: semana, mes y área

**Files:**
- Create: `frontend/src/app/(panel)/reports/page.tsx`, `frontend/src/components/reports/range-filter.tsx`, `frontend/src/components/reports/period-report.tsx`, `frontend/src/components/reports/area-report.tsx`, `frontend/src/lib/report-view.ts`, `frontend/src/lib/report-view.test.ts`
- Modify: `frontend/src/components/panel/menu.tsx`, `frontend/src/lib/xlsx.ts` (hojas de reportes), `frontend/src/lib/xlsx.test.ts`

**Interfaces:**
- Consumes: las rutas de las tareas 2 y 3 (`api.v1.reports.costs.weekly.$get`, etc., con `query: { from, to }`); `downloadXlsx`, `solesOf`, `safeFileName` (tarea 4); `formatCents`, `formatHours`, `formatDate`, `monthOf`, `limaDate`, `seesMoney`.
- Produces:

```ts
// lib/report-view.ts
export type ReportTab = 'weekly' | 'monthly' | 'area' | 'campaign' | 'worker'
export const REPORT_TABS: { key: ReportTab; label: string }[] // Semana, Mes, Área, Campaña, Trabajador
export const reportTabFromParam: (param: string | null) => ReportTab // unknown → 'weekly'
export const defaultRange: (today: string) => { from: string; to: string } // the month of today
export const weekLabel: (start: string, end: string) => string // '28/09 al 04/10/2026'
export const monthLabel: (month: string) => string // '2026-10' → 'Octubre 2026'
// lib/xlsx.ts (added)
export function periodSheet(tab: 'weekly' | 'monthly', data: …): Sheet
export function areaSheet(data: …): Sheet
```

**Menú:** entrada **Reportes** (`/reports`) entre Trabajadores y Configuración, solo para administración, contabilidad y gerencia. Reemplazar `adminOnly` por una lista de roles por entrada (`roles?: Role[]`; sin lista = todos) y filtrar con ella; Configuración queda solo para `admin`.

**Página `/reports`** (con `Suspense` por `useSearchParams`):

- Para el coordinador: "No tienes acceso a los reportes." y nada más; no se pide nada.
- Título "Reportes". Debajo, un selector **Módulo** con una sola opción, "Planilla" (los demás módulos llegarán con inventario, compras y ventas).
- Pestañas (`?tab=`, mismas reglas de teclado y foco que las pestañas de la planilla): Semana, Mes, Área, Campaña, Trabajador. Campaña y Trabajador se completan en la tarea 6 (en esta tarea muestran "Disponible pronto.").
- `RangeFilter`: **Desde** y **Hasta** (`type="date"`), por defecto `defaultRange(hoy)`; el rango vive en la dirección (`?from=&to=`) para poder compartir el enlace; los errores de la API (`field: 'to'`) se muestran bajo Hasta.
- Botón **Exportar a Excel** (`h-11`) de la pestaña activa, deshabilitado mientras no hay datos; archivo `Reporte <pestaña> <desde> a <hasta>.xlsx`.
- Bajo cada tabla, en `text-xs text-muted-foreground`, la regla de la pestaña: Semana y Mes: "La asistencia cuenta por la fecha de cada día; los conceptos, en la semana (o el mes) en que empieza su planilla."; Área: "Los conceptos no tienen área: se muestran aparte."
- **Semana / Mes** (`PeriodReport`): tabla con Periodo (`weekLabel` o `monthLabel`), Horas normales, Horas extra, Asistencia, Conceptos (con signo), Total, y fila de totales. Claves: `['reports', 'weekly', from, to]`, `['reports', 'monthly', from, to]`.
- **Área** (`AreaReport`): Área, Días trabajados, Horas normales, Horas extra, Monto; una fila "Conceptos (sin área)" con `itemsCents` solo en Monto; fila de totales. Clave `['reports', 'area', from, to]`.
- Carga: "Cargando…"; error: `ErrorWithRetry`; sin datos (todo en 0): la tabla se muestra igual (los periodos existen).
- Tablas dentro de `overflow-x-auto`, sin ensanchar la página.

- [ ] **Step 1: Pruebas (fallan)** de `report-view.ts` (pestañas, `defaultRange('2026-10-02')` → `{ from: '2026-10-01', to: '2026-10-31' }`, `weekLabel`, `monthLabel` de enero y diciembre) y de `periodSheet`/`areaSheet` (encabezados, filas, totales, dinero en soles).
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend`. Expected: PASS.
- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the reports screen with weekly, monthly and by-area costs"
```

---

### Task 6: Reportes por campaña y por trabajador

**Files:**
- Create: `frontend/src/components/reports/campaign-report.tsx`, `frontend/src/components/reports/worker-report.tsx`
- Modify: `frontend/src/app/(panel)/reports/page.tsx`, `frontend/src/lib/xlsx.ts`, `frontend/src/lib/xlsx.test.ts`

**Interfaces:**
- Consumes: `by-campaign` y `by-worker` (tarea 3); `pendingText`; `downloadXlsx`.
- Produces: `campaignSheets(data): Sheet[]` (hojas "Campañas", "Planillas" y "Trabajadores") y `workerSheet(data): Sheet` en `lib/xlsx.ts`.

- **Campaña** (`CampaignReport`, clave `['reports', 'campaign', from, to]`): tabla con Campaña, Planillas, Personas, Días, Horas normales, Horas extra, Total, Pagado, Pendiente (`pendingText`) y un botón **Ver detalle** (`aria-expanded`, `h-11`) que despliega debajo de la fila dos tablas: "Planillas" (nombre con enlace a `/payrolls/<id>`, fechas, estado, Total, Pagado, Pendiente) y "Trabajadores" (nombre con enlace a `/workers/<id>`, días, horas, Total, Pagado, Pendiente). Fila de totales. Regla bajo la tabla: "Incluye las planillas que empiezan en el rango, con todos sus días, conceptos y pagos."
- **Trabajador** (`WorkerReport`, clave `['reports', 'worker', from, to]`): Trabajador (enlace), DNI, Días, Horas normales, Horas extra, Asistencia, Conceptos, Total, Pagado, Pendiente; fila de totales; la misma regla.
- Exportar: Campaña → tres hojas (una fila por campaña; una por planilla con su campaña; una por trabajador y campaña); Trabajador → una hoja.

- [ ] **Step 1: Pruebas (fallan)** de `campaignSheets` y `workerSheet`.
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend && npm run build`. Expected: PASS; el build lista `/reports`.
- [ ] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add cost reports by campaign and by worker"
```

---

### Task 7: Documentación y verificación en el navegador

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-planilla-design.md`, `README.md` (solo si algo de la puesta en marcha cambió), este plan.

- [ ] **Step 1: Spec**: §9, la fila de `/reports/costs` con las cinco rutas y el rango; §10, el menú con Reportes, la pantalla 4 con "Exportar a Excel" y la pantalla 7; §11, las reglas de las decisiones 2 a 5 y que el Excel se genera en el navegador.
- [ ] **Step 2: Verificación en el navegador** (la hace el controlador con la sesión de Gonzalo y los datos de prueba de la base de desarrollo): a 375 px y en escritorio, el menú con Reportes, cada pestaña con el rango del mes y con un rango de dos meses, el detalle de una campaña, las exportaciones (archivo descargado y abierto en una hoja de cálculo, o leído con `write-excel-file`), "Exportar a Excel" de una planilla, sin desborde ni errores en la consola.
- [ ] **Step 3: Este plan**: "Estado de ejecución" y "Pendiente".
- [ ] **Step 4: Verificación final** — Run: `npm run lint && npm run typecheck && npm test && npm run build`. Expected: todo en verde.
- [ ] **Step 5: Commit**

```bash
git add docs README.md
git commit -m "docs(planilla): record the execution of plan 4"
```

---

## Fuera de este plan

- Gráficos en los reportes.
- Reportes de inventario, compras y ventas (otros módulos).
- Migración del Excel: fase 5.
