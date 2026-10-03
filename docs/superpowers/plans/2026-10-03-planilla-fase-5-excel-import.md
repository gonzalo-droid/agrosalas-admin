# Planilla fase 5: migración del historial del Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un script que lee el Excel de planilla, muestra un resumen comparado con los totales del Excel sin escribir nada (prueba en seco) y, solo con `--commit`, carga en la base los trabajadores, planillas, asistencias, conceptos y pagos del historial.

**Architecture:** Todo vive en `backend/scripts/import-excel/`. Un lector mínimo de `.xlsx` (descomprime con `fflate` y lee el XML de las hojas) entrega una grilla de valores. Un analizador puro convierte cada hoja, según su configuración (`sheets.ts`), en datos de planilla listos para cargar, con avisos por fila. Un generador puro arma el resumen. El cargador escribe todo en una sola transacción. La prueba en seco es el comportamiento por defecto.

**Tech Stack:** el del backend. Dependencia nueva solo de desarrollo del backend: `fflate` (MIT, sin dependencias; ya está en el lockfile por el frontend). El script no se despliega.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, sección 12 (migración del Excel) y 5 (`source = 'excel'`, `needs_review`), 7 y 8.

**Rama:** `feat/phase-5-excel-import`, desde `master` (`927700d`).

**Insumo:** el análisis de la estructura del archivo real (`JULIO PLANILLA CONT CHILE.xlsx`, 8 hojas) está resumido en "Estructura del Excel" más abajo. El archivo no se guarda en el repo; las pruebas usan grillas armadas en código.

## Decisiones tomadas

Se pueden cambiar antes de la carga real; las que dependen de cómo se pagó de verdad quedan marcadas **(confirmar)** y la prueba en seco las muestra.

1. **Montos tal cual el Excel** (spec §12): cada día se importa con las horas y el monto que calculó el Excel (`worked_minutes` = T. HORA, `regular_minutes` = HORA LABORAL, `overtime_minutes` = H. EXTRA, `amount_cents` = TOTAL × 100 redondeado). No se recalcula. `source = 'excel'`.
2. **Revisión (`needs_review`)** cuando el monto del Excel difiere en más de 1 céntimo del que da la regla correcta (480 min normales y el resto extra, con las tarifas de la hoja), o hay un dato raro: una hora con un valor que no es hora (≥ 1 día), un tramo con salida antes del ingreso, horas escritas con monto 0, o un día de más de 16 horas. La nota del registro dice el motivo en español. Así quedan marcados el martes de la primera semana y los días de sábado a miércoles de la hoja de junio (fórmula errada: toda la jornada como extra) sin leer fórmulas.
3. **Marcas:** de las cuatro celdas H.I/H.S del día se toman las horas válidas en orden: dos horas = un tramo (primera y última), cuatro = dos tramos; un número distinto o un tramo invertido se guarda como esté y el día va a revisión. La hora es la de Lima en la fecha del bloque.
4. **Planillas:** una por hoja, con el nombre de la hoja, semanal, del primer al último día de sus bloques; campaña "Etiquetado junio" para `ETI 5 AL 10 Junio` (se crea si no existe) y "Contenedor Chile" para las demás (supuesto del spec, confirmado por Gonzalo el 2026-10-03). Quedan **cerradas** al importarse (lo histórico no se edita por error; el administrador puede reabrir).
5. **Trabajadores:** se crean por nombre (`APELLIDOS, NOMBRES` → apellidos y nombres), sin DNI, temporales y activos, con la nota "Migrado del Excel: falta DNI". Los nombres se normalizan (espacios, coma, mayúsculas) y se unifican con un archivo de alias (`--aliases`, fuera del repo porque tiene nombres reales). En el archivo real hay dos casos: un nombre escrito como un número en la hoja de junio, y un segundo nombre agregado en otra hoja (por ejemplo, `TORRES DIAZ, JOSE LUIS` = `TORRES DIAZ, LUIS`). La prueba en seco lista los nombres parecidos que no unificó.
6. **Miembros:** un trabajador entra a la planilla de una hoja solo si tiene en ella algún día, concepto o pago.
7. **Monto sin horas** (una fila con total pero sin días, como los S/ 200 de la segunda semana): se importa como concepto `bonus` con la nota "Monto del Excel sin horas" y se lista en el resumen.
8. **Pagos (confirmar):** por hoja, según su configuración; fecha = último día del periodo, medio `cash` con el detalle "Migrado del Excel" y la nota "migrado" (la fecha y el medio reales no están en el Excel). Reglas por defecto:
   - `13 al 19 1era sem`: pagado = columna BH (Cancelado) + columna BJ (sin título).
   - `SEM 17 20 AL 25`: pagado = el total de la fila si dice `CANCELADO` en BH o BJ; si no, 0.
   - `9 MAYO`: pagado = columna M (se abono); las demás filas, 0.
   - `ETI 5 AL 10 Junio`: pagado = columna AZ (se abono); se ignoran BE ("ESTO ABONAR", que resta 50 a todos) y las notas de abajo.
