import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createFirstAdmin } from '../src/auth/first-admin'
import { auditoria, usuarios } from '../src/db/schema'
import type { AuthAdmin } from '../src/types'
import { USERS, createTestApp } from './helpers'

const input = { email: 'boss@example.test', name: 'Jefa Admin', password: 'clave-segura-9' }

describe('createFirstAdmin', () => {
  it('creates the administrator and leaves the audit row', async () => {
    const t = await createTestApp()
    const id = '00000000-0000-4000-8000-0000000000aa'
    const authAdmin: AuthAdmin = {
      async createUser() {
        return { id }
      },
      async deleteUser() {},
    }

    const created = await createFirstAdmin(t.db, authAdmin, input)

    expect(created.id).toBe(id)
    expect(created.rol).toBe('admin')
    const [row] = await t.db.select().from(usuarios).where(eq(usuarios.id, id))
    expect(row).toMatchObject({ correo: 'boss@example.test', nombre: 'Jefa Admin', rol: 'admin', activo: true })
    const rows = await t.db.select().from(auditoria).where(eq(auditoria.entidadId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ accion: 'crear', entidad: 'usuarios', usuarioId: id })
    expect(JSON.stringify(rows[0])).not.toContain(input.password)
  })

  it('deletes the login account if it cannot save the user', async () => {
    const t = await createTestApp()
    const deleted: string[] = []
    const authAdmin: AuthAdmin = {
      async createUser() {
        // An id that already exists in usuarios forces the database failure after the sign-up.
        return { id: USERS.admin }
      },
      async deleteUser(id) {
        deleted.push(id)
      },
    }
    const before = await t.db.select().from(auditoria)

    await expect(createFirstAdmin(t.db, authAdmin, input)).rejects.toThrow()

    expect(deleted).toEqual([USERS.admin])
    const after = await t.db.select().from(auditoria)
    expect(after).toHaveLength(before.length)
  })
})
