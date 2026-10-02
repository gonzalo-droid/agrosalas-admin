# Planilla fase 3A: API de conceptos, pagos, evidencia y cierre — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar funcionando y probada la API de la fase 3: conceptos de planilla (sueldo, bono, destajo, descuento), pagos parciales con evidencia, saldos por trabajador, cierre y reapertura de planillas, el detalle para el recibo y el sueldo automático de la planilla mensual.

**Architecture:** Dos tablas nuevas (`payroll_items`, `payments`) atadas a `payroll_workers` con clave foránea compuesta, de modo que solo un trabajador de la planilla puede tener conceptos, pagos o asistencia en ella. El saldo se calcula con un módulo puro (`backend/src/payroll/balance.ts`) a partir de tres sumas por trabajador. La evidencia vive en un bucket privado de Supabase Storage detrás de una interfaz inyectada (`EvidenceStorage`), igual que `authAdmin`, para que las pruebas no toquen la red. Toda escritura bloquea la fila de la planilla: `FOR SHARE` en asistencia, conceptos y pagos; `FOR UPDATE` al editarla, cerrarla o reabrirla.

**Tech Stack:** el de las fases anteriores (Node ≥ 22, Hono 4, Zod 4, Drizzle ORM 0.45 + drizzle-kit, PGlite en pruebas, Vitest 5, `@supabase/supabase-js` ya instalado). No se agrega ninguna dependencia.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, secciones 4 (permisos), 5 (`payroll_items`, `payments`), 7 (planillas: total, pendiente, cierre, planilla mensual), 8 (pagos y evidencia), 9 (API), 14 (pruebas) y 17 (nombres). Fase 3 de la sección 15.

**Plan hermano:** el 3B (pestaña Pagos, conceptos, cierre y reapertura en pantalla, recibo imprimible, columnas Pagado y Pendiente, historial en la ficha del trabajador) se escribe cuando este esté ejecutado, porque importa el tipo `AppType` real.

## Decisiones tomadas

Resuelven lo que el spec deja abierto y lo que el plan 2A dejó anotado para esta fase. Se pueden cambiar antes de fusionar.

1. **El descuento se guarda en positivo.** `amount_cents` es siempre mayor que 0; el tipo da el signo: `salary`, `bonus` y `piecework` suman, `deduction` resta.
2. **Un solo sueldo por trabajador y planilla.** Lo garantiza un índice único parcial. Los demás tipos se pueden repetir.
3. **Sueldo automático.** Al crear una planilla mensual, y al agregarle trabajadores después, cada trabajador de contrato cuyo cargo es mensual y tiene sueldo recibe un concepto `salary` por ese sueldo. Si el cargo no tiene sueldo mensual no se crea nada: contabilidad lo agrega a mano. El monto se edita como cualquier concepto.
4. **Un concepto se edita solo en monto y nota.** Para cambiar el tipo se elimina y se crea otro.
5. **Un pago no se edita:** se elimina y se registra de nuevo (el spec solo pide crear, listar y eliminar).
6. **Fecha del pago.** Puede caer fuera del periodo de la planilla (se suele pagar después), pero no puede ser futura respecto de hoy en Lima.
7. **Pendiente negativo.** Se permite pagar más que el total (adelanto): el pendiente queda negativo, a favor de la empresa.
8. **Detalle del medio.** Si el pago indica un método del trabajador (`paymentMethodId`), el servidor escribe `method_detail` con el número, banco, CCI y titular de ese momento. Sin método registrado se acepta un texto libre; en efectivo normalmente queda vacío.
9. **Evidencia.** Ruta fija `payrolls/<payrollId>/<workerId>/<uuid>.<ext>` en el bucket privado `payment-evidence`. Un archivo pertenece a un solo pago. Al eliminar un pago el archivo **no** se borra: queda como respaldo de la auditoría. La URL de lectura dura 60 segundos.
10. **Cierre.** Si algún trabajador tiene pendiente distinto de 0, la API responde 409 `pending_balances` hasta que se mande `confirmPending: true` (supuesto 2 del spec). Los registros `needs_review` o con un tramo abierto no impiden cerrar: la pantalla los avisará en el plan 3B.
11. **Reapertura:** solo el administrador.
12. **Quitar de la planilla** a un trabajador con conceptos o pagos se rechaza, igual que con registros de asistencia.
13. **Coordinador.** No alcanza ninguna ruta de conceptos, pagos, evidencia, saldos, resumen ni recibo: 403. En la lista de planillas `totalCents`, `paidCents` y `pendingCents` le llegan en `null`.
14. **Gerencia** lee conceptos, pagos, evidencias, saldos, resumen y recibo; no escribe.
15. **Resumen de la lista.** "Pendiente acumulado" es la suma del pendiente de las planillas abiertas; "por pagar" cuenta las planillas abiertas cuyo periodo ya terminó; "pagado en el mes" suma los pagos con fecha en el mes en curso de Lima, de cualquier planilla.
16. **Total de la planilla.** Desde esta fase `totalCents` incluye los conceptos (asistencia + lo que suma − descuentos).

## Estado de ejecución

Ejecutado el 2026-10-02 en la rama `feat/phase-3a-payments-api`, en un worktree aparte; base: `master` en `38526cd`. Las siete tareas están hechas y todos sus pasos marcados.

Commits (`git log --oneline --reverse 38526cd..HEAD`; el último es el de la tarea 7):

- `a0a0937` docs(planilla): add the phase 3A plan (items, payments, evidence and closing API)
- `51402ba` feat(api): add the pure balance, evidence and payment method modules
- `5a96565` feat(api): add payroll item and payment tables tied to the payroll members
- `af1e556` feat(api): add payroll items, the monthly salary item and row locks on the payroll
- `3323710` feat(api): add payments with their evidence in a private bucket
- `d32cebf` feat(api): add worker balances, payroll totals with items and payments, the summary and the receipt detail
- `c210668` feat(api): close and reopen payrolls, with confirmation when balances are pending
- `e7da122` test(api): cover items, payments, evidence and closing in the role matrix and the coordinator sweep (con el README, el spec y esta sección)
- `1dea9a9` fix(api): let a monthly payroll drop a worker with only a salary item, and tighten payment dates and evidence paths (revisión final, ver abajo)
- el commit siguiente: docs(planilla): record the final review of plan 3A

Pruebas del backend, en total, al terminar cada tarea:

| Después de | Pruebas |
|---|---|
| Inicio | 285 |
| Tareas 1 y 2 | 312 |
| Tarea 3 | 323 |
| Tarea 4 | 341 |
| Tarea 5 | 353 |
| Tarea 6 | 376 |
| Tarea 7 | 400 |

Total final del backend: 400 (24 casos nuevos en `permissions.test.ts`: 7 lecturas de dinero prohibidas al coordinador, 7 rutas de escritura prohibidas a gerencia y coordinador, y 3 roles prohibidos en la reapertura; el barrido y la prueba de control del administrador ampliaron aserciones sin sumar casos). Las del frontend siguen en 234 (no cambia en este plan). Verificación final desde la raíz: `npm run lint && npm run typecheck && npm test && npm run build`, todo en verde. El `lint` de la raíz solo revisa el frontend: la comprobación estática del backend es `npm run typecheck`.

Cada tarea pasó revisión de especificación y de calidad, sin hallazgos críticos ni importantes.

Revisión final de la rama: ningún hallazgo crítico y uno importante, el sueldo automático de una planilla mensual impedía quitar al trabajador de la planilla; se corrigió en `1dea9a9`, junto con los hallazgos menores de los puntos 2 a 5 de abajo. El revisor reprodujo los totales de pruebas y la migración. Tras `1dea9a9`: backend 409 pruebas (nueve más: tres de quitar trabajadores, una de notas en blanco, tres de fechas y rutas de evidencia, dos de `addDays`), frontend 234; lint, typecheck y build en verde.

Lo que difirió del texto del plan:

- Las tareas 1 y 2 se despacharon juntas: dos commits y una sola revisión.
- La API no deja crear un cargo mensual sin sueldo, así que el "cargo sin sueldo" de las pruebas de la tarea 3 se prepara con una actualización directa. En la práctica, el caso "trabajador de contrato sin concepto de sueldo" es un trabajador de contrato con un cargo por hora o sin cargo.
- Una planilla sin trabajadores se crea omitiendo `workers` (el esquema pide al menos un id).
- Una `note` de pago en blanco se guarda como `null`, igual que un `methodDetail` en blanco; la `note` de un concepto, también (revisión final).
- Quitar a un trabajador de una planilla mensual cuyo único concepto es el sueldo automático es posible: el sueldo se elimina con él y se audita (`DELETE /payrolls/:id/workers/:workerId`). Asistencia, pagos u otros conceptos siguen bloqueando con 409 `has_records`.
- La fecha de un pago no puede ser anterior en más de 31 días al inicio de su planilla (400 `validation`, campo `date`); el cálculo usa `addDays` de `backend/src/payroll/time.ts`.
- Las rutas de evidencia (`upload-url` y el alta del pago) pasan los ids a minúsculas antes de armar o comprobar la ruta del archivo.
- `payrollBalances` filtra por `workerIds` en SQL en las tres consultas, y la prueba de saldos tiene más de una fila por tabla en el trabajador `w1`.
- Las 13 escrituras que ejerce la prueba de la planilla cerrada (tarea 6) ya respondían `payroll_closed` cuando llegó la tarea: ninguna ruta hubo que corregir.
- En la tarea 7 la matriz de roles no necesitó cambios en las rutas: cada combinación prohibida respondió 403 `forbidden`. Las filas de `DELETE`, cerrar y reabrir van al final de la matriz.

Pendiente para el plan 3B (pantallas):

- Pestaña Pagos de la planilla: saldo por trabajador, conceptos, historial de pagos con su evidencia y formulario de pago que propone el pendiente y el método principal.
- Subida de la evidencia: pedir la URL firmada, subir el archivo (con compresión de imágenes en el navegador) y registrar el pago con su `evidencePath`.
- Columnas Pagado y Pendiente en la grilla y en la lista; las tres cifras del resumen.
- Cerrar (con la lista de pendientes y `confirmPending`) y reabrir; avisar antes de cerrar si hay registros `needs_review` o con un tramo abierto.
- Ocultar los controles de edición en una planilla cerrada (anotado en el plan 2B).
- Recibo imprimible por trabajador y planilla.
- Historial de planillas y pagos en la ficha del trabajador.
- Planilla mensual: mostrar y editar el sueldo generado.
- `/balances` trae solo `workerId`: los nombres salen de `GET /payrolls/:id`. Proponer `max(0, pendiente)` como monto del pago.
- El método principal que se propone sale de `paymentMethods` del recibo.
- La subida de evidencia usa `signedUrl` (PUT del archivo) o `uploadToSignedUrl` con el bucket.
- Al cerrar, enviar `{}`; ante 409 `pending_balances` mostrar la lista y reenviar con `confirmPending: true`.
- Los avisos de `needs_review` y de tramos abiertos se calculan en la pantalla.