9. **Una sola vez:** si ya existe una planilla con el nombre de una hoja y registros con `source = 'excel'`, el script se niega a cargar.
10. **Quién importa:** `--user <correo>` de un usuario administrador existente; queda como `created_by`, `recorded_by` y en la auditoría.

## Estado de ejecución

Ejecutado el 2026-10-03 en la rama `feat/phase-5-excel-import`, en un worktree aparte, desde `master` (`927700d`). Las cinco tareas y la tanda final de arreglos están hechas; la carga real no se hizo y espera la revisión de Gonzalo (ver "Pendiente").

Commits de las tareas (`git log --oneline --reverse 927700d..HEAD`):

- `de6f519` docs(planilla): add the phase 5 plan (Excel history import)
- `6f2f5ea` feat(api): read xlsx files and normalise worker names for the Excel import
- `52c8ff2` feat(api): parse the payroll sheets of the Excel into importable data
- `8b3c363` feat(api): add the dry run of the Excel import with a summary against the sheet totals
- `91144f5` feat(api): load the Excel history into payrolls in one transaction
- `ebcd26c` docs(planilla): record the execution of plan 5 (con el README, el spec y esta sección)

Tanda final (los hallazgos de la revisión de toda la rama):

- `84e62a3` fix(api): keep real worker names out of the import code and tests
- `1b20f96` fix(api): round a worker's days cumulatively and show pending from the imported cents
- `49fc62b` fix(api): match the Excel names to existing workers and refuse ambiguous ones before writing
- `d1c309f` fix(api): refuse negative minutes and attendance clashes, list unused aliases, keep each worker's employment type
- `845804e` fix(api): flag missing marks, name the target database, check the sums before committing and save the summary only after a load
- el commit siguiente: docs(planilla): record the final fix wave of plan 5 (README, spec §12 y este plan)

Pruebas, en total, al terminar cada tarea:

| Después de | Backend | Frontend |
|---|---|---|
| Inicio | 448 | 306 |
| Tarea 1 | 472 | 306 |
| Tarea 2 | 499 | 306 |
| Tarea 3 | 514 | 306 |
| Tarea 4 | 527 | 306 |
| Tarea 5 | 527 | 306 |
| Tanda final | 558 | 306 |

Cada tarea pasó revisión, sin hallazgos críticos ni importantes. La revisión final de toda la rama (`927700d..ebcd26c`) no encontró nada crítico y sí tres hallazgos importantes, arreglados en la tanda final: (1) cada día se redondeaba por separado y el pago usaba el total redondeado de la fila, así que a un trabajador pagado por completo le quedaba S/ 0.01 pendiente y el resumen lo ocultaba; (2) había nombres reales de trabajadores en el código, las pruebas y este plan; (3) un trabajador que ya existía con DNI se duplicaba en silencio. La tanda también agregó las guardas que habían quedado para antes de la carga (minutos negativos, ids de los creados por nombre, dos trabajadores sin DNI con el mismo nombre, choque con asistencia existente, alias sin efecto, tipo de empleo del trabajador) y los menores baratos (motivo "Faltan marcas del día", el host de la base antes de escribir, `--out` solo después de cargar, verificación de sumas antes de confirmar).

Lo que difirió del texto del plan:

- `similarNames` empareja nombres con los mismos apellidos cuando las palabras de uno de los nombres de pila están contenidas en las del otro; la regla "nombre de pila distinto" del plan habría emparejado a dos personas distintas.
- El resumen y la carga avisan (el resumen) o rechazan (la carga) los montos y pagos negativos, porque la base los rechaza; la carga también rechaza a un trabajador que aparece en dos filas de una misma hoja.
- La auditoría se escribe por tandas, con las mismas columnas que `recordAudit`; solo se crean los trabajadores con datos, y `result.workers` cuenta los trabajadores creados.
- `buildSummary` tiene un modo: prueba en seco ("Prueba en seco: no se escribió nada en la base.") o carga.
- Tanda final: la sección de trabajadores del resumen se llama "Trabajadores con datos (N)" (la prueba en seco no sabe cuáles ya existen; la carga lo dice al terminar). Dos trabajadores existentes sin DNI con el mismo nombre solo bloquean la carga si un nombre del Excel coincide con ellos. La lectura del archivo de alias pasó a `names.ts` (`parseAliases`) para probarla, y la descripción de la base a `database.ts`.

Prueba en seco con el archivo real (controlador, 2026-10-03, sin `--commit`: no se escribió nada). Resumen en "Task 5, Step 2" más abajo.

Resultado de la verificación final (después de la tanda final): `npm run lint && npm run typecheck && npm test && npm run build` desde la raíz, todo en verde: backend 558 pruebas (34 archivos), frontend 306 (29 archivos) y la compilación del panel.

Pendiente:

- La carga real espera que Gonzalo revise el resumen y confirme los pagos de cada hoja, sobre todo "9 MAYO" (solo hay un abono anotado y una nota "SE CANCELA HOY") y "ETI 5 AL 10 Junio" (la columna "ESTO ABONAR" resta 50 a todos y hay una nota de 7 × 300 pagados).
- Repetir la prueba en seco con el archivo de alias fuera del repo (los dos casos ya vistos) antes de la carga: los totales y el pendiente cambian con el redondeo acumulado.
- Una sola regla de miembros: "con datos" sigue definida en `load.ts` y en `summary.ts` (el resumen cuenta también una fila que solo tiene un total o un pago negativos, que la carga rechaza).
- Completar DNI y cargo de los trabajadores migrados (desde la pantalla de Trabajadores).

## Estructura del Excel

Común a las cuatro hojas a migrar (S1 `13 al 19 1era sem`, S2 `SEM 17 20 AL 25`, S3 `9 MAYO`, S4 `ETI 5 AL 10 Junio`):

- Tarifas: B19 jornada (0.3333 = 8 h), F19 hora (`=(1500.4/30)/8` = 6.2516667), F20 hora extra (= F19 × 1.25 = 7.8145833).
- Fila 22: un encabezado por día en la primera columna de su bloque, con texto `DIA␣␣dd/mm/aaaa` (2 a 4 espacios); la fecha manda (S3 dice LUNES pero el 09/05/2026 fue sábado).
- Fila 23: encabezados. Cada día ocupa 8 columnas desde su inicio *s*: s H.I, s+1 H.S, s+2 H.I, s+3 H.S, s+4 T. HORA (fracción de día), s+5 HORA LABORAL (horas), s+6 H. EXTRA (horas), s+7 TOTAL (soles).
- Trabajadores desde la fila 24, nombre en A, hasta la primera fila sin nombre. Celdas en 0 = no trabajó; vacías = nada.
- Bloques: S1 B, J, R, Z, AH, AP, AX (lun 13/04 a dom 19/04), total BG; S2 B, J, R, Z, AH, AP (lun 20/04 a sáb 25/04), total BG; S3 solo B (09/05), total I; S4 B, J, R, Z, AH, AP (vie 05/06 a mié 10/06), total AY.
- Totales del Excel por hoja (suma de la columna total de los trabajadores): S1 3029.74, S2 2166.54, S3 725.32, S4 3147.97.
- Hojas que no se migran: `ejemplo 43` (borrador viejo de la semana de S1 con otra tarifa), `Hoja1` (copia de S4), `SE DEBE` (costo por caja), `PRDUC X DIA` (producción).

## Global Constraints

- Nombres de código en inglés; mensajes del script, notas y resumen en español.
- El script solo escribe en la base con `--commit`; sin esa opción no abre transacciones de escritura.
- Todo lo cargado: `source = 'excel'` en asistencias; auditoría `create` de cada fila creada, con el usuario de `--user`; respeta las claves compuestas y CHECK de la fase 3 (todo trabajador con datos es miembro de su planilla; montos ≥ 0).
- Dinero en céntimos enteros (`Math.round(soles × 100)`); minutos enteros (`Math.round(horas × 60)`, `Math.round(fracción × 1440)`).
- Las pruebas no usan el Excel real, ni red, ni variables de entorno: grillas armadas en código y PGlite.
- El backend solo usa imports relativos; el número de pruebas no baja (backend 448, frontend 306).
- Rama `feat/phase-5-excel-import`; Conventional Commits (`feat(api): …`). No se versiona `.env` ni el Excel. No se hace `git push` sin que Gonzalo lo pida.

