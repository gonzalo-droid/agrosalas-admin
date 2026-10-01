import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('áreas', () => {
  it('el administrador crea y todos los roles listan', async () => {
    const creada = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(creada.status).toBe(201)
    expect(creada.json).toMatchObject({ nombre: 'Producción', activo: true })

    const lista = await p.pedir('coordinador', 'GET', '/v1/areas')
    expect(lista.status).toBe(200)
    expect(lista.json.datos.map((a: { nombre: string }) => a.nombre)).toEqual(['Producción'])
  })

  it('solo el administrador puede crear o editar', async () => {
    const r = await p.pedir('contabilidad', 'POST', '/v1/areas', { nombre: 'Almacén' })
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_permiso')
  })

  it('rechaza un nombre repetido con 409', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
    expect(r.status).toBe(409)
    expect(r.json.error.codigo).toBe('duplicado')
  })

  it('edita, desactiva y responde 404 si no existe', async () => {
    const { json: area } = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Etiquetado' })
    const editada = await p.pedir('admin', 'PATCH', `/v1/areas/${area.id}`, { activo: false })
    expect(editada.status).toBe(200)
    expect(editada.json.activo).toBe(false)

    const nada = await p.pedir('admin', 'PATCH', '/v1/areas/00000000-0000-4000-8000-00000000ffff', { activo: false })
    expect(nada.status).toBe(404)
  })

  it('deja creación y edición en auditoría', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=areas')
    expect(r.json.datos.map((f: { accion: string }) => f.accion).sort()).toEqual(['crear', 'crear', 'editar'])
  })

  it('rechaza con 400 una edición sin ningún campo', async () => {
    const { json: area } = await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Mantenimiento' })
    const r = await p.pedir('admin', 'PATCH', `/v1/areas/${area.id}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })
})

describe('turnos', () => {
  it('crea con horas HH:MM y rechaza otro formato', async () => {
    const ok = await p.pedir('admin', 'POST', '/v1/turnos', { nombre: 'Día', horaInicio: '07:00', horaFin: '17:00' })
    expect(ok.status).toBe(201)
    expect(ok.json.horaInicio).toBe('07:00:00')

    const mal = await p.pedir('admin', 'POST', '/v1/turnos', { nombre: 'Noche', horaInicio: '7pm', horaFin: '05:00' })
    expect(mal.status).toBe(400)
    expect(mal.json.error.campo).toBe('horaInicio')
  })
})

describe('campañas', () => {
  it('crea con fechas opcionales y edita', async () => {
    const creada = await p.pedir('admin', 'POST', '/v1/campanas', { nombre: 'Contenedor Chile' })
    expect(creada.status).toBe(201)
    expect(creada.json.fechaInicio).toBeNull()

    const editada = await p.pedir('admin', 'PATCH', `/v1/campanas/${creada.json.id}`, {
      fechaInicio: '2026-09-07',
      fechaFin: '2026-10-04',
    })
    expect(editada.json).toMatchObject({ fechaInicio: '2026-09-07', fechaFin: '2026-10-04' })
  })
})