Pendiente de la API (hallazgos menores de las revisiones de cada tarea, sin corregir todavía; la revisión final de la rama decide cuáles se corrigen antes de fusionar):

- Leer la evidencia de un archivo que nunca se subió responde 502 `storage_error` con "inténtalo de nuevo": conviene tratar el "no encontrado" del almacenamiento como 404. Nada comprueba que el archivo exista al registrar el pago.
- El historial del trabajador hace cuatro consultas por cada planilla de la página.
- Un pago enviado dos veces no se detecta en la API: lo evita la pantalla (plan 3B).
- El total de la lista incluye los conceptos (el sueldo de una planilla mensual) y la grilla del plan 2B todavía no: se alinean en el 3B.
- El recibo hace varias lecturas fuera de una transacción.
- Dos altas de sueldo simultáneas: la que pierde recibe el `duplicate` genérico, sin `field`.
- Pruebas por reforzar: restricciones de asistencia sin una fila aceptada de control; "repetir no crea otro sueldo" no ejerce el conflicto; los casos de planilla cerrada no comprueban que nada cambió; el orden de bloqueos no se puede probar con PGlite (una sola conexión).
- Antes de aplicar la migración `0002` a una base con datos, comprobar que esta consulta dé cuatro ceros (cualquier otro valor hace fallar la migración entera, que se revierte pero bloquea las siguientes): `select (select count(*) from attendance_records a left join payroll_workers pw using (payroll_id, worker_id) where pw.worker_id is null) as orphan_records, (select count(*) from attendance_records where worked_minutes < 0 or regular_minutes < 0 or overtime_minutes < 0) as negative_minutes, (select count(*) from attendance_records where hourly_rate < 0 or overtime_rate < 0 or amount_cents < 0) as negative_money, (select count(*) from payrolls where end_date < start_date) as payrolls_bad_dates`. En la base de desarrollo dio cuatro ceros el 2026-10-02.

## Global Constraints

- Todo nombre de código, tabla, columna, ruta, clave JSON y código de error va en inglés (spec, sección 17). Los textos que lee el usuario (`message` de los errores, mensajes de validación) van en español.
- Los permisos se aplican en el backend. Para el coordinador la API no envía dinero: las claves `hourlyRate`, `overtimeRate`, `amountCents`, `totalCents`, `paidCents` y `pendingCents` viajan como `null` donde la ruta le es visible, y las rutas de dinero le responden 403 `forbidden`.
- Gerencia (`management`) solo lee. Conceptos, pagos, evidencia y cierre: `admin` y `accounting`. Reapertura: `admin`.
- RLS activado en todas las tablas y sin políticas: toda tabla nueva lleva `.enableRLS()`.
- Toda creación, edición o eliminación escribe una fila en `audit_log` dentro de la misma transacción, con `entity` igual al nombre de la tabla. Una petición que no cambia nada no audita.
- Formato único de error: `{ "error": { "code", "message", "field?" } }`.
- Toda lista paginada recibe `page` y `pageSize` (máximo 100) y devuelve `{ items, total, page, pageSize }`. Las listas sin paginar devuelven `{ items }`.
- Las rutas se encadenan (`new Hono().get(...).post(...)`) para que el cliente tipado del frontend infiera los tipos. El backend solo usa imports relativos.
- Dinero en enteros (céntimos). Ningún cálculo usa decimales salvo la conversión del sueldo mensual del cargo (soles con dos decimales) a céntimos con `Math.round(x * 100)`.
- Las fechas se interpretan en Lima (UTC−5 fijo) con `limaDate` de `backend/src/payroll/time.ts`. Ninguna prueba depende de la hora real: se usa el reloj inyectado (`now`).
- Las pruebas no necesitan Docker, red ni variables de entorno: el almacenamiento de evidencias se inyecta y en las pruebas es un doble.
- El número de pruebas no baja: el backend parte de 285 y el frontend de 234. El frontend no cambia en este plan, pero su `typecheck` y su `build` deben seguir en verde porque importa el tipo de la API.
- Rama `feat/phase-3a-payments-api`; Conventional Commits con scope (`feat(api): …`). Nunca se versiona `.env`. No se hace `git push` sin que Gonzalo lo pida.
- Los comandos se ejecutan desde la raíz del repo salvo que se indique otra carpeta.

## Mapa de archivos

Todas las rutas son relativas a `backend/`.

| Archivo | Responsabilidad |
|---|---|
| `src/payroll/balance.ts` (nuevo) | Cálculo puro del saldo: signo de un concepto, saldo por trabajador, totales, sueldo en céntimos |
| `src/payroll/evidence.ts` (nuevo) | Reglas puras de la evidencia: formatos, tamaño máximo, ruta del archivo y su validación |
| `src/payroll/payment-method.ts` (nuevo) | Puro: medio que corresponde a un método del trabajador y texto de `method_detail` |
| `src/payroll/time.ts` | Se agrega `monthRange` (primer y último día del mes de una fecha) |
| `src/db/schema.ts` | Tablas `payroll_items` y `payments`, sus enums, claves compuestas hacia `payroll_workers` y CHECK |
| `drizzle/0002_payroll_items_payments.sql` (generado) | Migración |
| `src/payroll/open-payroll.ts` | `findOpenPayroll` bloquea la fila (`share` o `update`) |
| `src/payroll/salary-items.ts` (nuevo) | Crea los conceptos `salary` de una planilla mensual |
| `src/payroll/balance-service.ts` (nuevo) | Lee las tres sumas por trabajador y arma los saldos |
| `src/routes/payroll-items.ts` (nuevo) | Conceptos: listar, crear, editar, eliminar |
| `src/routes/payments.ts` (nuevo) | Pagos: listar, crear, eliminar |
| `src/routes/evidence.ts` (nuevo) | URL firmada de subida y de lectura |
| `src/storage/evidence.ts` (nuevo) | Implementación de `EvidenceStorage` con Supabase Storage |
| `scripts/create-evidence-bucket.ts` (nuevo) | Crea el bucket privado, con límite de tamaño y formatos |
| `src/routes/payrolls.ts` | Totales con conceptos y pagos, resumen, saldos, recibo, cerrar, reabrir, sueldo automático, bloqueo al quitar |
| `src/routes/worker-history.ts` (nuevo) | Planillas de un trabajador con su total, pagado y pendiente |
| `src/types.ts`, `src/app.ts`, `src/server.ts`, `src/env.ts`, `test/helpers.ts` | `EvidenceStorage` inyectado, `EVIDENCE_BUCKET`, montaje de rutas |
| `test/balance.test.ts`, `test/evidence-rules.test.ts`, `test/constraints.test.ts`, `test/payroll-items.test.ts`, `test/payments.test.ts`, `test/balances.test.ts`, `test/closing.test.ts` (nuevos) | Pruebas por módulo |
| `test/health.test.ts`, `test/time.test.ts`, `test/env.test.ts`, `test/payrolls.test.ts`, `test/permissions.test.ts` | Lista de tablas, `monthRange`, variable nueva, total con conceptos, matriz de roles y barrido |

---

### Task 1: Módulos puros: saldo, evidencia y medio de pago

**Files:**
- Create: `backend/src/payroll/balance.ts`, `backend/src/payroll/evidence.ts`, `backend/src/payroll/payment-method.ts`
- Modify: `backend/src/payroll/time.ts`
- Test: `backend/test/balance.test.ts`, `backend/test/evidence-rules.test.ts`, `backend/test/time.test.ts`

**Interfaces:**
- Consumes: nada (módulos sin base de datos).
- Produces (nombres exactos; las tareas 3 a 6 los importan):

```ts
// balance.ts
export type ItemType = 'salary' | 'bonus' | 'piecework' | 'deduction'
export type WorkerBalance = {
  workerId: string
  attendanceCents: number
  additionsCents: number // salary + bonus + piecework
  deductionsCents: number // stored positive
  totalCents: number // attendance + additions − deductions
  paidCents: number
  pendingCents: number // total − paid; negative = in favour of the company
}
export type BalanceTotals = Omit<WorkerBalance, 'workerId'>
export const signedCents: (type: ItemType, amountCents: number) => number
export function buildBalances(
  workerIds: string[],
  attendance: { workerId: string; cents: number }[],
  items: { workerId: string; type: ItemType; cents: number }[],
  payments: { workerId: string; cents: number }[],
): WorkerBalance[]
export function sumBalances(balances: WorkerBalance[]): BalanceTotals
export const salaryCents: (monthlySalary: number | null) => number

// evidence.ts
export const EVIDENCE_TYPES: { 'image/jpeg': 'jpg'; 'image/png': 'png'; 'image/webp': 'webp'; 'application/pdf': 'pdf' }
export type EvidenceContentType = keyof typeof EVIDENCE_TYPES
export const EVIDENCE_MAX_BYTES: number // 5 * 1024 * 1024
export const evidencePath: (payrollId: string, workerId: string, fileId: string, contentType: EvidenceContentType) => string
export const isEvidencePathOf: (path: string, payrollId: string, workerId: string) => boolean

// payment-method.ts
export type PaymentMedium = 'yape' | 'plin' | 'transfer' | 'cash'
export const MEDIUM_OF: { yape: 'yape'; plin: 'plin'; bank_account: 'transfer' }
export const describeMethod: (method: { type: 'yape' | 'plin' | 'bank_account'; number: string; bank: string | null; cci: string | null; holderName: string }) => string

// time.ts
export const monthRange: (date: string) => { from: string; to: string }
```

- [x] **Step 1: Escribir las pruebas (fallan)**

