# Planilla fase 2A: API de planillas y asistencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando y probada la API de la fase 2: módulo de cálculo de horas y montos, creación manual de planillas con sus trabajadores, registro diario de asistencia (marcar, carga en bloque, editar, eliminar) y la lista y el detalle de planillas.

**Architecture:** El cálculo vive en un módulo puro (`backend/src/payroll/`), sin base de datos, con enteros: minutos y céntimos. Las rutas nuevas (`/v1/payrolls`, `/v1/attendance`) siguen el patrón de la fase 1: Hono encadenado, Zod en la entrada, auditoría en la misma transacción, permisos en el servidor. La lógica de "aplicar una marca" es una función de servicio que usan tanto la marca individual como la carga en bloque. Para el coordinador, un ayudante común quita los campos de dinero antes de responder.

**Tech Stack:** el de la fase 1 (Node ≥ 22, Hono 4, Zod 4, Drizzle ORM 0.45 + drizzle-kit, PGlite en pruebas, Vitest 5). No se agrega ninguna dependencia.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, secciones 4 (permisos), 5 (modelo de datos: `payrolls`, `payroll_workers`, `attendance_records`), 6 (reglas de cálculo), 7 (planillas), 9 (API), 14 (pruebas) y 17 (nombres). Fase 2 de la sección 15.

**Plan hermano:** el 2B (pantallas de Asistencia y Planillas) se escribe cuando este esté ejecutado, porque importa el tipo `AppType` real.

## Decisiones tomadas

Resuelven lo que el spec deja abierto y lo que las fases 1A y 1C dejaron anotado para esta fase. Se pueden cambiar antes de ejecutar.

1. **Dinero en enteros.** El monto de cada registro se guarda en céntimos (`amount_cents`). Las tarifas siguen en soles con cuatro decimales, como en `positions`; el cálculo las pasa a enteros antes de multiplicar.
2. **Alcance de esta fase.** Cerrar y reabrir planillas, conceptos, pagos y exportar a Excel son de las fases 3 y 4. La tabla `payrolls` ya nace con `status`, `closed_by` y `closed_at` para no migrar dos veces, pero en esta fase toda planilla está abierta.
3. **Salida para el coordinador.** En lugar de un esquema de salida por rol, un ayudante común (`redactMoney`) pone en `null` los campos de dinero, y el barrido de `permissions.test.ts` comprueba que ninguna ruta nueva se le escapa.
4. **Cargo que no encaja con la modalidad.** Al crear un registro se copian las tarifas del cargo del trabajador. Si un trabajador temporal no tiene cargo o su cargo es mensual, las tarifas quedan en 0 y el registro se marca `needs_review`, para que contabilidad ponga la tarifa. Para el personal con contrato el monto del día es 0 (regla 9 del spec) y no se marca.
5. **Fechas.** En una planilla, `endDate` no puede ser anterior a `startDate`. No se tocan las reglas de campañas ni de grupos.
6. **Hora y fecha.** Lima no tiene horario de verano: siempre es UTC−5. La fecha de un registro es la del primer ingreso en hora de Lima. Al editar, las horas se mandan como `HH:MM` de Lima; una hora menor que la anterior se toma como del día siguiente (turno de noche).
7. **Marcar es idempotente.** Si la marca pedida ya tiene hora, la API responde el registro tal cual. Así un reintento por mala señal no avanza dos pasos.
8. **Un registro por trabajador y fecha.** Lo garantiza un índice único. Si el trabajador ya tiene registro ese día en otra planilla, la API responde 409.
9. **Quitar a un trabajador de la planilla** solo se permite si no tiene registros en ella.
10. **Nombres de los esquemas Zod.** Los esquemas nuevos se nombran como sustantivos (`payrollInput`, `payrollUpdate`, `payrollFilters`, `clockInput`), no como verbos. Los de la fase 1 no se tocan aquí.
11. **Búsqueda sin acentos:** se deja como está; no es de esta fase.

## Estado de ejecución

Ejecutado el 2026-10-02 en la rama `feat/phase-2a-attendance-api`. Las seis tareas están hechas y todos sus pasos marcados.

Commits (`git log --oneline --reverse 04527e1..HEAD`; el commit de documentación que registra esta sección viene después de estos):

- `5187a37` fix(web): solid page background, paginator that does not break and a bottom menu that stays on screen
- `769b6a8` feat(api): add the pure payroll calculation and Lima time modules
- `713dd5b` Merge pull request #4 from gonzalo-droid/fix/panel-theme-and-mobile-layout
- `07ca42e` Merge remote-tracking branch 'origin/master' into feat/phase-2a-attendance-api
- `caf9b50` feat(api): add payroll, payroll worker and attendance record tables
- `4d9abd4` feat(api): add payrolls with their workers, list filters and detail
- `3f4b0e9` feat(api): add the daily attendance list and clock marks
- `ed6d0e8` refactor(api): move findOpenPayroll to payroll/open-payroll to break the import cycle
- `64d1448` fix(api): make the first clock mark safe against a double tap
- `c9026a5` refactor(api): compare clock marks against the previous mark that is set
- `b1e5842` fix(api): flag a new record for review when a temporary worker has no hourly rate
- `ae320d9` test(api): assert the exact payroll total in the list test
- `364bd94` feat(api): add full attendance records, deletion and bulk clock marks
- `0d3fe70` test(api): cover payroll and attendance routes in the role matrix and the coordinator sweep

Pruebas del backend, en total, al terminar cada tarea:

| Después de | Pruebas |
|---|---|
| Tareas 1 y 2 | 170 |
| Tarea 3 | 205 |
| Tarea 4 | 228 |
| Tarea 5 | 254 |
| Tarea 6 | 268 |

Las del frontend siguen en 94 (el frontend no cambia en este plan). Verificación final desde la raíz: `npm run lint && npm run typecheck && npm test && npm run build`, todo en verde.

Lo que difirió del texto del plan:

- `findOpenPayroll` vive en `backend/src/payroll/open-payroll.ts` y no en `routes/payrolls.ts`: en `routes/payrolls.ts` creaba un ciclo de imports con el servicio de asistencia.
- `applyClock` devuelve `{ record, created }` (no solo el registro), para que la ruta responda 201 al crear y 200 si la marca ya existía.
- La primera marca de ingreso se inserta con `onConflictDoNothing`: dos toques seguidos buscan el registro a la vez y no lo encuentran; el índice único deja ganar a uno y el otro sigue como marca sobre el registro del ganador. Así la marca sigue siendo idempotente.
- `needsReview` se activa cuando la tarifa por hora copiada de un trabajador temporal es 0 (el plan decía: cuando ambas tarifas son 0).
- El objeto de opciones compartido para `.refine` perdió su mensaje en Zod 4, y se cambió por una constante de texto (`END_BEFORE_START`).
- Las pruebas por tarea superaron los mínimos que pedía el plan.
- La prueba de control del administrador en `permissions.test.ts` usa un segundo trabajador, temporal y con cargo por hora, porque el de la preparación es de contrato y cobra 0 por día.

## Global Constraints

