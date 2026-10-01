import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../src/app'
import * as schema from '../src/db/schema'
import type { Role } from '../src/types'

// One user per role. In the tests, the token is the role name.
export const USERS: Record<Role, string> = {
  admin: '00000000-0000-4000-8000-000000000001',
  gerencia: '00000000-0000-4000-8000-000000000002',
  contabilidad: '00000000-0000-4000-8000-000000000003',
  coordinador: '00000000-0000-4000-8000-000000000004',
}

export async function createTestApp() {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  await db.insert(schema.usuarios).values(
    (Object.keys(USERS) as Role[]).map((role) => ({
      id: USERS[role],
      correo: `${role}@example.test`,
      nombre: `Usuario ${role}`,
      rol: role,
    })),
  )

  let nextAuthId = 100
  const createdInAuth: { id: string; email: string }[] = []
  const deletedInAuth: string[] = []

  const app = createApp({
    db,
    verifyToken: async (token) => (token in USERS ? { sub: USERS[token as Role] } : null),
    authAdmin: {
      async createUser(email) {
        // Special case: returns an id that already exists in usuarios to force a database failure after the sign-up.
        const id =
          email === 'conflict@example.test'
            ? USERS.admin
            : `00000000-0000-4000-8000-${String(nextAuthId++).padStart(12, '0')}`
        createdInAuth.push({ id, email })
        return { id }
      },
      async deleteUser(id) {
        deletedInAuth.push(id)
      },
    },
    panelOrigin: 'http://localhost:3000',
  })

  // request('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
  async function request(role: Role | null, method: string, path: string, body?: unknown) {
    const response = await app.request(path, {
      method,
      headers: {
        ...(role ? { Authorization: `Bearer ${role}` } : {}),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await response.json()
    return { status: response.status, json }
  }

  return { app, db, request, createdInAuth, deletedInAuth }
}
