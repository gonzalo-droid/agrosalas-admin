import { and, eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditLog, userAreas } from '../src/db/schema.js'
import { isEvidencePathOf } from '../src/payroll/evidence.js'
import { createTestApp, USERS } from './helpers.js'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaProduction: string
let w1: string // temporary, in the payroll, with a Yape and a bank account
let w2: string // temporary, in the payroll, with a Plin
let w3: string // temporary, in no payroll
let yapeId: string
let accountId: string
let plinId: string
let payroll: string

const MISSING_ID = '00000000-0000-4000-8000-00000000ffff'

type Role = 'admin' | 'accounting' | 'management' | 'coordinator'

async function createWorker(firstName: string, lastName: string, dni: string, positionId: string) {
  const r = await t.request('admin', 'POST', '/v1/workers', {
    firstName,
    lastName,
    dni,
    employmentType: 'temporary',
    areaId: areaProduction,
    positionId,
  })
  return r.json.id as string
}

const createPayroll = async (name: string, startDate: string, endDate: string, workerIds: string[]) =>
  (await t.request('admin', 'POST', '/v1/payrolls', { name, type: 'weekly', startDate, endDate, workers: { workerIds } }))
    .json.id as string

const auditRows = (entity: string, entityId: string) =>
  t.db.select().from(auditLog).where(and(eq(auditLog.entity, entity), eq(auditLog.entityId, entityId)))

const pay = (role: Role, body: Record<string, unknown>) => t.request(role, 'POST', '/v1/payments', body)

const cashPayment = (extra: Record<string, unknown> = {}) => ({
  payrollId: payroll,
  workerId: w1,
  date: '2026-10-05',
  amountCents: 5000,
  method: 'cash',
  ...extra,
})

const uploadUrl = (role: Role, extra: Record<string, unknown> = {}) =>
  t.request(role, 'POST', '/v1/evidence/upload-url', {
    payrollId: payroll,
    workerId: w1,
    contentType: 'image/jpeg',
    sizeBytes: 300_000,
    ...extra,
  })

beforeAll(async () => {
  t = await createTestApp()
  areaProduction = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  const operario = (
    await t.request('admin', 'POST', '/v1/positions', { name: 'Operario', payType: 'hourly', hourlyRate: 6.25, overtimeRate: 7.8125 })
  ).json.id
  await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId: areaProduction })
  w1 = await createWorker('Rosa', 'Quispe', '72000001', operario)
  w2 = await createWorker('Beto', 'Alvarez', '72000002', operario)
  w3 = await createWorker('Carla', 'Mendoza', '72000003', operario)
  yapeId = (
    await t.request('admin', 'POST', `/v1/workers/${w1}/payment-methods`, { type: 'yape', number: '987654321', holderName: 'Rosa Quispe' })
  ).json.id
  accountId = (
    await t.request('admin', 'POST', `/v1/workers/${w1}/payment-methods`, {
      type: 'bank_account',
      number: '191-00000000-0-00',
      bank: 'BCP',
      cci: '002-191-000000000000-00',
      holderName: 'Rosa Quispe',
    })
  ).json.id
  plinId = (
    await t.request('admin', 'POST', `/v1/workers/${w2}/payment-methods`, { type: 'plin', number: '911222333', holderName: 'Beto Alvarez' })
  ).json.id
  payroll = await createPayroll('Semana 41', '2026-10-05', '2026-10-11', [w1, w2])
})