- Todo nombre de código, tabla, columna, ruta, clave JSON y código de error va en inglés (spec, sección 17). Los textos que lee el usuario (`message` de los errores, mensajes de validación) van en español.
- Los permisos se aplican en el backend. Para el coordinador, la API no envía campos de dinero (`hourlyRate`, `overtimeRate`, `amountCents`, `totalCents`): viajan como `null`.
- El coordinador solo alcanza a los trabajadores de sus áreas (`workerScope` de `backend/src/routes/workers.ts`) y solo registra o corrige asistencia en planillas abiertas.
- Gerencia (`management`) solo lee. Crear y editar planillas: `admin` y `accounting`. Registrar y corregir asistencia: `admin`, `accounting` y `coordinator`.
- RLS activado en todas las tablas y sin políticas: toda tabla nueva lleva `.enableRLS()`.
- Toda creación, edición o eliminación escribe una fila en `audit_log` dentro de la misma transacción, con `entity` igual al nombre de la tabla.
- Formato único de error: `{ "error": { "code", "message", "field?" } }`.
- Toda lista paginada recibe `page` y `pageSize` (máximo 100) y devuelve `{ items, total, page, pageSize }`. Las listas sin paginar devuelven `{ items }`.
- Las rutas se encadenan (`new Hono().get(...).post(...)`) para que el cliente tipado del frontend infiera los tipos. El backend solo usa imports relativos.
- Jornada: 480 minutos. Se paga al minuto. Redondeo al céntimo, mitad hacia arriba.
- Las pruebas no necesitan Docker, red ni variables de entorno. Ninguna prueba depende de la hora real: las horas se pasan explícitas o con el reloj inyectado.
- El número de pruebas no baja: el backend parte de 148.
- Rama `feat/phase-2a-attendance-api`; Conventional Commits con scope (`feat(api): …`). Nunca se versiona `.env`. No se hace `git push` sin que Gonzalo lo pida.
- Los comandos se ejecutan desde la raíz del repo salvo que se indique otra carpeta.

## Mapa de archivos

Todas las rutas son relativas a `backend/`.

| Archivo | Responsabilidad |
|---|---|
| `src/payroll/time.ts` (nuevo) | Fechas y horas de Lima: fecha de un instante, instante de una hora local, horas de un turno de noche |
| `src/payroll/calc.ts` (nuevo) | Cálculo puro: minutos trabajados, horas extra sugeridas, monto en céntimos, totales de un registro |
| `src/payroll/attendance-service.ts` (nuevo) | Lo que comparten marcar, carga en bloque y edición: precondiciones, tarifas del cargo, recálculo, guardado con auditoría, `redactMoney` |
| `src/db/schema.ts` | Tablas `payrolls`, `payroll_workers`, `attendance_records` y sus enums |
| `drizzle/0001_payrolls_attendance.sql` (generado) | Migración de las tres tablas |
| `src/routes/payrolls.ts` (nuevo) | Lista, alta, detalle, edición y trabajadores de la planilla |
| `src/routes/attendance.ts` (nuevo) | Lista del día, marcar, carga en bloque, registro completo, eliminar |
| `src/types.ts`, `src/app.ts`, `src/server.ts`, `test/helpers.ts` | Reloj inyectado (`now`) y montaje de las rutas |
| `test/time.test.ts`, `test/calc.test.ts`, `test/payrolls.test.ts`, `test/attendance.test.ts` (nuevos) | Pruebas por módulo |
| `test/health.test.ts`, `test/permissions.test.ts` | Lista de tablas; matriz de roles y barrido del coordinador para las rutas nuevas |

---

### Task 1: Módulo de tiempo y de cálculo

Código puro, sin base de datos. Es el corazón de la planilla: las reglas de la sección 6 del spec.

**Files:**
- Create: `backend/src/payroll/time.ts`, `backend/src/payroll/calc.ts`
- Test: `backend/test/time.test.ts`, `backend/test/calc.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `limaDate(instant: Date): string`, `limaTime(instant: Date): string`, `limaInstant(date: string, time: string): Date`, `addDays(date: string, days: number): string`, `marksFromTimes(date: string, times: (string | null)[]): (Date | null)[]`; `WORKDAY_MINUTES`, `Marks`, `workedMinutes(marks)`, `suggestedOvertime(worked)`, `amountCents(regularMinutes, overtimeMinutes, hourlyRate, overtimeRate)`, `RecordInput`, `RecordTotals`, `computeRecord(input)`.

- [x] **Step 1: Escribir las pruebas de tiempo**

`backend/test/time.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { addDays, limaDate, limaInstant, limaTime, marksFromTimes } from '../src/payroll/time'

describe('Lima time', () => {
  it('gives the Lima date of an instant, five hours behind UTC', () => {
    expect(limaDate(new Date('2026-10-06T03:30:00Z'))).toBe('2026-10-05')
    expect(limaDate(new Date('2026-10-06T05:00:00Z'))).toBe('2026-10-06')
  })

  it('gives the Lima wall-clock time of an instant', () => {
    expect(limaTime(new Date('2026-10-06T03:30:00Z'))).toBe('22:30')
  })

  it('turns a Lima date and time into an instant', () => {
    expect(limaInstant('2026-10-05', '07:10').toISOString()).toBe('2026-10-05T12:10:00.000Z')
  })

  it('adds days to a date across a month end', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-10-05', -1)).toBe('2026-10-04')
  })
})

describe('marksFromTimes', () => {
  it('keeps same-day times on the record date', () => {
    const marks = marksFromTimes('2026-10-05', ['07:10', '13:00', '14:00', '18:30'])
    expect(marks.map((m) => m?.toISOString())).toEqual([
      '2026-10-05T12:10:00.000Z',
      '2026-10-05T18:00:00.000Z',
      '2026-10-05T19:00:00.000Z',
      '2026-10-05T23:30:00.000Z',
    ])
  })

  it('moves a time earlier than the previous one to the next day (night shift)', () => {
    const marks = marksFromTimes('2026-10-05', ['19:00', '04:00', null, null])
    expect(marks[1]?.toISOString()).toBe('2026-10-06T09:00:00.000Z')
    expect(marks[2]).toBeNull()
  })

  it('keeps later times on the next day once the shift has crossed midnight', () => {
    const marks = marksFromTimes('2026-10-05', ['22:00', '02:00', '02:30', '06:00'])
    expect(marks.map((m) => m?.toISOString())).toEqual([
      '2026-10-06T03:00:00.000Z',
      '2026-10-06T07:00:00.000Z',
      '2026-10-06T07:30:00.000Z',
      '2026-10-06T11:00:00.000Z',
    ])
  })
})
```

- [x] **Step 2: Ver que fallan**

Run: `npx vitest run test/time.test.ts` (desde `backend/`)
Expected: FAIL, no existe `../src/payroll/time`.

- [x] **Step 3: Escribir `backend/src/payroll/time.ts`**

```ts
// Lima has no daylight saving time: it is always five hours behind UTC.
const LIMA_OFFSET_MS = 5 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

const inLima = (instant: Date) => new Date(instant.getTime() - LIMA_OFFSET_MS).toISOString()

// 'YYYY-MM-DD' of an instant, in Lima.
export const limaDate = (instant: Date): string => inLima(instant).slice(0, 10)

// 'HH:MM' of an instant, in Lima.
export const limaTime = (instant: Date): string => inLima(instant).slice(11, 16)

// The instant of a Lima wall-clock time ('HH:MM') on a date ('YYYY-MM-DD').
export const limaInstant = (date: string, time: string): Date => new Date(`${date}T${time}:00-05:00`)

export const addDays = (date: string, days: number): string =>
  new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

// Turns the wall-clock times of a record into instants. A time earlier than the one before it belongs to the
// next day: the record keeps the date of the first clock-in (night shift).
export function marksFromTimes(date: string, times: (string | null)[]): (Date | null)[] {
  let previous: Date | null = null
  return times.map((time) => {
    if (time === null) return null
    let instant = limaInstant(date, time)
    while (previous && instant.getTime() < previous.getTime()) instant = new Date(instant.getTime() + DAY_MS)
    previous = instant
    return instant
  })
}
```

Run: `npx vitest run test/time.test.ts` (desde `backend/`)
Expected: PASS, 7 pruebas.

- [x] **Step 4: Escribir las pruebas de cálculo**

`backend/test/calc.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { amountCents, computeRecord, suggestedOvertime, workedMinutes, type Marks } from '../src/payroll/calc'
import { marksFromTimes } from '../src/payroll/time'