## Mapa de archivos

Rutas bajo `backend/scripts/import-excel/` salvo que se diga otra cosa.

| Archivo | Responsabilidad |
|---|---|
| `read-xlsx.ts` | Descomprimir el `.xlsx` y devolver, por hoja, un mapa `ref → valor` (texto o número) |
| `grid.ts` | Ayudantes puros: columna ↔ letras, leer número/texto/hora de la grilla |
| `names.ts` | Normalizar nombres, separar apellidos y nombres, aplicar alias, detectar parecidos |
| `sheets.ts` | Configuración de las cuatro hojas (bloques, columnas, campaña, regla de pagos) |
| `parse-sheet.ts` | Convertir una hoja en planilla + trabajadores + días + conceptos + pagos, con avisos |
| `summary.ts` | Resumen de la prueba en seco (texto Markdown) |
| `load.ts` | Carga en una transacción |
| `index.ts` | Línea de comandos |
| `database.ts` | Línea que dice a qué base escribe la carga (host y proyecto; tanda final) |
| `backend/test/import-excel/*.test.ts` | Pruebas |
| `backend/package.json` | Script `import-excel` y `fflate` como dependencia de desarrollo |

---

### Task 1: Lector de `.xlsx`, grilla y nombres

**Files:**
- Create: `read-xlsx.ts`, `grid.ts`, `names.ts`; tests `backend/test/import-excel/read-xlsx.test.ts`, `grid.test.ts`, `names.test.ts`
- Modify: `backend/package.json`, `package-lock.json` (`npm install -D fflate@^0.8 -w @agrosalas/backend`)

**Interfaces:**

```ts
// read-xlsx.ts
export type CellValue = string | number
export type Workbook = Map<string, Map<string, CellValue>> // sheet name → ('B24' → value)
export function readXlsx(bytes: Uint8Array): Workbook

// grid.ts
export const columnIndex: (letters: string) => number // 'A' → 1, 'Z' → 26, 'AA' → 27, 'BG' → 59
export const columnLetters: (index: number) => string
export const cellRef: (column: string | number, row: number) => string
export const numberAt: (sheet: Map<string, CellValue>, ref: string) => number | null // numbers, and numeric text; else null
export const textAt: (sheet: Map<string, CellValue>, ref: string) => string // '' when empty
export const minutesOfDay: (fraction: number) => number // 0.3125 → 450 (07:30), rounded to the minute

// names.ts
export const normalizeName: (raw: string) => string // trim, collapse spaces, upper case, one space after the comma: 'PEREZ ROJAS,ANA' → 'PEREZ ROJAS, ANA'
export const splitName: (normalized: string) => { lastName: string; firstName: string } // 'RAMOS VARGAS, ELENA' → { lastName: 'RAMOS VARGAS', firstName: 'ELENA' }; without a comma: all in lastName, firstName ''
export const DEFAULT_ALIASES: Record<string, string> // normalized → normalized
export const applyAlias: (normalized: string, aliases: Record<string, string>) => string
export function similarNames(names: string[]): [string, string][] // pairs with the same surnames whose given-name words are all contained in the other's ('LUIS' / 'JOSE LUIS'); different given names alone do not pair
```

`readXlsx`: `unzipSync` de `fflate`; lee `xl/workbook.xml` (nombres de hojas y su `r:id`), `xl/_rels/workbook.xml.rels` (ruta de cada hoja), `xl/sharedStrings.xml` (si existe; un `<si>` puede tener varios `<t>` dentro de `<r>`) y cada `xl/worksheets/sheetN.xml`. De cada `<c r="…" t="…">`: si `t="s"`, el texto compartido del índice de `<v>`; si `t="str"` o `t="inlineStr"`, el texto; si `t="e"` (error, como `#VALUE!`), se omite la celda; si no, el número de `<v>`. Celdas sin `<v>` se omiten. Decodificar `&amp; &lt; &gt; &quot; &apos;` y `&#NNN;`/`&#xHH;`. Lectura con expresiones regulares sobre XML generado por Excel: está bien para este archivo; documentarlo en un comentario.

`DEFAULT_ALIASES`: `{}` (tanda final: los alias tienen nombres reales y solo llegan desde el archivo de `--aliases`).

