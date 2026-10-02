# Planilla fase 3B: pantallas de pagos, conceptos, cierre y recibo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar al panel la API de la fase 3: columnas Pagado y Pendiente y las tres cifras del resumen en la lista de planillas; pestaña Pagos en la planilla (saldos, conceptos, pagos con evidencia); cerrar y reabrir; planilla cerrada en solo lectura; recibo imprimible; historial de planillas y pagos en la ficha del trabajador.

**Architecture:** Igual que el plan 2B: el frontend solo habla con la API por el cliente tipado (`unwrap(api.v1…)`), la lógica sin pantalla vive en módulos puros de `frontend/src/lib/` con pruebas de Vitest, y los componentes se verifican con lint, typecheck, build y el recorrido en el navegador del controlador. La evidencia se sube en tres pasos: la API firma una URL, el navegador sube el archivo con `PUT` a esa URL (las imágenes se comprimen antes en un `canvas`) y el pago se registra con la ruta devuelta.

**Tech Stack:** el del plan 2B (Next.js 16 App Router, React 19, Tailwind 4, shadcn/ui sobre Base UI, TanStack Query 5, cliente de Hono, sonner). No se agrega ninguna dependencia.

**Spec:** `docs/superpowers/specs/2026-10-01-planilla-design.md`, secciones 4 (permisos), 7 (planillas: total, pendiente, cierre), 8 (pagos y evidencia, recibo), 10 (pantallas 3, 4, 5 y 6), 14 (pruebas) y 17 (nombres). API: plan `docs/superpowers/plans/2026-10-02-planilla-fase-3a-payments-api.md` (contratos de cada ruta y su "Pendiente para el plan 3B").

**Rama:** `feat/phase-3b-payments-screens`, creada sobre `feat/phase-3a-payments-api` (`dba9250`): este plan importa el tipo `AppType` de la API de la fase 3, que todavía no está en `master`.

## Decisiones tomadas

Se pueden cambiar antes de fusionar.

1. **Pestaña Pagos** entre Asistencia y Trabajadores. La ven administración, contabilidad y gerencia; el coordinador no (la API le responde 403). Gerencia la ve en solo lectura.
2. **Montos en soles.** Se escriben como `68.23` o `68,23`, hasta dos decimales y hasta 999 999.99. Se envían en céntimos.
3. **Monto propuesto al pagar:** el pendiente del trabajador si es positivo; vacío si es 0 o negativo (saldo a favor de la empresa).
4. **Medio de pago:** primero los métodos registrados del trabajador (el principal arriba y elegido por defecto), luego "Efectivo", luego "Otro Yape", "Otro Plin" y "Otra transferencia" con un texto libre ("Número y titular"). Sin métodos registrados, el elegido por defecto es "Efectivo".
5. **Evidencia opcional.** JPG, PNG, WebP o PDF de hasta 5 MB. Las imágenes se reducen en el navegador a 1600 px por el lado mayor y se guardan como JPEG de calidad 0.8, salvo que el resultado pese más que el original. El PDF se sube tal cual.
6. **Un pago no se envía dos veces:** mientras se registra, el botón queda deshabilitado y el diálogo no se puede cerrar (la API no detecta duplicados; decisión del plan 3A).
7. **Cerrar** abre un diálogo con la lista de trabajadores con pendiente distinto de 0 y los avisos de registros por revisar y de tramos abiertos. Si la lista no está vacía, el cierre se envía con `confirmPending: true`. Si la API responde `pending_balances` (los saldos cambiaron mientras tanto), el diálogo recarga los saldos y lo dice.
8. **Planilla cerrada en solo lectura:** se ocultan Editar, Agregar y Quitar trabajadores, Pagar, los conceptos y eliminar pagos; las celdas de la grilla abren el registro en solo lectura. El administrador ve "Reabrir".
9. **Recibo** en `/payrolls/[id]/receipt/[workerId]`: una página del panel que se imprime o se guarda como PDF desde el navegador; al imprimir se ocultan el menú y los botones.
10. **Grilla:** la columna Total pasa a mostrar el total del trabajador con conceptos (el de `/balances`), y se agregan Pagado y Pendiente para los roles que ven dinero. Los totales por día siguen siendo solo de asistencia (los conceptos no tienen día).
11. **Ficha del trabajador:** dos secciones nuevas para los roles que ven dinero: "Planillas" (total, pagado y pendiente en cada una) y "Pagos" (de todas las planillas).
12. **Pruebas:** como en el plan 2B, sin pruebas de componentes con DOM; lógica en módulos puros con pruebas, y recorrido en el navegador del controlador.
13. **Base de desarrollo:** para el recorrido en el navegador el controlador aplica la migración `0002` y crea el bucket en el proyecto de desarrollo antes de la tarea 7 (la consulta previa del plan 3A ya dio cuatro ceros).

## Estado de ejecución

Ejecutado el 2026-10-02 en la rama `feat/phase-3b-payments-screens`, en un worktree aparte, apilada sobre `feat/phase-3a-payments-api` (`dba9250`). Las siete tareas están hechas y todos sus pasos marcados.

Commits (`git log --oneline --reverse dba9250..HEAD`; el último es el de la tarea 7):

- `6520fe8` docs(planilla): add the phase 3B plan (payments, items, closing and receipt screens)
- `3b8e834` feat(web): add money, payment, evidence, closing and receipt helpers
- `13e4f71` feat(web): show paid and pending amounts and the summary in the payroll list
- `b0a15e2` feat(web): add the payments tab with balances, payroll items and payments
- `589533f` feat(web): record a payment with its evidence, compressing photos before the upload
- `0d5f1b2` feat(web): close and reopen a payroll and keep a closed one read-only
- `6d25f71` feat(web): add the printable receipt and the payroll and payment history of a worker
- el commit siguiente: docs(planilla): record the execution of plan 3B (con el spec y esta sección)

Pruebas del frontend, en total, al terminar cada tarea:

| Después de | Pruebas |
|---|---|
| Inicio | 234 |
| Tareas 1 y 2 | 257 |
| Tarea 3 | 266 |
| Tarea 4 | 267 |
| Tarea 5 | 268 |
| Tarea 6 | 268 |

Las del backend siguen en 409 (no cambia en este plan). Cada tarea pasó revisión de especificación y de calidad, sin hallazgos críticos ni importantes. Verificación final desde la raíz: ver "Resultado de la verificación final" más abajo.

Lo que difirió del texto del plan:

- Las tareas 1 y 2 se despacharon juntas.
- Las claves de las consultas de pagos y del historial del trabajador llevan también el tamaño de página (`['payments', { payrollId }, paging]`), porque el paginador deja cambiarlo.
- Se agregaron: el título "Saldos"; los avisos "Pago eliminado" y el de la ventana bloqueada al pulsar "Ver"; `isEvidenceType` y `EvidenceType` en `lib/evidence.ts` (el cliente tipado pide la unión de los cuatro tipos); el botón de pago deshabilitado mientras se reduce una foto o cargan los métodos del trabajador, con el texto "Preparando el archivo…"; una alerta bajo "Medio" si los métodos no cargan; `invalidateClosing` (cerrar y reabrir también refrescan `['attendance']` y `['workers']`); el flujo de "Ver" se movió al hook `lib/evidence-viewer.ts`, que comparten la pestaña Pagos y la ficha del trabajador.
- Toda imagen que el navegador pueda leer se vuelve a codificar como JPEG antes de comprobar el tipo, así que un GIF puede pasar si su JPEG pesa menos (punto abierto, ver "Pendiente").
- Base de desarrollo: antes del recorrido, el controlador aplicó la migración `0002` y creó el bucket `payment-evidence` en el proyecto de desarrollo.