const marks = (date: string, times: (string | null)[]): Marks => {
  const [clockIn1, clockOut1, clockIn2, clockOut2] = marksFromTimes(date, times)
  return { clockIn1, clockOut1, clockIn2, clockOut2 }
}
const worked = (times: (string | null)[]) => ({
  type: 'worked' as const,
  marks: marks('2026-10-05', times),
  employmentType: 'temporary' as const,
  hourlyRate: 6.25,
  overtimeRate: 7.8125,
  overtimeMinutes: null,
})

describe('workedMinutes', () => {
  it('adds both stretches and does not pay the break between them', () => {
    expect(workedMinutes(marks('2026-10-05', ['07:10', '13:00', '14:00', '18:30']))).toBe(620)
  })

  it('counts only the first stretch when there is no second one', () => {
    expect(workedMinutes(marks('2026-10-05', ['08:00', '12:00', null, null]))).toBe(240)
  })

  it('counts nothing for a stretch that has no exit yet', () => {
    expect(workedMinutes(marks('2026-10-05', ['08:00', null, null, null]))).toBe(0)
  })

  it('counts a night shift that ends the next day', () => {
    expect(workedMinutes(marks('2026-10-05', ['19:00', '04:00', null, null]))).toBe(540)
  })

  it('ignores the seconds: each mark counts from the start of its minute', () => {
    expect(
      workedMinutes({
        clockIn1: new Date('2026-10-05T12:10:59Z'),
        clockOut1: new Date('2026-10-05T12:11:00Z'),
        clockIn2: null,
        clockOut2: null,
      }),
    ).toBe(1)
  })
})

describe('suggestedOvertime', () => {
  it('is what exceeds the 480-minute workday', () => {
    expect(suggestedOvertime(620)).toBe(140)
    expect(suggestedOvertime(480)).toBe(0)
    expect(suggestedOvertime(240)).toBe(0)
  })
})

describe('amountCents', () => {
  it('pays by the minute at each rate', () => {
    expect(amountCents(480, 140, 6.25, 7.8125)).toBe(6823)
  })

  it('rounds half a cent up', () => {
    expect(amountCents(1, 0, 0.3, 0)).toBe(1)
    expect(amountCents(1, 0, 0.29, 0)).toBe(0)
  })
})

describe('computeRecord', () => {
  it('matches the example of the spec: S/ 68.23', () => {
    expect(computeRecord(worked(['07:10', '13:00', '14:00', '18:30']))).toEqual({
      workedMinutes: 620,
      regularMinutes: 480,
      overtimeMinutes: 140,
      amountCents: 6823,
    })
  })

  it('pays a short day at the regular rate', () => {
    expect(computeRecord(worked(['08:00', '12:00', null, null]))).toEqual({
      workedMinutes: 240,
      regularMinutes: 240,
      overtimeMinutes: 0,
      amountCents: 2500,
    })
  })

  it('pays a night shift with its own rates', () => {
    expect(computeRecord({ ...worked(['19:00', '04:00', null, null]), hourlyRate: 10, overtimeRate: 12.5 })).toEqual({
      workedMinutes: 540,
      regularMinutes: 480,
      overtimeMinutes: 60,
      amountCents: 9250,
    })
  })

  it('uses the overtime set by hand instead of the suggested one', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: 0 })).toEqual({
      workedMinutes: 620,
      regularMinutes: 620,
      overtimeMinutes: 0,
      amountCents: 6458,
    })
  })

  it('keeps hand-set overtime between zero and the minutes worked', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: 999 })).toMatchObject({
      regularMinutes: 0,
      overtimeMinutes: 620,
      amountCents: 8073,
    })
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), overtimeMinutes: -5 })).toMatchObject({
      regularMinutes: 620,
      overtimeMinutes: 0,
    })
  })

  it('pays nothing per day to contract staff but keeps their hours', () => {
    expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), employmentType: 'contract' })).toEqual({
      workedMinutes: 620,
      regularMinutes: 480,
      overtimeMinutes: 140,
      amountCents: 0,
    })
  })

  it('is all zeros for an absence, a leave or a medical leave', () => {
    for (const type of ['absence', 'leave', 'medical_leave'] as const) {
      expect(computeRecord({ ...worked(['07:10', '13:00', '14:00', '18:30']), type })).toEqual({
        workedMinutes: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        amountCents: 0,
      })
    }
  })
})
```

Run: `npx vitest run test/calc.test.ts` (desde `backend/`)
Expected: FAIL, no existe `../src/payroll/calc`.

- [x] **Step 5: Escribir `backend/src/payroll/calc.ts`**

```ts
export const WORKDAY_MINUTES = 480

export type Marks = {
  clockIn1: Date | null
  clockOut1: Date | null
  clockIn2: Date | null
  clockOut2: Date | null
}

// Each mark counts from the start of its minute: the seconds are not paid.
const minuteOf = (instant: Date) => Math.floor(instant.getTime() / 60000)
const span = (from: Date | null, to: Date | null) => (from && to ? Math.max(0, minuteOf(to) - minuteOf(from)) : 0)

// The break between the two stretches is not paid. A stretch without its exit counts nothing yet.
export const workedMinutes = (marks: Marks): number =>
  span(marks.clockIn1, marks.clockOut1) + span(marks.clockIn2, marks.clockOut2)

export const suggestedOvertime = (worked: number): number => Math.max(0, worked - WORKDAY_MINUTES)

// Rates are soles with up to four decimals: as integers they are ten-thousandths of a sol.
const rateUnits = (rate: number) => Math.round(rate * 10000)

// Paid by the minute. minutes × rate ÷ 60 soles = minutes × rateUnits ÷ 6000 cents, rounded half up.
export function amountCents(regularMinutes: number, overtimeMinutes: number, hourlyRate: number, overtimeRate: number): number {
  const numerator = regularMinutes * rateUnits(hourlyRate) + overtimeMinutes * rateUnits(overtimeRate)
  return Math.floor((numerator + 3000) / 6000)
}

export type RecordInput = {
  type: 'worked' | 'absence' | 'leave' | 'medical_leave'
  marks: Marks
  employmentType: 'temporary' | 'contract'
  hourlyRate: number
  overtimeRate: number
  // null = use the suggested overtime; a number = the overtime set by hand.
  overtimeMinutes: number | null
}

export type RecordTotals = {
  workedMinutes: number
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
}