`backend/test/balance.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildBalances, salaryCents, signedCents, sumBalances } from '../src/payroll/balance'

describe('signedCents', () => {
  it('adds salary, bonus and piecework and subtracts a deduction', () => {
    expect(signedCents('salary', 150000)).toBe(150000)
    expect(signedCents('bonus', 2000)).toBe(2000)
    expect(signedCents('piecework', 3550)).toBe(3550)
    expect(signedCents('deduction', 1000)).toBe(-1000)
  })
})

describe('buildBalances', () => {
  const balances = buildBalances(
    ['w1', 'w2', 'w3'],
    [{ workerId: 'w1', cents: 6823 }, { workerId: 'w2', cents: 5000 }],
    [
      { workerId: 'w1', type: 'bonus', cents: 2000 },
      { workerId: 'w1', type: 'deduction', cents: 1000 },
      { workerId: 'w3', type: 'salary', cents: 150000 },
    ],
    [{ workerId: 'w1', cents: 5000 }, { workerId: 'w2', cents: 6000 }],
  )

  it('returns one balance per worker, in the order given', () => {
    expect(balances.map((b) => b.workerId)).toEqual(['w1', 'w2', 'w3'])
  })

  it('adds attendance and items and subtracts deductions and payments', () => {
    expect(balances[0]).toEqual({
      workerId: 'w1',
      attendanceCents: 6823,
      additionsCents: 2000,
      deductionsCents: 1000,
      totalCents: 7823,
      paidCents: 5000,
      pendingCents: 2823,
    })
  })

  it('leaves a negative pending amount when more than the total was paid', () => {
    expect(balances[1].totalCents).toBe(5000)
    expect(balances[1].pendingCents).toBe(-1000)
  })

  it('gives a worker with only a salary that salary as total and pending', () => {
    expect(balances[2]).toMatchObject({ attendanceCents: 0, additionsCents: 150000, totalCents: 150000, paidCents: 0, pendingCents: 150000 })
  })

  it('ignores sums of workers that are not in the list', () => {
    expect(buildBalances(['w1'], [{ workerId: 'other', cents: 999 }], [], [])).toEqual([
      { workerId: 'w1', attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 },
    ])
  })

  it('adds up every balance', () => {
    expect(sumBalances(balances)).toEqual({
      attendanceCents: 11823,
      additionsCents: 152000,
      deductionsCents: 1000,
      totalCents: 162823,
      paidCents: 11000,
      pendingCents: 151823,
    })
    expect(sumBalances([])).toEqual({ attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 })
  })
})

describe('salaryCents', () => {
  it('turns the monthly salary of a position into cents', () => {
    expect(salaryCents(1500)).toBe(150000)
    expect(salaryCents(1025.5)).toBe(102550)
    expect(salaryCents(1130.29)).toBe(113029)
  })

  it('is zero without a salary', () => {
    expect(salaryCents(null)).toBe(0)
    expect(salaryCents(0)).toBe(0)
  })
})
```

`backend/test/evidence-rules.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EVIDENCE_MAX_BYTES, evidencePath, isEvidencePathOf } from '../src/payroll/evidence'
import { describeMethod, MEDIUM_OF } from '../src/payroll/payment-method'

const PAYROLL = '11111111-1111-4111-8111-111111111111'
const WORKER = '22222222-2222-4222-8222-222222222222'
const FILE = '33333333-3333-4333-8333-333333333333'

describe('evidence path', () => {
  it('is built from the payroll, the worker, the file id and the extension of the type', () => {
    expect(evidencePath(PAYROLL, WORKER, FILE, 'image/jpeg')).toBe(`payrolls/${PAYROLL}/${WORKER}/${FILE}.jpg`)
    expect(evidencePath(PAYROLL, WORKER, FILE, 'application/pdf')).toBe(`payrolls/${PAYROLL}/${WORKER}/${FILE}.pdf`)
  })

  it('is accepted only for its own payroll and worker', () => {
    const path = evidencePath(PAYROLL, WORKER, FILE, 'image/webp')
    expect(isEvidencePathOf(path, PAYROLL, WORKER)).toBe(true)
    expect(isEvidencePathOf(path, WORKER, PAYROLL)).toBe(false)
    expect(isEvidencePathOf(path, PAYROLL, FILE)).toBe(false)
  })

  it('rejects anything that is not a file id with an allowed extension', () => {
    const prefix = `payrolls/${PAYROLL}/${WORKER}/`
    expect(isEvidencePathOf(`${prefix}../other.jpg`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`${prefix}${FILE}.exe`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`${prefix}${FILE}.jpg/extra`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`x/${prefix}${FILE}.jpg`, PAYROLL, WORKER)).toBe(false)
  })

  it('allows files up to 5 MB', () => {
    expect(EVIDENCE_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('payment method', () => {
  it('maps the method of a worker to the medium of a payment', () => {
    expect(MEDIUM_OF).toEqual({ yape: 'yape', plin: 'plin', bank_account: 'transfer' })
  })

  it('describes a Yape or Plin number with its holder', () => {
    expect(describeMethod({ type: 'yape', number: '987654321', bank: null, cci: null, holderName: 'Rosa Quispe' })).toBe('987654321 · Titular: Rosa Quispe')
  })

  it('describes a bank account with its bank and CCI when it has them', () => {
    expect(
      describeMethod({ type: 'bank_account', number: '19412345678901', bank: 'BCP', cci: '00219400123456789012', holderName: 'Rosa Quispe' }),
    ).toBe('BCP 19412345678901 · CCI 00219400123456789012 · Titular: Rosa Quispe')
    expect(describeMethod({ type: 'bank_account', number: '19412345678901', bank: null, cci: null, holderName: 'Rosa Quispe' })).toBe(
      '19412345678901 · Titular: Rosa Quispe',
    )
  })
})
```

En `backend/test/time.test.ts`, agregar al final (y `monthRange` al import existente de `../src/payroll/time`):

```ts
describe('monthRange', () => {
  it('gives the first and the last day of the month of a date', () => {
    expect(monthRange('2026-10-05')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(monthRange('2026-02-28')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(monthRange('2026-12-31')).toEqual({ from: '2026-12-01', to: '2026-12-31' })
  })
})
```

Run: `npx vitest run test/balance.test.ts test/evidence-rules.test.ts test/time.test.ts` (desde `backend/`)
Expected: FAIL, los módulos y `monthRange` no existen.

- [x] **Step 2: Escribir `backend/src/payroll/balance.ts`**

```ts
export type ItemType = 'salary' | 'bonus' | 'piecework' | 'deduction'

export type WorkerBalance = {
  workerId: string
  attendanceCents: number
  additionsCents: number
  deductionsCents: number
  totalCents: number
  paidCents: number
  pendingCents: number
}
export type BalanceTotals = Omit<WorkerBalance, 'workerId'>

// A deduction is stored as a positive amount: its type gives the sign.
export const signedCents = (type: ItemType, amountCents: number): number => (type === 'deduction' ? -amountCents : amountCents)

const sumBy = (rows: { workerId: string; cents: number }[]): Map<string, number> => {
  const sums = new Map<string, number>()
  for (const row of rows) sums.set(row.workerId, (sums.get(row.workerId) ?? 0) + row.cents)
  return sums
}

// One balance per worker of the list, in its order. Sums of workers outside the list are ignored.
export function buildBalances(
  workerIds: string[],
  attendance: { workerId: string; cents: number }[],
  items: { workerId: string; type: ItemType; cents: number }[],
  payments: { workerId: string; cents: number }[],
): WorkerBalance[] {
  const worked = sumBy(attendance)
  const added = sumBy(items.filter((item) => item.type !== 'deduction'))
  const deducted = sumBy(items.filter((item) => item.type === 'deduction'))
  const paid = sumBy(payments)
  return workerIds.map((workerId) => {
    const attendanceCents = worked.get(workerId) ?? 0
    const additionsCents = added.get(workerId) ?? 0
    const deductionsCents = deducted.get(workerId) ?? 0
    const totalCents = attendanceCents + additionsCents - deductionsCents
    const paidCents = paid.get(workerId) ?? 0
    return { workerId, attendanceCents, additionsCents, deductionsCents, totalCents, paidCents, pendingCents: totalCents - paidCents }
  })
}

const KEYS = ['attendanceCents', 'additionsCents', 'deductionsCents', 'totalCents', 'paidCents', 'pendingCents'] as const

export function sumBalances(balances: WorkerBalance[]): BalanceTotals {
  const totals: BalanceTotals = { attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 }
  for (const balance of balances) for (const key of KEYS) totals[key] += balance[key]
  return totals
}

// The monthly salary of a position is kept in soles with two decimals.
export const salaryCents = (monthlySalary: number | null): number => (monthlySalary ? Math.round(monthlySalary * 100) : 0)
```

- [x] **Step 3: Escribir `backend/src/payroll/evidence.ts` y `backend/src/payroll/payment-method.ts`**

```ts
// evidence.ts
export const EVIDENCE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
} as const
export type EvidenceContentType = keyof typeof EVIDENCE_TYPES

export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024

const prefixOf = (payrollId: string, workerId: string) => `payrolls/${payrollId}/${workerId}/`

// Where the evidence of a payment lives in the bucket: one folder per payroll and worker.
export const evidencePath = (payrollId: string, workerId: string, fileId: string, contentType: EvidenceContentType): string =>
  `${prefixOf(payrollId, workerId)}${fileId}.${EVIDENCE_TYPES[contentType]}`

const FILE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|pdf)$/

// A payment can only point to a file of its own payroll and worker, with a name this API generated.
export function isEvidencePathOf(path: string, payrollId: string, workerId: string): boolean {
  const prefix = prefixOf(payrollId, workerId)
  return path.startsWith(prefix) && FILE_NAME.test(path.slice(prefix.length))
}
```

```ts
// payment-method.ts
export type PaymentMedium = 'yape' | 'plin' | 'transfer' | 'cash'

// The medium of a payment made with a registered method of the worker.
export const MEDIUM_OF = { yape: 'yape', plin: 'plin', bank_account: 'transfer' } as const

type Method = { type: keyof typeof MEDIUM_OF; number: string; bank: string | null; cci: string | null; holderName: string }

// The text copied into the payment, so that its history does not change if the method is edited later.
export const describeMethod = (method: Method): string =>
  [
    method.type === 'bank_account' && method.bank ? `${method.bank} ${method.number}` : method.number,
    method.type === 'bank_account' && method.cci ? `CCI ${method.cci}` : null,
    `Titular: ${method.holderName}`,
  ]
    .filter(Boolean)
    .join(' · ')
```

- [x] **Step 4: `monthRange` en `backend/src/payroll/time.ts`**

```ts
// The first and the last day of the month of a date ('YYYY-MM-DD').
export function monthRange(date: string): { from: string; to: string } {
  const [year, month] = date.split('-').map(Number)
  // Day 0 of the next month is the last day of this one.
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const prefix = date.slice(0, 8)
  return { from: `${prefix}01`, to: `${prefix}${String(last).padStart(2, '0')}` }
}
```

- [x] **Step 5: Verificar**

Run: `npx vitest run test/balance.test.ts test/evidence-rules.test.ts test/time.test.ts` (desde `backend/`)
Expected: PASS.

Run: `npm run lint && npm run typecheck` (desde la raíz)
Expected: sin errores.

- [x] **Step 6: Commit**

```bash
git add backend/src/payroll/balance.ts backend/src/payroll/evidence.ts backend/src/payroll/payment-method.ts backend/src/payroll/time.ts backend/test/balance.test.ts backend/test/evidence-rules.test.ts backend/test/time.test.ts
git commit -m "feat(api): add the pure balance, evidence and payment method modules"
```

---

### Task 2: Tablas de conceptos y pagos, claves compuestas y CHECK

**Files:**
- Modify: `backend/src/db/schema.ts`, `backend/test/health.test.ts`
- Create: `backend/drizzle/0002_payroll_items_payments.sql` (generado, con su snapshot en `drizzle/meta/`)
- Test: `backend/test/constraints.test.ts`

**Interfaces:**
- Consumes: tablas de las fases 1 y 2.
- Produces: `payrollItems`, `payments`, `payrollItemTypeEnum`, `paymentMediumEnum` exportados desde `src/db/schema.ts`; restricciones nuevas en `attendance_records` y `payrolls`.

- [x] **Step 1: Escribir las pruebas (fallan)**

