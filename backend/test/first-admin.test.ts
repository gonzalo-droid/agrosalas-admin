import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { createFirstAdmin } from '../src/auth/first-admin.js'
import { auditLog, users } from '../src/db/schema.js'
import type { AuthAdmin } from '../src/types.js'
import { USERS, createTestApp } from './helpers.js'

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
    expect(created.role).toBe('admin')
    const [row] = await t.db.select().from(users).where(eq(users.id, id))
    expect(row).toMatchObject({ email: 'boss@example.test', name: 'Jefa Admin', role: 'admin', active: true })
    const rows = await t.db.select().from(auditLog).where(eq(auditLog.entityId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ action: 'create', entity: 'users', userId: id })
    expect(JSON.stringify(rows[0])).not.toContain(input.password)
  })

  it('deletes the login account if it cannot save the user', async () => {
    const t = await createTestApp()
    const deleted: string[] = []
    const authAdmin: AuthAdmin = {
      async createUser() {
        // An id that already exists in users forces the database failure after the sign-up.
        return { id: USERS.admin }
      },
      async deleteUser(id) {
        deleted.push(id)
      },
    }
    const before = await t.db.select().from(auditLog)

    await expect(createFirstAdmin(t.db, authAdmin, input)).rejects.toThrow()

    expect(deleted).toEqual([USERS.admin])
    const after = await t.db.select().from(auditLog)
    expect(after).toHaveLength(before.length)
  })
})