export function computeRecord(input: RecordInput): RecordTotals {
  if (input.type !== 'worked') return { workedMinutes: 0, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
  const worked = workedMinutes(input.marks)
  const overtime =
    input.overtimeMinutes === null ? suggestedOvertime(worked) : Math.min(Math.max(0, input.overtimeMinutes), worked)
  const regular = worked - overtime
  // Contract staff are paid by the monthly salary item of the payroll, not by the day.
  const amount = input.employmentType === 'contract' ? 0 : amountCents(regular, overtime, input.hourlyRate, input.overtimeRate)
  return { workedMinutes: worked, regularMinutes: regular, overtimeMinutes: overtime, amountCents: amount }
}
```

- [x] **Step 6: Verificar**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores de tipos; 148 + 7 + 15 = 170 pruebas en verde.

- [x] **Step 7: Commit**

```bash
git add backend/src/payroll backend/test/time.test.ts backend/test/calc.test.ts
git commit -m "feat(api): add the pure payroll calculation and Lima time modules"
```

---

### Task 2: Tablas de planillas y asistencia

**Files:**
- Modify: `backend/src/db/schema.ts` (agregar al final), `backend/test/health.test.ts`
- Create (generado): `backend/drizzle/0001_payrolls_attendance.sql` y su entrada en `backend/drizzle/meta/`

**Interfaces:**
- Consumes: `users`, `workers`, `areas`, `campaigns`, `employmentTypeEnum`, `timestamps` de `schema.ts`.
- Produces: `payrollTypeEnum`, `payrollStatusEnum`, `attendanceTypeEnum`, `payrolls`, `payrollWorkers`, `attendanceRecords`.

- [x] **Step 1: Actualizar primero la prueba de migraciones**

En `backend/test/health.test.ts`, la prueba `create the phase 1 tables with RLS enabled` pasa a llamarse `create every table with RLS enabled` y su lista esperada a:

```ts
expect(rows.map((row) => row.tablename)).toEqual([
  'areas',
  'attendance_records',
  'audit_log',
  'campaigns',
  'group_workers',
  'groups',
  'payroll_workers',
  'payrolls',
  'positions',
  'shifts',
  'user_areas',
  'users',
  'worker_payment_methods',
  'workers',
])
```

Run: `npx vitest run test/health.test.ts` (desde `backend/`)
Expected: FAIL, faltan `attendance_records`, `payroll_workers` y `payrolls`.

- [x] **Step 2: Agregar las tablas al final de `backend/src/db/schema.ts`**

Agregar `integer` a la lista de imports de `drizzle-orm/pg-core`, y al final del archivo:

```ts
export const payrollTypeEnum = pgEnum('payroll_type', ['weekly', 'monthly'])
export const payrollStatusEnum = pgEnum('payroll_status', ['open', 'closed'])
export const attendanceTypeEnum = pgEnum('attendance_type', ['worked', 'absence', 'leave', 'medical_leave'])

export const payrolls = pgTable(
  'payrolls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: payrollTypeEnum('type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id),
    status: payrollStatusEnum('status').notNull().default('open'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    closedBy: uuid('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('payrolls_dates_idx').on(t.startDate, t.endDate)],
).enableRLS()

export const payrollWorkers = pgTable(
  'payroll_workers',
  {
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
  },
  (t) => [primaryKey({ columns: [t.payrollId, t.workerId] })],
).enableRLS()

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
    // The date of the first clock-in, in Lima time.
    date: date('date').notNull(),
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id),
    type: attendanceTypeEnum('type').notNull().default('worked'),
    clockIn1: timestamp('clock_in_1', { withTimezone: true }),
    clockOut1: timestamp('clock_out_1', { withTimezone: true }),
    clockIn2: timestamp('clock_in_2', { withTimezone: true }),
    clockOut2: timestamp('clock_out_2', { withTimezone: true }),
    workedMinutes: integer('worked_minutes').notNull().default(0),
    regularMinutes: integer('regular_minutes').notNull().default(0),
    overtimeMinutes: integer('overtime_minutes').notNull().default(0),
    overtimeEdited: boolean('overtime_edited').notNull().default(false),
    // Copied from the worker's position when the record is created; editable per record.
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 4, mode: 'number' }).notNull().default(0),
    overtimeRate: numeric('overtime_rate', { precision: 10, scale: 4, mode: 'number' }).notNull().default(0),
    amountCents: integer('amount_cents').notNull().default(0),
    // Copies of the worker's values on that day.
    areaId: uuid('area_id').references(() => areas.id),
    employmentType: employmentTypeEnum('employment_type').notNull(),
    note: text('note'),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    source: text('source').notNull().default('panel'),
    needsReview: boolean('needs_review').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('attendance_records_worker_date_unique').on(t.workerId, t.date),
    index('attendance_records_payroll_idx').on(t.payrollId, t.date),
  ],
).enableRLS()
```

- [x] **Step 3: Generar la migración**

```bash
npm run db:generate -w @agrosalas/backend -- --name payrolls_attendance
```

Expected: crea `backend/drizzle/0001_payrolls_attendance.sql` sin tocar `0000_initial.sql`.

Run: `grep -c 'ENABLE ROW LEVEL SECURITY' backend/drizzle/0001_payrolls_attendance.sql`
Expected: `3`

Run: `git status --short backend/drizzle`
Expected: solo archivos nuevos y `meta/_journal.json` modificado; `0000_initial.sql` sin cambios.

- [x] **Step 4: Verificar**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores; 170 pruebas en verde.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle backend/test/health.test.ts
git commit -m "feat(api): add payroll, payroll worker and attendance record tables"
```

---

### Task 3: Planillas: alta, lista, detalle, edición y trabajadores

**Files:**
- Create: `backend/src/routes/payrolls.ts`, `backend/src/payroll/attendance-service.ts` (solo `redactMoney` en esta tarea)
- Modify: `backend/src/app.ts`
- Test: `backend/test/payrolls.test.ts`

**Interfaces:**
- Consumes: tablas de la tarea 2; `workerScope` de `routes/workers.ts`; `requireRole`, `validate`, `idSchema`, `withAtLeastOneField`, `pageSchema`, `offsetOf`, `paginated`, `recordAudit`, `ApiError`, `notFound`.
- Produces:
  - `payrollsRoutes(deps)` montado en `/v1/payrolls`.
  - `findOpenPayroll(db: Db | Tx, id: string): Promise<Payroll>` exportada desde `routes/payrolls.ts`: devuelve la planilla o lanza 404 `not_found` ("La planilla no existe") o 409 `payroll_closed` ("La planilla está cerrada").
  - `redactMoney(user: SessionUser, record)` exportada desde `payroll/attendance-service.ts`: para el coordinador devuelve una copia con `hourlyRate`, `overtimeRate` y `amountCents` en `null`; para los demás, el mismo objeto. Su tipo de retorno declara esos tres campos como `number | null`.

**Contrato**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `GET /v1/payrolls` | todos | query `payrollFilters`: `page`, `pageSize`, `search?` (en el nombre), `from?` y `to?` (fechas; trae las planillas cuyo periodo se cruza con el rango), `campaignId?`, `status?` (`open`\|`closed`), `type?` (`weekly`\|`monthly`) | paginada; cada fila: `id`, `name`, `type`, `startDate`, `endDate`, `campaignId`, `campaignName`, `status`, `workerCount`, `totalCents`, `createdAt`. Orden: `startDate` descendente, luego `id`. `totalCents` es la suma de `amountCents` de sus registros; `null` para el coordinador |
| `POST /v1/payrolls` | `admin`, `accounting` | body `payrollInput`: `name` (2 a 80), `type`, `startDate`, `endDate`, `campaignId?` (nullable), `workers?` (`workerSource`) | 201 con la planilla y `workerCount` |
| `GET /v1/payrolls/:id` | todos | | la planilla + `campaignName` + `workers` (`id`, `firstName`, `lastName`, `dni`, `areaId`, `positionId`, `employmentType`, `status`, ordenados por apellido y nombre) + `records` (todos los registros de la planilla, ordenados por `date` y `workerId`). El coordinador solo recibe los trabajadores y registros de sus áreas, con el dinero en `null` |
| `PATCH /v1/payrolls/:id` | `admin`, `accounting` | body `payrollUpdate`: `name?`, `startDate?`, `endDate?`, `campaignId?`; al menos un campo | la planilla |
| `POST /v1/payrolls/:id/workers` | `admin`, `accounting` | body `workerSource` | `{ added: number, workerCount: number }` |
| `DELETE /v1/payrolls/:id/workers/:workerId` | `admin`, `accounting` | | `{ ok: true }` |

`workerSource` es un objeto con exactamente una de estas claves: `workerIds` (1 a 500 uuid), `groupId` (los miembros del grupo), `payrollId` (los trabajadores de otra planilla) o `allActiveTemporary: true` (todos los trabajadores `temporary` con estado `active`). Mensaje si no trae exactamente una: `'Indica una sola forma de agregar trabajadores'`.

Reglas y errores:

- `endDate` anterior a `startDate`: 400 `validation`, `'La fecha de fin no puede ser anterior a la de inicio'`, `field: 'endDate'`. En `PATCH` se compara con el valor guardado cuando solo llega una de las dos fechas.
- `campaignId`, `groupId` o `payrollId` que no existen: 400 `invalid_reference` (el de `campaignId` lo da la clave foránea; los otros dos se comprueban a mano con `'El grupo indicado no existe'` y `'La planilla indicada no existe'`).
- Un `workerId` que no existe en `workerIds`: 400 `invalid_reference`, `'Uno de los trabajadores indicados no existe'`.
- Agregar a quien ya está en la planilla no es error: se ignora (`onConflictDoNothing`) y no cuenta en `added`.
- `PATCH` que cambia las fechas y deja fuera algún registro de asistencia de esa planilla: 409 `records_outside_range`, `'Hay registros de asistencia fuera de las fechas nuevas'`.
- Quitar a un trabajador con registros en la planilla: 409 `has_records`, `'El trabajador tiene registros en esta planilla; elimínalos primero'`. Quitar a quien no está: 404 `not_found`, `'El trabajador no está en la planilla'`.
- Toda escritura sobre una planilla cerrada: 409 `payroll_closed` (vía `findOpenPayroll`).
- Auditoría: `create` y `update` con `entity: 'payrolls'`; agregar y quitar trabajadores se auditan como `update` de la planilla con `after: { added: [...] }` y `before: { removed: workerId }`, igual que los grupos.

- [x] **Step 1: Escribir las pruebas**

`backend/test/payrolls.test.ts`. Preparación en `beforeAll`: un área `Producción` y otra `Almacén`; un cargo `Operario` por hora (6.25 / 7.8125); cuatro trabajadores (`w1` y `w2` temporales en Producción, `w3` temporal en Almacén, `w4` de contrato en Producción); un grupo con `w1` y `w3`; el coordinador con el área Producción (`insert` directo en `userAreas`, como en `permissions.test.ts`); una campaña `Contenedor Chile`.

Casos, uno por `it`:

1. `admin` crea una planilla semanal con `workers: { workerIds: [w1, w2] }` → 201, `workerCount` 2, `status` `'open'`, y queda una fila de auditoría `create` de `payrolls`.
2. `accounting` puede crear; `management` y `coordinator` reciben 403 `forbidden`.
3. `endDate` anterior a `startDate` → 400 `validation` con `field` `'endDate'`.
4. Crear con `workers: { groupId }` agrega a `w1` y `w3`; con `{ allActiveTemporary: true }` agrega a `w1`, `w2` y `w3` y no a `w4`.
5. `workers` con dos claves (`workerIds` y `groupId`) → 400 `validation`.
6. `workers: { workerIds: [uuid inexistente] }` → 400 `invalid_reference`.
7. `POST /:id/workers` con `{ payrollId: otra }` copia sus trabajadores; repetir la llamada devuelve `added: 0` y el mismo `workerCount`.
8. La lista filtra por `search`, por `type`, por `campaignId` y por rango (`from`/`to`: una planilla del 5 al 11 de octubre aparece con `from=2026-10-10&to=2026-10-20` y no con `from=2026-10-12`), y devuelve `{ items, total, page, pageSize }` ordenada por `startDate` descendente.
9. `GET /:id` devuelve `workers` ordenados por apellido y `records` vacío en una planilla nueva; un id inexistente → 404 `not_found`.
10. El coordinador ve en `GET /:id` solo a `w1`, `w2` y `w4` (su área) y `totalCents` `null` en la lista; gerencia ve a los cuatro y `totalCents` numérico.
11. `PATCH` cambia nombre y campaña y audita `update`; `PATCH` con solo `endDate` anterior al `startDate` guardado → 400.
12. `DELETE /:id/workers/:workerId` quita a quien no tiene registros; quitar a quien no está → 404.

Los casos de `records_outside_range` y `has_records` necesitan registros de asistencia: se escriben en la tarea 4, en `attendance.test.ts`.

Run: `npx vitest run test/payrolls.test.ts` (desde `backend/`)
Expected: FAIL, la ruta `/v1/payrolls` responde 404.

- [x] **Step 2: `redactMoney` en `backend/src/payroll/attendance-service.ts`**

```ts
import type { SessionUser } from '../types'

type MoneyKey = 'hourlyRate' | 'overtimeRate' | 'amountCents'
type Redacted<T> = Omit<T, MoneyKey> & Record<MoneyKey, number | null>

// The coordinator sees hours but never money: the amounts are removed on the server, not hidden on the screen.
export function redactMoney<T extends Record<MoneyKey, number>>(user: SessionUser, record: T): Redacted<T> {
  if (user.role !== 'coordinator') return record
  return { ...record, hourlyRate: null, overtimeRate: null, amountCents: null }
}
```

- [x] **Step 3: Escribir `backend/src/routes/payrolls.ts`**

Esquemas (nombres exactos):

```ts
const isoDate = z.iso.date()
const payrollFields = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(['weekly', 'monthly']),
  startDate: isoDate,
  endDate: isoDate,
  campaignId: z.uuid().nullable().optional(),
})
const workerSource = z
  .object({
    workerIds: z.array(z.uuid()).min(1).max(500),
    groupId: z.uuid(),
    payrollId: z.uuid(),
    allActiveTemporary: z.literal(true),
  })
  .partial()
  .refine((source) => Object.keys(source).length === 1, { message: 'Indica una sola forma de agregar trabajadores' })
const endNotBeforeStart = { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['endDate'] }
const payrollInput = payrollFields
  .extend({ workers: workerSource.optional() })
  .refine((p) => p.endDate >= p.startDate, endNotBeforeStart)
const payrollUpdate = withAtLeastOneField(payrollFields.omit({ type: true }).partial())
const payrollFilters = pageSchema.extend({
  search: z.string().trim().min(1).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  campaignId: z.uuid().optional(),
  status: z.enum(['open', 'closed']).optional(),
  type: z.enum(['weekly', 'monthly']).optional(),
})
const memberIds = z.object({ id: z.uuid(), workerId: z.uuid() })
```

Las fechas ISO se comparan como texto (`'2026-10-11' >= '2026-10-05'`): el formato lo permite.

Funciones internas:

- `resolveWorkerIds(tx, source): Promise<string[]>` devuelve los ids según la clave presente; comprueba que el grupo o la planilla existan y que todos los `workerIds` existan (compara `new Set(ids).size` con las filas encontradas).
- `addWorkers(tx, payrollId, workerIds): Promise<number>` inserta con `onConflictDoNothing().returning()` y devuelve cuántas filas entraron.
- `countWorkers(db, payrollId): Promise<number>`.

`findOpenPayroll`:

```ts
export async function findOpenPayroll(db: Db | Tx, id: string) {
  const [payroll] = await db.select().from(payrolls).where(eq(payrolls.id, id))
  if (!payroll) throw notFound('La planilla')
  if (payroll.status === 'closed') throw new ApiError(409, 'payroll_closed', 'La planilla está cerrada')
  return payroll
}
```

La lista calcula `workerCount` y `totalCents` con subconsultas correlacionadas (`sql<number>` con `coalesce(sum(...), 0)` y `count(*)`, convertidas a entero), no con dos `join` a la vez, que duplicarían filas. El cruce de rango es `endDate >= from` y `startDate <= to`.

En `GET /:id`, los trabajadores se filtran con `and(eq(payrollWorkers.payrollId, id), workerScope(user))` y los registros con `inArray(attendanceRecords.workerId, idsDeEsosTrabajadores)` (lista vacía → `records: []` sin consultar), cada uno pasado por `redactMoney`.

Montar en `backend/src/app.ts`: `.route('/payrolls', payrollsRoutes(deps))` después de `/users`.

