import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, USERS } from './helpers'
import { auditoria } from '../src/db/schema'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
  // Every name change leaves an audit row.
  for (const nombre of ['Uno Uno', 'Dos Dos', 'Tres Tres']) {
    await t.request('admin', 'PATCH', '/v1/me', { nombre })
  }
})

describe('/v1/auditoria', () => {
  it('only the administrator can read it', async () => {
    for (const role of ['gerencia', 'contabilidad', 'coordinador'] as const) {
      expect((await t.request(role, 'GET', '/v1/auditoria')).status).toBe(403)
    }
  })

  it('paginates, returns the total and sorts from the most recent to the oldest', async () => {
    const r = await t.request('admin', 'GET', '/v1/auditoria?tamano=2')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 3, pagina: 1, tamano: 2 })
    expect(r.json.datos.map((row: { despues: { nombre: string } }) => row.despues.nombre)).toEqual(['Tres Tres', 'Dos Dos'])

    const second = await t.request('admin', 'GET', '/v1/auditoria?tamano=2&pagina=2')
    expect(second.json.datos).toHaveLength(1)
  })

  it('includes the name of who made the change and filters by table', async () => {
    const r = await t.request('admin', 'GET', '/v1/auditoria?entidad=usuarios')
    expect(r.json.total).toBe(3)
    expect(r.json.datos[0]).toMatchObject({ accion: 'editar', entidad: 'usuarios', usuarioNombre: 'Tres Tres' })
    expect((await t.request('admin', 'GET', '/v1/auditoria?entidad=areas')).json.total).toBe(0)
  })

  it('uses 25 rows by default and rejects more than 100', async () => {
    expect((await t.request('admin', 'GET', '/v1/auditoria')).json.tamano).toBe(25)
    const r = await t.request('admin', 'GET', '/v1/auditoria?tamano=101')
    expect(r.status).toBe(400)
    expect(r.json.error.campo).toBe('tamano')
  })

  it('paginates without repeating or skipping rows even when they share the same date', async () => {
    // Insert 5 audit rows with exactly the same creadoEn
    await t.db.insert(auditoria).values(
      Array.from({ length: 5 }, () => ({
        usuarioId: USERS.admin,
        accion: 'crear' as const,
        entidad: 'empate',
        entidadId: USERS.admin,
        antes: null,
        despues: null,
        creadoEn: new Date('2026-01-01T00:00:00Z'),
      })),
    )

    // Request the 5 pages, 1 row per page
    const ids: string[] = []
    const first = await t.request('admin', 'GET', '/v1/auditoria?entidad=empate&tamano=1&pagina=1')
    expect(first.json.total).toBe(5)
    for (let page = 1; page <= 5; page++) {
      const res = await t.request('admin', 'GET', `/v1/auditoria?entidad=empate&tamano=1&pagina=${page}`)
      expect(res.json.datos).toHaveLength(1)
      ids.push(res.json.datos[0].id)
    }

    // Check that all the ids are different
    expect(new Set(ids).size).toBe(5)
  })
})