- [x] **Step 1: Pruebas (fallan).** `read-xlsx.test.ts` arma un `.xlsx` mínimo en memoria con `zipSync` de `fflate` (workbook con dos hojas, rels, sharedStrings con un `<si>` simple y uno con dos `<r>`, una hoja con texto compartido, número, `t="str"`, un error `t="e"`, una celda sin `<v>` y un `&amp;`) y comprueba el mapa resultante. `grid.test.ts`: `columnIndex`/`columnLetters` ida y vuelta (A, Z, AA, AZ, BA, BG, BN), `numberAt` con número, texto numérico, texto no numérico y vacío, `minutesOfDay(0.3125)` → 450, `(0.54166666666666663)` → 780, `(0.7833333)` → 1128. `names.test.ts`: normalización de los casos con y sin espacio tras la coma y con espacios dobles; `splitName`; alias de los dos casos (`3` → `PEREZ ROJAS, ANA`; `TORRES DIAZ, JOSE LUIS` → `TORRES DIAZ, LUIS`); `similarNames` encuentra `TORRES DIAZ, LUIS` / `TORRES DIAZ, JOSE LUIS` y no empareja `PEREZ ROJAS, ANA` con `PEREZ ROJAS, CARMEN`.
- [x] **Step 2: Instalar `fflate` e implementar.**
- [x] **Step 3: Verificar** — `npm test -w @agrosalas/backend && npm run typecheck`. Para que `typecheck` cubra `backend/scripts/import-excel`, comprobar `backend/tsconfig.json` (si `scripts` no está incluido, incluirlo).
- [x] **Step 4: Commit** — `feat(api): read xlsx files and normalise worker names for the Excel import`

---

### Task 2: Configuración de hojas y analizador

**Files:**
- Create: `sheets.ts`, `parse-sheet.ts`; test `backend/test/import-excel/parse-sheet.test.ts`

**Interfaces:**

```ts
// sheets.ts
export type PaymentRule =
  | { kind: 'columns'; columns: string[] } // paid = sum of the numbers in these columns
  | { kind: 'stamp'; columns: string[]; text: string } // paid = the row total when any of these cells contains the text (case-insensitive)
export type SheetConfig = {
  sheet: string
  campaign: string
  rateCells: { hourly: string; overtime: string } // 'F19', 'F20'
  dayHeaderRow: number // 22
  firstWorkerRow: number // 24
  blocks: string[] // start columns: ['B', 'J', …]
  totalColumn: string // 'BG'
  payment: PaymentRule
}
export const SHEETS: SheetConfig[] // the four sheets, as in "Estructura del Excel" and decision 8

// parse-sheet.ts
export type ReviewReason = 'formula' | 'not_a_time' | 'reversed' | 'times_without_amount' | 'too_long'
export const REVIEW_TEXT: Record<ReviewReason, string>
export type ParsedDay = {
  date: string
  marks: { clockIn1: number | null; clockOut1: number | null; clockIn2: number | null; clockOut2: number | null } // minutes of the day, Lima; a mark after midnight is not expected in this file
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
  reasons: ReviewReason[]
}
export type ParsedWorker = { row: number; rawName: string; name: string; days: ParsedDay[]; amountWithoutHoursCents: number; totalCents: number; paidCents: number }
export type ParsedSheet = {
  sheet: string
  campaign: string
  startDate: string
  endDate: string
  hourlyRate: number // rounded to 4 decimals
  overtimeRate: number
  workers: ParsedWorker[]
  excelTotalCents: number // sum of the total column of the worker rows, each rounded to the cent
}
export function parseSheet(config: SheetConfig, grid: Map<string, CellValue>, aliases: Record<string, string>): ParsedSheet
```

Reglas de `parseSheet`:

- **Fecha de un bloque:** el texto de `dayHeaderRow` en su columna de inicio, con la fecha `dd/mm/aaaa` (expresión regular sobre el texto); sin fecha legible → error con la hoja y la columna. `startDate`/`endDate`: la menor y la mayor.
- **Trabajadores:** desde `firstWorkerRow` hasta la primera fila con A vacía; `name = applyAlias(normalizeName(A))`.
- **Día:** las cuatro celdas H.I/H.S (s..s+3), T. HORA (s+4), HORA LABORAL (s+5), H. EXTRA (s+6), TOTAL (s+7). Un día existe si alguna de las cuatro horas es mayor que 0 o el TOTAL es mayor que 0.
  - Horas válidas: números entre 0 (excluido) y 1 (excluido), en el orden de las cuatro celdas. Un número ≥ 1 → motivo `not_a_time` (y no cuenta como hora).
  - Marcas: 2 horas válidas → `clockIn1` la primera y `clockOut1` la segunda; 4 → los dos tramos; 1 o 3 → se guardan en su posición (H.I/H.S originales) y motivo `not_a_time`.
  - Un tramo con salida antes que su ingreso → motivo `reversed`.
  - Minutos y monto: `workedMinutes = round(T × 1440)` (con T ≥ 0; un T negativo cuenta 0 y motivo `reversed`), `regularMinutes = round(HORA LABORAL × 60)`, `overtimeMinutes = round(H. EXTRA × 60)`, `amountCents = round(TOTAL × 100)`.
  - `formula`: `|amountCents − correcto| > 1`, donde correcto = `round((min(worked, 480) × hourly + max(0, worked − 480) × overtime) / 60 × 100)` con las tarifas de la hoja sin redondear.
  - `times_without_amount`: hay horas válidas y TOTAL es 0 o vacío.
  - `too_long`: `workedMinutes > 960`.
- **Monto sin horas:** si la fila no tiene ningún día y su total es mayor que 0 → `amountWithoutHoursCents` = total.
- `totalCents` = `round(total de la fila × 100)`; `paidCents` según la regla de pagos (con `stamp`: el total de la fila si alguna celda de esas columnas contiene el texto).
- Tarifas: `numberAt(rateCells.hourly)`, `numberAt(rateCells.overtime)`; faltantes → error.

- [x] **Step 1: Pruebas (fallan)** con grillas armadas en código (un ayudante `gridOf({ B22: 'LUNES   13/04/2026', A24: 'QUISPE MAMANI, LUIS', B24: 0.3125, … })`), una por caso:
  1. Día con dos tramos correcto (07:30–12:00, 13:00–16:30): marcas, minutos, monto y sin motivos.
  2. El mismo día con HORA LABORAL 0 y toda la jornada como extra (TOTAL inflado): motivo `formula`.
  3. Un solo tramo escrito en la primera y la cuarta celda con 0 en medio: un tramo, sin `not_a_time`.
  4. Un 7 en H.I y nada más (TOTAL 0): el día se crea sin marcas, con 0 minutos, monto 0 y motivo `not_a_time` (no `times_without_amount`, porque no hay horas válidas).
  5. Primer tramo invertido (14:00 → 12:00): `reversed`.
  6. Horas escritas sin TOTAL: `times_without_amount`.
  7. Día de 18.33 h: `too_long` (y `formula` si corresponde).
  8. Fila con total 200 y ningún día: `amountWithoutHoursCents` 20000.
  9. Pagos: `columns` (BH + BJ con BJ vacío y con número), `stamp` (`CANCELADO` en BH, en BJ y ausente), y un error de celda (omitido por el lector) que no rompe nada.
  10. Encabezado con 4 espacios y fecha que no coincide con el día de la semana: se usa la fecha.
  11. Alias: `3` se convierte en `PEREZ ROJAS, ANA`.
  12. `SHEETS` tiene las cuatro hojas con sus bloques, columnas de total y reglas de pago exactamente como en "Estructura del Excel" y la decisión 8.
- [x] **Step 2: Implementar.**
- [x] **Step 3: Verificar** — `npm test -w @agrosalas/backend && npm run typecheck`.
- [x] **Step 4: Commit** — `feat(api): parse the payroll sheets of the Excel into importable data`

---

### Task 3: Resumen y prueba en seco

**Files:**
- Create: `summary.ts`, `index.ts`; test `backend/test/import-excel/summary.test.ts`
- Modify: `backend/package.json` (script `"import-excel": "tsx --env-file=.env scripts/import-excel/index.ts"`)

**Interfaces:**

```ts
// summary.ts
export function buildSummary(sheets: ParsedSheet[], options: { similar: [string, string][]; aliasesUsed: [string, string][] }): string // Markdown in Spanish
```