- [x] **Step 4: Verificar**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores; 170 + 12 = 182 pruebas en verde (más si un caso se partió en varios `it`; anotar el total real en el reporte).

- [x] **Step 5: Commit**

```bash
git add backend/src/routes/payrolls.ts backend/src/payroll/attendance-service.ts backend/src/app.ts backend/test/payrolls.test.ts
git commit -m "feat(api): add payrolls with their workers, list filters and detail"
```

---

### Task 4: Asistencia del día: lista y marcar

**Files:**
- Modify: `backend/src/payroll/attendance-service.ts`, `backend/src/types.ts`, `backend/src/server.ts`, `backend/test/helpers.ts`, `backend/src/app.ts`
- Create: `backend/src/routes/attendance.ts`
- Test: `backend/test/attendance.test.ts`

**Interfaces:**
- Consumes: `computeRecord`, `Marks` (tarea 1); `limaDate` (tarea 1); tablas (tarea 2); `findOpenPayroll`, `redactMoney` (tarea 3); `findWorker`, `workerScope` de `routes/workers.ts`.
- Produces:
  - `Dependencies.now: () => Date` (reloj inyectado; `server.ts` pasa `() => new Date()`; `test/helpers.ts` pasa un reloj fijo y lo expone).
  - En `attendance-service.ts`: `type Mark = 'clockIn1' | 'clockOut1' | 'clockIn2' | 'clockOut2'`, `MARKS: Mark[]` en ese orden, y `applyClock(tx, user, input: { payrollId: string; workerId: string; date: string; mark: Mark; at: Date }): Promise<AttendanceRecord>`.
  - `attendanceRoutes(deps)` montado en `/v1/attendance`.

**Reloj de pruebas.** En `test/helpers.ts`: `let currentTime = new Date('2026-10-05T13:00:00Z')` (lunes 5 de octubre de 2026, 08:00 en Lima); se pasa `now: () => currentTime` a `createApp` y se devuelve `setNow(date: Date)` junto a `app`, `db` y `request`.

**Contrato**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `GET /v1/attendance` | todos | query `dayFilters`: `payrollId`, `date`, `areaId?` | `{ items: [{ worker: { id, firstName, lastName, dni, areaId }, record \| null }] }`: los trabajadores de la planilla (en el alcance del usuario, y del área pedida), por apellido y nombre, cada uno con su registro de esa fecha o `null`. Registro pasado por `redactMoney` |
| `POST /v1/attendance/clock` | `admin`, `accounting`, `coordinator` | body `clockInput`: `payrollId`, `workerId`, `date`, `mark` (`clockIn1`\|`clockOut1`\|`clockIn2`\|`clockOut2`), `at?` (fecha y hora ISO con zona; por defecto `deps.now()`) | el registro, pasado por `redactMoney`. 201 si se creó, 200 si ya existía |

Las cuatro marcas son, en orden: ingreso, salida a refrigerio, regreso, salida.

Reglas de `applyClock`, en este orden:

1. `findOpenPayroll(tx, payrollId)` → 404 o 409 `payroll_closed`.
2. `date` fuera de `[startDate, endDate]` de la planilla → 400 `validation`, `'La fecha no está dentro de la planilla'`, `field: 'date'`.
3. `findWorker(tx, user, workerId)` → 404 si no existe o no está en el alcance del coordinador.
4. El trabajador no está en `payroll_workers` de esa planilla → 400 `not_in_payroll`, `'El trabajador no está en esta planilla'`.
5. Se busca el registro de `(workerId, date)`:
   - Existe y es de otra planilla → 409 `other_payroll`, `'El trabajador ya tiene un registro ese día en otra planilla'`.
   - Existe y su `type` no es `worked` → 409 `not_worked`, `'Ese día está marcado como falta o permiso; edita el registro'`.
   - Existe y la marca pedida ya tiene hora → se devuelve tal cual, sin escribir nada (idempotente).
6. Orden de las marcas: cada marca exige que la anterior tenga hora (`clockOut1` exige `clockIn1`, y así). Si falta → 409 `out_of_order`, `'Falta la marca anterior'`. `clockIn1` sobre un registro inexistente lo crea; cualquier otra marca sin registro → 409 `out_of_order`.
7. Hora: para `clockIn1`, `limaDate(at)` debe ser igual a `date`; si no → 400 `validation`, `'La hora de ingreso no corresponde a ese día'`, `field: 'at'`. Para las demás, `at` no puede ser anterior a la marca previa ni estar a más de 24 horas del ingreso → 400 `validation`, `'La hora no puede ser anterior a la marca previa'` o `'La hora está a más de un día del ingreso'`, `field: 'at'`.
8. Al crear: se copian del trabajador `areaId` y `employmentType`, y de su cargo las tarifas. Tarifas: si el cargo existe y es `hourly`, `hourlyRate` y `overtimeRate` del cargo; en cualquier otro caso `0` y `0`. `needsReview` es `true` solo cuando el trabajador es `temporary` y las tarifas quedaron en 0. `recordedBy` es el usuario.
9. Tras poner la marca se recalcula con `computeRecord` (`overtimeMinutes: record.overtimeEdited ? record.overtimeMinutes : null`) y se guardan `workedMinutes`, `regularMinutes`, `overtimeMinutes` y `amountCents`.
10. Auditoría en la misma transacción: `create` o `update` con `entity: 'attendance_records'`.

- [x] **Step 1: Escribir las pruebas**

`backend/test/attendance.test.ts`. Preparación en `beforeAll`: áreas `Producción` y `Almacén`; cargos `Operario` (por hora, 6.25 / 7.8125) y `Supervisor` (mensual, sueldo 1800); trabajadores `temp` (temporal, Producción, Operario), `noRate` (temporal, Producción, sin cargo), `staff` (contrato, Producción, Supervisor), `other` (temporal, Almacén, Operario); el coordinador con el área Producción; planilla `week` del 2026-10-05 al 2026-10-11 con los cuatro; planilla `week2` con las mismas fechas y solo `temp`.

Las horas se dan en UTC: el 5 de octubre de 2026, 07:10 en Lima es `2026-10-05T12:10:00Z`.

Casos:

1. `clockIn1` crea el registro (201) con `date` `'2026-10-05'`, tarifas 6.25 y 7.8125 copiadas del cargo, `employmentType` `'temporary'`, `workedMinutes` 0, y una fila de auditoría `create` de `attendance_records`.
2. Las cuatro marcas del ejemplo del spec (12:10, 18:00, 19:00, 23:30 UTC) dejan `workedMinutes` 620, `regularMinutes` 480, `overtimeMinutes` 140, `amountCents` 6823.
3. Repetir una marca ya puesta devuelve 200 con la misma hora y no agrega fila de auditoría.
4. `clockOut1` sin `clockIn1` → 409 `out_of_order`; `clockIn2` sin `clockOut1` → 409 `out_of_order`.
5. `clockIn1` con `at` de otro día (`2026-10-06T12:00:00Z` para `date` `2026-10-05`) → 400 `validation` con `field` `'at'`.
6. Una salida anterior al ingreso → 400 `validation`; una salida a más de 24 horas del ingreso → 400 `validation`.
7. Turno de noche: ingreso `2026-10-06T00:00:00Z` (19:00 del 5 en Lima) con `date` `2026-10-05`, salida `2026-10-06T09:00:00Z` → `workedMinutes` 540 y el registro sigue con `date` `'2026-10-05'`.
8. Sin `at`, usa el reloj inyectado: con `setNow(new Date('2026-10-07T12:30:00Z'))`, `clockIn1` para `date` `'2026-10-07'` guarda esa hora.
9. `noRate`: el registro nace con tarifas 0 y `needsReview` `true`. `staff`: tarifas 0, `needsReview` `false`, y con las cuatro marcas `amountCents` 0 y `workedMinutes` 620.
10. `date` fuera de la planilla → 400 `validation` con `field` `'date'`; trabajador que no está en la planilla → 400 `not_in_payroll`.
11. `temp` con registro el día 5 en `week`: marcar el día 5 en `week2` → 409 `other_payroll`.
12. Permisos: `management` → 403 `forbidden`; el coordinador marca a `temp` (su área) y recibe `hourlyRate`, `overtimeRate` y `amountCents` en `null`; al marcar a `other` (Almacén) recibe 404.
13. `GET /v1/attendance?payrollId&date` devuelve a los cuatro trabajadores por apellido, con `record` `null` para quien no tiene; con `areaId` de Almacén devuelve solo a `other`; al coordinador solo los de Producción y sin dinero.
14. (pendiente de la tarea 3) `PATCH /v1/payrolls/:id` que mueve `startDate` al 2026-10-06 cuando hay un registro del día 5 → 409 `records_outside_range`.
15. (pendiente de la tarea 3) `DELETE /v1/payrolls/:id/workers/:workerId` de un trabajador con registros → 409 `has_records`.

