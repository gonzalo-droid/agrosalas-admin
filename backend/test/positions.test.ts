import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('positions and rates', () => {
  it('creates an hourly position with both rates', async () => {
    const r = await t.request('admin', 'POST', '/v1/positions', {
      name: 'Estibador',
      payType: 'hourly',
      hourlyRate: 10,
      overtimeRate: 12.5,
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ name: 'Estibador', hourlyRate: 10, overtimeRate: 12.5, monthlySalary: null })
  })

  it('keeps four decimals in the rate', async () => {
    const r = await t.request('admin', 'POST', '/v1/positions', {
      name: 'Operario',
      payType: 'hourly',
      hourlyRate: 6.25,
      overtimeRate: 7.8125,
    })
    expect(r.json.overtimeRate).toBe(7.8125)
  })

  it('requires rates in an hourly position and a salary in a monthly one', async () => {
    const withoutOvertime = await t.request('admin', 'POST', '/v1/positions', { name: 'Mecánico', payType: 'hourly', hourlyRate: 30 })
    expect(withoutOvertime.status).toBe(400)
    expect(withoutOvertime.json.error.field).toBe('hourlyRate')

    const withoutSalary = await t.request('admin', 'POST', '/v1/positions', { name: 'Jefe de planta', payType: 'monthly' })
    expect(withoutSalary.status).toBe(400)
    expect(withoutSalary.json.error.field).toBe('monthlySalary')
  })

  it('validates against the already saved position when editing', async () => {
    const { json: position } = await t.request('admin', 'POST', '/v1/positions', {
      name: 'Jefa de almacén',
      payType: 'monthly',
      monthlySalary: 1800,
    })
    const toHourly = await t.request('admin', 'PATCH', `/v1/positions/${position.id}`, { payType: 'hourly' })
    expect(toHourly.status).toBe(400)

    const raise = await t.request('admin', 'PATCH', `/v1/positions/${position.id}`, { monthlySalary: 2000 })
    expect(raise.json.monthlySalary).toBe(2000)
  })

  it('the coordinator receives the positions without amounts', async () => {
    const r = await t.request('coordinator', 'GET', '/v1/positions')
    expect(r.status).toBe(200)
    expect(r.json.items.length).toBeGreaterThan(0)
    for (const position of r.json.items) {
      expect(position.hourlyRate).toBeNull()
      expect(position.overtimeRate).toBeNull()
      expect(position.monthlySalary).toBeNull()
    }
  })

  it('management does see the amounts, but cannot create', async () => {
    const list = await t.request('management', 'GET', '/v1/positions')
    expect(list.json.items.find((p: { name: string }) => p.name === 'Estibador').hourlyRate).toBe(10)
    const create = await t.request('management', 'POST', '/v1/positions', { name: 'X1', payType: 'monthly', monthlySalary: 1 })
    expect(create.status).toBe(403)
  })

  it('rejects an edit without any field with 400', async () => {
    const { json: position } = await t.request('admin', 'POST', '/v1/positions', {
      name: 'Vigilante',
      payType: 'monthly',
      monthlySalary: 1200,
    })
    const r = await t.request('admin', 'PATCH', `/v1/positions/${position.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.code).toBe('validation')
    expect(r.json.error.message).toBe('Indica al menos un campo para editar')
  })
})