El resumen tiene, por hoja: nombre, campaña, fechas, tarifas, trabajadores (cuántos con datos), días, días a revisar por motivo (con `REVIEW_TEXT`), total del Excel, total importado (asistencia + montos sin horas) y la diferencia (que debe ser solo de redondeo, a lo más medio céntimo por día; si es mayor, una línea "⚠ Diferencia mayor que el redondeo"), pagado, pendiente, y una tabla por trabajador (nombre, días, total, pagado, pendiente, motivos). Después: trabajadores nuevos (nombre normalizado → apellidos/nombres), alias aplicados, nombres parecidos no unificados, montos sin horas, y la lista de supuestos de pago de la decisión 8 con la regla de cada hoja.

`index.ts`:

```
npm run import-excel -w @agrosalas/backend -- <ruta.xlsx> [--aliases alias.json] [--out resumen.md] [--commit --user correo]
```

- Lee el archivo, analiza las hojas de `SHEETS` (una hoja que falta → error con su nombre), arma el resumen y lo imprime (y lo escribe en `--out` si se pide).
- Sin `--commit` no toca la base (no lee `DATABASE_URL`).
- `--aliases`: JSON `{ "nombre tal como está": "nombre unificado" }` que se suma a `DEFAULT_ALIASES` (las claves se normalizan).
- Con `--commit` sin `--user` → error. La carga es la tarea 4: en esta tarea `--commit` responde "La carga llega en la tarea 4" y sale con código 1.

- [x] **Step 1: Pruebas (fallan)** de `buildSummary` con dos hojas analizadas armadas en código: que aparezcan los totales, la diferencia de redondeo, el aviso cuando la diferencia es mayor, los motivos en español, los nombres parecidos y los supuestos de pago.
- [x] **Step 2: Implementar** `summary.ts` e `index.ts`.
- [x] **Step 3: Verificar** — `npm test -w @agrosalas/backend && npm run typecheck`.
- [x] **Step 4: Commit** — `feat(api): add the dry run of the Excel import with a summary against the sheet totals`

---

### Task 4: Carga

**Files:**
- Create: `load.ts`; test `backend/test/import-excel/load.test.ts`
- Modify: `index.ts`

**Interfaces:**

```ts
export async function loadSheets(db: Db, userId: string, sheets: ParsedSheet[]): Promise<{ workers: number; payrolls: number; records: number; items: number; payments: number }>
```

En **una** transacción:

1. Por cada hoja, si ya existe una planilla con ese nombre que tenga registros `source = 'excel'` → error "La hoja <nombre> ya se importó" y nada se escribe.
2. Campañas: buscar por nombre; crear la que falte (activa).
3. Trabajadores: por cada nombre distinto de todas las hojas, buscar uno existente con el mismo nombre normalizado (`normalizeName(\`${last_name}, ${first_name}\`)`) y sin DNI; si no hay, crear (`employmentType: 'temporary'`, `status: 'active'`, `notes: 'Migrado del Excel: falta DNI'`).
4. Por hoja: crear la planilla (`type: 'weekly'`, fechas, campaña, `createdBy`); agregar miembros (decisión 6); por cada día, un registro de asistencia con las marcas convertidas a instantes de Lima (`limaInstant(fecha, 'HH:MM')` de `backend/src/payroll/time.ts`), los minutos y el monto del Excel, `hourlyRate`/`overtimeRate` de la hoja, `type: 'worked'`, `employmentType: 'temporary'`, `areaId: null`, `source: 'excel'`, `needsReview: reasons.length > 0`, `note`: los textos de los motivos unidos por "; " (o `null`), `recordedBy`; un concepto `bonus` por cada monto sin horas (nota "Monto del Excel sin horas"); un pago por cada `paidCents > 0` (fecha = `endDate`, `method: 'cash'`, `methodDetail: 'Migrado del Excel'`, `note: 'migrado'`); al final, cerrar la planilla (`status: 'closed'`, `closedBy`, `closedAt: now`).
5. Auditoría `create` de cada fila creada (campañas, trabajadores, planillas, registros, conceptos, pagos) y `update` del cierre, con `userId`.

`index.ts` con `--commit --user <correo>`: busca el usuario por correo (debe existir, estar activo y ser `admin`; si no, error), imprime el resumen, ejecuta `loadSheets` y muestra los conteos.

