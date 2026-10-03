import { beforeAll, describe, expect, it } from 'vitest'
import { userAreas } from '../src/db/schema'
import type { Role } from '../src/types'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let areaId: string
let positionId: string
let groupId: string
let workerId: string
let methodId: string
let payrollId: string
let recordId: string
let itemId: string
let paymentId: string
// The day of the attendance record created in the setup (a Monday, inside the payroll).
const RECORD_DATE = '2026-10-05'

beforeAll(async () => {
  t = await createTestApp()
  areaId = (await t.request('admin', 'POST', '/v1/areas', { name: 'Producción' })).json.id
  positionId = (
    await t.request('admin', 'POST', '/v1/positions', {
      name: 'Operario',
      payType: 'hourly',
      hourlyRate: 6.5,
      overtimeRate: 8.1,
      monthlySalary: 1800,
    })
  ).json.id
  groupId = (await t.request('admin', 'POST', '/v1/groups', { name: 'Turno noche' })).json.id
  const worker = await t.request('admin', 'POST', '/v1/workers', {
    firstName: 'Rosa',
    lastName: 'Quispe',
    dni: '45871236',
    employmentType: 'contract',
    areaId,
    positionId,
  })
  workerId = worker.json.id
  methodId = (
    await t.request('admin', 'POST', `/v1/workers/${workerId}/payment-methods`, {
      type: 'bank_account',
      number: '19412345678901',
      bank: 'BCP',
      cci: '00219400123456789012',
      holderName: 'Rosa Quispe',
    })
  ).json.id
  await t.request('admin', 'POST', `/v1/groups/${groupId}/members`, { workerIds: [workerId] })

  // The worker above is a contract one and is paid nothing per day. The payroll and the record belong to a
  // temporary worker with an hourly position, so that the amounts the administrator sees are above zero.
  const temporary = await t.request('admin', 'POST', '/v1/workers', {
    firstName: 'Luis',
    lastName: 'Huamán',
    dni: '45871238',
    employmentType: 'temporary',
    areaId,
    positionId,
  })
  const temporaryId: string = temporary.json.id
  payrollId = (
    await t.request('admin', 'POST', '/v1/payrolls', {
      name: 'Semana 41',
      type: 'weekly',
      startDate: '2026-10-05',
      endDate: '2026-10-11',
      workers: { workerIds: [workerId, temporaryId] },
    })
  ).json.id
  // 12:10 to 18:00 and 19:00 to 23:30 UTC: 350 + 270 = 620 minutes.
  const marks: [string, string][] = [
    ['clockIn1', '12:10'],
    ['clockOut1', '18:00'],
    ['clockIn2', '19:00'],
    ['clockOut2', '23:30'],
  ]
  for (const [mark, hour] of marks) {
    const r = await t.request('admin', 'POST', '/v1/attendance/clock', {
      payrollId,
      workerId: temporaryId,
      date: RECORD_DATE,
      mark,
      at: `${RECORD_DATE}T${hour}:00Z`,
    })
    recordId = r.json.id
  }
  // A bonus of 2000 and a cash payment of 1000 for the same worker, so that the money routes have rows to answer with.
  itemId = (
    await t.request('admin', 'POST', '/v1/payroll-items', {
      payrollId,
      workerId: temporaryId,
      type: 'bonus',
      amountCents: 2000,
    })
  ).json.id
  paymentId = (
    await t.request('admin', 'POST', '/v1/payments', {
      payrollId,
      workerId: temporaryId,
      date: RECORD_DATE,
      amountCents: 1000,
      method: 'cash',
    })
  ).json.id
})

// The paths carry placeholders (:worker, :group, :method) that are replaced with the ids created above.
const path = (template: string) =>
  template
    .replace(':worker', workerId)
    .replace(':group', groupId)
    .replace(':method', methodId)
    .replace(':user', USERS.coordinator)
    .replace(':area', areaId)
    .replace(':payroll', payrollId)
    .replace(':record', recordId)
    .replace(':item', itemId)
    .replace(':payment', paymentId)