En `backend/test/health.test.ts`, agregar `'payments'` y `'payroll_items'` a la lista esperada de tablas, en orden alfabético (entre `'groups'` y `'payroll_workers'` van `'payments'`, `'payroll_items'`).

`backend/test/constraints.test.ts`: prueba las restricciones con `insert` directo de Drizzle (no pasan por la API, que ya las cumple). Preparación en `beforeAll` por la API con `createTestApp()`: un área, un cargo por hora, dos trabajadores temporales `w1` y `w2`, y una planilla semanal del `2026-10-05` al `2026-10-11` con `workers: { workerIds: [w1] }` (solo `w1` es miembro). Cada caso espera que la promesa del `insert` o `update` sea rechazada (`await expect(...).rejects.toThrow()`):

1. Un registro de asistencia de `w2` (no miembro) en esa planilla → rechazado por la clave compuesta.
2. Un registro de asistencia de `w1` con `amountCents: -1` → rechazado; lo mismo con `workedMinutes: -1`.
3. Un concepto de `w2` (no miembro) → rechazado. Un concepto de `w1` con `amountCents: 0` → rechazado.
4. Dos conceptos `salary` de `w1` en la misma planilla → el segundo rechazado; dos `bonus` de `w1` → aceptados.
5. Un pago de `w2` (no miembro) → rechazado. Un pago de `w1` con `amountCents: 0` → rechazado.
6. Dos pagos de `w1` con el mismo `evidencePath` → el segundo rechazado; dos pagos sin evidencia → aceptados.
7. `update` de la planilla con `endDate` anterior a `startDate` → rechazado.
8. Control: un concepto `bonus` y un pago de `w1` con valores válidos se insertan (`recordedBy: USERS.admin`).

Run: `npx vitest run test/health.test.ts test/constraints.test.ts` (desde `backend/`)
Expected: FAIL (las tablas no existen).

- [x] **Step 2: Ampliar `backend/src/db/schema.ts`**

Al import de `drizzle-orm/pg-core` se agregan `check` y `foreignKey`.

`payrolls`: agregar a su lista de restricciones `check('payrolls_dates_order', sql`${t.endDate} >= ${t.startDate}`)`.

`attendanceRecords`: agregar a su lista de restricciones:

```ts
    // Only a worker of the payroll can have records in it.
    foreignKey({
      name: 'attendance_records_member_fk',
      columns: [t.payrollId, t.workerId],
      foreignColumns: [payrollWorkers.payrollId, payrollWorkers.workerId],
    }),
    check(
      'attendance_records_minutes_not_negative',
      sql`${t.workedMinutes} >= 0 and ${t.regularMinutes} >= 0 and ${t.overtimeMinutes} >= 0`,
    ),
    check(
      'attendance_records_money_not_negative',
      sql`${t.hourlyRate} >= 0 and ${t.overtimeRate} >= 0 and ${t.amountCents} >= 0`,
    ),
```

Tablas nuevas, al final del archivo:

```ts
export const payrollItemTypeEnum = pgEnum('payroll_item_type', ['salary', 'bonus', 'piecework', 'deduction'])
export const paymentMediumEnum = pgEnum('payment_medium', ['yape', 'plin', 'transfer', 'cash'])

export const payrollItems = pgTable(
  'payroll_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // No cascade: a payroll with items cannot be deleted from under them.
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
    type: payrollItemTypeEnum('type').notNull(),
    // Always positive: a deduction subtracts because of its type.
    amountCents: integer('amount_cents').notNull(),
    note: text('note'),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: 'payroll_items_member_fk',
      columns: [t.payrollId, t.workerId],
      foreignColumns: [payrollWorkers.payrollId, payrollWorkers.workerId],
    }),
    check('payroll_items_amount_positive', sql`${t.amountCents} > 0`),
    uniqueIndex('payroll_items_salary_unique').on(t.payrollId, t.workerId).where(sql`type = 'salary'`),
    index('payroll_items_payroll_idx').on(t.payrollId, t.workerId),
  ],
).enableRLS()

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
    date: date('date').notNull(),
    amountCents: integer('amount_cents').notNull(),
    method: paymentMediumEnum('method').notNull(),
    // A copy of the number and the holder used, so that the history does not change with the worker's methods.
    methodDetail: text('method_detail'),
    evidencePath: text('evidence_path'),
    note: text('note'),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    ...timestamps,
  },
  (t) => [
    foreignKey({
      name: 'payments_member_fk',
      columns: [t.payrollId, t.workerId],
      foreignColumns: [payrollWorkers.payrollId, payrollWorkers.workerId],
    }),
    check('payments_amount_positive', sql`${t.amountCents} > 0`),
    uniqueIndex('payments_evidence_unique').on(t.evidencePath).where(sql`evidence_path is not null`),
    index('payments_payroll_idx').on(t.payrollId, t.workerId),
    index('payments_worker_idx').on(t.workerId, t.date),
  ],
).enableRLS()
```

- [x] **Step 3: Generar la migración**

Run (desde `backend/`): `npx drizzle-kit generate --name payroll_items_payments`
Expected: crea `drizzle/0002_payroll_items_payments.sql` y `drizzle/meta/0002_snapshot.json`, y actualiza `drizzle/meta/_journal.json`.

Leer el SQL generado y comprobar que contiene: los dos `CREATE TYPE`, las dos `CREATE TABLE` con `ENABLE ROW LEVEL SECURITY`, las tres claves compuestas (`attendance_records_member_fk`, `payroll_items_member_fk`, `payments_member_fk`) hacia `payroll_workers("payroll_id","worker_id")`, los cinco `CHECK` y los índices. Si `drizzle-kit` genera un `CHECK` con el nombre de la tabla antepuesto a las columnas (`"payments"."amount_cents"`), es válido en Postgres: no se edita. No se edita la migración a mano salvo que falte algo de esta lista.

- [x] **Step 4: Verificar**

Run: `npm test -w @agrosalas/backend`
Expected: PASS; todas las pruebas anteriores siguen pasando (las de asistencia insertan registros de miembros de la planilla, así que la clave compuesta no las afecta). Si alguna prueba anterior falla por la clave compuesta o por un CHECK, la causa es un defecto real de esa ruta o de la preparación de la prueba: reportarlo, no relajar la restricción.

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

- [x] **Step 5: Commit**

```bash
git add backend/src/db/schema.ts backend/drizzle backend/test/health.test.ts backend/test/constraints.test.ts
git commit -m "feat(api): add payroll item and payment tables tied to the payroll members"
```

---

### Task 3: Bloqueo de la planilla, conceptos y sueldo automático

**Files:**
- Modify: `backend/src/payroll/open-payroll.ts`, `backend/src/payroll/attendance-service.ts`, `backend/src/routes/payrolls.ts`, `backend/src/app.ts`
- Create: `backend/src/routes/payroll-items.ts`, `backend/src/payroll/salary-items.ts`
- Test: `backend/test/payroll-items.test.ts`, `backend/test/payrolls.test.ts`

**Interfaces:**
- Consumes: `payrollItems` (tarea 2); `salaryCents`, `ItemType` (tarea 1); `findWorker`, `requireRole`, `validate`, `idSchema`, `withAtLeastOneField`, `recordAudit`, `ApiError`, `notFound`.
- Produces:
  - `findOpenPayroll(tx: Tx, id: string, lock: 'share' | 'update')`: igual que antes (404 `not_found`, 409 `payroll_closed`) pero bloquea la fila con `.for(lock)`. Ya no acepta `Db`: siempre se llama dentro de una transacción.
  - `findPayrollMember(tx, payrollId, workerId)` exportada desde `payroll/open-payroll.ts`: comprueba que el trabajador está en la planilla y lanza 400 `not_in_payroll` (`'El trabajador no está en esta planilla'`) si no. La usan conceptos, pagos y evidencia.
  - `createSalaryItems(tx: Tx, userId: string, payroll: { id: string; type: 'weekly' | 'monthly' }, workerIds: string[]): Promise<number>` desde `payroll/salary-items.ts`.
  - `payrollItemsRoutes(deps)` montado en `/v1/payroll-items`.

**Bloqueo**

```ts
// backend/src/payroll/open-payroll.ts
import { and, eq } from 'drizzle-orm'
import { payrolls, payrollWorkers } from '../db/schema'
import { ApiError, notFound } from '../lib/errors'
import type { Tx } from '../types'

// Returns the payroll, or fails if it does not exist (404) or is closed (409), and locks its row until the
// transaction ends. Writes inside the payroll (attendance, items, payments) take 'share': they do not block each
// other, but they wait for a close in progress and make a close wait for them. Editing, closing and reopening the
// payroll take 'update'.
export async function findOpenPayroll(tx: Tx, id: string, lock: 'share' | 'update') {
  const [payroll] = await tx.select().from(payrolls).where(eq(payrolls.id, id)).for(lock)
  if (!payroll) throw notFound('La planilla')
  if (payroll.status === 'closed') throw new ApiError(409, 'payroll_closed', 'La planilla está cerrada')
  return payroll
}

export async function findPayrollMember(tx: Tx, payrollId: string, workerId: string): Promise<void> {
  const [member] = await tx
    .select({ workerId: payrollWorkers.workerId })
    .from(payrollWorkers)
    .where(and(eq(payrollWorkers.payrollId, payrollId), eq(payrollWorkers.workerId, workerId)))
  if (!member) throw new ApiError(400, 'not_in_payroll', 'El trabajador no está en esta planilla')
}
```

Llamadas existentes que cambian:

| Dónde | Bloqueo |
|---|---|
| `attendance-service.ts`, función local `findPayrollMember` (marcar y crear registro) | `'share'`. La función local pasa a llamarse `findRecordContext` para no chocar con la exportada, y usa la `findPayrollMember` exportada para la comprobación de miembro |
| `attendance-service.ts`, `loadEditable` (editar y eliminar registro) | `'share'` |
| `routes/payrolls.ts`, `PATCH /:id` | `'update'` |
| `routes/payrolls.ts`, `POST /:id/workers` y `DELETE /:id/workers/:workerId` | `'update'` |

El orden de bloqueo en asistencia no cambia (en `loadEditable` primero el registro y luego la planilla). No hay interbloqueo: los bloqueos compartidos de la planilla no chocan entre sí y quien toma el exclusivo no bloquea registros.

**Contrato de `/v1/payroll-items`**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `GET /v1/payroll-items` | `admin`, `accounting`, `management` | query `itemFilters`: `payrollId` (uuid, obligatorio), `workerId?` | `{ items }`: todas las columnas del concepto. Orden: `createdAt`, luego `id`. Planilla inexistente → 404 `not_found` |
| `POST /v1/payroll-items` | `admin`, `accounting` | body `itemInput`: `payrollId`, `workerId`, `type` (`salary`\|`bonus`\|`piecework`\|`deduction`), `amountCents` (entero de 1 a 99 999 999), `note?` (hasta 300, nullable) | 201 con el concepto |
| `PATCH /v1/payroll-items/:id` | `admin`, `accounting` | body `itemUpdate`: `amountCents?`, `note?`; al menos un campo | el concepto |
| `DELETE /v1/payroll-items/:id` | `admin`, `accounting` | | `{ ok: true }` |

