import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
})

describe('areas', () => {
  it('the administrator creates and every role lists', async () => {
    const created = await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(created.status).toBe(201)
    expect(created.json).toMatchObject({ nombre: 'Producción', activo: true })

    const list = await t.request('coordinador', 'GET', '/v1/areas')
    expect(list.status).toBe(200)
    expect(list.json.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Producción'])
  })

  it('only the administrator can create or edit', async () => {
    const r = await t.request('contabilidad', 'POST', '/v1/areas', { nombre: 'Almacén' })
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_permiso')
  })

  it('rejects a repeated name with 409', async () => {
    const r = await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(r.status).toBe(409)
    expect(r.json.error.codigo).toBe('duplicado')
  })

  it('edits, deactivates and answers 404 if it does not exist', async () => {
    const { json: area } = await t.request('admin', 'POST', '/v1/areas', { nombre: 'Etiquetado' })
    const edited = await t.request('admin', 'PATCH', `/v1/areas/${area.id}`, { activo: false })
    expect(edited.status).toBe(200)
    expect(edited.json.activo).toBe(false)

    const missing = await t.request('admin', 'PATCH', '/v1/areas/00000000-0000-4000-8000-00000000ffff', { activo: false })
    expect(missing.status).toBe(404)
  })

  it('leaves creation and edit in the audit log', async () => {
    const r = await t.request('admin', 'GET', '/v1/auditoria?entidad=areas')
    expect(r.json.datos.map((row: { accion: string }) => row.accion).sort()).toEqual(['crear', 'crear', 'editar'])
  })

  it('rejects an edit without any field with 400', async () => {
    const { json: area } = await t.request('admin', 'POST', '/v1/areas', { nombre: 'Mantenimiento' })
    const r = await t.request('admin', 'PATCH', `/v1/areas/${area.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
    expect('campo' in r.json.error).toBe(false)
  })
})

describe('shifts', () => {
  it('creates with HH:MM times and rejects another format', async () => {
    const ok = await t.request('admin', 'POST', '/v1/turnos', { nombre: 'Día', horaInicio: '07:00', horaFin: '17:00' })
    expect(ok.status).toBe(201)
    expect(ok.json.horaInicio).toBe('07:00:00')

    const bad = await t.request('admin', 'POST', '/v1/turnos', { nombre: 'Noche', horaInicio: '7pm', horaFin: '05:00' })
    expect(bad.status).toBe(400)
    expect(bad.json.error.campo).toBe('horaInicio')
  })
})

describe('campaigns', () => {
  it('creates with optional dates and edits', async () => {
    const created = await t.request('admin', 'POST', '/v1/campanas', { nombre: 'Contenedor Chile' })
    expect(created.status).toBe(201)
    expect(created.json.fechaInicio).toBeNull()

    const edited = await t.request('admin', 'PATCH', `/v1/campanas/${created.json.id}`, {
      fechaInicio: '2026-09-07',
      fechaFin: '2026-10-04',
    })
    expect(edited.json).toMatchObject({ fechaInicio: '2026-09-07', fechaFin: '2026-10-04' })
  })
})
