import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
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
  areaId = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  positionId = (
    await t.request('admin', 'POST', '/v1/cargos', {
      nombre: 'Operario',
      tipoPago: 'por_hora',
      tarifaHora: 6.5,
      tarifaHoraExtra: 8.1,
      sueldoMensual: 1800,
    })
  ).json.id
  groupId = (await t.request('admin', 'POST', '/v1/grupos', { nombre: 'Turno noche' })).json.id
  const worker = await t.request('admin', 'POST', '/v1/trabajadores', {
    nombres: 'Rosa',
    apellidos: 'Quispe',
    dni: '45871236',
    modalidad: 'contrato',
    areaId,
    cargoId: positionId,
  })
  workerId = worker.json.id
  methodId = (
    await t.request('admin', 'POST', `/v1/trabajadores/${workerId}/metodos-pago`, {
      tipo: 'cuenta_bancaria',
      numero: '19412345678901',
      banco: 'BCP',
      cci: '00219400123456789012',
      titular: 'Rosa Quispe',
    })
  ).json.id
  await t.request('admin', 'POST', `/v1/grupos/${groupId}/miembros`, { trabajadorIds: [workerId] })
})

// The paths carry placeholders (:worker, :group, :method) that are replaced with the ids created above.
const path = (template: string) =>
  template
    .replace(':worker', workerId)
    .replace(':group', groupId)
    .replace(':method', methodId)
    .replace(':user', USERS.coordinador)
    .replace(':area', areaId)

type Case = [role: Role, method: string, path: string, body?: unknown]

const catalogs: [string, string, unknown][] = [
  ['POST', '/v1/areas', { nombre: 'Otra área' }],
  ['PATCH', '/v1/areas/:area', { nombre: 'Área renombrada' }],
  ['POST', '/v1/turnos', { nombre: 'Día', horaInicio: '07:00', horaFin: '17:00' }],
  ['PATCH', '/v1/turnos/:area', { nombre: 'Turno renombrado' }],
  ['POST', '/v1/campanas', { nombre: 'Contenedor Chile' }],
  ['PATCH', '/v1/campanas/:area', { nombre: 'Campaña renombrada' }],
  ['POST', '/v1/cargos', { nombre: 'Jefe', tipoPago: 'mensual', sueldoMensual: 2500 }],
  ['PATCH', '/v1/cargos/:area', { nombre: 'Cargo renombrado' }],
  ['POST', '/v1/grupos', { nombre: 'Otro grupo' }],
  ['PATCH', '/v1/grupos/:group', { nombre: 'Grupo renombrado' }],
]
const users: [string, string, unknown][] = [
  ['GET', '/v1/usuarios', undefined],
  ['POST', '/v1/usuarios', { correo: 'new@example.test', clave: 'clave-segura-1', nombre: 'Nuevo', rol: 'gerencia' }],
  ['PATCH', '/v1/usuarios/:user', { nombre: 'Otro nombre' }],
]
const workersAndPayments: [string, string, unknown][] = [
  ['POST', '/v1/trabajadores', { nombres: 'Ana', apellidos: 'Rojas', dni: '45871237', modalidad: 'temporal' }],
  ['PATCH', '/v1/trabajadores/:worker', { nombres: 'Rosa María' }],
  ['POST', '/v1/trabajadores/:worker/metodos-pago', { tipo: 'yape', numero: '987654321', titular: 'Rosa Quispe' }],
  ['PATCH', '/v1/trabajadores/:worker/metodos-pago/:method', { titular: 'Rosa M. Quispe' }],
  ['DELETE', '/v1/trabajadores/:worker/metodos-pago/:method', undefined],
  ['POST', '/v1/grupos/:group/miembros', { trabajadorIds: ['00000000-0000-4000-8000-00000000ffff'] }],
  ['DELETE', '/v1/grupos/:group/miembros/:worker', undefined],
]
const auditLog: [string, string, unknown][] = [['GET', '/v1/auditoria', undefined]]

const withRoles = (roles: Role[], cases: [string, string, unknown][]): Case[] =>
  roles.flatMap((role) => cases.map(([method, template, body]): Case => [role, method, template, body]))

const forbidden: Case[] = [
  ...withRoles(['gerencia', 'coordinador'], [...catalogs, ...users, ...auditLog]),
  ...withRoles(['contabilidad'], [...catalogs, ...users, ...auditLog]),
  ...withRoles(['gerencia', 'coordinador'], workersAndPayments),
  // Accounting does manage workers, payment methods and members; it is not tested here.
]

describe('permission matrix by role', () => {
  it.each(forbidden)('%s cannot %s %s', async (role, method, template, body) => {
    const r = await t.request(role, method, path(template), body)
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_permiso')
  })
})

const SENSITIVE_KEYS = ['tarifaHora', 'tarifaHoraExtra', 'sueldoMensual', 'numero', 'cci', 'banco', 'titular']

// Walks the JSON and returns the path of every money or bank field that carries a value.
function sensitiveFields(value: unknown, trail = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => sensitiveFields(v, `${trail}[${i}]`))
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value).flatMap(([key, v]) => {
    const here = `${trail}.${key}`
    if (SENSITIVE_KEYS.includes(key) && v !== null) return [here]
    const list = key === 'metodosPago' && Array.isArray(v) && v.length > 0 ? [here] : []
    return [...list, ...sensitiveFields(v, here)]
  })
}

describe('the coordinator never receives money or bank details', () => {
  const endpoints = () => [
    '/v1/me',
    '/v1/areas',
    '/v1/turnos',
    '/v1/campanas',
    '/v1/cargos',
    '/v1/grupos',
    `/v1/grupos/${groupId}`,
    '/v1/trabajadores',
    `/v1/trabajadores/${workerId}`,
  ]

  beforeAll(async () => {
    await t.db.insert(usuarioAreas).values({ usuarioId: USERS.coordinador, areaId })
  })

  it('answers 200 on every read and without amounts or accounts', async () => {
    for (const url of endpoints()) {
      const r = await t.request('coordinador', 'GET', url)
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
    const positions = sensitiveFields(responses['/v1/cargos'])
    expect(positions.some((p) => p.endsWith('.tarifaHora'))).toBe(true)
    expect(positions.some((p) => p.endsWith('.tarifaHoraExtra'))).toBe(true)
    expect(positions.some((p) => p.endsWith('.sueldoMensual'))).toBe(true)

    const record = sensitiveFields(responses[`/v1/trabajadores/${workerId}`])
    for (const key of ['metodosPago', 'numero', 'banco', 'cci', 'titular']) {
      expect(record.some((p) => p.endsWith(`.${key}`)), key).toBe(true)
    }
  })
})