Recorrido en el navegador (controlador, 2026-10-02, sesión de administrador, base de desarrollo, a 375 px y en escritorio):

- Lista de planillas: las tres cifras de arriba y las columnas Total, Pagado y Pendiente.
- Pestaña Pagos sin desborde horizontal a 375 px.
- Concepto Bono de S/ 20.00 a una trabajadora: el saldo quedó en 84.58.
- Pago por Yape de S/ 30.00 con una foto PNG de 3.3 MB, reducida a un JPEG de 333 KB; el `PUT` a la URL firmada funcionó y el archivo quedó en el bucket, enlazado al pago.
- "Ver": el navegador de pruebas bloquea las ventanas emergentes y se mostró el aviso; con la ventana simulada, la URL firmada devolvió la imagen.
- Pago en efectivo y su eliminación.
- Cierre con un pendiente (lista y aviso de 5 días con un tramo sin salida), planilla cerrada en solo lectura y reapertura.
- Recibo con días, conceptos, pagos y resumen que cuadran; el menú se oculta al imprimir (clases `print`).
- Historial de planillas y pagos en la ficha del trabajador.
- Sin errores en la consola.
- No se probó: las vistas de gerencia y de coordinador (no hay usuarios con esos roles en la base de desarrollo), la vista de impresión real del navegador ni el 409 `pending_balances` real.

Resultado de la verificación final: `npm run lint && npm run typecheck && npm test && npm run build` desde la raíz, todo en verde: backend 409 pruebas, frontend 268, y la compilación incluye las rutas `/payrolls/[id]` y `/payrolls/[id]/receipt/[workerId]`.

Pendiente (hallazgos menores de las revisiones de cada tarea, sin corregir; la revisión final de la rama decide cuáles se corrigen antes de fusionar):

- Un GIF pasa o no según si su JPEG pesa menos: hay que definir una regla.
- Si la respuesta de un pago se pierde después de guardarse, reintentar lo duplica (la API no tiene idempotencia); al reintentar se sube el archivo otra vez y el anterior queda huérfano.
- Cancelar el selector de archivo mientras se reduce una foto deja el botón deshabilitado.
- El monto propuesto no se completa si los saldos llegan después de abrir el diálogo de pago.
- La lista del diálogo de cierre puede tener hasta 30 s de antigüedad; un 409 `payroll_closed` o `not_closed` no recarga la planilla; "Reabrir" reaparece un instante tras reabrir.
- Con la ventana emergente bloqueada igual se pide la URL firmada.
- Código repetido (`PENDING_CLASS`, `h-11`, los esqueletos de tablas) y `payments-tab.tsx` crece.
- Sin pruebas de componentes (decisión 12): el diálogo de pago, el de cierre y `useEvidenceViewer` solo se verificaron leyendo el código y en el navegador.

## Global Constraints

- Todo nombre de código, archivo, carpeta, clave de consulta y prueba va en inglés; todo texto que lee una persona, en español y exactamente como lo da la tarea. Ningún valor del contrato se muestra tal cual: pasa por un mapa de etiquetas (`ITEM_TYPE_LABEL`, `PAYMENT_MEDIUM_LABEL`, etc.).
- El frontend solo habla con la API, siempre con `unwrap(api.v1…)`. Los tipos de respuesta se toman del cliente con `ResponseBody<typeof api.v1.…>`; no se escriben tipos de la API a mano ni se fuerzan cuerpos con `as never` o `as any`.
- El dinero se oculta por rol (`seesMoney(me.role)` de `lib/payroll-view.ts`), nunca mirando si un valor es `null`. El coordinador no ve montos, ni la pestaña Pagos, ni el resumen, ni el recibo, ni el historial de pagos.
- Gerencia solo lee: ve montos y pagos, pero ningún botón que escriba. Escriben conceptos y pagos, y cierran: administración y contabilidad. Reabre: administración.
- Una planilla cerrada no muestra ningún control que escriba (decisión 8).
- Todo control de formulario tiene etiqueta. Nada ensancha la página más allá de 375 px: las tablas anchas se desplazan dentro de su contenedor. Los botones táctiles miden al menos 44 px de alto en el celular.
- Toda escritura de dinero invalida `['payrolls']` (lista, detalle, saldos, resumen y recibo comparten ese prefijo), `['payroll-items']`, `['payments']` y `['workers']`.
- Las fechas de hoy son las de Lima (`limaDate(new Date())`), nunca las del dispositivo.
- Next.js 16 tiene cambios: antes de usar una convención de Next se lee su guía en `node_modules/next/dist/docs/`. `useSearchParams` necesita un `Suspense` encima.
- No se toca `frontend/src/components/ui/` salvo para agregar un componente nuevo. No se toca `backend/`.
- El número de pruebas no baja: el frontend parte de 234 y el backend de 409.
- Rama `feat/phase-3b-payments-screens`; Conventional Commits con scope (`feat(web): …`). No se versiona `.env.local`. No se hace `git push` sin que Gonzalo lo pida.

## Mapa de archivos

Rutas relativas a `frontend/src/`.

| Archivo | Responsabilidad |
|---|---|
| `lib/money.ts` (nuevo) | Montos escritos en soles ↔ céntimos, monto propuesto, texto del pendiente |
| `lib/payments.ts` (nuevo) | Etiquetas de conceptos y medios, opciones de pago a partir de los métodos del trabajador, cuerpo del pago |
| `lib/evidence.ts` (nuevo) | Formatos, tamaño máximo, problema de un archivo, tamaño reducido de una imagen |
| `lib/compress-image.ts` (nuevo) | Reducción de una imagen en el navegador (usa `canvas`; sin pruebas) |
| `lib/closing.ts` (nuevo) | Lo que el diálogo de cierre muestra: pendientes, registros por revisar, tramos abiertos |
| `lib/receipt.ts` (nuevo) | Líneas del recibo por día |
| `lib/payroll-detail.ts` | La pestaña `payments` |
| `app/(panel)/payrolls/page.tsx` | Columnas Pagado y Pendiente; tres cifras arriba |
| `app/(panel)/payrolls/[id]/page.tsx` | Tercera pestaña, cerrar, reabrir, solo lectura en planilla cerrada |
| `components/payrolls/attendance-grid.tsx` | Total con conceptos, Pagado y Pendiente |
| `components/payrolls/payments-tab.tsx` (nuevo) | Saldos, conceptos y pagos de la planilla |
| `components/payrolls/item-dialog.tsx` (nuevo) | Agregar y editar un concepto |
| `components/payrolls/payment-dialog.tsx` (nuevo) | Registrar un pago con su evidencia |
| `components/payrolls/close-dialog.tsx` (nuevo) | Cerrar la planilla |
| `app/(panel)/payrolls/[id]/receipt/[workerId]/page.tsx` (nuevo) | Recibo imprimible |
| `components/workers/worker-payrolls.tsx`, `components/workers/worker-payments.tsx` (nuevos) | Historial en la ficha |
| `app/(panel)/workers/[id]/page.tsx`, `app/(panel)/layout.tsx`, `components/panel/menu.tsx` | Secciones nuevas; menú oculto al imprimir |
| `lib/*.test.ts` | Pruebas de los módulos puros |

