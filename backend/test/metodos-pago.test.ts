import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let trabajadorId: string
let deOtraArea: string
let yapeId: string
let cuentaId: string

beforeAll(async () => {
  p = await crearPrueba()
  const produccion = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  const almacen = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
  const crear = (dni: string, areaId: string) =>
    p.pedir('admin', 'POST', '/v1/trabajadores', { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal', dni, areaId })
  trabajadorId = (await crear('45871236', produccion)).json.id
  deOtraArea = (await crear('40236517', almacen)).json.id
})

describe('métodos de pago', () => {
  it('el primer método queda como principal', async () => {
    const r = await p.pedir('contabilidad', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'yape',
      numero: '912345678',
      titular: 'Jhon Torres',
    })
    expect(r.status).toBe(201)
    expect(r.json.principal).toBe(true)
    yapeId = r.json.id
  })

  it('un segundo método no desplaza al principal salvo que se pida', async () => {
    const r = await p.pedir('admin', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'cuenta_bancaria',
      numero: '191-00000000-0-00',
      banco: 'BCP',
      cci: '002-191-000000000000-00',
      titular: 'Ana Torres Quispe',
    })
    expect(r.json.principal).toBe(false)
    cuentaId = r.json.id
  })

  it('marcar otro como principal desmarca al anterior', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`, { principal: true })
    expect(r.json.principal).toBe(true)
    const { json: ficha } = await p.pedir('admin', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.metodosPago.map((m: { id: string; principal: boolean }) => [m.id, m.principal])).toEqual([
      [yapeId, false],
      [cuentaId, true],
    ])
  })

  it('no permite dejar al trabajador sin principal desmarcándolo', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`, { principal: false })
    expect(r.status).toBe(400)
  })

  it('rechaza una edición sin ningún campo', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${trabajadorId}/metodos-pago/${yapeId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('al quitar el principal, el más antiguo que queda pasa a serlo', async () => {
    const r = await p.pedir('admin', 'DELETE', `/v1/trabajadores/${trabajadorId}/metodos-pago/${cuentaId}`)
    expect(r.status).toBe(200)
    const { json: ficha } = await p.pedir('admin', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.metodosPago).toHaveLength(1)
    expect(ficha.metodosPago[0]).toMatchObject({ id: yapeId, principal: true })
  })

  it('el coordinador ve la ficha de su área sin métodos de pago, y no puede agregarlos', async () => {
    const ficha = await p.pedir('coordinador', 'GET', `/v1/trabajadores/${trabajadorId}`)
    expect(ficha.status).toBe(200)
    expect(ficha.json.metodosPago).toEqual([])
    const r = await p.pedir('coordinador', 'POST', `/v1/trabajadores/${trabajadorId}/metodos-pago`, {
      tipo: 'plin',
      numero: '999888777',
      titular: 'X Y',
    })
    expect(r.status).toBe(403)
  })

  it('el coordinador recibe 404 por un trabajador de otra área', async () => {
    const r = await p.pedir('coordinador', 'GET', `/v1/trabajadores/${deOtraArea}`)
    expect(r.status).toBe(404)
  })
})