Esquemas (nombres exactos):

```ts
const amountCents = z.number().int().min(1).max(99_999_999)
const note = z.string().trim().max(300).nullable()
const itemFilters = z.object({ payrollId: z.uuid(), workerId: z.uuid().optional() })
const itemInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  type: z.enum(['salary', 'bonus', 'piecework', 'deduction']),
  amountCents,
  note: note.optional(),
})
const itemUpdate = withAtLeastOneField(z.object({ amountCents, note }).partial())
```

Reglas y errores:

- Toda ruta lleva `requireRole`: el coordinador recibe 403 `forbidden` también en `GET`.
- `POST`: dentro de una transacción, `findOpenPayroll(tx, payrollId, 'share')` (404 o 409 `payroll_closed`) y `findPayrollMember` (400 `not_in_payroll`). Un segundo `salary` del mismo trabajador en la planilla → 409 `duplicate`, `'El trabajador ya tiene un sueldo en esta planilla'`, `field: 'type'` (se comprueba con un `select` antes de insertar; el índice único queda como defensa ante dos peticiones a la vez).
- `PATCH` y `DELETE`: el concepto se lee con `.for('update')`; si no existe, 404 `not_found` (`notFound('El concepto')`); luego `findOpenPayroll(tx, item.payrollId, 'share')`.
- `PATCH` con los mismos valores guardados responde 200 sin escribir ni auditar.
- Auditoría: `create`, `update` y `delete` con `entity: 'payroll_items'`.

**Sueldo automático** (`backend/src/payroll/salary-items.ts`)

```ts
import { and, eq, inArray } from 'drizzle-orm'
import { payrollItems, positions, workers } from '../db/schema'
import { recordAudit } from '../lib/audit'
import type { Tx } from '../types'
import { salaryCents } from './balance'

// A monthly payroll pays the contract staff with a salary item: one per contract worker whose position is monthly
// and has a salary. Whoever already has one keeps it. Returns how many were created.
export async function createSalaryItems(
  tx: Tx,
  userId: string,
  payroll: { id: string; type: 'weekly' | 'monthly' },
  workerIds: string[],
): Promise<number> {
  if (payroll.type !== 'monthly' || workerIds.length === 0) return 0
  const staff = await tx
    .select({ workerId: workers.id, monthlySalary: positions.monthlySalary })
    .from(workers)
    .innerJoin(positions, eq(positions.id, workers.positionId))
    .where(and(inArray(workers.id, workerIds), eq(workers.employmentType, 'contract'), eq(positions.payType, 'monthly')))
  const values = staff
    .map((row) => ({ workerId: row.workerId, amountCents: salaryCents(row.monthlySalary) }))
    .filter((row) => row.amountCents > 0)
    .map((row) => ({ ...row, payrollId: payroll.id, type: 'salary' as const, recordedBy: userId }))
  if (values.length === 0) return 0
  const created = await tx.insert(payrollItems).values(values).onConflictDoNothing().returning()
  for (const item of created) await recordAudit(tx, userId, 'create', 'payroll_items', item.id, null, item)
  return created.length
}
```

Se llama en `routes/payrolls.ts`:

- `POST /`: después de `addWorkers`, `await createSalaryItems(tx, c.get('user').id, created, workerIds)`.
- `POST /:id/workers`: con los ids realmente agregados, `await createSalaryItems(tx, c.get('user').id, payroll, added)`, donde `payroll` es lo que devuelve `findOpenPayroll`.

**Quitar a un trabajador con conceptos o pagos** (`DELETE /v1/payrolls/:id/workers/:workerId`): después de la comprobación de registros de asistencia y antes de borrar, si el trabajador tiene alguna fila en `payroll_items` o en `payments` de esa planilla → 409 `has_records`, `'El trabajador tiene conceptos o pagos en esta planilla; elimínalos primero'`.

- [x] **Step 1: Escribir las pruebas (fallan)**

`backend/test/payroll-items.test.ts`. Preparación en `beforeAll`: área `Producción`; cargo `Operario` por hora (6.25 / 7.8125); cargo `Supervisor` mensual con `monthlySalary: 1800`; cargo `Asistente` mensual sin sueldo (`monthlySalary` omitido); trabajadores `w1` (temporal, Operario), `w2` (contrato, Supervisor), `w3` (contrato, Asistente), `w4` (temporal, Operario, no se agrega a ninguna planilla); el coordinador con el área Producción (`insert` directo en `userAreas`); una planilla semanal `weekly` del `2026-10-05` al `2026-10-11` con `w1` y `w2`.

Casos, uno por `it`:

1. `admin` crea un `bonus` de 2000 para `w1` → 201 con `type`, `amountCents`, `recordedBy` del admin, y una fila de auditoría `create` de `payroll_items`.
2. `accounting` puede crear; `management` y `coordinator` reciben 403 `forbidden` en `POST`; `coordinator` recibe 403 en `GET`; `management` puede listar.
3. `amountCents` 0, negativo o decimal → 400 `validation` con `field` `'amountCents'`.
4. Concepto para `w4` (no está en la planilla) → 400 `not_in_payroll`. `payrollId` inexistente → 404 `not_found`.
5. Un `salary` para `w1` se crea; un segundo `salary` para `w1` → 409 `duplicate` con `field` `'type'`; dos `deduction` para `w1` se aceptan.
6. `GET ?payrollId=` devuelve todos los conceptos de la planilla en orden de creación; con `workerId` solo los de ese trabajador; sin `payrollId` → 400 `validation`.
7. `PATCH` cambia `amountCents` y `note` y audita `update`; repetir el mismo `PATCH` responde 200 y no agrega auditoría; `PATCH` con `{ type: 'bonus' }` → 400 `validation` (no hay campos conocidos).
8. `DELETE` elimina y audita `delete`; un id inexistente → 404 `not_found`.
9. Planilla mensual: crear una planilla `monthly` del `2026-10-01` al `2026-10-31` con `workers: { workerIds: [w1, w2, w3] }` genera exactamente un concepto: `salary` de 180000 para `w2` (no para `w1`, temporal, ni para `w3`, sin sueldo), con su auditoría `create`.
10. Agregar `w2` a otra planilla mensual vacía con `POST /:id/workers` genera su `salary`; repetir la llamada no crea otro. Una planilla semanal nunca genera sueldos.
11. Quitar de la planilla a un trabajador con un concepto → 409 `has_records` con el mensaje de conceptos o pagos; tras eliminar el concepto, se puede quitar.

En `backend/test/payrolls.test.ts` no cambia ningún caso en esta tarea: sus pruebas deben seguir pasando con el bloqueo.

Run: `npx vitest run test/payroll-items.test.ts` (desde `backend/`)
Expected: FAIL, la ruta `/v1/payroll-items` responde 404.

- [x] **Step 2: Bloqueo**

Reemplazar `backend/src/payroll/open-payroll.ts` por el código de arriba y actualizar las llamadas de la tabla "Llamadas existentes que cambian".

Run: `npm test -w @agrosalas/backend`
Expected: las 285 pruebas anteriores y las de las tareas 1 y 2 pasan; solo falla `payroll-items.test.ts`.

- [x] **Step 3: `salary-items.ts`, `routes/payroll-items.ts` y los cambios de `routes/payrolls.ts`**

Escribir `createSalaryItems` (código de arriba), las rutas del contrato y montar `.route('/payroll-items', payrollItemsRoutes(deps))` en `backend/src/app.ts` después de `/attendance`.

- [x] **Step 4: Verificar**

Run: `npm test -w @agrosalas/backend`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: sin errores (el frontend sigue compilando contra el tipo nuevo de la API).

- [x] **Step 5: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add payroll items, the monthly salary item and row locks on the payroll"
```

---

### Task 4: Pagos y evidencia

**Files:**
- Create: `backend/src/routes/payments.ts`, `backend/src/routes/evidence.ts`, `backend/src/storage/evidence.ts`, `backend/scripts/create-evidence-bucket.ts`
- Modify: `backend/src/types.ts`, `backend/src/app.ts`, `backend/src/server.ts`, `backend/src/env.ts`, `backend/.env.example`, `backend/package.json`, `backend/test/helpers.ts`, `backend/test/env.test.ts`
- Test: `backend/test/payments.test.ts`

**Interfaces:**
- Consumes: `payments`, `workerPaymentMethods` (schema); `findOpenPayroll`, `findPayrollMember` (tarea 3); `EVIDENCE_TYPES`, `EVIDENCE_MAX_BYTES`, `evidencePath`, `isEvidencePathOf`, `MEDIUM_OF`, `describeMethod` (tarea 1); `limaDate`; reloj `now`.
- Produces:

```ts
// backend/src/types.ts
export interface EvidenceStorage {
  // A signed URL (and its token) to upload one file to that path of the private bucket.
  createUploadUrl(path: string): Promise<{ signedUrl: string; token: string }>
  // A signed URL to read the file, valid for that many seconds.
  createReadUrl(path: string, expiresInSeconds: number): Promise<{ signedUrl: string }>
}
// Dependencies gains: evidence: EvidenceStorage
```

  - `paymentsRoutes(deps)` en `/v1/payments`; `evidenceRoutes(deps)` en `/v1/evidence`.
  - Variable de entorno `EVIDENCE_BUCKET` (por defecto `payment-evidence`).
  - `npm run create-evidence-bucket -w @agrosalas/backend`.

**Contrato de `/v1/payments`**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `GET /v1/payments` | `admin`, `accounting`, `management` | query `paymentFilters`: `page`, `pageSize`, `payrollId?`, `workerId?` (al menos uno de los dos) | paginada; cada fila: las columnas del pago + `workerFirstName`, `workerLastName`, `payrollName`. Orden: `date` descendente, `createdAt` descendente, `id` |
| `POST /v1/payments` | `admin`, `accounting` | body `paymentInput` | 201 con el pago |
| `DELETE /v1/payments/:id` | `admin`, `accounting` | | `{ ok: true }` |

```ts
const paymentFilters = pageSchema
  .extend({ payrollId: z.uuid().optional(), workerId: z.uuid().optional() })
  .refine((f) => f.payrollId !== undefined || f.workerId !== undefined, { message: 'Indica la planilla o el trabajador' })
const paymentInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  date: z.iso.date(),
  amountCents: z.number().int().min(1).max(99_999_999),
  method: z.enum(['yape', 'plin', 'transfer', 'cash']),
  paymentMethodId: z.uuid().optional(),
  methodDetail: z.string().trim().max(160).nullable().optional(),
  evidencePath: z.string().max(200).nullable().optional(),
  note: z.string().trim().max(300).nullable().optional(),
})
```

Reglas de `POST`, en este orden, dentro de una transacción:

1. `findOpenPayroll(tx, payrollId, 'share')` → 404 `not_found` o 409 `payroll_closed`.
2. `findPayrollMember(tx, payrollId, workerId)` → 400 `not_in_payroll`.
3. `date` posterior a `limaDate(now())` → 400 `validation`, `'La fecha del pago no puede ser futura'`, `field: 'date'`.
4. Con `paymentMethodId`: se lee de `worker_payment_methods`; si no existe o es de otro trabajador → 400 `invalid_reference`, `'El método de pago no es de ese trabajador'`, `field: 'paymentMethodId'`. Si `MEDIUM_OF[method.type] !== method` del cuerpo → 400 `validation`, `'El medio no coincide con el método de pago elegido'`, `field: 'method'`. Se guarda `methodDetail = describeMethod(método)` y se ignora el `methodDetail` del cuerpo.
5. Sin `paymentMethodId`: `methodDetail` es el texto del cuerpo, o `null` (un texto vacío tras `trim` se guarda como `null`).
6. Con `evidencePath`: si `!isEvidencePathOf(evidencePath, payrollId, workerId)` → 400 `validation`, `'La evidencia no corresponde a este pago'`, `field: 'evidencePath'`. Si otro pago ya usa esa ruta → 409 `duplicate`, `'Esa evidencia ya está en otro pago'`, `field: 'evidencePath'` (se comprueba con un `select`; el índice único queda como defensa).
7. Inserta con `recordedBy` y audita `create` con `entity: 'payments'`.

`paymentMethodId` no se guarda: es solo la forma de pedir la copia.

`DELETE`: el pago se lee con `.for('update')` (404 `notFound('El pago')`), `findOpenPayroll(tx, payment.payrollId, 'share')`, borra y audita `delete`. El archivo de evidencia no se toca.

**Contrato de `/v1/evidence`**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `POST /v1/evidence/upload-url` | `admin`, `accounting` | body `uploadInput`: `payrollId`, `workerId`, `contentType` (una clave de `EVIDENCE_TYPES`), `sizeBytes` (entero de 1 a `EVIDENCE_MAX_BYTES`) | `{ path, token, signedUrl }` |
| `GET /v1/evidence/read-url` | `admin`, `accounting`, `management` | query `{ paymentId }` | `{ url, expiresIn: 60 }` |

```ts
const uploadInput = z.object({
  payrollId: z.uuid(),
  workerId: z.uuid(),
  contentType: z.enum(Object.keys(EVIDENCE_TYPES) as [EvidenceContentType, ...EvidenceContentType[]], {
    message: 'Formato no permitido: usa JPG, PNG, WebP o PDF',
  }),
  sizeBytes: z.number().int().min(1).max(EVIDENCE_MAX_BYTES, { message: 'El archivo no puede pasar de 5 MB' }),
})
```

- `upload-url`: en una transacción, `findOpenPayroll(tx, payrollId, 'share')` y `findPayrollMember`; fuera de ella, `path = evidencePath(payrollId, workerId, randomUUID(), contentType)` (`randomUUID` de `node:crypto`) y `evidence.createUploadUrl(path)`. No escribe en la base ni audita: el pago es el que queda registrado.
- `read-url`: lee el pago (404 `notFound('El pago')`); sin `evidencePath` → 404 `not_found`, `'El pago no tiene evidencia'`; responde `{ url: (await evidence.createReadUrl(path, 60)).signedUrl, expiresIn: 60 }`.
- Si el almacenamiento falla, la implementación lanza `new ApiError(502, 'storage_error', 'No se pudo preparar la evidencia; inténtalo de nuevo')`.

**Implementación con Supabase** (`backend/src/storage/evidence.ts`)

```ts
import { createClient } from '@supabase/supabase-js'
import { ApiError } from '../lib/errors'
import type { EvidenceStorage } from '../types'

const failed = () => new ApiError(502, 'storage_error', 'No se pudo preparar la evidencia; inténtalo de nuevo')

// The private bucket of payment evidence. The backend never handles the file: it only signs short-lived URLs.
export function createSupabaseEvidenceStorage(supabaseUrl: string, secretKey: string, bucket: string): EvidenceStorage {
  const storage = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from(bucket)
  return {
    async createUploadUrl(path) {
      const { data, error } = await storage.createSignedUploadUrl(path)
      if (error || !data) {
        console.error('Evidence upload URL failed:', error?.message)
        throw failed()
      }
      return { signedUrl: data.signedUrl, token: data.token }
    },
    async createReadUrl(path, expiresInSeconds) {
      const { data, error } = await storage.createSignedUrl(path, expiresInSeconds)
      if (error || !data) {
        console.error('Evidence read URL failed:', error?.message)
        throw failed()
      }
      return { signedUrl: data.signedUrl }
    },
  }
}
```

Antes de escribirlo, confirmar los nombres y la forma de `createSignedUploadUrl` y `createSignedUrl` en los tipos instalados (`node_modules/@supabase/storage-js/dist/`): si difieren, se sigue lo instalado y se anota en el reporte.

`backend/src/env.ts`: agregar `EVIDENCE_BUCKET: z.string().min(1).default('payment-evidence')`. `backend/src/server.ts`: `evidence: createSupabaseEvidenceStorage(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, env.EVIDENCE_BUCKET)`. `backend/.env.example`: una línea `# Private bucket for payment evidence (created with npm run create-evidence-bucket).` y `EVIDENCE_BUCKET=payment-evidence`.

`backend/scripts/create-evidence-bucket.ts` (y el script `"create-evidence-bucket": "tsx --env-file=.env scripts/create-evidence-bucket.ts"` en `backend/package.json`):

```ts
import { createClient } from '@supabase/supabase-js'
import { readEnv } from '../src/env'
import { EVIDENCE_MAX_BYTES, EVIDENCE_TYPES } from '../src/payroll/evidence'

// Creates the private bucket of payment evidence, or updates its limits if it already exists.
const env = readEnv()
const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const options = { public: false, fileSizeLimit: EVIDENCE_MAX_BYTES, allowedMimeTypes: Object.keys(EVIDENCE_TYPES) }

const { data: existing } = await supabase.storage.getBucket(env.EVIDENCE_BUCKET)
const { error } = existing
  ? await supabase.storage.updateBucket(env.EVIDENCE_BUCKET, options)
  : await supabase.storage.createBucket(env.EVIDENCE_BUCKET, options)
if (error) {
  console.error(`Could not prepare the bucket "${env.EVIDENCE_BUCKET}": ${error.message}`)
  process.exit(1)
}
console.log(`Bucket "${env.EVIDENCE_BUCKET}" ${existing ? 'updated' : 'created'}: private, 5 MB, JPG/PNG/WebP/PDF.`)
```

El script no se ejecuta en este plan (necesita las credenciales del proyecto): se verifica con `typecheck`.

**Doble para las pruebas** (`backend/test/helpers.ts`): dentro de `createTestApp`, antes de `createApp`:

```ts
  const uploadUrls: string[] = []
  const readUrls: { path: string; seconds: number }[] = []
```

en las dependencias:

```ts
    evidence: {
      async createUploadUrl(path) {
        uploadUrls.push(path)
        return { signedUrl: `https://storage.test/upload/${path}?token=test-token`, token: 'test-token' }
      },
      async createReadUrl(path, seconds) {
        readUrls.push({ path, seconds })
        return { signedUrl: `https://storage.test/read/${path}` }
      },
    },