---

### Task 1: Módulos puros de dinero, pagos, evidencia, cierre y recibo

**Files:**
- Create: `frontend/src/lib/money.ts`, `frontend/src/lib/payments.ts`, `frontend/src/lib/evidence.ts`, `frontend/src/lib/closing.ts`, `frontend/src/lib/receipt.ts`
- Test: `frontend/src/lib/money.test.ts`, `frontend/src/lib/payments.test.ts`, `frontend/src/lib/evidence.test.ts`, `frontend/src/lib/closing.test.ts`, `frontend/src/lib/receipt.test.ts`

**Interfaces:**
- Consumes: `formatCents` (`lib/format.ts`), `hasOpenStretch`, `formatHours`, `ATTENDANCE_TYPE_LABEL`, `AttendanceType` (`lib/attendance.ts`), `limaTime` (`lib/lima-time.ts`).
- Produces: el código de abajo, con estos nombres exactos.

- [x] **Step 1: Escribir las pruebas (fallan)**

`frontend/src/lib/money.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { centsToInput, parseSolesToCents, pendingText, proposedPaymentCents } from './money'

describe('parseSolesToCents', () => {
  it('reads soles with a point or a comma and up to two decimals', () => {
    expect(parseSolesToCents('68.23')).toBe(6823)
    expect(parseSolesToCents('68,23')).toBe(6823)
    expect(parseSolesToCents('68.5')).toBe(6850)
    expect(parseSolesToCents('68')).toBe(6800)
    expect(parseSolesToCents(' 1200.05 ')).toBe(120005)
    expect(parseSolesToCents('999999.99')).toBe(99999999)
  })

  it('rejects anything else', () => {
    for (const text of ['', ' ', 'abc', '-5', '1.234', '1.2.3', '1000000', '68.', '.50', '1,000.50', 'S/ 10']) {
      expect(parseSolesToCents(text)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('writes cents as soles for an input', () => {
    expect(centsToInput(6823)).toBe('68.23')
    expect(centsToInput(6800)).toBe('68.00')
    expect(centsToInput(5)).toBe('0.05')
  })
})

describe('proposedPaymentCents', () => {
  it('proposes the pending amount, never a negative one', () => {
    expect(proposedPaymentCents(2823)).toBe(2823)
    expect(proposedPaymentCents(0)).toBe(0)
    expect(proposedPaymentCents(-1000)).toBe(0)
  })
})

describe('pendingText', () => {
  it('says when the balance is in favour of the company', () => {
    expect(pendingText(2823)).toBe('S/ 28.23')
    expect(pendingText(0)).toBe('S/ 0.00')
    expect(pendingText(-1000)).toBe('S/ 10.00 a favor')
  })
})
```

`frontend/src/lib/payments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, defaultPayOption, payOptions, paymentBody, signedItemCents } from './payments'

const yape = { id: 'm1', type: 'yape' as const, number: '987654321', bank: null, holderName: 'Rosa Quispe', isPrimary: false }
const bank = { id: 'm2', type: 'bank_account' as const, number: '19412345678901', bank: 'BCP', holderName: 'Rosa Quispe', isPrimary: true }

describe('labels', () => {
  it('names every item type and medium in Spanish', () => {
    expect(ITEM_TYPE_LABEL).toEqual({ salary: 'Sueldo', bonus: 'Bono', piecework: 'Destajo', deduction: 'Descuento' })
    expect(PAYMENT_MEDIUM_LABEL).toEqual({ yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', cash: 'Efectivo' })
  })

  it('subtracts a deduction', () => {
    expect(signedItemCents('bonus', 2000)).toBe(2000)
    expect(signedItemCents('deduction', 1000)).toBe(-1000)
  })
})

describe('payOptions', () => {
  it('puts the primary method first, then the others, cash and the unregistered ones', () => {
    const options = payOptions([yape, bank])
    expect(options.map((o) => o.key)).toEqual(['method:m2', 'method:m1', 'cash', 'other:yape', 'other:plin', 'other:transfer'])
    expect(options[0]).toEqual({ key: 'method:m2', label: 'BCP 19412345678901 · Rosa Quispe', medium: 'transfer', paymentMethodId: 'm2', needsDetail: false })
    expect(options[1].label).toBe('Yape 987654321 · Rosa Quispe')
    expect(options[2]).toEqual({ key: 'cash', label: 'Efectivo', medium: 'cash', needsDetail: false })
    expect(options[3]).toEqual({ key: 'other:yape', label: 'Otro Yape', medium: 'yape', needsDetail: true })
    expect(options[5].label).toBe('Otra transferencia')
  })

  it('chooses the first option: the primary method, or cash when the worker has none', () => {
    expect(defaultPayOption(payOptions([yape, bank]))).toBe('method:m2')
    expect(defaultPayOption(payOptions([]))).toBe('cash')
  })
})

describe('paymentBody', () => {
  const base = { payrollId: 'p1', workerId: 'w1', date: '2026-10-05', amountCents: 6823, evidencePath: null, note: '  ' }

  it('sends a registered method by its id and no detail', () => {
    const option = payOptions([bank])[0]
    expect(paymentBody({ ...base, option, detail: 'ignored' })).toEqual({
      payrollId: 'p1', workerId: 'w1', date: '2026-10-05', amountCents: 6823, method: 'transfer', paymentMethodId: 'm2',
      methodDetail: null, evidencePath: null, note: null,
    })
  })

  it('sends the typed detail of an unregistered method, and null when it is blank', () => {
    const option = payOptions([]).find((o) => o.key === 'other:yape')!
    expect(paymentBody({ ...base, option, detail: ' 999888777 hermana ' }).methodDetail).toBe('999888777 hermana')
    expect(paymentBody({ ...base, option, detail: ' ' }).methodDetail).toBeNull()
  })

  it('sends cash without method id, the evidence path and a trimmed note', () => {
    const option = payOptions([]).find((o) => o.key === 'cash')!
    const body = paymentBody({ ...base, option, detail: '', evidencePath: 'payrolls/p1/w1/f.jpg', note: ' adelanto ' })
    expect(body).toEqual({ ...base, method: 'cash', methodDetail: null, evidencePath: 'payrolls/p1/w1/f.jpg', note: 'adelanto' })
    expect('paymentMethodId' in body).toBe(false)
  })
})
```

`frontend/src/lib/evidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { EVIDENCE_ACCEPT, EVIDENCE_MAX_BYTES, evidenceProblem, isImage, scaledSize } from './evidence'

describe('evidenceProblem', () => {
  it('accepts JPG, PNG, WebP and PDF up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(evidenceProblem({ type, size: 1000 })).toBeNull()
    }
    expect(evidenceProblem({ type: 'image/jpeg', size: EVIDENCE_MAX_BYTES })).toBeNull()
  })

  it('names what is wrong', () => {
    expect(evidenceProblem({ type: 'image/gif', size: 1000 })).toBe('Formato no permitido: usa JPG, PNG, WebP o PDF')
    expect(evidenceProblem({ type: 'image/jpeg', size: EVIDENCE_MAX_BYTES + 1 })).toBe('El archivo no puede pasar de 5 MB')
    expect(evidenceProblem({ type: 'application/pdf', size: 0 })).toBe('El archivo está vacío')
  })

  it('lists the accepted types for the file input', () => {
    expect(EVIDENCE_ACCEPT).toBe('image/jpeg,image/png,image/webp,application/pdf')
    expect(isImage('image/png')).toBe(true)
    expect(isImage('application/pdf')).toBe(false)
  })
})

describe('scaledSize', () => {
  it('keeps the proportions with the longest side at 1600 px at most', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(scaledSize(1000, 3333)).toEqual({ width: 480, height: 1600 })
  })

  it('never enlarges an image', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
```

