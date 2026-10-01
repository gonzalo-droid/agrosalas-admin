import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { createTestApp, USERS } from './helpers'

let t: Awaited<ReturnType<typeof createTestApp>>
let production: string
let warehouse: string

const base = { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal' }

beforeAll(async () => {
  t = await createTestApp()
  production = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  warehouse = (await t.request('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await t.db.insert(usuarioAreas).values({ usuarioId: USERS.coordinador, areaId: production })
})

describe('create and edit workers', () => {
  it('accounting creates with DNI and name; everything else is optional', async () => {
    const r = await t.request('contabilidad', 'POST', '/v1/trabajadores', { ...base, dni: '45871236', areaId: production })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ dni: '45871236', estado: 'activo', telefono: null })
  })

  it('requires an 8-digit DNI when creating', async () => {
    const missing = await t.request('admin', 'POST', '/v1/trabajadores', base)
    expect(missing.status).toBe(400)
    expect(missing.json.error.campo).toBe('dni')
    const short = await t.request('admin', 'POST', '/v1/trabajadores', { ...base, dni: '123' })
    expect(short.json.error.mensaje).toBe('El DNI debe tener 8 dígitos')
  })

  it('rejects a repeated DNI with 409', async () => {
    const r = await t.request('admin', 'POST', '/v1/trabajadores', { ...base, nombres: 'Otra', dni: '45871236' })
    expect(r.status).toBe(409)
  })

  it('management and coordinator cannot create', async () => {
    for (const role of ['gerencia', 'coordinador'] as const) {
      const r = await t.request(role, 'POST', '/v1/trabajadores', { ...base, dni: '11112222' })
      expect(r.status).toBe(403)
    }
  })

  it('edits, terminates and leaves the before and after in the audit log', async () => {
    const { json: worker } = await t.request('admin', 'POST', '/v1/trabajadores', {
      ...base,
      nombres: 'José',
      apellidos: 'Chávez Rojas',
      dni: '40236517',
      areaId: warehouse,
    })
    const r = await t.request('contabilidad', 'PATCH', `/v1/trabajadores/${worker.id}`, { estado: 'cesado', telefono: '987654321' })
    expect(r.json).toMatchObject({ estado: 'cesado', telefono: '987654321' })

    const audit = await t.request('admin', 'GET', '/v1/auditoria?entidad=trabajadores')
    const edit = audit.json.datos.find((row: { accion: string }) => row.accion === 'editar')
    expect(edit.antes.estado).toBe('activo')
    expect(edit.despues.estado).toBe('cesado')
    expect(edit.usuarioNombre).toBe('Usuario contabilidad')
  })

  it('rejects an edit without any field', async () => {
    const id = (await t.request('admin', 'GET', '/v1/trabajadores?texto=torres')).json.datos[0].id
    const r = await t.request('admin', 'PATCH', `/v1/trabajadores/${id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('answers 400 if the given area does not exist', async () => {
    const r = await t.request('admin', 'POST', '/v1/trabajadores', {
      nombres: 'Sin',
      apellidos: 'Área',
      modalidad: 'temporal',
      dni: '99998888',
      areaId: '00000000-0000-4000-8000-00000000ffff',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('referencia_invalida')
  })
})

describe('list workers', () => {
  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      await t.request('admin', 'POST', '/v1/trabajadores', {
        nombres: `Persona ${i}`,
        apellidos: `Apellido ${i}`,
        dni: `7000000${i}`,
        modalidad: i === 0 ? 'contrato' : 'temporal',
        areaId: i < 3 ? production : warehouse,
      })
    }
  })

  it('paginates and returns the total', async () => {
    const r = await t.request('admin', 'GET', '/v1/trabajadores?pagina=2&tamano=3')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 7, pagina: 2, tamano: 3 })
    expect(r.json.datos).toHaveLength(3)
  })

  it('sorts by last name', async () => {
    const r = await t.request('admin', 'GET', '/v1/trabajadores?tamano=100')
    const lastNames = r.json.datos.map((w: { apellidos: string }) => w.apellidos)
    expect(lastNames).toEqual([...lastNames].sort((a, b) => a.localeCompare(b)))
  })

  it('filters by text (name, last name or DNI), area, employment type and status', async () => {
    expect((await t.request('admin', 'GET', '/v1/trabajadores?texto=torres')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', '/v1/trabajadores?texto=4023')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', `/v1/trabajadores?areaId=${warehouse}`)).json.total).toBe(3)
    expect((await t.request('admin', 'GET', '/v1/trabajadores?modalidad=contrato')).json.total).toBe(1)
    expect((await t.request('admin', 'GET', '/v1/trabajadores?estado=cesado')).json.total).toBe(1)
  })

  it('rejects a page size greater than 100', async () => {
    const r = await t.request('admin', 'GET', '/v1/trabajadores?tamano=500')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })

  it('the coordinator only sees the workers of their areas', async () => {
    const r = await t.request('coordinador', 'GET', '/v1/trabajadores?tamano=100')
    expect(r.json.total).toBe(4)
    expect(r.json.datos.every((w: { areaId: string }) => w.areaId === production)).toBe(true)
  })

  it('a coordinator without areas sees nobody', async () => {
    await t.db.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, USERS.coordinador))
    expect((await t.request('coordinador', 'GET', '/v1/trabajadores')).json.total).toBe(0)
    await t.db.insert(usuarioAreas).values({ usuarioId: USERS.coordinador, areaId: production })
  })
})