describe('payments: create', () => {
  it('the administrator registers a cash payment and it is audited', async () => {
    const r = await pay('admin', cashPayment())
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({
      payrollId: payroll,
      workerId: w1,
      date: '2026-10-05',
      amountCents: 5000,
      method: 'cash',
      methodDetail: null,
      evidencePath: null,
      recordedBy: USERS.admin,
    })
    const rows = await auditRows('payments', r.json.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', userId: USERS.admin })
  })

  it('accounting pays; management and the coordinator get 403 on POST and DELETE, and the coordinator on GET', async () => {
    expect((await pay('accounting', cashPayment({ amountCents: 1000 }))).status).toBe(201)
    for (const role of ['management', 'coordinator'] as const) {
      const created = await pay(role, cashPayment())
      expect(created.status).toBe(403)
      expect(created.json.error.code).toBe('forbidden')
      const deleted = await t.request(role, 'DELETE', `/v1/payments/${MISSING_ID}`)
      expect(deleted.status).toBe(403)
    }
    expect((await t.request('coordinator', 'GET', `/v1/payments?payrollId=${payroll}`)).status).toBe(403)
    expect((await t.request('management', 'GET', `/v1/payments?payrollId=${payroll}`)).status).toBe(200)
  })

  it('a registered method copies its description into the payment and ignores the methodDetail of the body', async () => {
    const yape = await pay('admin', cashPayment({ method: 'yape', paymentMethodId: yapeId, methodDetail: 'otro texto' }))
    expect(yape.status).toBe(201)
    expect(yape.json.methodDetail).toBe('987654321 · Titular: Rosa Quispe')
    expect(yape.json).not.toHaveProperty('paymentMethodId')

    const account = await pay('admin', cashPayment({ method: 'transfer', paymentMethodId: accountId }))
    expect(account.status).toBe(201)
    expect(account.json.methodDetail).toBe('BCP 191-00000000-0-00 · CCI 002-191-000000000000-00 · Titular: Rosa Quispe')
  })

  it('a method of another worker is invalid_reference and a different medium is a validation error', async () => {
    const other = await pay('admin', cashPayment({ method: 'plin', paymentMethodId: plinId }))
    expect(other.status).toBe(400)
    expect(other.json.error).toMatchObject({ code: 'invalid_reference', field: 'paymentMethodId' })

    const missing = await pay('admin', cashPayment({ method: 'yape', paymentMethodId: MISSING_ID }))
    expect(missing.status).toBe(400)
    expect(missing.json.error).toMatchObject({ code: 'invalid_reference', field: 'paymentMethodId' })

    const mismatch = await pay('admin', cashPayment({ method: 'cash', paymentMethodId: yapeId }))
    expect(mismatch.status).toBe(400)
    expect(mismatch.json.error).toMatchObject({
      code: 'validation',
      message: 'El medio no coincide con el método de pago elegido',
      field: 'method',
    })
  })

  it('without a registered method the methodDetail is the text of the body, or null when it is blank', async () => {
    const text = await pay('admin', cashPayment({ method: 'yape', methodDetail: 'Yape de su hermana 999888777' }))
    expect(text.status).toBe(201)
    expect(text.json.methodDetail).toBe('Yape de su hermana 999888777')

    const blank = await pay('admin', cashPayment({ method: 'yape', methodDetail: '   ' }))
    expect(blank.status).toBe(201)
    expect(blank.json.methodDetail).toBeNull()
  })

  it('refuses a future date and accepts one before the period', async () => {
    const future = await pay('admin', cashPayment({ date: '2026-10-06' }))
    expect(future.status).toBe(400)
    expect(future.json.error).toMatchObject({
      code: 'validation',
      message: 'La fecha del pago no puede ser futura',
      field: 'date',
    })
    expect((await pay('admin', cashPayment({ date: '2026-09-30' }))).status).toBe(201)
  })

  it('refuses a date more than 31 days before the start of the payroll', async () => {
    // The payroll starts on 2026-10-05: 2026-09-04 is exactly 31 days before.
    expect((await pay('admin', cashPayment({ date: '2026-09-04' }))).status).toBe(201)
    for (const date of ['2026-09-03', '1900-01-01']) {
      const r = await pay('admin', cashPayment({ date }))
      expect(r.status).toBe(400)
      expect(r.json.error).toMatchObject({
        code: 'validation',
        message: 'La fecha del pago es muy anterior a la planilla',
        field: 'date',
      })
    }
  })

  it('refuses an amount of 0 or with decimals, a worker outside the payroll and a missing payroll', async () => {
    for (const amountCents of [0, 50.5]) {
      const r = await pay('admin', cashPayment({ amountCents }))
      expect(r.status).toBe(400)
      expect(r.json.error.code).toBe('validation')
    }
    const outside = await pay('admin', cashPayment({ workerId: w3 }))
    expect(outside.status).toBe(400)
    expect(outside.json.error.code).toBe('not_in_payroll')
    const missing = await pay('admin', cashPayment({ payrollId: MISSING_ID }))
    expect(missing.status).toBe(404)
    expect(missing.json.error.code).toBe('not_found')
  })

  it('accepts paying more than the total: two payments of 5000 to a worker without attendance', async () => {
    const lonely = await createPayroll('Semana sin asistencia', '2026-10-12', '2026-10-18', [w2])
    for (let i = 0; i < 2; i += 1) {
      const r = await pay('admin', { payrollId: lonely, workerId: w2, date: '2026-10-05', amountCents: 5000, method: 'cash' })
      expect(r.status).toBe(201)
    }
  })
})

describe('payments: evidence', () => {
  let evidencePath: string
  let withEvidence: string

  it('upload-url answers with a path of the payroll and worker, and the storage signed it', async () => {
    const r = await uploadUrl('admin')
    expect(r.status).toBe(200)
    expect(isEvidencePathOf(r.json.path, payroll, w1)).toBe(true)
    expect(r.json.token).toBe('test-token')
    expect(r.json.signedUrl).toContain(r.json.path)
    expect(t.uploadUrls).toContain(r.json.path)
    evidencePath = r.json.path
  })

  it('upload-url lower-cases the ids, so a payment with the ids in lowercase accepts the path', async () => {
    const r = await uploadUrl('admin', { payrollId: payroll.toUpperCase(), workerId: w1.toUpperCase() })
    expect(r.status).toBe(200)
    expect(r.json.path).toBe(r.json.path.toLowerCase())
    expect(isEvidencePathOf(r.json.path, payroll, w1)).toBe(true)
    const paid = await pay('admin', cashPayment({ amountCents: 1200, evidencePath: r.json.path }))
    expect(paid.status).toBe(201)
    expect(paid.json.evidencePath).toBe(r.json.path)
  })

  it('a payment sent with the ids in uppercase is checked against the lowercase folder', async () => {
    const r = await uploadUrl('admin')
    const paid = await pay('admin', cashPayment({
      payrollId: payroll.toUpperCase(),
      workerId: w1.toUpperCase(),
      amountCents: 1300,
      evidencePath: r.json.path,
    }))
    expect(paid.status).toBe(201)
  })

  it('upload-url refuses a format, a size or a worker that are not valid, and accounting is the only other role that can ask', async () => {
    const format = await uploadUrl('admin', { contentType: 'image/gif' })
    expect(format.status).toBe(400)
    expect(format.json.error).toMatchObject({ code: 'validation', message: 'Formato no permitido: usa JPG, PNG, WebP o PDF' })

    const size = await uploadUrl('admin', { sizeBytes: 5 * 1024 * 1024 + 1 })
    expect(size.status).toBe(400)
    expect(size.json.error).toMatchObject({ code: 'validation', message: 'El archivo no puede pasar de 5 MB' })

    const outside = await uploadUrl('admin', { workerId: w3 })
    expect(outside.status).toBe(400)
    expect(outside.json.error.code).toBe('not_in_payroll')

    expect((await uploadUrl('accounting')).status).toBe(200)
    for (const role of ['management', 'coordinator'] as const) expect((await uploadUrl(role)).status).toBe(403)
  })

  it('a payment takes the evidence once, and only from the folder of its payroll and worker', async () => {
    const first = await pay('admin', cashPayment({ evidencePath }))
    expect(first.status).toBe(201)
    expect(first.json.evidencePath).toBe(evidencePath)
    withEvidence = first.json.id

    const again = await pay('admin', cashPayment({ evidencePath }))
    expect(again.status).toBe(409)
    expect(again.json.error).toMatchObject({
      code: 'duplicate',
      message: 'Esa evidencia ya está en otro pago',
      field: 'evidencePath',
    })

    const foreign = await uploadUrl('admin', { workerId: w2 })
    const stolen = await pay('admin', cashPayment({ evidencePath: foreign.json.path }))
    expect(stolen.status).toBe(400)
    expect(stolen.json.error).toMatchObject({
      code: 'validation',
      message: 'La evidencia no corresponde a este pago',
      field: 'evidencePath',
    })
  })

  it('read-url signs the evidence for 60 seconds, management can read it and the coordinator cannot', async () => {
    const r = await t.request('admin', 'GET', `/v1/evidence/read-url?paymentId=${withEvidence}`)
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ url: `https://storage.test/read/${evidencePath}`, expiresIn: 60 })
    expect(t.readUrls).toContainEqual({ path: evidencePath, seconds: 60 })

    expect((await t.request('management', 'GET', `/v1/evidence/read-url?paymentId=${withEvidence}`)).status).toBe(200)
    expect((await t.request('coordinator', 'GET', `/v1/evidence/read-url?paymentId=${withEvidence}`)).status).toBe(403)
  })

  it('read-url answers 404 for a payment without evidence and for a missing payment', async () => {
    const bare = await pay('admin', cashPayment())
    const r = await t.request('admin', 'GET', `/v1/evidence/read-url?paymentId=${bare.json.id}`)
    expect(r.status).toBe(404)
    expect(r.json.error).toMatchObject({ code: 'not_found', message: 'El pago no tiene evidencia' })

    const missing = await t.request('admin', 'GET', `/v1/evidence/read-url?paymentId=${MISSING_ID}`)
    expect(missing.status).toBe(404)
    expect(missing.json.error.message).toBe('El pago no existe')
  })
})