`frontend/src/lib/closing.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { closingCheck } from './closing'

const marks = (c1: string | null, o1: string | null, c2: string | null = null, o2: string | null = null) => ({
  clockIn1: c1, clockOut1: o1, clockIn2: c2, clockOut2: o2,
})

describe('closingCheck', () => {
  it('lists the workers whose pending amount is not zero, in the order of the balances', () => {
    const check = closingCheck(
      [{ workerId: 'w2', pendingCents: -3000 }, { workerId: 'w1', pendingCents: 0 }, { workerId: 'w3', pendingCents: 2823 }],
      [],
    )
    expect(check.pending).toEqual([{ workerId: 'w2', pendingCents: -3000 }, { workerId: 'w3', pendingCents: 2823 }])
  })

  it('counts the records flagged for review and the worked days with a stretch still open', () => {
    const check = closingCheck(
      [],
      [
        { type: 'worked' as const, needsReview: true, ...marks('a', 'b') },
        { type: 'worked' as const, needsReview: false, ...marks('a', null) },
        { type: 'worked' as const, needsReview: true, ...marks('a', 'b', 'c', null) },
        { type: 'absence' as const, needsReview: false, ...marks(null, null) },
      ],
    )
    expect(check.needsReview).toBe(2)
    expect(check.openStretches).toBe(2)
  })

  it('is empty when everything is settled', () => {
    expect(closingCheck([{ workerId: 'w1', pendingCents: 0 }], [])).toEqual({ pending: [], needsReview: 0, openStretches: 0 })
  })
})
```

`frontend/src/lib/receipt.test.ts` (las marcas son instantes UTC; Lima es UTC−5):

```ts
import { describe, expect, it } from 'vitest'
import { receiptDays } from './receipt'

const worked = {
  date: '2026-10-05',
  type: 'worked' as const,
  clockIn1: '2026-10-05T12:10:00.000Z',
  clockOut1: '2026-10-05T18:00:00.000Z',
  clockIn2: '2026-10-05T19:00:00.000Z',
  clockOut2: '2026-10-05T23:30:00.000Z',
  regularMinutes: 480,
  overtimeMinutes: 140,
  amountCents: 6823,
}

describe('receiptDays', () => {
  it('describes a worked day with its times in Lima, its hours and its amount', () => {
    expect(receiptDays([worked])).toEqual([
      { date: '2026-10-05', label: '07:10–13:00 · 14:00–18:30', hours: '8:00 +2:20', amountCents: 6823 },
    ])
  })

  it('names a day that was not worked and sorts the days by date', () => {
    const absence = { ...worked, date: '2026-10-04', type: 'absence' as const, clockIn1: null, clockOut1: null, clockIn2: null, clockOut2: null, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
    const days = receiptDays([worked, absence])
    expect(days.map((d) => d.date)).toEqual(['2026-10-04', '2026-10-05'])
    expect(days[0]).toEqual({ date: '2026-10-04', label: 'Falta', hours: '–', amountCents: 0 })
  })

  it('shows a stretch without its exit with an ellipsis', () => {
    const open = { ...worked, clockIn2: null, clockOut2: null, clockOut1: null, regularMinutes: 0, overtimeMinutes: 0, amountCents: 0 }
    expect(receiptDays([open])[0].label).toBe('07:10–…')
  })
})
```

Run: `npm test -w @agrosalas/frontend`
Expected: FAIL, los módulos no existen.

- [x] **Step 2: Escribir los módulos**

`frontend/src/lib/money.ts`:

```ts
import { formatCents } from './format'

// What a person types as an amount: "68.23" or "68,23", up to two decimals and up to 999 999.99 (the API's cap).
const AMOUNT = /^(\d{1,6})(?:[.,](\d{1,2}))?$/

export function parseSolesToCents(text: string): number | null {
  const match = AMOUNT.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// 6823 → "68.23", to fill an input.
export const centsToInput = (cents: number): string => `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`

// A payment proposes what is pending; a balance in favour of the company proposes nothing.
export const proposedPaymentCents = (pendingCents: number): number => Math.max(0, pendingCents)

// "S/ 28.23", or "S/ 10.00 a favor" when more than the total was paid.
export const pendingText = (pendingCents: number): string =>
  pendingCents < 0 ? `${formatCents(-pendingCents)} a favor` : formatCents(pendingCents)
```

`frontend/src/lib/payments.ts`:

```ts
export const ITEM_TYPE_LABEL = { salary: 'Sueldo', bonus: 'Bono', piecework: 'Destajo', deduction: 'Descuento' } as const
export type ItemType = keyof typeof ITEM_TYPE_LABEL

export const PAYMENT_MEDIUM_LABEL = { yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', cash: 'Efectivo' } as const
export type PaymentMedium = keyof typeof PAYMENT_MEDIUM_LABEL

// A deduction is stored positive: its type gives the sign.
export const signedItemCents = (type: ItemType, amountCents: number): number => (type === 'deduction' ? -amountCents : amountCents)

type Method = { id: string; type: 'yape' | 'plin' | 'bank_account'; number: string; bank: string | null; holderName: string; isPrimary: boolean }

export type PayOption = { key: string; label: string; medium: PaymentMedium; paymentMethodId?: string; needsDetail: boolean }

const MEDIUM_OF = { yape: 'yape', plin: 'plin', bank_account: 'transfer' } as const
const METHOD_NAME = { yape: 'Yape', plin: 'Plin', bank_account: null } as const

// The registered methods of the worker (the primary one first), cash, and a Yape, Plin or transfer that is not registered.
export function payOptions(methods: Method[]): PayOption[] {
  const ordered = [...methods.filter((m) => m.isPrimary), ...methods.filter((m) => !m.isPrimary)]
  return [
    ...ordered.map((m) => ({
      key: `method:${m.id}`,
      label: `${[METHOD_NAME[m.type] ?? m.bank, m.number].filter(Boolean).join(' ')} · ${m.holderName}`,
      medium: MEDIUM_OF[m.type],
      paymentMethodId: m.id,
      needsDetail: false,
    })),
    { key: 'cash', label: 'Efectivo', medium: 'cash', needsDetail: false },
    { key: 'other:yape', label: 'Otro Yape', medium: 'yape', needsDetail: true },
    { key: 'other:plin', label: 'Otro Plin', medium: 'plin', needsDetail: true },
    { key: 'other:transfer', label: 'Otra transferencia', medium: 'transfer', needsDetail: true },
  ]
}

export const defaultPayOption = (options: PayOption[]): string => options[0].key

type PaymentInput = {
  payrollId: string
  workerId: string
  date: string
  amountCents: number
  option: PayOption
  detail: string
  evidencePath: string | null
  note: string
}

// The body of POST /v1/payments. A registered method goes by its id: the server copies its number and holder.
export function paymentBody({ option, detail, note, ...rest }: PaymentInput) {
  return {
    ...rest,
    method: option.medium,
    ...(option.paymentMethodId ? { paymentMethodId: option.paymentMethodId } : {}),
    methodDetail: option.needsDetail ? detail.trim() || null : null,
    note: note.trim() || null,
  }
}
```

