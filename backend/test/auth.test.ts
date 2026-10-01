import { eq } from 'drizzle-orm'
import { beforeAll, describe, expect, it } from 'vitest'
import { auditoria, usuarios } from '../src/db/schema'
import { crearPrueba, USUARIOS } from './ayudas'

let p: Awaited<ReturnType<typeof crearPrueba>>
beforeAll(async () => {
  p = await crearPrueba()
})

describe('autenticación', () => {
  it('rechaza sin token', async () => {
    const r = await p.pedir(null, 'GET', '/v1/me')
    expect(r.status).toBe(401)
    expect(r.json.error.codigo).toBe('no_autenticado')
  })

  it('rechaza un token inválido', async () => {
    const r = await p.app.request('/v1/me', { headers: { Authorization: 'Bearer falso' } })
    expect(r.status).toBe(401)
  })

  it('rechaza a un usuario desactivado', async () => {
    await p.db.update(usuarios).set({ activo: false }).where(eq(usuarios.id, USUARIOS.gerencia))
    const r = await p.pedir('gerencia', 'GET', '/v1/me')
    expect(r.status).toBe(403)
    expect(r.json.error.codigo).toBe('sin_acceso')
    await p.db.update(usuarios).set({ activo: true }).where(eq(usuarios.id, USUARIOS.gerencia))
  })
})

describe('/v1/me', () => {
  it('devuelve el usuario con su rol y áreas', async () => {
    const r = await p.pedir('admin', 'GET', '/v1/me')
    expect(r.status).toBe(200)
    expect(r.json).toEqual({
      id: USUARIOS.admin,
      correo: 'admin@prueba.test',
      nombre: 'Usuario admin',
      rol: 'admin',
      areaIds: [],
    })
  })

  it('cambia el nombre y lo deja en auditoría', async () => {
    const r = await p.pedir('contabilidad', 'PATCH', '/v1/me', { nombre: 'Rosa Contadora' })
    expect(r.status).toBe(200)
    expect(r.json.nombre).toBe('Rosa Contadora')
    const filas = await p.db.select().from(auditoria).where(eq(auditoria.entidadId, USUARIOS.contabilidad))
    expect(filas).toHaveLength(1)
    expect(filas[0].accion).toBe('editar')
    expect(filas[0].despues).toEqual({ nombre: 'Rosa Contadora' })
  })

  it('valida el nombre con el formato de error de la API', async () => {
    const r = await p.pedir('admin', 'PATCH', '/v1/me', { nombre: 'x' })
    expect(r.status).toBe(400)
    expect(r.json.error.codigo).toBe('validacion')
    expect(r.json.error.campo).toBe('nombre')
  })
})
