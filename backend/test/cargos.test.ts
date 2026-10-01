import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('cargos y tarifas', () => {
  it('crea un cargo por hora con sus dos tarifas', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Estibador',
      tipoPago: 'por_hora',
      tarifaHora: 10,
      tarifaHoraExtra: 12.5,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ nombre: 'Estibador', tarifaHora: 10, tarifaHoraExtra: 12.5, sueldoMensual: null })
  })

  it('conserva cuatro decimales en la tarifa', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Operario',
      tipoPago: 'por_hora',
      tarifaHora: 6.25,
      tarifaHoraExtra: 7.8125,
    })
    expect(r.json.tarifaHoraExtra).toBe(7.8125)
  })

  it('exige tarifas en un cargo por hora y sueldo en uno mensual', async () => {
    const sinExtra = await p.pedir('admin', 'POST', '/v1/cargos', { nombre: 'Mecánico', tipoPago: 'por_hora', tarifaHora: 30 })
    expect(sinExtra.status).toBe(400)
    expect(sinExtra.json.error.campo).toBe('tarifaHora')

    const sinSueldo = await p.pedir('admin', 'POST', '/v1/cargos', { nombre: 'Jefe de planta', tipoPago: 'mensual' })
    expect(sinSueldo.status).toBe(400)
    expect(sinSueldo.json.error.campo).toBe('sueldoMensual')
  })

  it('al editar valida contra el cargo ya guardado', async () => {
    const { json: cargo } = await p.pedir('admin', 'POST', '/v1/cargos', {
      nombre: 'Jefa de almacén',
      tipoPago: 'mensual',
      sueldoMensual: 1800,
    })
    const aPorHora = await p.pedir('admin', 'PATCH', `/v1/cargos/${cargo.id}`, { tipoPago: 'por_hora' })
    expect(aPorHora.status).toBe(400)

    const sube = await p.pedir('admin', 'PATCH', `/v1/cargos/${cargo.id}`, { sueldoMensual: 2000 })
    expect(sube.json.sueldoMensual).toBe(2000)
  })

  it('el coordinador recibe los cargos sin montos', async () => {
    const r = await p.pedir('coordinador', 'GET', '/v1/cargos')
    expect(r.status).toBe(200)
    expect(r.json.datos.length).toBeGreaterThan(0)
    for (const cargo of r.json.datos) {
      expect(cargo.tarifaHora).toBeNull()
      expect(cargo.tarifaHoraExtra).toBeNull()
      expect(cargo.sueldoMensual).toBeNull()
    }
  })

  it('gerencia sí ve los montos, pero no puede crear', async () => {
    const lista = await p.pedir('gerencia', 'GET', '/v1/cargos')
    expect(lista.json.datos.find((c: { nombre: string }) => c.nombre === 'Estibador').tarifaHora).toBe(10)
    const crear = await p.pedir('gerencia', 'POST', '/v1/cargos', { nombre: 'X1', tipoPago: 'mensual', sueldoMensual: 1 })
    expect(crear.status).toBe(403)
  })
})
