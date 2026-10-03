# Planilla: gráficos en los reportes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un gráfico de barras arriba de la tabla en cada pestaña de Reportes (Semana, Mes, Área, Campaña, Trabajador), con los mismos números que la tabla.

**Architecture:** Los datos de cada gráfico se arman con funciones puras probadas (`frontend/src/lib/report-charts.ts`) a partir de la misma respuesta de la API que usa la tabla. Un solo componente de barras (`components/reports/report-chart.tsx`) sobre el componente `chart` de shadcn/ui (que usa `recharts`), cargado de forma diferida para no engordar la página. La tabla sigue siendo la fuente de verdad y lo que se exporta a Excel.

**Tech Stack:** el del frontend. Dependencia nueva: `recharts` 3.x (MIT; compatible con React 19), traída por el componente `chart` de shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md` §10 (pantalla 7) y §11. El plan 4 dejó los gráficos "fuera de este plan"; Gonzalo los pidió el 2026-10-03.

**Rama:** `feat/report-charts`, desde `master` (`668160f`).

## Decisiones tomadas

1. **Un gráfico por pestaña, de barras**, arriba de la tabla:
   - Semana y Mes: barras apiladas por periodo, "Asistencia" (verde de marca) y "Conceptos" (ámbar); los conceptos pueden ser negativos (descuentos) y bajan del cero.
   - Área: una barra por área con su monto, más la barra "Conceptos (sin área)" si hay conceptos.
   - Campaña: barras horizontales apiladas por campaña, "Pagado" (verde) y "Pendiente" (ámbar); un pendiente negativo (a favor de la empresa) se dibuja como 0 en el gráfico (la tabla dice el monto exacto).
   - Trabajador: barras horizontales apiladas "Pagado" y "Pendiente" de los 10 trabajadores con mayor total; el resto se junta en una barra "Otros (N)".
2. **Montos en soles** en el gráfico (céntimos ÷ 100), con el formato `S/ 1,234.56` en el eje y en la ventana emergente.
3. **Sin datos:** si todas las barras suman 0, en lugar del gráfico se muestra "Sin montos en este rango.".
4. **Accesible:** cada gráfico tiene un título visible y un resumen en texto para lectores de pantalla (`role="img"` con `aria-label`); la tabla de abajo tiene el detalle.
5. **Carga diferida:** `next/dynamic` con `ssr: false`; mientras carga, un recuadro de la misma altura con "Cargando gráfico…".
6. **Colores:** `--chart-1` = verde de marca (`#15803d`), `--chart-2` = ámbar (`#d97706`), `--chart-3` = gris (`#a3a3a3`) en `globals.css`, en tema claro y oscuro.
7. **Altura:** 260 px; en el celular el gráfico ocupa el ancho disponible sin desbordar la página; las barras horizontales de Campaña y Trabajador crecen 36 px por fila.
8. **El Excel no cambia** (solo tablas).

## Global Constraints

- Nombres de código en inglés; textos en español exactamente como los da la tarea.
- Los números del gráfico salen de la misma respuesta que la tabla; nada se recalcula distinto.
- El coordinador no ve Reportes (sin cambios).
- Nada ensancha la página más allá de 375 px.
- Next.js 16: leer su guía en `node_modules/next/dist/docs/` antes de usar `next/dynamic`.
- El número de pruebas no baja: frontend 306, backend 561.
- Rama `feat/report-charts`; Conventional Commits (`feat(web): …`). No se versiona `.env*`. No se hace `git push` sin que Gonzalo lo pida.

---

### Task 1: Datos de los gráficos (puro)

**Files:**
- Create: `frontend/src/lib/report-charts.ts`, `frontend/src/lib/report-charts.test.ts`

**Interfaces:**
- Consumes: `periodLabel` (`lib/report-view.ts`), `formatCents` (`lib/format.ts`).
- Produces (nombres exactos):

```ts
export type ChartColor = 'primary' | 'amber' | 'muted'
export type ChartSeries = { key: string; label: string; color: ChartColor }
export type ChartRow = { label: string; [key: string]: string | number }
export type ChartData = { rows: ChartRow[]; series: ChartSeries[] }

export const soles: (cents: number) => number // 6823 → 68.23
export function periodChart(items: ({ weekStart: string; weekEnd: string } | { month: string }) & { attendanceCents: number; itemsCents: number })[], range: { from: string; to: string }): ChartData
export function areaChart(data: { items: { areaName: string; attendanceCents: number }[]; itemsCents: number }): ChartData
export function campaignChart(items: { name: string; paidCents: number; pendingCents: number }[]): ChartData
export function workerChart(items: { firstName: string; lastName: string; paidCents: number; pendingCents: number; totalCents: number }[], limit?: number): ChartData // limit default 10
export const isEmptyChart: (data: ChartData) => boolean // every value of every series is 0
export function chartSummary(title: string, data: ChartData): string // for screen readers
```