```

y `uploadUrls`, `readUrls` en el objeto que devuelve.

- [x] **Step 1: Escribir las pruebas (fallan)**

`backend/test/env.test.ts`: un caso nuevo: sin `EVIDENCE_BUCKET` el valor es `'payment-evidence'`; con `EVIDENCE_BUCKET: 'otro'` es `'otro'`.

`backend/test/payments.test.ts`. Preparación en `beforeAll`: área `Producción`; cargo `Operario` por hora; trabajadores temporales `w1`, `w2` y `w3` (`w3` fuera de la planilla); para `w1`, un método `yape` (`number: '987654321'`, `holderName: 'Rosa Quispe'`) y uno `bank_account` (`BCP`, con CCI); para `w2`, un método `plin`; planilla semanal del `2026-10-05` al `2026-10-11` con `w1` y `w2`. El reloj de las pruebas está en el lunes 5 de octubre de 2026, 08:00 de Lima.

Casos, uno por `it`:

1. `admin` registra un pago en efectivo de 5000 a `w1` con fecha `2026-10-05` → 201, `method` `'cash'`, `methodDetail` `null`, `evidencePath` `null`, y auditoría `create` de `payments`.
2. `accounting` puede pagar; `management` y `coordinator` reciben 403 en `POST` y `DELETE`; `coordinator` recibe 403 en `GET`; `management` puede listar.
3. Con `paymentMethodId` del Yape de `w1` y `method: 'yape'` → `methodDetail` es `'987654321 · Titular: Rosa Quispe'`, aunque el cuerpo mande otro `methodDetail`. Con el método `bank_account` y `method: 'transfer'` → el detalle incluye banco, CCI y titular.
4. `paymentMethodId` del Plin de `w2` en un pago a `w1` → 400 `invalid_reference` con `field` `'paymentMethodId'`. `paymentMethodId` del Yape de `w1` con `method: 'cash'` → 400 `validation` con `field` `'method'`.
5. Sin `paymentMethodId`, `method: 'yape'` y `methodDetail: 'Yape de su hermana 999888777'` → se guarda ese texto; `methodDetail: '   '` se guarda como `null`.
6. Fecha futura (`2026-10-06`) → 400 `validation` con `field` `'date'`. Fecha anterior al periodo (`2026-09-30`) → 201.
7. `amountCents` 0 o decimal → 400 `validation`. Pago a `w3` → 400 `not_in_payroll`. `payrollId` inexistente → 404.
8. Se puede pagar más que el total (el trabajador no tiene asistencia): dos pagos de 5000 se aceptan.
9. `POST /v1/evidence/upload-url` con `contentType: 'image/jpeg'` y `sizeBytes: 300000` → 200 con `path` que cumple `isEvidencePathOf(path, payrollId, w1)`, `token` y `signedUrl`, y `t.uploadUrls` contiene esa ruta.
10. `upload-url` con `contentType: 'image/gif'` → 400 `validation` con el mensaje de formato; con `sizeBytes` de 5 MB + 1 → 400 `validation` con el mensaje de tamaño; para `w3` → 400 `not_in_payroll`; `management` y `coordinator` → 403.
11. Un pago con el `evidencePath` recibido en el caso 9 → 201; un segundo pago con la misma ruta → 409 `duplicate` con `field` `'evidencePath'`; un pago a `w1` con una ruta de la carpeta de `w2` → 400 `validation` con `field` `'evidencePath'`.
12. `GET /v1/evidence/read-url?paymentId=` del pago con evidencia → `{ url, expiresIn: 60 }` y `t.readUrls` registra la ruta con 60 segundos; `management` puede leerla; `coordinator` → 403; un pago sin evidencia → 404 con `'El pago no tiene evidencia'`; un id inexistente → 404.
13. `GET /v1/payments?payrollId=` devuelve los pagos paginados con `workerFirstName`, `workerLastName` y `payrollName`, del más reciente al más antiguo; `?workerId=` solo los de ese trabajador; sin ninguno de los dos → 400 `validation`.
14. `DELETE` elimina y audita `delete`; un id inexistente → 404.
15. Quitar de la planilla a un trabajador con un pago → 409 `has_records`.

Run: `npx vitest run test/payments.test.ts test/env.test.ts` (desde `backend/`)
Expected: FAIL.

- [x] **Step 2: Tipos, entorno, doble de pruebas y almacenamiento**

`EvidenceStorage` y `evidence` en `Dependencies`; `EVIDENCE_BUCKET`; el doble en `test/helpers.ts`; `storage/evidence.ts`; `server.ts`; el script del bucket.

- [x] **Step 3: `routes/payments.ts` y `routes/evidence.ts`**

Según los contratos. Montar en `backend/src/app.ts`: `.route('/payments', paymentsRoutes(deps))` y `.route('/evidence', evidenceRoutes(deps))`.

- [x] **Step 4: Verificar**

Run: `npm test -w @agrosalas/backend`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

- [x] **Step 5: Commit**

```bash
git add backend/src backend/test backend/scripts backend/package.json backend/.env.example
git commit -m "feat(api): add payments with their evidence in a private bucket"
```

---

### Task 5: Saldos, totales de la lista, resumen, recibo e historial del trabajador

**Files:**
- Create: `backend/src/payroll/balance-service.ts`, `backend/src/routes/worker-history.ts`
- Modify: `backend/src/routes/payrolls.ts`, `backend/src/app.ts`, `backend/test/payrolls.test.ts`
- Test: `backend/test/balances.test.ts`

**Interfaces:**
- Consumes: `buildBalances`, `sumBalances`, `signedCents`, `WorkerBalance` (tarea 1); tablas de la tarea 2; rutas de conceptos y pagos (tareas 3 y 4) para preparar las pruebas; `monthRange`, `limaDate`; `redactMoney`; `findWorker`, `workerScope`.
- Produces:
  - `payrollBalances(db: Db | Tx, payrollId: string, workerIds?: string[]): Promise<WorkerBalance[]>` desde `payroll/balance-service.ts`: un saldo por trabajador de la planilla (o solo de los `workerIds` dados), en orden de apellido, nombre e id. La usa también la tarea 6 para el cierre.
  - En la lista de planillas: `totalCents` incluye los conceptos; campos nuevos `paidCents` y `pendingCents`.
  - Rutas nuevas del contrato de abajo.

**`payrollBalances`**: cuatro consultas y el módulo puro.

1. Miembros: `payroll_workers` unido a `workers`, filtrado por planilla (y por `workerIds` si llegan), ordenado por `lastName`, `firstName`, `id`.
2. Asistencia: `workerId` y `coalesce(sum(amount_cents), 0)` de `attendance_records` de la planilla, agrupado por trabajador.
3. Conceptos: `workerId`, `type` y la suma, agrupado por trabajador y tipo.
4. Pagos: `workerId` y la suma, agrupado por trabajador.

Las sumas se leen con ``sql<number>`coalesce(sum(${col}), 0)::bigint`.mapWith(Number)``, como en la lista de planillas. Devuelve `buildBalances(ids, attendance, items, payments)`.

**Contrato**

| Método y ruta | Roles | Respuesta |
|---|---|---|
| `GET /v1/payrolls` (cambia) | todos | cada fila gana `paidCents` y `pendingCents`; `totalCents` = asistencia + conceptos que suman − descuentos; `pendingCents` = `totalCents` − `paidCents`. Los tres en `null` para el coordinador |
| `GET /v1/payrolls/summary` | `admin`, `accounting`, `management` | `{ pendingCents, toPayCount, paidThisMonthCents }` |
| `GET /v1/payrolls/:id/balances` | `admin`, `accounting`, `management` | `{ items: WorkerBalance[], totals: BalanceTotals }`; planilla inexistente → 404 |
| `GET /v1/payrolls/:id/workers/:workerId` | `admin`, `accounting`, `management` | el detalle para el recibo (abajo) |
| `GET /v1/workers/:id/payrolls` | `admin`, `accounting`, `management` | paginada; cada fila: `payrollId`, `name`, `type`, `startDate`, `endDate`, `status`, `totalCents`, `paidCents`, `pendingCents` de ese trabajador en esa planilla. Orden: `startDate` descendente, luego `payrollId`. Trabajador inexistente → 404 |

- `GET /summary` se declara **antes** de `GET /:id` en la cadena: si no, `summary` se lee como un id y responde 400.
- Resumen, con `today = limaDate(now())` (la ruta recibe `now` de `Dependencies`):
  - `pendingCents`: suma, sobre las planillas abiertas, de (asistencia + conceptos con signo − pagos).
  - `toPayCount`: planillas abiertas con `endDate < today`.
  - `paidThisMonthCents`: suma de los pagos con `date` entre `monthRange(today).from` y `monthRange(today).to`, de cualquier planilla.
- En la lista, los tres montos salen de subconsultas correlacionadas (una por tabla), igual que el `totalCents` actual; el signo del concepto se resuelve en SQL con `case when type = 'deduction' then -amount_cents else amount_cents end`.
- Recibo (`GET /:id/workers/:workerId`, parámetros validados con el `memberIds` existente): 404 `notFound('La planilla')` si no existe; 404 `not_found` con `'El trabajador no está en la planilla'` si no es miembro. Responde:

```ts
{
  payroll: { id, name, type, startDate, endDate, status, campaignName },
  worker: { id, firstName, lastName, dni, employmentType, positionName }, // positionName: string | null
  records: AttendanceRecord[],   // de ese trabajador en esa planilla, por fecha
  items: PayrollItem[],          // por createdAt
  payments: Payment[],           // por date y createdAt, ascendente
  balance: WorkerBalance,
  paymentMethods: WorkerPaymentMethod[], // los del trabajador, por createdAt; la pantalla propone el principal
}
```

- Historial (`routes/worker-history.ts`, montado con `.route('/workers', workerHistoryRoutes(deps))` junto a `paymentMethodsRoutes`): `findWorker(db, user, id)` para el 404; las planillas donde el trabajador es miembro, paginadas con `pageSchema`; por cada planilla de la página, su saldo con `payrollBalances(db, payrollId, [id])`.

- [x] **Step 1: Escribir las pruebas (fallan)**

`backend/test/balances.test.ts`. Preparación en `beforeAll`: área `Producción`; cargo `Operario` por hora (6.25 / 7.8125); trabajadores temporales `w1` (apellido `Quispe`) y `w2` (apellido `Huamán`); coordinador con el área Producción. Planilla A semanal del `2026-10-05` al `2026-10-11` con `w1` y `w2`. Para `w1`, el lunes `2026-10-05`, las cuatro marcas con `POST /v1/attendance/clock` y `at` explícito: `12:10Z`, `18:00Z`, `19:00Z`, `23:30Z` (620 minutos → 6823 céntimos). Conceptos de `w1`: `bonus` 2000 y `deduction` 1000. Pago a `w1`: 5000 en efectivo con fecha `2026-10-05`. Pago a `w2`: 3000 con fecha `2026-10-05` (sin asistencia: pendiente −3000). Planilla B semanal del `2026-09-21` al `2026-09-27` (ya terminó) con `w1` y un `bonus` de 4000, sin pagos.

Casos:

1. `GET /:id/balances` de A → `items` en orden de apellido (`w2` Huamán, luego `w1` Quispe); el de `w1` es `{ attendanceCents: 6823, additionsCents: 2000, deductionsCents: 1000, totalCents: 7823, paidCents: 5000, pendingCents: 2823 }`; el de `w2` tiene `pendingCents: -3000`; `totals.totalCents` 7823, `totals.paidCents` 8000, `totals.pendingCents` −177.
2. `management` puede leer los saldos; `coordinator` → 403; planilla inexistente → 404.
3. La lista de planillas muestra para A `totalCents: 7823`, `paidCents: 8000`, `pendingCents: -177`, y para B `totalCents: 4000`, `paidCents: 0`, `pendingCents: 4000`; para el coordinador los tres son `null`.
4. `GET /summary` → `pendingCents` 3823 (−177 + 4000), `toPayCount` 1 (solo B terminó antes del 5 de octubre), `paidThisMonthCents` 8000. Tras `setNow(new Date('2026-11-02T13:00:00Z'))`: `toPayCount` 2 y `paidThisMonthCents` 0 (devolver el reloj a `2026-10-05T13:00:00Z` al final del caso).
5. `coordinator` → 403 en `/summary`; `management` puede leerlo.
6. Recibo de `w1` en A: `payroll.name`, `worker.positionName` `'Operario'`, un registro, dos conceptos, un pago, `balance.pendingCents` 2823 y `paymentMethods` como arreglo. `w1` en una planilla donde no está → 404; `coordinator` → 403.
7. Historial de `w1`: dos filas, A primero (empieza después), con sus tres montos; `pageSize=1` devuelve una fila y `total` 2; trabajador inexistente → 404; `coordinator` → 403.

En `backend/test/payrolls.test.ts`: si algún caso existente compara `totalCents` de la lista, sigue valiendo (sin conceptos el total no cambia); agregar a ese caso la comprobación de que `paidCents` es 0 y `pendingCents` es igual a `totalCents`.

Run: `npx vitest run test/balances.test.ts` (desde `backend/`)
Expected: FAIL.

- [x] **Step 2: `payroll/balance-service.ts`**

`payrollBalances` según la descripción de arriba.

- [x] **Step 3: Rutas**

Lista con los tres montos; `/summary` antes de `/:id`; `/:id/balances`; `/:id/workers/:workerId`; `routes/worker-history.ts` y su montaje. `payrollsRoutes` pasa a recibir `{ db, now }`.

- [x] **Step 4: Verificar**

Run: `npm test -w @agrosalas/backend`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: sin errores. El frontend lee `totalCents` de la lista: debe seguir compilando.

- [x] **Step 5: Commit**

```bash
git add backend/src backend/test
git commit -m "feat(api): add worker balances, payroll totals with items and payments, the summary and the receipt detail"
```

---

### Task 6: Cerrar y reabrir la planilla

**Files:**
- Modify: `backend/src/routes/payrolls.ts`
- Test: `backend/test/closing.test.ts`

**Interfaces:**
- Consumes: `payrollBalances` (tarea 5); bloqueo `FOR UPDATE` sobre `payrolls`; reloj `now`.
- Produces: `POST /v1/payrolls/:id/close` y `POST /v1/payrolls/:id/reopen`.

**Contrato**

| Método y ruta | Roles | Entrada | Respuesta |
|---|---|---|---|
| `POST /v1/payrolls/:id/close` | `admin`, `accounting` | body `closeInput`: `{ confirmPending?: boolean }` (un objeto, puede ir vacío) | la planilla, con `status: 'closed'`, `closedBy` y `closedAt` |
| `POST /v1/payrolls/:id/reopen` | `admin` | sin cuerpo | la planilla, con `status: 'open'`, `closedBy: null`, `closedAt: null` |

```ts
const closeInput = z.object({ confirmPending: z.boolean().optional() })
```

Reglas, en una transacción:

- Cerrar: la planilla se lee con `.for('update')` (no con `findOpenPayroll`, para distinguir los casos): inexistente → 404 `notFound('La planilla')`; ya cerrada → 409 `payroll_closed`, `'La planilla está cerrada'`. Se calculan los saldos con `payrollBalances(tx, id)`; si alguno tiene `pendingCents !== 0` y `confirmPending` no es `true` → 409 `pending_balances`, `'Hay trabajadores con saldo pendiente; confirma el cierre'`. Si pasa: `status: 'closed'`, `closedBy: user.id`, `closedAt: now()`; auditoría `update` de `payrolls` con el antes y el después.
- Reabrir: lectura con `.for('update')`; inexistente → 404; no cerrada → 409 `not_closed`, `'La planilla no está cerrada'`. Si pasa: `status: 'open'`, `closedBy: null`, `closedAt: null`; auditoría `update`.
- Una planilla cerrada rechaza con 409 `payroll_closed` toda escritura que pase por `findOpenPayroll`: marcar, carga en bloque, crear, editar y eliminar registros; editar la planilla; agregar y quitar trabajadores; crear, editar y eliminar conceptos; crear y eliminar pagos; pedir una URL de subida. Las lecturas siguen funcionando.

- [x] **Step 1: Escribir las pruebas (fallan)**

`backend/test/closing.test.ts`. Preparación: área, cargo por hora, trabajadores temporales `w1` y `w2`; coordinador con el área; planilla semanal del `2026-10-05` al `2026-10-11` con `w1`; para `w1`, un registro de asistencia completo el lunes (6823 céntimos), un `bonus` de 2000 (`itemId`) y un pago en efectivo de 5000 (`paymentId`).

Casos, en este orden (comparten estado):

1. `management` y `coordinator` → 403 en `close`; `accounting`, `management` y `coordinator` → 403 en `reopen`.
2. `close` con `{}` y pendiente distinto de 0 (3823) → 409 `pending_balances`; la planilla sigue `open`.
3. `reopen` de una planilla abierta → 409 `not_closed`.
4. `close` con `{ confirmPending: true }` por `accounting` → 200, `status` `'closed'`, `closedBy` del usuario de contabilidad, `closedAt` igual al reloj de la prueba, y una fila de auditoría `update` de `payrolls` cuyo `after.status` es `'closed'`.
5. Cerrar de nuevo → 409 `payroll_closed`.
6. La planilla cerrada rechaza con 409 `payroll_closed` cada una de estas escrituras (un `it.each`): `POST /v1/attendance/clock`, `POST /v1/attendance` (registro nuevo el martes), `PATCH /v1/attendance/:record`, `DELETE /v1/attendance/:record`, `PATCH /v1/payrolls/:id`, `POST /v1/payrolls/:id/workers` (con `w2`), `DELETE /v1/payrolls/:id/workers/:w1`, `POST /v1/payroll-items`, `PATCH /v1/payroll-items/:item`, `DELETE /v1/payroll-items/:item`, `POST /v1/payments`, `DELETE /v1/payments/:payment`, `POST /v1/evidence/upload-url`. `POST /v1/attendance/bulk` responde 200 con el resultado del trabajador en `ok: false` y `code: 'payroll_closed'`.
7. Las lecturas de la planilla cerrada siguen respondiendo 200: `GET /v1/payrolls/:id`, `/balances`, `/workers/:w1`, `GET /v1/attendance?payrollId=&date=`, `GET /v1/payroll-items?payrollId=`, `GET /v1/payments?payrollId=`.
8. `admin` reabre → 200, `status` `'open'`, `closedBy` y `closedAt` en `null`, con su auditoría; después, un pago nuevo se acepta (201).
9. Con el pendiente en 0 (se registra un pago por el saldo exacto que devuelve `/balances`), `close` con `{}` cierra sin pedir confirmación.
10. Planilla inexistente → 404 en `close` y en `reopen`.

Run: `npx vitest run test/closing.test.ts` (desde `backend/`)
Expected: FAIL, las rutas no existen.

- [x] **Step 2: Implementar `close` y `reopen` en `routes/payrolls.ts`**

Según el contrato.

- [x] **Step 3: Verificar**

Run: `npm test -w @agrosalas/backend`
Expected: PASS.

Run: `npm run lint && npm run typecheck`
Expected: sin errores.

- [x] **Step 4: Commit**

```bash
git add backend/src/routes/payrolls.ts backend/test/closing.test.ts
git commit -m "feat(api): close and reopen payrolls, with confirmation when balances are pending"
```

---

### Task 7: Matriz de permisos, documentación y verificación

**Files:**
- Modify: `backend/test/permissions.test.ts`, `README.md`, `docs/superpowers/specs/2026-10-01-planilla-design.md`, este plan.

**Interfaces:**
- Consumes: todas las rutas de las tareas 3 a 6.
- Produces: el repo listo para el PR.

- [x] **Step 1: Ampliar la matriz de roles**

En `backend/test/permissions.test.ts`, el `beforeAll` crea además, en la planilla existente y para el trabajador temporal: un concepto `bonus` de 2000 (`itemId`) y un pago en efectivo de 1000 con fecha `RECORD_DATE` (`paymentId`); `path` reemplaza también `:item` y `:payment`.

Casos nuevos en la matriz (cada combinación prohibida debe responder 403 `forbidden`):

| Ruta | Roles prohibidos |
|---|---|
| `GET /v1/payroll-items?payrollId=:payroll` | `coordinator` |
| `POST /v1/payroll-items` | `management`, `coordinator` |
| `PATCH /v1/payroll-items/:item` | `management`, `coordinator` |
| `DELETE /v1/payroll-items/:item` | `management`, `coordinator` |
| `GET /v1/payments?payrollId=:payroll` | `coordinator` |
| `POST /v1/payments` | `management`, `coordinator` |
| `DELETE /v1/payments/:payment` | `management`, `coordinator` |
| `POST /v1/evidence/upload-url` | `management`, `coordinator` |
| `GET /v1/evidence/read-url?paymentId=:payment` | `coordinator` |
| `GET /v1/payrolls/summary` | `coordinator` |
| `GET /v1/payrolls/:payroll/balances` | `coordinator` |
| `GET /v1/payrolls/:payroll/workers/:worker` | `coordinator` |
| `GET /v1/workers/:worker/payrolls` | `coordinator` |
| `POST /v1/payrolls/:payroll/close` | `management`, `coordinator` |
| `POST /v1/payrolls/:payroll/reopen` | `management`, `accounting`, `coordinator` |

Los casos de `DELETE`, `close` y `reopen` van al final de la matriz o usan filas propias, para que una eliminación permitida a otro rol no deje sin datos a los casos siguientes (la matriz solo ejerce a los roles prohibidos, que no modifican nada).

Run: `npx vitest run test/permissions.test.ts` (desde `backend/`)
Expected: PASS. Si algún caso responde otra cosa que 403, es un defecto de la tarea que hizo esa ruta: se corrige ahí.

- [x] **Step 2: Ampliar el barrido del coordinador**

A `NULLABLE_MONEY_KEYS` se agregan `paidCents` y `pendingCents`. El barrido sigue recorriendo las rutas `GET` que el coordinador sí alcanza (la lista y el detalle de planillas y la lista del día): ahora la lista trae además `paidCents` y `pendingCents`, que deben llegar en `null`. La prueba de control con `admin` comprueba que `admin` recibe en la lista `totalCents`, `paidCents` (1000) y `pendingCents` con número.

Run: `npx vitest run test/permissions.test.ts` (desde `backend/`)
Expected: PASS.

- [x] **Step 3: Documentación**

- `README.md`: en la sección de puesta en marcha, la variable `EVIDENCE_BUCKET` y el paso `npm run create-evidence-bucket -w @agrosalas/backend` (una vez por proyecto de Supabase, después de las migraciones); en "Reglas", una línea: `El saldo de cada trabajador se calcula en backend/src/payroll/balance.ts: asistencia + conceptos que suman − descuentos − pagos.`
- Spec, sección 5: en `payroll_items`, que `amount_cents` es siempre positivo y el tipo da el signo, que hay un solo `salary` por trabajador y planilla, y que conceptos, pagos y asistencias solo existen para trabajadores de la planilla; en `payments`, que un archivo de evidencia pertenece a un solo pago y que `method_detail` es un texto.
- Spec, sección 7: en "Cierre", el código `pending_balances` y `confirmPending`; una línea con la definición de las tres cifras del resumen (decisión 15); que el sueldo automático sale del sueldo mensual del cargo y no se crea si el cargo no lo tiene.
- Spec, sección 8: la ruta del archivo, que la URL de lectura dura 60 segundos, que la fecha de un pago no puede ser futura y que al eliminar un pago su archivo se conserva.
- Spec, sección 9: las filas de `/payrolls` (resumen, saldos, cerrar, reabrir), `/payrolls/:id/workers/:workerId`, `/payroll-items`, `/payments`, `/evidence` y una fila nueva `/workers/:id/payrolls`, con sus operaciones reales.
- Spec, sección 17: los códigos de error nuevos `pending_balances` (409), `not_closed` (409) y `storage_error` (502), y que `has_records` cubre también conceptos y pagos; en variables de entorno, `EVIDENCE_BUCKET`; en scripts, `create-evidence-bucket`.
- Este plan: sección "Estado de ejecución" con fecha, commits, total de pruebas por tarea y lo que difirió del texto; y "Pendiente para el plan 3B".

- [x] **Step 4: Verificación final**

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

Expected: todo en verde. El frontend no cambia: sus 234 pruebas siguen igual. Anotar el total de pruebas del backend.

- [x] **Step 5: Commit**

```bash
git add backend/test/permissions.test.ts README.md docs
git commit -m "test(api): cover items, payments, evidence and closing in the role matrix and the coordinator sweep"
```

---

## Fuera de este plan

- Pantallas: pestaña Pagos, conceptos, cierre y reapertura, recibo imprimible, columnas Pagado y Pendiente, cifras del resumen, historial en la ficha del trabajador, subida de la evidencia con compresión de imágenes, y ocultar los controles de edición en una planilla cerrada: plan 3B.
- Aplicar la migración `0002` y crear el bucket en el proyecto Supabase de desarrollo: se hace al fusionar, con `npm run db:migrate -w @agrosalas/backend` y `npm run create-evidence-bucket -w @agrosalas/backend`.
- Comprobar en el servidor que el archivo de evidencia realmente se subió antes de aceptar el pago, y limpiar archivos subidos que nunca se asociaron a un pago.
- Reportes y exportación a Excel: fase 4. Migración del Excel: fase 5 (los registros importados no se deben recalcular al editarlos).