`frontend/src/lib/evidence.ts`:

```ts
// The same limits as the API and the bucket.
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export const EVIDENCE_ACCEPT = TYPES.join(',')
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024
const MAX_SIDE = 1600

export const isImage = (type: string): boolean => type.startsWith('image/')

export function evidenceProblem(file: { type: string; size: number }): string | null {
  if (!TYPES.includes(file.type)) return 'Formato no permitido: usa JPG, PNG, WebP o PDF'
  if (file.size === 0) return 'El archivo está vacío'
  if (file.size > EVIDENCE_MAX_BYTES) return 'El archivo no puede pasar de 5 MB'
  return null
}

// The size of a photo reduced so that its longest side is at most 1600 px. A smaller one is left as it is.
export function scaledSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const ratio = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) }
}
```

`frontend/src/lib/closing.ts`:

```ts
import { hasOpenStretch, type AttendanceType } from './attendance'

type ClosingRecord = {
  type: AttendanceType
  needsReview: boolean
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
}

// What the close dialog warns about: who still has a balance, and the records that may be wrong.
export function closingCheck(balances: { workerId: string; pendingCents: number }[], records: ClosingRecord[]) {
  return {
    pending: balances.filter((b) => b.pendingCents !== 0).map(({ workerId, pendingCents }) => ({ workerId, pendingCents })),
    needsReview: records.filter((r) => r.needsReview).length,
    openStretches: records.filter((r) => hasOpenStretch(r)).length,
  }
}
```

`frontend/src/lib/receipt.ts`:

```ts
import { ATTENDANCE_TYPE_LABEL, formatHours, type AttendanceType } from './attendance'
import { limaTime } from './lima-time'

type ReceiptRecord = {
  date: string
  type: AttendanceType
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
  regularMinutes: number
  overtimeMinutes: number
  amountCents: number
}

const stretch = (start: string | null, end: string | null) => (start ? `${limaTime(start)}–${end ? limaTime(end) : '…'}` : null)

// One line per day of the receipt: the times in Lima, the regular and overtime hours, and the amount.
export function receiptDays(records: ReceiptRecord[]) {
  return [...records]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((r) => {
      const worked = r.type === 'worked'
      const label = worked
        ? [stretch(r.clockIn1, r.clockOut1), stretch(r.clockIn2, r.clockOut2)].filter(Boolean).join(' · ')
        : ATTENDANCE_TYPE_LABEL[r.type]
      const minutes = r.regularMinutes + r.overtimeMinutes
      const hours =
        minutes === 0 ? '–' : r.overtimeMinutes > 0 ? `${formatHours(r.regularMinutes)} +${formatHours(r.overtimeMinutes)}` : formatHours(r.regularMinutes)
      return { date: r.date, label, hours, amountCents: r.amountCents }
    })
}
```

- [x] **Step 3: Verificar**

Run: `npm test -w @agrosalas/frontend && npm run lint && npm run typecheck`
Expected: PASS; 234 + las nuevas.

- [x] **Step 4: Commit**

```bash
git add frontend/src/lib/money.ts frontend/src/lib/money.test.ts frontend/src/lib/payments.ts frontend/src/lib/payments.test.ts frontend/src/lib/evidence.ts frontend/src/lib/evidence.test.ts frontend/src/lib/closing.ts frontend/src/lib/closing.test.ts frontend/src/lib/receipt.ts frontend/src/lib/receipt.test.ts
git commit -m "feat(web): add money, payment, evidence, closing and receipt helpers"
```

---

### Task 2: Lista de planillas: Pagado, Pendiente y resumen

**Files:**
- Modify: `frontend/src/app/(panel)/payrolls/page.tsx`

**Interfaces:**
- Consumes: `GET /v1/payrolls` (cada fila trae `totalCents`, `paidCents`, `pendingCents`; `null` para el coordinador), `GET /v1/payrolls/summary` (`{ pendingCents, toPayCount, paidThisMonthCents }`; 403 para el coordinador); `formatCents`; `pendingText` (tarea 1); `seesMoney`.
- Produces: nada que usen otras tareas.

Comportamiento:

- Para los roles que ven dinero, la tabla tiene tres columnas de monto alineadas a la derecha: **Total**, **Pagado** y **Pendiente** (en ese orden, donde hoy está Total). Pendiente usa `pendingText`; si es mayor que 0 va en ámbar (`text-amber-700 dark:text-amber-300`), si es menor que 0 en gris (`text-muted-foreground`). El `colSpan` de las filas de carga, error y vacío se ajusta (8 columnas con dinero, 5 sin dinero).
- Arriba de los filtros, para los roles que ven dinero, tres cifras en tarjetas (`rounded-xl border bg-background p-4`, en una cuadrícula de 1 columna en el celular y 3 desde `sm`): **Pendiente acumulado** (`formatCents(pendingCents)`), **Planillas por pagar** (`toPayCount`, número), **Pagado en el mes** (`formatCents(paidThisMonthCents)`). Cada tarjeta: el título en `text-sm text-muted-foreground` y la cifra en `text-2xl font-semibold tabular-nums`. Mientras carga, la cifra es `…`; si falla, `–` y la página sigue funcionando.
- Clave de consulta del resumen: `['payrolls', 'summary']`, con `enabled: seesMoney(me?.role)`. No depende de los filtros (la API no los recibe).
- El coordinador no ve ni las columnas de dinero ni las tarjetas, y no se pide el resumen.