type Case = [role: Role, method: string, path: string, body?: unknown]

const catalogCases: [string, string, unknown][] = [
  ['POST', '/v1/areas', { name: 'Otra área' }],
  ['PATCH', '/v1/areas/:area', { name: 'Área renombrada' }],
  ['POST', '/v1/shifts', { name: 'Día', startTime: '07:00', endTime: '17:00' }],
  ['PATCH', '/v1/shifts/:area', { name: 'Turno renombrado' }],
  ['POST', '/v1/campaigns', { name: 'Contenedor Chile' }],
  ['PATCH', '/v1/campaigns/:area', { name: 'Campaña renombrada' }],
  ['POST', '/v1/positions', { name: 'Jefe', payType: 'monthly', monthlySalary: 2500 }],
  ['PATCH', '/v1/positions/:area', { name: 'Cargo renombrado' }],
  ['POST', '/v1/groups', { name: 'Otro grupo' }],
  ['PATCH', '/v1/groups/:group', { name: 'Grupo renombrado' }],
]
const userCases: [string, string, unknown][] = [
  ['GET', '/v1/users', undefined],
  ['POST', '/v1/users', { email: 'new@example.test', password: 'clave-segura-1', name: 'Nuevo', role: 'management' }],
  ['PATCH', '/v1/users/:user', { name: 'Otro nombre' }],
]
const workerCases: [string, string, unknown][] = [
  ['POST', '/v1/workers', { firstName: 'Ana', lastName: 'Rojas', dni: '45871237', employmentType: 'temporary' }],
  ['PATCH', '/v1/workers/:worker', { firstName: 'Rosa María' }],
  ['POST', '/v1/workers/:worker/payment-methods', { type: 'yape', number: '987654321', holderName: 'Rosa Quispe' }],
  ['PATCH', '/v1/workers/:worker/payment-methods/:method', { holderName: 'Rosa M. Quispe' }],
  ['DELETE', '/v1/workers/:worker/payment-methods/:method', undefined],
  ['POST', '/v1/groups/:group/members', { workerIds: ['00000000-0000-4000-8000-00000000ffff'] }],
  ['DELETE', '/v1/groups/:group/members/:worker', undefined],
]
// The role check runs before the body is validated, so the ids of these bodies only need to have the right shape.
const SOME_ID = '00000000-0000-4000-8000-00000000ffff'
const payrollCases: [string, string, unknown][] = [
  ['POST', '/v1/payrolls', { name: 'Semana 42', type: 'weekly', startDate: '2026-10-12', endDate: '2026-10-18' }],
  ['PATCH', '/v1/payrolls/:payroll', { name: 'Semana renombrada' }],
  ['POST', '/v1/payrolls/:payroll/workers', { workerIds: [SOME_ID] }],
  ['DELETE', '/v1/payrolls/:payroll/workers/:worker', undefined],
]
const attendanceCases: [string, string, unknown][] = [
  ['POST', '/v1/attendance/clock', { payrollId: SOME_ID, workerId: SOME_ID, date: RECORD_DATE, mark: 'clockIn1' }],
  ['POST', '/v1/attendance/bulk', { payrollId: SOME_ID, date: RECORD_DATE, mark: 'clockIn1', workerIds: [SOME_ID] }],
  ['POST', '/v1/attendance', { payrollId: SOME_ID, workerId: SOME_ID, date: RECORD_DATE }],
  ['PATCH', '/v1/attendance/:record', { note: 'Corregido' }],
  ['DELETE', '/v1/attendance/:record', undefined],
]
const auditLogCases: [string, string, unknown][] = [['GET', '/v1/audit-log', undefined]]
// Money reads: management and accounting read them, the coordinator reaches none.
const moneyReadCases: [string, string, unknown][] = [
  ['GET', '/v1/payroll-items?payrollId=:payroll', undefined],
  ['GET', '/v1/payments?payrollId=:payroll', undefined],
  ['GET', '/v1/evidence/read-url?paymentId=:payment', undefined],
  ['GET', '/v1/payrolls/summary', undefined],
  ['GET', '/v1/payrolls/:payroll/balances', undefined],
  ['GET', '/v1/payrolls/:payroll/workers/:worker', undefined],
  ['GET', '/v1/workers/:worker/payrolls', undefined],
]
// Money writes: only administration and accounting write them. The ones that delete or change the payroll go last
// in the matrix (deleteCases, closeCases), although a forbidden role never modifies anything.
const moneyWriteCases: [string, string, unknown][] = [
  ['POST', '/v1/payroll-items', { payrollId: SOME_ID, workerId: SOME_ID, type: 'bonus', amountCents: 500 }],
  ['PATCH', '/v1/payroll-items/:item', { amountCents: 2500 }],
  [
    'POST',
    '/v1/payments',
    { payrollId: SOME_ID, workerId: SOME_ID, date: RECORD_DATE, amountCents: 500, method: 'cash' },
  ],
  ['POST', '/v1/evidence/upload-url', { payrollId: SOME_ID, workerId: SOME_ID, contentType: 'image/png', sizeBytes: 1000 }],
]
const deleteCases: [string, string, unknown][] = [
  ['DELETE', '/v1/payroll-items/:item', undefined],
  ['DELETE', '/v1/payments/:payment', undefined],
]
// The cost reports: administration, accounting and management read them; the coordinator reaches none.
const reportCases: [string, string, unknown][] = ['weekly', 'monthly', 'by-area', 'by-campaign', 'by-worker'].map((report) => [
  'GET',
  `/v1/reports/costs/${report}?from=2026-10-01&to=2026-10-31`,
  undefined,
])
const closeCases: [string, string, unknown][] = [['POST', '/v1/payrolls/:payroll/close', {}]]
const reopenCases: [string, string, unknown][] = [['POST', '/v1/payrolls/:payroll/reopen', undefined]]

