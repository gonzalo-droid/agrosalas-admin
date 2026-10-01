import { beforeAll, describe, expect, it } from 'vitest'
import { crearPrueba } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
  // Cada cambio de nombre deja una fila de auditoría.
  for (const nombre of ['Uno Uno', 'Dos Dos', 'Tres Tres']) {
    await p.pedir('admin', 'PATCH', '/v1/me', { nombre })
  }
})

describe('/v1/auditoria', () => {
  it('solo el administrador la consulta', async () => {
    for (const rol of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await p.pedir(rol, 'GET', '/v1/auditoria')).status).toBe(403)
    }
  })

  it('pagina, devuelve el total y ordena de la más reciente a la más antigua', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=2')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 3, pagina: 1, tamano: 2 })
    expect(r.json.datos.map((f: { despues: { nombre: string } }) => f.despues.nombre)).toEqual(['Tres Tres', 'Dos Dos'])

    const segunda = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=2&pagina=2')
    expect(segunda.json.datos).toHaveLength(1)
  })

  it('incluye el nombre de quien hizo el cambio y filtra por tabla', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?entidad=usuarios')
    expect(r.json.total).toBe(3)
    expect(r.json.datos[0]).toMatchObject({ accion: 'editar', entidad: 'usuarios', usuarioNombre: 'Tres Tres' })
    expect((await p.pedir('admin', 'GET', '/v1/auditoria?entidad=areas')).json.total).toBe(0)
  })

  it('usa 25 filas por defecto y rechaza más de 100', async () => {
    expect((await p.pedir('admin', 'GET', '/v1/auditoria')).json.tamano).toBe(25)
    const r = await p.pedir('admin', 'GET', '/v1/auditoria?tamano=101')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })
})