- [x] **Step 1: Pruebas (fallan)** en PGlite (`createTestApp()` da `db` y `USERS.admin`), con dos hojas analizadas armadas en código:
  1. Crea la campaña nueva y reutiliza la existente; crea los trabajadores; un nombre que ya existe sin DNI no se duplica.
  2. Planillas cerradas con su campaña y fechas; miembros solo con datos; registros con `source = 'excel'`, montos del Excel (no recalculados) y `needsReview` con su nota; marcas en hora de Lima.
  3. Concepto del monto sin horas; pagos con fecha de fin, `cash`, "Migrado del Excel", "migrado".
  4. `GET /v1/payrolls/:id/balances` de una planilla importada da total = suma de montos del Excel + conceptos, pagado y pendiente correctos.
  5. Auditoría escrita con el usuario.
  6. Ejecutar dos veces: la segunda falla y no cambia nada (mismos conteos).
- [x] **Step 2: Implementar.**
- [x] **Step 3: Verificar** — `npm test -w @agrosalas/backend && npm run lint && npm run typecheck`.
- [x] **Step 4: Commit** — `feat(api): load the Excel history into payrolls in one transaction`

---

### Task 5: Documentación y prueba en seco con el archivo real

**Files:**
- Modify: `README.md` (cómo correr el import y la regla de la prueba en seco), `docs/superpowers/specs/2026-10-01-planilla-design.md` §12 (decisiones 1 a 10), este plan.

- [x] **Step 1: Documentación.**
- [x] **Step 2: Prueba en seco** (la hace el controlador, con el archivo de Gonzalo, sin `--commit`): `npm run import-excel -w @agrosalas/backend -- "<ruta>" --out <scratchpad>/resumen.md`; revisar que los totales coincidan con los del Excel (S1 3029.74, S2 2166.54, S3 725.32, S4 3147.97) salvo redondeo, y anotar los avisos.

  Resultado (2026-10-03, controlador, nada escrito en la base, antes de la tanda final). Los totales importados difieren de los del Excel solo en el redondeo de cada día. El "Total del Excel" de la tabla es la suma de los totales de cada trabajador redondeados al céntimo: por eso dice 3029.76 y 2166.56, cuando las sumas sin redondear de las hojas son 3029.74 y 2166.54. Con el redondeo acumulado de la tanda final, los días de cada trabajador suman su total y el pendiente se calcula con lo importado, así que estas cifras cambian en la próxima prueba en seco:

  | Hoja | Trabajadores | Días | A revisar | Total del Excel | Total importado | Pagado | Pendiente |
  |---|---|---|---|---|---|---|---|
  | `13 al 19 1era sem` | 14 | 51 | 12 | S/ 3029.76 | S/ 3029.79 | S/ 2574.19 | S/ 455.57 |
  | `SEM 17 20 AL 25` | 14 | 38 | 2 | S/ 2166.56 | S/ 2166.57 | S/ 2104.82 | S/ 61.74 |
  | `9 MAYO` | 11 | 11 | 0 | S/ 725.32 | S/ 725.32 | S/ 81.27 | S/ 644.05 |
  | `ETI 5 AL 10 Junio` | 8 | 42 | 35 | S/ 3147.97 | S/ 3147.90 | S/ 196.00 | S/ 2951.97 |

  Avisos:
  - `13 al 19 1era sem`: 12 días a revisar; motivos: 10 de fórmula, 1 con un valor que no es hora y 2 con horas sin pago (un día puede tener más de un motivo).
  - `SEM 17 20 AL 25`: 2 días a revisar; un monto sin horas (S/ 200.00) que se importa como concepto.
  - `ETI 5 AL 10 Junio`: 35 días a revisar, casi todos de fórmula (toda la jornada como extra); además 1 valor que no es hora, 2 tramos invertidos y 1 jornada de más de 16 horas.
  - 27 trabajadores con datos. Alias aplicados: los dos casos (un nombre escrito como un número y un segundo nombre agregado en otra hoja). No quedan nombres parecidos sin unificar.
  - Los pagos son los supuestos de la decisión 8; las hojas `9 MAYO` y `ETI 5 AL 10 Junio` son las que más necesitan la confirmación de Gonzalo.
- [x] **Step 3: Este plan:** "Estado de ejecución" y "Pendiente" (la carga real espera la revisión de Gonzalo).
- [x] **Step 4: Verificación final** — `npm run lint && npm run typecheck && npm test && npm run build`.
- [x] **Step 5: Commit** — `docs(planilla): record the execution of plan 5`

---

## Fuera de este plan

- La carga real en la base de desarrollo o de producción: después de que Gonzalo revise el resumen y confirme las reglas de pago.
- Completar el DNI y el cargo de los trabajadores migrados (desde la pantalla de Trabajadores).
- Importar las hojas omitidas o la producción por día.
