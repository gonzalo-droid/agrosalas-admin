import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('positions and rates', () => {
  it('creates an hourly position with both rates', async () => {
    const r = await t.request('admin', 'POST', '/v1/cargos', {
      nombre: 'Estibador',
      tipoPago: 'por_hora',
      tarifaHora: 10,
      tarifaHoraExtra: 12.5,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ nombre: 'Estibador', tarifaHora: 10, tarifaHoraExtra: 12.5, sueldoMensual: null })
  })

  it('keeps four decimals in the rate', async () => {
    const r = await t.request('admin', 'POST', '/v1/cargos', {
      nombre: 'Operario',
      tipoPago: 'por_hora',
      tarifaHora: 6.25,
      tarifaHoraExtra: 7.8125,
    })
    expect(r.json.tarifaHoraExtra).toBe(7.8125)
  })

  it('requires rates in an hourly position and a salary in a monthly one', async () => {
    const withoutOvertime = await t.request('admin', 'POST', '/v1/cargos', { nombre: 'Mecánico', tipoPago: 'por_hora', tarifaHora: 30 })
    expect(withoutOvertime.status).toBe(400)
    expect(withoutOvertime.json.error.campo).toBe('tarifaHora')

    const withoutSalary = await t.request('admin', 'POST', '/v1/cargos', { nombre: 'Jefe de planta', tipoPago: 'mensual' })
    expect(withoutSalary.status).toBe(400)
    expect(withoutSalary.json.error.campo).toBe('sueldoMensual')
  })

  it('validates against the already saved position when editing', async () => {
    const { json: position } = await t.request('admin', 'POST', '/v1/cargos', {
      nombre: 'Jefa de almacén',
      tipoPago: 'mensual',
      sueldoMensual: 1800,
    })
    const toHourly = await t.request('admin', 'PATCH', `/v1/cargos/${position.id}`, { tipoPago: 'por_hora' })
    expect(toHourly.status).toBe(400)

    const raise = await t.request('admin', 'PATCH', `/v1/cargos/${position.id}`, { sueldoMensual: 2000 })
    expect(raise.json.sueldoMensual).toBe(2000)
  })

  it('the coordinator receives the positions without amounts', async () => {
    const r = await t.request('coordinador', 'GET', '/v1/cargos')
    expect(r.status).toBe(200)
    expect(r.json.datos.length).toBeGreaterThan(0)
    for (const position of r.json.datos) {
      expect(position.tarifaHora).toBeNull()
      expect(position.tarifaHoraExtra).toBeNull()
      expect(position.sueldoMensual).toBeNull()
    }
  })

  it('management does see the amounts, but cannot create', async () => {
    const list = await t.request('gerencia', 'GET', '/v1/cargos')
    expect(list.json.datos.find((p: { nombre: string }) => p.nombre === 'Estibador').tarifaHora).toBe(10)
    const create = await t.request('gerencia', 'POST', '/v1/cargos', { nombre: 'X1', tipoPago: 'mensual', sueldoMensual: 1 })
    expect(create.status).toBe(403)
  })

  it('rejects an edit without any field with 400', async () => {
    const { json: position } = await t.request('admin', 'POST', '/v1/cargos', {
      nombre: 'Vigilante',
      tipoPago: 'mensual',
      sueldoMensual: 1200,
    })
    const r = await t.request('admin', 'PATCH', `/v1/cargos/${position.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })
})