Reglas:

- `periodChart`: una fila por periodo con `label = periodLabel(item, range)`, `attendance = soles(attendanceCents)`, `items = soles(itemsCents)`; series `[{ key: 'attendance', label: 'Asistencia', color: 'primary' }, { key: 'items', label: 'Conceptos', color: 'amber' }]`.
- `areaChart`: una fila por área (`label = areaName`, `amount = soles(attendanceCents)`), más `{ label: 'Conceptos (sin área)', amount: soles(itemsCents) }` solo si `itemsCents !== 0`; serie `[{ key: 'amount', label: 'Monto', color: 'primary' }]`.
- `campaignChart`: fila por campaña (`label = name`, `paid = soles(paidCents)`, `pending = soles(max(0, pendingCents))`); series `[{ key: 'paid', label: 'Pagado', color: 'primary' }, { key: 'pending', label: 'Pendiente', color: 'amber' }]`.
- `workerChart`: ordena por `totalCents` descendente (empate: apellido, nombre); los primeros `limit` con `label = 'Apellido, Nombre'`, `paid`, `pending` como en campaña; si quedan más, una fila `Otros (N)` con la suma de su pagado y de su pendiente positivo. Mismas series que campaña.
- `isEmptyChart`: verdadero si no hay filas o todos los valores numéricos de las series son 0.
- `chartSummary`: `"<título>: <fila 1>: <serie> S/ x, <serie> S/ y; <fila 2>: …"`, con `formatCents` de cada valor (× 100, redondeado); si hay más de 12 filas, las 12 primeras y `"; y N más"`.

- [ ] **Step 1: Pruebas (fallan)** en `report-charts.test.ts`: `soles`; `periodChart` con una semana cortada por el rango (etiqueta recortada) y un concepto negativo; `areaChart` con y sin conceptos; `campaignChart` con pendiente negativo (0 en el gráfico); `workerChart` con 12 trabajadores y `limit` 10 (10 filas + `Otros (2)` con sus sumas; un pendiente negativo no resta) y con 3 trabajadores (sin `Otros`); `isEmptyChart` con todo en 0, sin filas y con un valor; `chartSummary` corto y largo (corte a 12 filas).
- [ ] **Step 2: Implementar.**
- [ ] **Step 3: Verificar** — `npm test -w @agrosalas/frontend && npm run lint && npm run typecheck`.
- [ ] **Step 4: Commit** — `feat(web): build the chart data of the cost reports`

---

### Task 2: Gráficos en las cinco pestañas

**Files:**
- Create: `frontend/src/components/ui/chart.tsx` (componente `chart` de shadcn/ui), `frontend/src/components/reports/report-chart.tsx`
- Modify: `frontend/package.json`, `package-lock.json`, `frontend/src/app/globals.css` (colores `--chart-1..3`), `frontend/src/components/reports/{period-report,area-report,campaign-report,worker-report}.tsx`

**Interfaces:**
- Consumes: `ChartData`, `periodChart`, `areaChart`, `campaignChart`, `workerChart`, `isEmptyChart`, `chartSummary` (tarea 1).
- Produces: `ReportChart({ title, data, layout })` con `layout: 'vertical' | 'horizontal'` (barras verticales para Semana, Mes y Área; horizontales para Campaña y Trabajador), exportado de forma diferida desde `report-chart.tsx` para que las pestañas lo usen con `next/dynamic`.

Pasos de implementación:

- Instalar el componente: `npx shadcn@latest add chart` desde `frontend/` (agrega `components/ui/chart.tsx` y la dependencia `recharts`). Si el comando también toca `globals.css`, quedarse solo con los colores de la decisión 6 y revertir lo demás. Si el comando no funciona sin red o pide algo interactivo, instalar `recharts@^3` con `npm install recharts@^3 -w @agrosalas/frontend` y escribir `components/ui/chart.tsx` siguiendo la documentación del componente `chart` de shadcn/ui para Tailwind 4 (`ChartContainer`, `ChartTooltip`, `ChartTooltipContent`, `ChartLegend`, `ChartLegendContent`, `ChartConfig`), y decirlo en el reporte.
- `ReportChart`: título (`h3` en `text-sm font-medium`), el gráfico dentro de `ChartContainer` con `config` armado desde `series` (color `primary` → `var(--chart-1)`, `amber` → `var(--chart-2)`, `muted` → `var(--chart-3)`), barras apiladas (`stackId`), eje de montos con `formatSoles`, ventana emergente con el nombre de la serie y `formatSoles`, leyenda debajo. Altura 260 px (vertical) o `max(160, 36 × filas + 60)` px (horizontal). Contenedor `role="img"` con `aria-label={chartSummary(title, data)}`. Si `isEmptyChart(data)`: el texto "Sin montos en este rango." en lugar del gráfico.
- Cada pestaña muestra su gráfico arriba de la tabla con estos títulos: Semana "Costo por semana", Mes "Costo por mes", Área "Costo por área", Campaña "Pagado y pendiente por campaña", Trabajador "Pagado y pendiente por trabajador (10 con mayor total)". Carga con `dynamic(() => import('./report-chart'), { ssr: false, loading: () => <div className="h-[260px] …">Cargando gráfico…</div> })`.
- Etiquetas largas del eje (semanas, nombres): en barras verticales, inclinadas o recortadas con el texto completo en la ventana emergente; en horizontales, el ancho del eje de nombres hasta 140 px en el celular y 200 px desde `sm`, con el texto recortado.

- [ ] **Step 1: Instalar e implementar** (sin pruebas con DOM; la lógica ya está probada en la tarea 1).
- [ ] **Step 2: Verificar** — `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend && npm run build` (el build no debe incluir `recharts` en el paquete inicial de `/reports`).
- [ ] **Step 3: Commit** — `feat(web): add a bar chart to each cost report`

---

### Task 3: Documentación y verificación en el navegador

**Files:** `docs/superpowers/specs/2026-10-01-planilla-design.md` (§10 pantalla 7 y §11: un gráfico por pestaña), este plan.

- [ ] **Step 1: Spec.**
- [ ] **Step 2: Verificación en el navegador** (la hace el controlador): las cinco pestañas con datos (abril–junio y octubre) a 375 px y en escritorio; el gráfico coincide con la tabla; sin desborde; un rango sin datos muestra "Sin montos en este rango."; sin errores en la consola.
- [ ] **Step 3: Este plan:** "Estado de ejecución".
- [ ] **Step 4: Verificación final** — `npm run lint && npm run typecheck && npm test && npm run build`.
- [ ] **Step 5: Commit** — `docs(planilla): record the execution of the report charts plan`

---

## Estado de ejecución

Ejecutado el 2026-10-03 en la rama `feat/report-charts` (desarrollo con subagentes y revisión por tarea).

- **Tareas 1 y 2** (`4ae4d12`, `af71728`): datos de los gráficos (funciones puras con pruebas) y un gráfico por pestaña con el componente `chart` de shadcn/ui y `recharts` 3. Revisión aprobada.
- **Revisión en el navegador** (escritorio y 375 px, datos de abril a junio): las barras cuadran con la tabla y la página no se desborda, pero los montos del eje se partían en dos líneas, las semanas inclinadas ocupaban medio gráfico y chocaban con la leyenda en el celular, Área tenía etiquetas inclinadas y una leyenda de una sola serie, y los nombres se partían en el celular.
- **Corrección** (`b1080fd`, `15be8fa`):
  - El eje de montos va en soles enteros con espacio que no se parte (`axisSoles`), y las semanas se rotulan en el eje por su primer día (`tick`).
  - Área pasa a barras horizontales y la leyenda solo aparece con dos series o más. Los nombres se recortan sin partirse.
  - El componente se dividió en una parte liviana (`ReportChart`: título, vacío y alto exacto con `chartHeight`) y `bar-chart-view`, que se carga aparte; así "Cargando gráfico…" ya ocupa el alto real y la página no salta.
  - Revisión acotada aprobada.
- **Diferencias con el plan:**
  - Área usa barras horizontales en lugar de verticales.
  - El eje de montos no lleva decimales (la ventana emergente sí).
  - El tema oscuro no se revisó porque el panel no tiene cómo activarlo.
- **Pruebas:** frontend 329 (antes 306), backend 561 sin cambios; lint, typecheck y build limpios; `recharts` fuera del paquete inicial de `/reports`.