- [x] **Step 1: Implementar** según el comportamiento de arriba.
- [x] **Step 2: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend`. Expected: PASS.
- [x] **Step 3: Commit**

```bash
git add "frontend/src/app/(panel)/payrolls/page.tsx"
git commit -m "feat(web): show paid and pending amounts and the summary in the payroll list"
```

---

### Task 3: Pestaña Pagos: saldos, conceptos y pagos; grilla con Pagado y Pendiente

**Files:**
- Create: `frontend/src/components/payrolls/payments-tab.tsx`, `frontend/src/components/payrolls/item-dialog.tsx`
- Modify: `frontend/src/app/(panel)/payrolls/[id]/page.tsx`, `frontend/src/components/payrolls/attendance-grid.tsx`, `frontend/src/lib/payroll-detail.ts`, `frontend/src/lib/payroll-detail.test.ts`

**Interfaces:**
- Consumes: `GET /v1/payrolls/:id/balances` (`{ items: WorkerBalance[], totals }`, cada saldo con `workerId`, `attendanceCents`, `additionsCents`, `deductionsCents`, `totalCents`, `paidCents`, `pendingCents`), `GET /v1/payroll-items?payrollId=`, `POST`/`PATCH`/`DELETE /v1/payroll-items`, `GET /v1/payments?payrollId=&page=&pageSize=` (filas con `workerFirstName`, `workerLastName`), `DELETE /v1/payments/:id`, `GET /v1/evidence/read-url?paymentId=`; `ITEM_TYPE_LABEL`, `PAYMENT_MEDIUM_LABEL`, `signedItemCents`, `parseSolesToCents`, `centsToInput`, `pendingText` (tarea 1); `workerName` (`components/attendance/record-dialog.tsx`); `Paginator`.
- Produces:
  - `type PayrollTab = 'attendance' | 'payments' | 'workers'` y `tabFromParam(param: string | null, withPayments: boolean): PayrollTab` en `lib/payroll-detail.ts` (`'payments'` solo si `withPayments`; cualquier otro valor → `'attendance'`).
  - `PaymentsTab({ payroll, canPay, onPay })` en `components/payrolls/payments-tab.tsx`, donde `canPay` es "administración o contabilidad y planilla abierta" y `onPay(workerId)` abre el diálogo de pago (tarea 4; en esta tarea el botón "Pagar" existe y llama a `onPay`, y la página todavía no hace nada con él).
  - Clave de consulta de los saldos: `['payrolls', payrollId, 'balances']`, usada por la grilla, la pestaña y el diálogo de cierre (tarea 5).

**`lib/payroll-detail.ts`**: cambiar `PayrollTab` y `tabFromParam` como arriba, con pruebas en `payroll-detail.test.ts` (`'payments'` con y sin permiso, `'workers'`, `null`, un valor desconocido).

**Página del detalle**: la pestaña "Pagos" va entre "Asistencia" y "Trabajadores" y solo existe si `seesMoney(me.role)`; la navegación con flechas recorre solo las pestañas visibles; `?tab=payments` abre la pestaña; para el coordinador `?tab=payments` abre Asistencia.

**Grilla** (`attendance-grid.tsx`), solo cuando `showMoney`:

- Pide los saldos (`['payrolls', payroll.id, 'balances']`).
- En la columna Total, debajo de las horas, el monto es el `totalCents` del saldo del trabajador (con conceptos), no la suma de asistencia; mientras los saldos cargan, `…`.
- Dos columnas nuevas después de Total: **Pagado** (`formatCents(paidCents)`) y **Pendiente** (`pendingText(pendingCents)`, ámbar si es mayor que 0). En el pie, los `totals` de `/balances`.
- Los totales por día no cambian.
- El coordinador ve la grilla como hoy.

**`PaymentsTab`**, de arriba abajo:

1. **Saldos.** Tabla (`overflow-x-auto` dentro de su borde) con columnas Trabajador, Asistencia, Conceptos (`additionsCents − deductionsCents`, con signo: `+S/ 20.00`, `−S/ 10.00`, o `–` si es 0), Total, Pagado, Pendiente (con `pendingText`, ámbar si es mayor que 0) y una última columna de acciones con dos enlaces o botones: **Pagar** (solo si `canPay`; botón `size="lg"`; `aria-label` "Pagar a <Apellido, Nombre>") y **Recibo** (enlace a `/payrolls/<id>/receipt/<workerId>`, `aria-label` "Recibo de <Apellido, Nombre>"). Una fila de totales al pie. El nombre de cada trabajador sale de `payroll.workers` por su id. Sin trabajadores: "Esta planilla todavía no tiene trabajadores.".
2. **Conceptos.** Título "Conceptos" y, si `canPay`, el botón **Agregar concepto**. Lista (tabla) con Trabajador, Tipo (`ITEM_TYPE_LABEL`), Monto (con signo por `signedItemCents`), Nota, y si `canPay` los botones **Editar** y **Eliminar** (`aria-label` con el tipo y el trabajador). Eliminar pide `window.confirm('¿Eliminar el concepto <Tipo> de <Apellido, Nombre>?')`. Sin conceptos: "Sin conceptos en esta planilla.". Clave: `['payroll-items', payroll.id]`.
3. **Pagos.** Título "Pagos". Tabla paginada (25 por página, `Paginator`) con Fecha (`formatDate`), Trabajador, Medio (`PAYMENT_MEDIUM_LABEL`, y debajo `methodDetail` en `text-xs text-muted-foreground` si existe), Monto, Evidencia y, si `canPay`, **Eliminar** (`window.confirm('¿Eliminar el pago de <monto> a <Apellido, Nombre>? La evidencia se conserva.')`). Evidencia: si `evidencePath`, un botón **Ver** que pide `GET /v1/evidence/read-url` y abre la URL en una pestaña nueva; si no, `–`. Sin pagos: "Todavía no hay pagos en esta planilla.". Clave: `['payments', { payrollId }, page]`.

Abrir la evidencia sin que el navegador bloquee la ventana: abrir primero, dentro del clic, `const tab = window.open('', '_blank')`; pedir la URL; luego `tab.location.href = url` y `tab.opener = null`. Si la petición falla, cerrar la pestaña y mostrar `toast.error(errorMessage(e))`.

**`ItemDialog`** (`components/payrolls/item-dialog.tsx`), un diálogo para agregar o editar:

- Agregar: campos **Trabajador** (select con los trabajadores de la planilla, por "Apellido, Nombre"), **Tipo** (select con los cuatro tipos; por defecto Bono), **Monto (S/)** (`inputMode="decimal"`, ayuda "Un descuento se escribe en positivo: resta por su tipo.") y **Nota (opcional)** (hasta 300). Título "Agregar concepto"; botón "Agregar".
- Editar: solo **Monto (S/)** y **Nota (opcional)**, con el trabajador y el tipo como texto arriba. Título "Editar concepto"; botón "Guardar". Envía solo los campos que cambiaron; si no cambió nada, cierra sin enviar. Nota vacía se envía como `null`.
- Monto que `parseSolesToCents` no lee, o 0: "Escribe un monto válido, por ejemplo 68.23" bajo el campo, sin enviar.
- Errores de la API con `field` bajo su campo (`amountCents` → Monto, `type` → Tipo, `workerId` → Trabajador, `note` → Nota); el resto en un aviso del diálogo.
- Mientras guarda, el botón dice "Guardando…" y el diálogo no se cierra. Al terminar: aviso "Concepto agregado" o "Concepto actualizado"; aviso "Concepto eliminado" al eliminar.

Toda escritura invalida `['payrolls']`, `['payroll-items']`, `['payments']` y `['workers']`.

- [x] **Step 1: Pruebas de `tabFromParam`** en `payroll-detail.test.ts` (fallan).
- [x] **Step 2: Implementar** `lib/payroll-detail.ts`, la página, la grilla, `PaymentsTab` e `ItemDialog`.
- [x] **Step 3: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend`. Expected: PASS.
- [x] **Step 4: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the payments tab with balances, payroll items and payments"
```

---

### Task 4: Registrar un pago con su evidencia

**Files:**
- Create: `frontend/src/components/payrolls/payment-dialog.tsx`, `frontend/src/lib/compress-image.ts`
- Modify: `frontend/src/app/(panel)/payrolls/[id]/page.tsx` (abre el diálogo desde `onPay`)

**Interfaces:**
- Consumes: `GET /v1/workers/:id` (`paymentMethods`, clave `['workers', workerId]`), los saldos `['payrolls', payrollId, 'balances']`, `POST /v1/evidence/upload-url` (`{ path, token, signedUrl }`), `POST /v1/payments`; `payOptions`, `defaultPayOption`, `paymentBody`, `parseSolesToCents`, `centsToInput`, `proposedPaymentCents` (tarea 1); `evidenceProblem`, `isImage`, `scaledSize`, `EVIDENCE_ACCEPT` (tarea 1); `limaDate`.
- Produces: `PaymentDialog({ payroll, workerId, open, onOpenChange })`; `compressImage(file: File): Promise<File>`.

**`compressImage`** (`lib/compress-image.ts`): si el archivo no es imagen, lo devuelve igual. Si es imagen: `createImageBitmap(file)`, `scaledSize(bitmap.width, bitmap.height)`, dibujar en un `canvas` de ese tamaño, `canvas.toBlob(resolve, 'image/jpeg', 0.8)`. Si el resultado es más grande que el original, o algo falla, devuelve el original. El resultado es un `File` con el nombre original y extensión `.jpg`, tipo `image/jpeg`.

**Diálogo** (título "Registrar pago a <Apellido, Nombre>"; debajo, en `text-sm text-muted-foreground`, "Pendiente: <pendingText>"):

- **Monto (S/)**: `inputMode="decimal"`, lleno con `centsToInput(proposedPaymentCents(pendiente))` si es mayor que 0; vacío si no.
- **Fecha**: `type="date"`, por defecto hoy en Lima, `max` hoy.
- **Medio**: select con `payOptions(paymentMethods)` y `defaultPayOption`. Mientras cargan los métodos del trabajador, el select dice "Cargando métodos…" y está deshabilitado.
- **Número y titular**: solo si la opción elegida tiene `needsDetail`; hasta 160 caracteres.
- **Evidencia (opcional)**: `<input type="file" accept={EVIDENCE_ACCEPT}>` con ayuda "JPG, PNG, WebP o PDF de hasta 5 MB. Las fotos se reducen antes de subir." Al elegir: si es imagen se comprime con `compressImage`; luego `evidenceProblem` sobre el resultado; un problema se muestra bajo el campo y el archivo no se acepta. Se muestra el nombre y el tamaño en KB del archivo aceptado, con un botón "Quitar".
- **Nota (opcional)**: hasta 300.

Al enviar, en este orden:

1. Monto ilegible o 0 → "Escribe un monto válido, por ejemplo 68.23" bajo Monto, sin enviar.
2. Si hay evidencia: `POST /v1/evidence/upload-url` con `{ payrollId, workerId, contentType: file.type, sizeBytes: file.size }`; luego `fetch(signedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })`. Si la subida no responde 2xx o falla la red: "No se pudo subir la evidencia. Inténtalo de nuevo." en el aviso del diálogo, y no se registra el pago.
3. `POST /v1/payments` con `paymentBody(...)` y `evidencePath` (o `null`).

Todo el envío es una sola mutación con `networkMode: 'always'` y `retry: false` (un pago no se reintenta solo). Mientras dura: el botón dice "Registrando…", todos los campos y el botón están deshabilitados y el diálogo no se cierra (`onOpenChange` ignora el cierre). Errores de la API con `field` bajo su campo (`amountCents` → Monto, `date` → Fecha, `method` y `paymentMethodId` → Medio, `methodDetail` → Número y titular, `evidencePath` → Evidencia, `note` → Nota); el resto en el aviso del diálogo. Al terminar: aviso "Pago registrado", se cierra el diálogo e invalida `['payrolls']`, `['payments']` y `['workers']`. Cada vez que el diálogo se abre, el formulario se arma de nuevo.

Si al probarlo en el navegador el `PUT` crudo a la URL firmada no funcionara, la alternativa es mandar el archivo en un `FormData` con el campo vacío `''` (lo que hace `uploadToSignedUrl` de Supabase): se anota en el reporte.

- [x] **Step 1: Implementar** `compress-image.ts`, `payment-dialog.tsx` y la conexión en la página.
- [x] **Step 2: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend`. Expected: PASS.
- [x] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(web): record a payment with its evidence, compressing photos before the upload"
```

---

### Task 5: Cerrar y reabrir; planilla cerrada en solo lectura

**Files:**
- Create: `frontend/src/components/payrolls/close-dialog.tsx`
- Modify: `frontend/src/app/(panel)/payrolls/[id]/page.tsx`, `frontend/src/components/payrolls/attendance-grid.tsx`, `frontend/src/components/payrolls/payroll-workers.tsx`, `frontend/src/components/payrolls/payments-tab.tsx`

**Interfaces:**
- Consumes: `POST /v1/payrolls/:id/close` (`{ confirmPending?: boolean }`; 409 `pending_balances`, 409 `payroll_closed`), `POST /v1/payrolls/:id/reopen` (409 `not_closed`); los saldos `['payrolls', id, 'balances']`; `closingCheck`, `pendingText` (tarea 1); `workerName`.
- Produces: `CloseDialog({ payroll, open, onOpenChange })`.

**Solo lectura.** En la página: `const isOpen = payroll.status === 'open'`; `canEdit = (admin o contabilidad) && isOpen`; `canRegister = (canEdit o coordinador) && isOpen`; la grilla recibe `readOnly = management || !isOpen`; `PayrollWorkers` recibe `canEdit`; `PaymentsTab` recibe `canPay = canEdit`. En una planilla cerrada no se ve Editar, ni Agregar ni Quitar trabajadores, ni Pagar, Agregar concepto, Editar o Eliminar; las celdas vacías de la grilla no son botones y las que tienen registro lo abren en solo lectura. Arriba de las pestañas, un aviso fijo (`role="status"`, borde gris): "Planilla cerrada el <fecha de closedAt en Lima, dd/mm/aaaa>. Solo se puede consultar." y, para el administrador, el botón **Reabrir** dentro del aviso.

**Cerrar.** Botón **Cerrar planilla** junto a Editar, para administración y contabilidad, solo si la planilla está abierta. Abre `CloseDialog`:

- Título "Cerrar planilla". Texto: "Al cerrarla no se podrán registrar ni corregir asistencias, conceptos ni pagos. Solo el administrador puede reabrirla."
- Con `closingCheck(saldos, payroll.records)`:
  - Si `pending` no está vacía: "Estos trabajadores tienen saldo pendiente:" y la lista "<Apellido, Nombre>: <pendingText>".
  - Si `needsReview > 0`: "<n> registro(s) por revisar." (con `plural`: "1 registro por revisar", "3 registros por revisar").
  - Si `openStretches > 0`: "<n> día(s) con un tramo sin salida." (`plural`: "1 día con un tramo sin salida", "2 días con un tramo sin salida").
  - Si nada de lo anterior: "Todo está pagado y completo.".
- Botones "Cancelar" y "Cerrar planilla" (destructivo). Mientras cargan los saldos, el botón está deshabilitado y la lista dice "Revisando saldos…".
- Envía `{ confirmPending: true }` si `pending` no está vacía, `{}` si está vacía. Mientras envía: "Cerrando…", y el diálogo no se cierra.
- 409 `pending_balances`: recarga los saldos y muestra en el diálogo "Los saldos cambiaron. Revisa la lista y vuelve a confirmar." (el botón vuelve a habilitarse con la lista nueva). Cualquier otro error: su mensaje en el aviso del diálogo.
- Éxito: aviso "Planilla cerrada", se cierra el diálogo e invalida `['payrolls']`, `['attendance']`, `['payroll-items']` y `['payments']`.

**Reabrir** (solo administrador, planilla cerrada): `window.confirm('¿Reabrir la planilla? Se podrán volver a registrar asistencias, conceptos y pagos.')`; luego `POST /reopen`; aviso "Planilla reabierta" e invalidación como al cerrar; un error se muestra con `toast.error(errorMessage(e))`.

- [x] **Step 1: Implementar.**
- [x] **Step 2: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend`. Expected: PASS.
- [x] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(web): close and reopen a payroll and keep a closed one read-only"
```

---

### Task 6: Recibo imprimible e historial en la ficha del trabajador

**Files:**
- Create: `frontend/src/app/(panel)/payrolls/[id]/receipt/[workerId]/page.tsx`, `frontend/src/components/workers/worker-payrolls.tsx`, `frontend/src/components/workers/worker-payments.tsx`
- Modify: `frontend/src/app/(panel)/workers/[id]/page.tsx`, `frontend/src/app/(panel)/layout.tsx`, `frontend/src/components/panel/menu.tsx`

**Interfaces:**
- Consumes: `GET /v1/payrolls/:id/workers/:workerId` (`{ payroll, worker, records, items, payments, balance, paymentMethods }`; `worker.positionName`), `GET /v1/workers/:id/payrolls` (paginada: `payrollId`, `name`, `type`, `startDate`, `endDate`, `status`, `totalCents`, `paidCents`, `pendingCents`), `GET /v1/payments?workerId=` (paginada); `receiptDays`, `signedItemCents`, `ITEM_TYPE_LABEL`, `PAYMENT_MEDIUM_LABEL`, `pendingText` (tarea 1); `payrollDisplayStatus`, `PAYROLL_STATUS_LABEL`, `seesMoney`, `formatDate`, `dateRange`, `formatCents`; `Paginator`.

**Recibo** (`/payrolls/[id]/receipt/[workerId]`, clave `['payrolls', id, 'receipt', workerId]`):

- Para el coordinador (o si la API responde 403): "No tienes acceso a este recibo." y un enlace "← Planilla".
- Arriba, oculto al imprimir (`print:hidden`): enlace "← Planilla" (a `/payrolls/<id>?tab=payments`) y el botón **Imprimir o guardar PDF** (`window.print()`).
- Encabezado: "Agrosalas Perú" en negrita, "Recibo de planilla" y la fecha de hoy en Lima; luego la planilla (nombre, `dateRange`, campaña si tiene) y el trabajador ("Apellido, Nombre", "DNI <dni>" o "Sin DNI", cargo o "Sin cargo").
- Tabla **Días**: Fecha (`formatDate`), Detalle (`label` de `receiptDays`), Horas, Monto. Sin registros: "Sin días registrados.".
- Tabla **Conceptos** (solo si hay): Tipo, Nota, Monto con signo.
- Tabla **Pagos** (solo si hay): Fecha, Medio y detalle, Monto.
- Resumen alineado a la derecha: Asistencia, Conceptos (con signo), **Total**, Pagado, **Pendiente** (`pendingText`).
- Al imprimir: fondo blanco, texto negro, sin sombras; las tablas no se cortan dentro de una fila (`break-inside: avoid` en las filas).

**Menú oculto al imprimir:** en `app/(panel)/layout.tsx` y `components/panel/menu.tsx`, la barra lateral, la barra superior del celular y el panel desplegable llevan `print:hidden`, y `main` pierde su relleno al imprimir (`print:p-0`).

**Ficha del trabajador** (`/workers/[id]`), solo si `seesMoney(me.role)`, debajo de lo que hay:

- `WorkerPayrolls`: título "Planillas"; tabla paginada (10 por página) con Planilla (enlace a `/payrolls/<id>`, con `dateRange` debajo), Estado (`PAYROLL_STATUS_LABEL[payrollDisplayStatus(fila, hoy)]`), Total, Pagado, Pendiente (`pendingText`) y un enlace **Recibo**. Vacío: "Todavía no está en ninguna planilla.". Clave: `['workers', id, 'payrolls', page]`.
- `WorkerPayments`: título "Pagos"; tabla paginada (10 por página) con Fecha, Planilla (`payrollName`, enlace), Medio y detalle, Monto y Evidencia (botón **Ver**, igual que en la pestaña Pagos). Vacío: "Todavía no tiene pagos.". Clave: `['payments', { workerId: id }, page]`.

- [x] **Step 1: Implementar.** Antes de crear la ruta anidada, leer en `node_modules/next/dist/docs/` cómo se reciben los parámetros dinámicos en Next 16 (la página es de cliente y usa `useParams`, como las demás).
- [x] **Step 2: Verificar** — Run: `npm run lint && npm run typecheck && npm test -w @agrosalas/frontend && npm run build`. Expected: PASS; el build lista la ruta nueva del recibo.
- [x] **Step 3: Commit**

```bash
git add frontend/src
git commit -m "feat(web): add the printable receipt and the payroll and payment history of a worker"
```

---

### Task 7: Documentación y verificación en el navegador

**Files:**
- Modify: `docs/superpowers/specs/2026-10-01-planilla-design.md`, `README.md` (si algo de la puesta en marcha cambió), este plan.

- [x] **Step 1: Spec**: §10, pantallas 3, 4 y 6: quitar las notas "llegan con la fase 3" y describir lo que hay (columnas, resumen, pestañas Asistencia, Pagos y Trabajadores, cerrar y reabrir, planilla cerrada en solo lectura, recibo); dejar "exportar" como fase 4. Pantalla 5: el historial de planillas y pagos. §8: el flujo de la evidencia en tres pasos y la reducción de las fotos.
- [x] **Step 2: Verificación en el navegador** (la hace el controlador con la sesión de Gonzalo, después de aplicar la migración `0002` y crear el bucket en el proyecto de desarrollo): a 375 px y en escritorio, la lista con sus cifras; la pestaña Pagos; agregar, editar y eliminar un concepto; registrar un pago en efectivo, uno con un método registrado y uno con una foto como evidencia; ver la evidencia; eliminar un pago; cerrar con pendientes (lista y confirmación) y ver la planilla en solo lectura; reabrir; el recibo y su vista de impresión; el historial en la ficha del trabajador; sin desborde horizontal ni errores en la consola.
  Resultado (2026-10-02, controlador, administrador, base de desarrollo, 375 px y escritorio): se recorrieron la lista con sus cifras, la pestaña Pagos sin desborde, un concepto (Bono de S/ 20.00), un pago por Yape de S/ 30.00 con una foto PNG de 3.3 MB reducida a un JPEG de 333 KB y subida a la URL firmada, "Ver" (el aviso de ventana bloqueada y, con la ventana simulada, la imagen), un pago en efectivo y su eliminación, el cierre con un pendiente y un tramo sin salida, la planilla cerrada en solo lectura, la reapertura, el recibo (cuadra y oculta el menú al imprimir) y el historial en la ficha del trabajador; sin errores en la consola. No se probó: gerencia y coordinador (sin usuarios con esos roles), la impresión real ni el 409 `pending_balances` real. Detalle en "Estado de ejecución".
- [x] **Step 3: Este plan**: sección "Estado de ejecución" (fecha, commits, pruebas, lo que difirió, resultado del recorrido) y "Pendiente".
- [x] **Step 4: Verificación final** — Run: `npm run lint && npm run typecheck && npm test && npm run build`. Expected: todo en verde.
- [x] **Step 5: Commit**

```bash
git add docs README.md
git commit -m "docs(planilla): record the execution of plan 3B"
```

---

## Fuera de este plan

- Exportar a Excel y los reportes: fase 4.
- Detectar en la API un pago enviado dos veces; comprobar que el archivo de evidencia existe antes de aceptar el pago; responder 404 (y no 502) al leer una evidencia que no se subió.
- Compartir el recibo desde el celular con la hoja de compartir del sistema.
