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
})

// The paths carry placeholders (:worker, :group, :method) that are replaced with the ids created above.
const path = (template: string) =>
  template
    .replace(':worker', workerId)
    .replace(':group', groupId)
    .replace(':method', methodId)
    .replace(':user', USERS.coordinator)
    .replace(':area', areaId)

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
const auditLogCases: [string, string, unknown][] = [['GET', '/v1/audit-log', undefined]]

const withRoles = (roles: Role[], cases: [string, string, unknown][]): Case[] =>
  roles.flatMap((role) => cases.map(([method, template, body]): Case => [role, method, template, body]))

const forbidden: Case[] = [
  ...withRoles(['management', 'coordinator'], [...catalogCases, ...userCases, ...auditLogCases]),
  ...withRoles(['accounting'], [...catalogCases, ...userCases, ...auditLogCases]),
  ...withRoles(['management', 'coordinator'], workerCases),
  // Accounting does manage workers, payment methods and members; it is not tested here.
]

describe('permission matrix by role', () => {
  it.each(forbidden)('%s cannot %s %s', async (role, method, template, body) => {
    const r = await t.request(role, method, path(template), body)
    expect(r.status).toBe(403)
    expect(r.json.error.code).toBe('forbidden')
  })
})

const SENSITIVE_KEYS = ['hourlyRate', 'overtimeRate', 'monthlySalary', 'number', 'cci', 'bank', 'holderName']

// Walks the JSON and returns the path of every money or bank field that carries a value.
function sensitiveFields(value: unknown, trail = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => sensitiveFields(v, `${trail}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, v]) => {
    const here = `${trail}.${key}`
    if (SENSITIVE_KEYS.includes(key) && v !== null) return [here]
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
  })
})