describe('payments: list and delete', () => {
  let listed: string

  beforeAll(async () => {
    listed = await createPayroll('Semana listado', '2026-10-19', '2026-10-25', [w1, w2])
    t.setNow(new Date('2026-10-26T13:00:00Z'))
    const base = { payrollId: listed, method: 'cash' }
    await pay('admin', { ...base, workerId: w1, date: '2026-10-20', amountCents: 1000 })
    await pay('admin', { ...base, workerId: w2, date: '2026-10-24', amountCents: 2000 })
    await pay('admin', { ...base, workerId: w1, date: '2026-10-22', amountCents: 3000 })
    t.setNow(new Date('2026-10-05T13:00:00Z'))
  })

  it('lists the payments of a payroll with the worker and the payroll, newest first', async () => {
    const r = await t.request('admin', 'GET', `/v1/payments?payrollId=${listed}`)
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 3, page: 1, pageSize: 25 })
    expect(r.json.items.map((p: { date: string }) => p.date)).toEqual(['2026-10-24', '2026-10-22', '2026-10-20'])
    expect(r.json.items[0]).toMatchObject({ workerFirstName: 'Beto', workerLastName: 'Alvarez', payrollName: 'Semana listado', amountCents: 2000 })

    const paged = await t.request('admin', 'GET', `/v1/payments?payrollId=${listed}&page=2&pageSize=2`)
    expect(paged.json.items).toHaveLength(1)
    expect(paged.json.total).toBe(3)
  })

  it('filters by worker and requires a payroll or a worker', async () => {
    const r = await t.request('admin', 'GET', `/v1/payments?workerId=${w2}`)
    expect(r.status).toBe(200)
    expect(r.json.items.every((p: { workerId: string }) => p.workerId === w2)).toBe(true)
    expect(r.json.items.length).toBeGreaterThanOrEqual(1)

    const none = await t.request('admin', 'GET', '/v1/payments')
    expect(none.status).toBe(400)
    expect(none.json.error).toMatchObject({ code: 'validation', message: 'Indica la planilla o el trabajador' })
  })

  it('deletes a payment and audits it; a missing id answers 404', async () => {
    const created = await pay('admin', cashPayment({ amountCents: 777 }))
    const r = await t.request('accounting', 'DELETE', `/v1/payments/${created.json.id}`)
    expect(r.status).toBe(200)
    expect(r.json).toEqual({ ok: true })
    const rows = await auditRows('payments', created.json.id)
    expect(rows.map((row) => row.action).sort()).toEqual(['create', 'delete'])

    const again = await t.request('admin', 'DELETE', `/v1/payments/${created.json.id}`)
    expect(again.status).toBe(404)
    expect(again.json.error.message).toBe('El pago no existe')
  })

  it('a worker with a payment cannot be removed from the payroll', async () => {
    const r = await t.request('admin', 'DELETE', `/v1/payrolls/${listed}/workers/${w1}`)
    expect(r.status).toBe(409)
    expect(r.json.error.code).toBe('has_records')
  })
})