Run: `npx vitest run test/attendance.test.ts` (desde `backend/`)
Expected: FAIL, `/v1/attendance` responde 404.

- [x] **Step 2: Reloj inyectado**

En `backend/src/types.ts`, agregar a `Dependencies`:

```ts
  // The clock. Injected so that tests never depend on the real time.
  now: () => Date
```

`backend/src/server.ts` pasa `now: () => new Date()`. `backend/test/helpers.ts` pasa el reloj fijo descrito arriba y devuelve `setNow`.

- [x] **Step 3: `applyClock` en `attendance-service.ts` y la ruta**

`backend/src/routes/attendance.ts`, esquemas:

```ts
const isoDate = z.iso.date()
const mark = z.enum(['clockIn1', 'clockOut1', 'clockIn2', 'clockOut2'])
const dayFilters = z.object({ payrollId: z.uuid(), date: isoDate, areaId: z.uuid().optional() })
const clockInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  date: isoDate,
  mark,
  at: z.iso.datetime({ offset: true }).optional(),
})
```

La ruta `POST /clock` abre una transacción, llama a `applyClock` y responde 201 o 200. Para saber cuál, `applyClock` devuelve `{ record, created: boolean }`.

`GET /` valida que la fecha esté dentro de la planilla (mismo 400 del punto 2), trae los trabajadores con `innerJoin(payrollWorkers…)` y `workerScope(user)`, y los registros de esa fecha y planilla con una sola consulta (`inArray`).

Montar en `backend/src/app.ts`: `.route('/attendance', attendanceRoutes(deps))` después de `/payrolls`.

- [x] **Step 4: Verificar**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores; todas las pruebas en verde (total anterior + 15; anotar el total real).

- [x] **Step 5: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add the daily attendance list and clock marks"
```

---

### Task 5: Asistencia: registro completo, eliminar y carga en bloque

**Files:**
- Modify: `backend/src/payroll/attendance-service.ts`, `backend/src/routes/attendance.ts`
- Test: `backend/test/attendance.test.ts` (nuevos `describe`)

**Interfaces:**
- Consumes: `applyClock`, `MARKS` (tarea 4); `marksFromTimes`, `limaDate` (tarea 1); `computeRecord`.
- Produces: `saveFullRecord(tx, user, input): Promise<{ record; created: boolean }>` en `attendance-service.ts`; rutas `POST /v1/attendance`, `PATCH /v1/attendance/:id`, `DELETE /v1/attendance/:id`, `POST /v1/attendance/bulk`.

**Contrato**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `POST /v1/attendance` | `admin`, `accounting`, `coordinator` | body `recordInput`: `payrollId`, `workerId`, `date` + los campos de `recordFields` | 201 con el registro (redactado para el coordinador) |
| `PATCH /v1/attendance/:id` | `admin`, `accounting`, `coordinator` | body `recordUpdate`: campos de `recordFields`, al menos uno | el registro |
| `DELETE /v1/attendance/:id` | `admin`, `accounting`, `coordinator` | | `{ ok: true }` |
| `POST /v1/attendance/bulk` | `admin`, `accounting`, `coordinator` | body `bulkClockInput`: `payrollId`, `date`, `mark`, `at?`, `workerIds` (1 a 300) | `{ results: [{ workerId, ok: true, record } \| { workerId, ok: false, code, message }] }`, en el orden pedido |

`recordFields`:

| Campo | Tipo | Nota |
|---|---|---|
| `type` | `worked` \| `absence` \| `leave` \| `medical_leave` | En `POST` por defecto `worked` |
| `clockIn1`, `clockOut1`, `clockIn2`, `clockOut2` | `'HH:MM'` de Lima o `null` | Se convierten con `marksFromTimes(date, …)` |
| `overtimeMinutes` | entero ≥ 0 o `null` | `null` vuelve a la sugerida (`overtimeEdited` `false`); un número la fija (`overtimeEdited` `true`) |
| `hourlyRate`, `overtimeRate` | número ≥ 0, máximo 99999 | Solo `admin` y `accounting` |
| `note` | texto hasta 300, nullable | |
| `needsReview` | booleano | Solo `admin` y `accounting` |

Reglas:

- `POST` aplica las mismas precondiciones 1 a 5 de `applyClock` (planilla abierta, fecha dentro, trabajador en alcance y en la planilla). Si ya hay registro de `(workerId, date)` en esta planilla → 409 `duplicate`, `'Ya existe un registro de ese trabajador ese día'`; si es de otra planilla → 409 `other_payroll`. Las tarifas se copian del cargo como en `applyClock`, salvo que el cuerpo las traiga.
- `PATCH` y `DELETE` cargan el registro, comprueban que su planilla esté abierta (`findOpenPayroll`) y que el trabajador esté en el alcance del usuario (`findWorker`); si no → 404 `not_found`, `'El registro'`.
- El coordinador que manda `hourlyRate`, `overtimeRate` o `needsReview` → 403 `forbidden`, `'Tu rol no permite cambiar tarifas'`.
- Horas: no puede haber un hueco (una marca con hora después de una sin hora) → 400 `validation`, `'Completa las marcas en orden'`, `field` de la primera que falta. Tras `marksFromTimes`, la última marca no puede estar a más de 24 horas de la primera → 400 `validation`, `'El registro no puede durar más de un día'`.
- Un `type` distinto de `worked` borra las cuatro marcas y deja minutos y monto en 0. Mandar marcas con un `type` distinto de `worked` → 400 `validation`, `'Una falta o un permiso no lleva horas'`.
- `overtimeMinutes` mayor que los minutos trabajados se recorta a ese valor (lo hace `computeRecord`).
- Siempre se recalcula con `computeRecord` y se audita (`create`, `update` con antes y después, `delete` con el registro eliminado).
- Carga en bloque: cada trabajador en su propia transacción, uno tras otro. Un fallo (cualquier `ApiError`) no detiene a los demás: se anota en su resultado con `code` y `message`. Un error que no es `ApiError` se relanza. Los registros se redactan para el coordinador.

- [x] **Step 1: Escribir las pruebas**

Nuevos `describe` en `backend/test/attendance.test.ts`:

1. `POST` con `type: 'absence'` crea un registro sin horas, con minutos y monto en 0.
2. `POST` con las cuatro horas `'07:10'`, `'13:00'`, `'14:00'`, `'18:30'` guarda los instantes UTC correctos (`clockIn1` `2026-10-06T12:10:00.000Z` para `date` `2026-10-06`) y calcula 620 / 480 / 140 / 6823.
3. `POST` de turno de noche (`'19:00'`, `'04:00'`) guarda la salida en el día siguiente y 540 minutos.
4. `POST` duplicado → 409 `duplicate`.
5. `POST` con marcas y `type: 'leave'` → 400 `validation`; con hueco (`clockIn1` y `clockIn2` sin `clockOut1`) → 400 `validation` con `field` `'clockOut1'`.
6. `PATCH` con `overtimeMinutes: 0` deja `overtimeEdited` `true`, `regularMinutes` 620, `amountCents` 6458; luego `overtimeMinutes: null` vuelve a 140 y `overtimeEdited` `false`.
7. `PATCH` con `hourlyRate: 10, overtimeRate: 12.5` recalcula el monto (480 × 10 ÷ 60 + 140 × 12.5 ÷ 60 = 80.00 + 29.17 → `amountCents` 10917) y audita `update` con el antes y el después.
8. `PATCH` que pasa un día trabajado a `type: 'absence'` borra las horas y pone todo en 0.
9. El coordinador puede corregir horas de su área y no recibe dinero; si manda `hourlyRate` → 403 `forbidden`; sobre un registro de `other` (Almacén) → 404.
10. `management` no puede `POST`, `PATCH` ni `DELETE` → 403.
11. `DELETE` elimina y audita `delete`; un id inexistente → 404.
12. Carga en bloque de `clockIn1` para `[temp, other, uuid inexistente]` como `admin`: los dos primeros `ok: true` con su registro y el tercero `ok: false` con `code` `'not_found'`; quedan dos registros creados.
13. Carga en bloque como coordinador con `[temp, other]`: `temp` `ok: true` sin dinero; `other` `ok: false` con `code` `'not_found'`.
14. Carga en bloque repetida: los que ya tenían la marca vuelven `ok: true` sin cambios.

Run: `npx vitest run test/attendance.test.ts` (desde `backend/`)
Expected: FAIL en los `describe` nuevos (404 o 405 en las rutas que faltan).

- [x] **Step 2: Implementar**

Esquemas en `backend/src/routes/attendance.ts` (nombres exactos):

```ts
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Usa el formato HH:MM').nullable()
const rate = z.number().min(0).max(99999)
const recordFields = z.object({
  type: z.enum(['worked', 'absence', 'leave', 'medical_leave']),
  clockIn1: time,
  clockOut1: time,
  clockIn2: time,
  clockOut2: time,
  overtimeMinutes: z.number().int().min(0).nullable(),
  hourlyRate: rate,
  overtimeRate: rate,
  note: z.string().trim().max(300).nullable(),
  needsReview: z.boolean(),
})
const recordInput = recordFields.partial().extend({ payrollId: z.uuid(), workerId: z.uuid(), date: isoDate })
const recordUpdate = withAtLeastOneField(recordFields.partial())
const bulkClockInput = z.object({
  payrollId: z.uuid(),
  date: isoDate,
  mark,
  at: z.iso.datetime({ offset: true }).optional(),
  workerIds: z.array(z.uuid()).min(1).max(300),
})
```

En `PATCH`, las horas que no llegan se toman del registro guardado (convertidas a `HH:MM` con `limaTime`) antes de validar el orden, para que editar solo la salida no rompa el ingreso.

`saveFullRecord` concentra: precondiciones, permiso sobre tarifas, validación de horas, `marksFromTimes`, `computeRecord`, insert o update y auditoría. `POST` y `PATCH` la llaman con el registro existente o sin él.

- [x] **Step 3: Verificar**

Run: `npm run typecheck -w @agrosalas/backend && npm test -w @agrosalas/backend`
Expected: sin errores; todas en verde (total anterior + 14; anotar el total real).

- [x] **Step 4: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add full attendance records, deletion and bulk clock marks"
```