const withRoles = (roles: Role[], cases: [string, string, unknown][]): Case[] =>
  roles.flatMap((role) => cases.map(([method, template, body]): Case => [role, method, template, body]))

const forbidden: Case[] = [
  ...withRoles(['management', 'coordinator'], [...catalogCases, ...userCases, ...auditLogCases]),
  ...withRoles(['accounting'], [...catalogCases, ...userCases, ...auditLogCases]),
  ...withRoles(['management', 'coordinator'], workerCases),
  // Accounting does manage workers, payment methods and members; it is not tested here.
  ...withRoles(['management', 'coordinator'], payrollCases),
  // The coordinator does take attendance; only management is read-only here.
  ...withRoles(['management'], attendanceCases),
  // Items, payments, evidence, balances, the summary and the receipt: the coordinator reaches none of them.
  ...withRoles(['coordinator'], [...moneyReadCases, ...reportCases]),
  ...withRoles(['management', 'coordinator'], moneyWriteCases),
  // Deleting and closing go last; only the administrator reopens.
  ...withRoles(['management', 'coordinator'], [...deleteCases, ...closeCases]),
  ...withRoles(['management', 'accounting', 'coordinator'], reopenCases),
]

describe('permission matrix by role', () => {
  it.each(forbidden)('%s cannot %s %s', async (role, method, template, body) => {
    const r = await t.request(role, method, path(template), body)
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('forbidden')
  })
})

// Bank data: these keys must not appear at all in what the coordinator gets, not even as null.
const BANK_KEYS = ['number', 'cci', 'bank', 'holderName']
// Amounts: the coordinator gets these keys with the value null (positions, payrolls and attendance blank them
// instead of dropping them), so for them the rule is "absent or null". Any number is money that leaked.
const NULLABLE_MONEY_KEYS = ['hourlyRate', 'overtimeRate', 'monthlySalary', 'amountCents', 'totalCents', 'paidCents', 'pendingCents']

