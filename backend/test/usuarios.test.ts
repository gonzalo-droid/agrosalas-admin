import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
let areaId: string
let nuevoId: string

beforeAll(async () => {
  p = await crearPrueba()
  areaId = (await p.pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })).json.id
})

describe('usuarios', () => {
  it('solo el administrador entra a /v1/usuarios', async () => {
    for (const rol of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await p.pedir(rol, 'GET', '/v1/usuarios')).status).toBe(403)
    }
  })

  it('crea el usuario en el proveedor de login y en la base, con sus áreas', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'coordina@prueba.test',
      clave: 'clave-segura-1',
      nombre: 'Pedro Coordinador',
      rol: 'coordinador',
      areaIds: [areaId],
    })
    expect(r.status).toBe(201)
    expect(r.json).toMatchObject({ correo: 'coordina@prueba.test', rol: 'coordinador', areaIds: [areaId] })
    expect(r.json.clave).toBeUndefined()
    expect(p.creadosEnAuth).toEqual([{ id: r.json.id, correo: 'coordina@prueba.test' }])
    nuevoId = r.json.id
  })

  it('no llama al proveedor de login si el correo ya existe', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'coordina@prueba.test',
      clave: 'clave-segura-2',
      nombre: 'Repetido',
      rol: 'gerencia',
    })
    expect(r.status).toBe(409)
    expect(p.creadosEnAuth).toHaveLength(1)
  })

  it('exige una contraseña de al menos 8 caracteres', async () => {
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'otro@prueba.test',
      clave: 'corta',
      nombre: 'Otro',
      rol: 'gerencia',
    })
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('clave')
  })

  it('lista los usuarios con sus áreas', async () => {
    const { json } = await p.pedir('admin', 'GET', '/v1/usuarios')
    expect(json.datos).toHaveLength(5)
    expect(json.datos.find((u: { id: string }) => u.id === nuevoId).areaIds).toEqual([areaId])
  })

  it('edita rol, áreas y estado', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/usuarios/${nuevoId}`, { rol: 'contabilidad', areaIds: [], activo: false })
    expect(r.json).toMatchObject({ rol: 'contabilidad', areaIds: [], activo: false })
  })

  it('el administrador no puede quitarse su propio acceso', async () => {
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { activo: false })).status).toBe(400)
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { rol: 'gerencia' })).status).toBe(400)
    expect((await p.pedir('admin', 'PATCH', `/v1/usuarios/${USUARIOS.admin}`, { nombre: 'Lucía Paredes' })).status).toBe(200)
  })

  it('cambia solo las áreas sin tocar lo demás', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/usuarios/${nuevoId}`, { areaIds: [areaId] })
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ rol: 'contabilidad', activo: false, areaIds: [areaId] })
  })

  it('rechaza una edición sin ningún campo', async () => {
    const r = await p.pedir('admin', 'PATCH', `/v1/usuarios/${nuevoId}`, {})
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.mensaje).toBe('Indica al menos un campo para editar')
  })

  it('no crea la cuenta de login si un área no existe', async () => {
    const antes = p.creadosEnAuth.length
    const r = await p.pedir('admin', 'POST', '/v1/usuarios', {
      correo: 'huerfano@prueba.test',
      clave: 'clave-segura-3',
      nombre: 'Sin Área',
      rol: 'coordinador',
      areaIds: ['00000000-0000-4000-8000-00000000ffff'],
    })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('referencia_invalida')
    expect(r.json.error.campo).toBe('areaIds')
    expect(p.creadosEnAuth.length).toBe(antes)
  })
})
