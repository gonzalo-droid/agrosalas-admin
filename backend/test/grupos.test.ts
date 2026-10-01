import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let ids: string[]
let grupoId: string
let temporalId: string

beforeAll(async () => {
  p = await crearPrueba()
  ids = []
  for (let i = 0; i < 3; i++) {
    const r = await p.pedir('admin', 'POST', '/v1/trabajadores', {
      nombres: `Persona ${i}`,
      apellidos: 'Prueba',
      dni: `6000000${i}`,
      modalidad: 'temporal',
    })
    ids.push(r.json.id)
  }
})

describe('grupos de trabajadores', () => {
  it('el administrador crea un grupo fijo y uno temporal con fechas', async () => {
    const fijo = await p.pedir('admin', 'POST', '/v1/grupos', { nombre: 'Turno noche' })
    expect(fijo.status).toBe(201)
    expect(fijo.json).toMatchObject({ temporal: false, fechaInicio: null })
    grupoId = fijo.json.id

    const temporal = await p.pedir('admin', 'POST', '/v1/grupos', {
      nombre: 'Apoyo contenedor Chile',
      temporal: true,
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-04',
    })
    expect(temporal.json).toMatchObject({ temporal: true, fechaFin: '2026-10-04' })
    temporalId = temporal.json.id
  })

  it('contabilidad agrega miembros; repetir uno no falla ni lo duplica', async () => {
    const r = await p.pedir('contabilidad', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[0], ids[1]] })
    expect(r.status).toBe(200)
    await p.pedir('contabilidad', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[1], ids[2]] })

    const { json: grupo } = await p.pedir('admin', 'GET', `/v1/grupos/${grupoId}`)
    expect(grupo.miembros.map((m: { id: string }) => m.id).sort()).toEqual([...ids].sort())
    expect(grupo.miembros[0]).toEqual({ id: ids[0], nombres: 'Persona 0', apellidos: 'Prueba', dni: '60000000' })
  })

  it('la lista trae el número de miembros de cada grupo', async () => {
    const { json } = await p.pedir('coordinador', 'GET', '/v1/grupos')
    expect(json.datos.map((g: { nombre: string; miembros: number }) => [g.nombre, g.miembros])).toEqual([
      ['Apoyo contenedor Chile', 0],
      ['Turno noche', 3],
    ])
  })

  it('quita un miembro y la ficha del trabajador refleja sus grupos', async () => {
    const r = await p.pedir('admin', 'DELETE', `/v1/grupos/${grupoId}/miembros/${ids[0]}`)
    expect(r.status).toBe(200)
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores/${ids[0]}`)).json.grupoIds).toEqual([])
    expect((await p.pedir('admin', 'GET', `/v1/trabajadores/${ids[1]}`)).json.grupoIds).toEqual([grupoId])
  })

  it('solo el administrador crea grupos; el coordinador no toca miembros', async () => {
    expect((await p.pedir('contabilidad', 'POST', '/v1/grupos', { nombre: 'Otro' })).status).toBe(403)
    const r = await p.pedir('coordinador', 'POST', `/v1/grupos/${grupoId}/miembros`, { trabajadorIds: [ids[0]] })
    expect(r.status).toBe(403)
  })

  it('responde 404 al agregar miembros a un grupo que no existe', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/grupos/00000000-0000-4000-8000-00000000ffff/miembros', {
      trabajadorIds: [ids[0]],
    })
    expect(r.status).toBe(404)
  })

  it('una edición parcial no toca los campos que no se mandan', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/grupos/${temporalId}`, { fechaFin: '2026-10-11' })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({
      nombre: 'Apoyo contenedor Chile',
      temporal: true,
      fechaInicio: '2026-09-28',
      fechaFin: '2026-10-11',
    })
  })

  it('rechaza una edición sin ningún campo', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/grupos/${grupoId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })
})
