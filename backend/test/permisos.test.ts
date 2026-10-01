import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import type { Rol } from '../src/tipos'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let areaId: string
let cargoId: string
let grupoId: string
let trabajadorId: string
let metodoId: string

beforeAll(async () => {
  p = await crearPrueba()
  areaId = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  cargoId = (
    await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Operario',
      tipoPago: 'por_hora',
      tarifaHora: 6.5,
      tarifaHoraExtra: 8.1,
      sueldoMensual: 1800,
    })
  ).json.id
  grupoId = (await p.pedir('admin', 'POST', '/v1/grupos', { nombre: 'Turno noche' })).json.id
  const trabajador = await p.pedir('admin', 'POST', '/v1/trabajadores', {
    nombres: 'Rosa',
    apellidos: 'Quispe',
    dni: '45871236',
    modalidad: 'contrato',
    areaId,
    cargoId,
  })
  trabajadorId = trabajador.json.id
  metodoId = (
    await p.pedir('admin', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'cuenta_bancaria',
      numero: '19412345678901',
      banco: 'BCP',
      cci: '00219400123456789012',
      titular: 'Rosa Quispe',
    })
  ).json.id
  await p.pedir('admin', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [trabajadorId] })
})

// Las rutas llevan marcadores (:trabajador, :grupo, :metodo) que se reemplazan con los ids creados arriba.
const ruta = (plantilla: string) =>
  plantilla
    .replace(':trabajador', trabajadorId)
    .replace(':grupo', grupoId)
    .replace(':metodo', metodoId)
    .replace(':usuario', USUARIOS.coordinador)
    .replace(':area', areaId)

type Fila = [rol: Rol, metodo: string, ruta: string, cuerpo?: unknown]

const catalogos: [string, string, unknown][] = [
  ['POST', '/v1/areas', { nombre: 'Otra área' }],
  ['PATCH', '/v1/areas/:area', { nombre: 'Área renombrada' }],
  ['POST', '/v1/turnos', { nombre: 'Día', horaInicio: '07:00', horaFin: '17:00' }],
  ['PATCH', '/v1/turnos/:area', { nombre: 'Turno renombrado' }],
  ['POST', '/v1/campanas', { nombre: 'Contenedor Chile' }],
  ['PATCH', '/v1/campanas/:area', { nombre: 'Campaña renombrada' }],
  ['POST', '/v1/cargos', { nombre: 'Jefe', tipoPago: 'mensual', sueldoMensual: 2500 }],
  ['PATCH', '/v1/cargos/:area', { nombre: 'Cargo renombrado' }],
  ['POST', '/v1/grupos', { nombre: 'Otro grupo' }],
  ['PATCH', '/v1/grupos/:grupo', { nombre: 'Grupo renombrado' }],
]
const usuarios: [string, string, unknown][] = [
  ['GET', '/v1/usuarios', undefined],
  ['POST', '/v1/usuarios', { correo: 'nuevo@prueba.test', clave: 'clave-segura-1', nombre: 'Nuevo', rol: 'gerencia' }],
  ['PATCH', '/v1/usuarios/:usuario', { nombre: 'Otro nombre' }],
]
const trabajadoresYPagos: [string, string, unknown][] = [
  ['POST', '/v1/trabajadores', { nombres: 'Ana', apellidos: 'Rojas', dni: '45871237', modalidad: 'temporal' }],
  ['PATCH', '/v1/trabajadores/:trabajador', { nombres: 'Rosa María' }],
  ['POST', '/v1/trabajadores/:trabajador/metodos-pago', { tipo: 'yape', numero: '987654321', titular: 'Rosa Quispe' }],
  ['PATCH', '/v1/trabajadores/:trabajador/metodos-pago/:metodo', { titular: 'Rosa M. Quispe' }],
  ['DELETE', '/v1/trabajadores/:trabajador/metodos-pago/:metodo', undefined],
  ['POST', '/v1/grupos/:grupo/miembros', { trabajadorIds: ['00000000-0000-4000-8000-00000000ffff'] }],
  ['DELETE', '/v1/grupos/:grupo/miembros/:trabajador', undefined],
]
const auditoria: [string, string, unknown][] = [['GET', '/v1/auditoria', undefined]]

const con = (roles: Rol[], filas: [string, string, unknown][]): Fila[] =>
  roles.flatMap((rol) => filas.map(([metodo, ruta, cuerpo]): Fila => [rol, metodo, ruta, cuerpo]))

const prohibidas: Fila[] = [
  ...con(['gerencia', 'coordinador'], [...catalogos, ...usuarios, ...auditoria]),
  ...con(['contabilidad'], [...catalogos, ...usuarios, ...auditoria]),
  ...con(['gerencia', 'coordinador'], trabajadoresYPagos),
  // Contabilidad sí gestiona trabajadores, métodos de pago y miembros; no se prueba aquí.
]

describe('matriz de permisos por rol', () => {
  it.each(prohibidas)('%s no puede %s %s', async (rol, metodo, plantilla, cuerpo) => {
    const r = await p.pedir(rol, metodo, ruta(plantilla), cuerpo)
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_permiso')
  })
})

const CLAVES_SENSIBLES = ['tarifaHora', 'tarifaHoraExtra', 'sueldoMensual', 'numero', 'cci', 'banco', 'titular']

// Recorre el JSON y devuelve la ruta de cada dato de dinero o de banco que trae un valor.
function datosSensibles(valor: unknown, camino = '$'): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => datosSensibles(v, `${camino}[${i}]`))
  if (valor === null || typeof valor !== 'object') return []
  return Object.entries(valor).flatMap(([clave, v]) => {
    const aqui = `${camino}.${clave}`
    if (CLAVES_SENSIBLES.includes(clave) && v !== null) return [aqui]
    const lista = clave === 'metodosPago' && Array.isArray(v) && v.length > 0 ? [aqui] : []
    return [...lista, ...datosSensibles(v, aqui)]
  })
}

describe('el coordinador nunca recibe dinero ni datos bancarios', () => {
  const endpoints = () => [
    '/v1/me',
    '/v1/areas',
    '/v1/turnos',
    '/v1/campanas',
    '/v1/cargos',
    '/v1/grupos',
    `/v1/grupos/${grupoId}`,
    '/v1/trabajadores',
    `/v1/trabajadores/${trabajadorId}`,
  ]

  beforeAll(async () => {
    await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId })
  })

  it('responde 200 en cada lectura y sin montos ni cuentas', async () => {
    for (const url of endpoints()) {
      const r = await p.pedir('coordinador', 'GET', url)
      expect(r.status, url).toBe(200)
      expect(datosSensibles(r.json), url).toEqual([])
    }
  })

  it('el administrador sí los recibe, así que la prueba anterior no es vacía', async () => {
    const respuestas: Record<string, unknown> = {}
    for (const url of endpoints()) {
      const r = await p.pedir('admin', 'GET', url)
      expect(r.status, url).toBe(200)
      respuestas[url] = r.json
    }
    const cargos = datosSensibles(respuestas['/v1/cargos'])
    expect(cargos.some((c) => c.endsWith('.tarifaHora'))).toBe(true)
    expect(cargos.some((c) => c.endsWith('.tarifaHoraExtra'))).toBe(true)
    expect(cargos.some((c) => c.endsWith('.sueldoMensual'))).toBe(true)

    const ficha = datosSensibles(respuestas[`/v1/trabajadores/${trabajadorId}`])
    for (const clave of ['metodosPago', 'numero', 'banco', 'cci', 'titular']) {
      expect(ficha.some((c) => c.endsWith(`.${clave}`)), clave).toBe(true)
    }
  })
})