// Walks the JSON and returns the path of every bank key and every amount that carries a value.
function sensitiveFields(value: unknown, trail = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => sensitiveFields(v, `${trail}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, v]) => {
    const here = `${trail}.${key}`
    if (BANK_KEYS.includes(key) || (NULLABLE_MONEY_KEYS.includes(key) && v !== null)) return [here]
    const list = key === 'paymentMethods' && Array.isArray(v) && v.length > 0 ? [here] : []
    return [...list, ...sensitiveFields(v, here)]
  })
}

describe('the coordinator never receives money or bank details', () => {
  const endpoints = () => [
    '/v1/me',
    '/v1/areas',
    '/v1/shifts',
    '/v1/campaigns',
    '/v1/positions',
    '/v1/groups',
    `/v1/groups/${groupId}`,
    '/v1/workers',
    `/v1/workers/${workerId}`,
    '/v1/payrolls',
    `/v1/payrolls/${payrollId}`,
    `/v1/attendance?payrollId=${payrollId}&date=${RECORD_DATE}`,
  ]

  beforeAll(async () => {
    await t.db.insert(userAreas).values({ userId: USERS.coordinator, areaId })
  })

  it('answers 200 on every read and without amounts or accounts', async () => {
    for (const url of endpoints()) {
      const r = await t.request('coordinator', 'GET', url)
      expect(r.status, url).toBe(200)
      expect(sensitiveFields(r.json), url).toEqual([])
    }
  })

  it('receives the hours of the record, with the amounts blanked and not dropped', async () => {
    const detail = (await t.request('coordinator', 'GET', `/v1/payrolls/${payrollId}`)).json
    const day = (await t.request('coordinator', 'GET', `/v1/attendance?payrollId=${payrollId}&date=${RECORD_DATE}`)).json
    const list = (await t.request('coordinator', 'GET', '/v1/payrolls')).json
    // The sweep above would also pass on empty responses, so first check that the records did arrive.
    expect(detail.records).toHaveLength(1)
    expect(detail.records[0]).toMatchObject({ amountCents: null, hourlyRate: null, overtimeRate: null })
    expect(detail.records[0].workedMinutes).toBe(620)
    const [entry] = day.items.filter((item: { record: unknown }) => item.record)
    expect(entry.record).toMatchObject({ amountCents: null, hourlyRate: null, overtimeRate: null })
    expect(list.items[0].totalCents).toBeNull()
    expect(list.items[0].paidCents).toBeNull()
    expect(list.items[0].pendingCents).toBeNull()
  })

  it('the administrator does receive them, so the previous test is not vacuous', async () => {
    const responses: Record<string, unknown> = {}
    for (const url of endpoints()) {
      const r = await t.request('admin', 'GET', url)
      expect(r.status, url).toBe(200)
      responses[url] = r.json
    }
    const positions = sensitiveFields(responses['/v1/positions'])
    expect(positions.some((p) => p.endsWith('.hourlyRate'))).toBe(true)
    expect(positions.some((p) => p.endsWith('.overtimeRate'))).toBe(true)
    expect(positions.some((p) => p.endsWith('.monthlySalary'))).toBe(true)

    const record = sensitiveFields(responses[`/v1/workers/${workerId}`])
    for (const key of ['paymentMethods', 'number', 'bank', 'cci', 'holderName']) {
      expect(record.some((p) => p.endsWith(`.${key}`)), key).toBe(true)
    }

    // The amounts of payrolls and attendance are numbers above zero for the administrator.
    const listed = (responses['/v1/payrolls'] as { items: { totalCents: number; paidCents: number; pendingCents: number }[] }).items[0]
    expect(listed.totalCents).toBeGreaterThan(0)
    // The cash payment of the setup is 1000; what is pending is the total minus what was paid.
    expect(listed.paidCents).toBe(1000)
    expect(listed.pendingCents).toBe(listed.totalCents - 1000)
    const detailJson = responses[`/v1/payrolls/${payrollId}`] as { records: { amountCents: number }[] }
    expect(detailJson.records[0].amountCents).toBeGreaterThan(0)
    const dayJson = responses[`/v1/attendance?payrollId=${payrollId}&date=${RECORD_DATE}`] as {
      items: { record: { amountCents: number } | null }[]
    }
    expect(dayJson.items.find((item) => item.record)?.record?.amountCents).toBeGreaterThan(0)
  })
})