---

### Task 6: Matriz de permisos, documentación y verificación

**Files:**
- Modify: `backend/test/permissions.test.ts`, `README.md`, `docs/superpowers/specs/2026-10-01-planilla-design.md`, este plan.

**Interfaces:**
- Consumes: todas las rutas de las tareas 3 a 5.
- Produces: el repo listo para el PR.

- [x] **Step 1: Ampliar la matriz de roles**

En `backend/test/permissions.test.ts`, el `beforeAll` crea además una planilla (`payrollId`) con el trabajador y un registro de asistencia del día (`recordId`) con las cuatro marcas; `path` reemplaza también `:payroll` y `:record`.

Casos nuevos en la matriz (cada combinación prohibida debe responder 403 `forbidden`):

| Ruta | Roles prohibidos |
|---|---|
| `POST /v1/payrolls` | `management`, `coordinator` |
| `PATCH /v1/payrolls/:payroll` | `management`, `coordinator` |
| `POST /v1/payrolls/:payroll/workers` | `management`, `coordinator` |
| `DELETE /v1/payrolls/:payroll/workers/:worker` | `management`, `coordinator` |
| `POST /v1/attendance/clock` | `management` |
| `POST /v1/attendance/bulk` | `management` |
| `POST /v1/attendance` | `management` |
| `PATCH /v1/attendance/:record` | `management` |
| `DELETE /v1/attendance/:record` | `management` |

Run: `npx vitest run test/permissions.test.ts` (desde `backend/`)
Expected: PASS. Si algún caso responde otra cosa que 403, es un defecto de la tarea que hizo esa ruta: se corrige ahí.

- [x] **Step 2: Ampliar el barrido del coordinador**

A `SENSITIVE_KEYS` se agregan `amountCents` y `totalCents`. Como esas claves viajan en `null` para el coordinador (no se omiten), el barrido cambia de "la clave no aparece" a "la clave no aparece o vale `null`" **solo para las claves de dinero de asistencia y planillas** (`hourlyRate`, `overtimeRate`, `amountCents`, `totalCents`); las claves bancarias siguen sin poder aparecer. A la lista de rutas `GET` que recorre el barrido se agregan `/v1/payrolls`, `/v1/payrolls/:payroll` y `/v1/attendance?payrollId=:payroll&date=<fecha del registro>`.

La prueba de control con `admin` (la que demuestra que el barrido no pasa en vacío) comprueba además que `admin` sí recibe `amountCents` y `totalCents` con número mayor que 0 en esas tres rutas.

Run: `npx vitest run test/permissions.test.ts` (desde `backend/`)
Expected: PASS.

- [x] **Step 3: Documentación**

- `README.md`: en "Reglas", una línea: `El cálculo de horas y montos vive en backend/src/payroll/calc.ts y trabaja con enteros (minutos y céntimos).`
- Spec, sección 9: en la fila de `/attendance`, precisar que `POST /clock` recibe `payrollId`, `workerId`, `date`, `mark` y `at` opcional, y que es idempotente; en la de `/payrolls`, que cerrar, reabrir y exportar llegan en las fases 3 y 4.
- Spec, sección 5, `attendance_records`: agregar que `source` vale `'panel'` para lo registrado en el sistema.
- Este plan: sección "Estado de ejecución" con fecha, commits, total de pruebas y lo que difirió del texto.

- [x] **Step 4: Verificación final**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: todo en verde. El frontend no cambia en este plan: sus 94 pruebas y sus 16 rutas siguen igual. Anotar el total de pruebas del backend.

- [x] **Step 5: Commit**

```bash
git add backend/test/permissions.test.ts README.md docs
git commit -m "test(api): cover payroll and attendance routes in the role matrix and the coordinator sweep"
```

---

## Fuera de este plan

- Pantallas de Asistencia y Planillas, y el cambio del menú: plan 2B.
- Cerrar y reabrir planillas, conceptos (`payroll_items`), pagos y evidencias, recibo: fase 3.
- Reportes y exportación a Excel: fase 4.
- Aplicar la migración `0001` al proyecto Supabase de desarrollo: se hace al mergear, con `npm run db:migrate -w @agrosalas/backend`.
- Búsqueda de trabajadores sin acentos, y las inconsistencias de nombres de la fase 1 anotadas en el plan 1C.
