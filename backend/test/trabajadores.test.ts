import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { usuarioAreas } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let produccion: string
let almacen: string

const base = { nombres: 'Ana', apellidos: 'Torres Quispe', modalidad: 'temporal' }

beforeAll(async () => {
  p = await crearPrueba()
  produccion = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
  almacen = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Almacén' })).json.id
  await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
})

describe('crear y editar trabajadores', () => {
  it('contabilidad crea con DNI y nombre; lo demás es opcional', async () => {
    const r = await p.pedir('contabilidad', 'POST', '/v1/trabajadores', { ...base, dni: '45871236', areaId: produccion })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ dni: '45871236', estado: 'activo', telefono: null })
  })

  it('exige un DNI de 8 dígitos al crear', async () => {
    const sin = await p.pedir('admin', 'POST', '/v1/trabajadores', base)
    expect(sin.status).toBe(400)
    expect(sin.json.error.campo).toBe('dni')
    const corto = await p.pedir('admin', 'POST', '/v1/trabajadores', { ...base, dni: '123' })
    expect(corto.json.error.mensaje).toBe('El DNI debe tener 8 dígitos')
  })

  it('rechaza un DNI repetido con 409', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/trabajadores', { ...base, nombres: 'Otra', dni: '45871236' })
    expect(r.status).toBe(409)
  })

  it('gerencia y coordinador no pueden crear', async () => {
    for (const rol of ['gerencia', 'coordinador'] as const) {
      const r = await p.pedir(rol, 'POST', '/v1/trabajadores', { ...base, dni: '11112222' })
      expect(r.status).toBe(403)
    }
  })

  it('edita, cesa y deja el antes y el después en auditoría', async () => {
    const { json: t } = await p.pedir('admin', 'POST', '/v1/trabajadores', {
      ...base,
      nombres: 'José',
      apellidos: 'Chávez Rojas',
      dni: '40236517',
      areaId: almacen,
    })
    const r = await p.pedir('contabilidad', 'PATCH', `/v1/trabajadores/${t.id}`, { estado: 'cesado', telefono: '987654321' })
    expect(r.json).toMatchObject({ estado: 'cesado', telefono: '987654321' })

    const audit = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=trabajadores')
    const edicion = audit.json.datos.find((f: { accion: string }) => f.accion === 'editar')
    expect(edicion.antes.estado).toBe('activo')
    expect(edicion.despues.estado).toBe('cesado')
    expect(edicion.usuarioNombre).toBe('Usuario contabilidad')
  })

  it('rechaza una edición sin ningún campo', async () => {
    const id = (await p.pedir('admin', 'GET', '/v1/trabajadores?texto=torres')).json.datos[0].id
    const r = await p.pedir('admin', 'PATCH', `/v1/trabajadores/${id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('responde 400 si el área indicada no existe', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/trabajadores', {
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

describe('listar trabajadores', () => {
  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      await p.pedir('admin', 'POST', '/v1/trabajadores', {
        nombres: `Persona ${i}`,
        apellidos: `Apellido ${i}`,
        dni: `7000000${i}`,
        modalidad: i === 0 ? 'contrato' : 'temporal',
        areaId: i < 3 ? produccion : almacen,
      })
    }
  })

  it('pagina y devuelve el total', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?pagina=2&tamano=3')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 7, pagina: 2, tamano: 3 })
    expect(r.json.datos).toHaveLength(3)
  })

  it('ordena por apellidos', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?tamano=100')
    const apellidos = r.json.datos.map((t: { apellidos: string }) => t.apellidos)
    expect(apellidos).toEqual([...apellidos].sort((a, b) => a.localeCompare(b)))
  })

  it('filtra por texto (nombre, apellido o DNI), área, modalidad y estado', async () => {
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?texto=torres')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?texto=4023')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores?areaId=${almacen}`)).json.total).toBe(3)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?modalidad=contrato')).json.total).toBe(1)
    expect((await p.pedir('admin', 'GET', '/v1/trabajadores?estado=cesado')).json.total).toBe(1)
  })

  it('rechaza un tamaño de página mayor a 100', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/trabajadores?tamano=500')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })

  it('el coordinador solo ve a los de sus áreas', async () => {
    const r = await p.pedir('coordinador', 'GET', '/v1/trabajadores?tamano=100')
    expect(r.json.total).toBe(4)
    expect(r.json.datos.every((t: { areaId: string }) => t.areaId === produccion)).toBe(true)
  })

  it('un coordinador sin áreas no ve a nadie', async () => {
    await p.db.delete(usuarioAreas).where(eq(usuarioAreas.usuarioId, USUARIOS.coordinador))
    expect((await p.pedir('coordinador', 'GET', '/v1/trabajadores')).json.total).toBe(0)
    await p.db.insert(usuarioAreas).values({ usuarioId: USUARIOS.coordinador, areaId: produccion })
  })
})
