import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { createApp } from '../src/app.js'
import * as schema from '../src/db/schema.js'
import type { Role } from '../src/types.js'

// One user per role. In the tests, the token is the role name.
export const USERS: Record<Role, string> = {
  admin: '00000000-0000-4000-8000-000000000001',
  management: '00000000-0000-4000-8000-000000000002',
  accounting: '00000000-0000-4000-8000-000000000003',
  coordinator: '00000000-0000-4000-8000-000000000004',
}

export async function createTestApp(options: { cronSecret?: string } = {}) {
  // Omitted: the default secret. Passed as undefined: an API with no cron secret configured.
  const cronSecret = 'cronSecret' in options ? options.cronSecret : 'test-cron-secret-0123456789'

  // The test clock: Monday 5 October 2026, 08:00 in Lima. A test moves it with setNow.
  let currentTime = new Date('2026-10-05T13:00:00Z')
  const setNow = (date: Date) => {
    currentTime = date
  }

  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  await db.insert(schema.users).values(
    (Object.keys(USERS) as Role[]).map((role) => ({
      id: USERS[role],
      email: `${role}@example.test`,
      name: `User ${role}`,
      role,
    })),
  )

  let nextAuthId = 100
  const createdInAuth: { id: string; email: string }[] = []
  const deletedInAuth: string[] = []

  const uploadUrls: string[] = []
  const readUrls: { path: string; seconds: number }[] = []

  const app = createApp({
    db,
    verifyToken: async (token) => (token in USERS ? { sub: USERS[token as Role] } : null),
    authAdmin: {
      async createUser(email) {
        // Special case: returns an id that already exists in users to force a database failure after the sign-up.
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
    now: () => currentTime,
    evidence: {
      async createUploadUrl(path) {
        uploadUrls.push(path)
        return { signedUrl: `https://storage.test/upload/${path}?token=test-token`, token: 'test-token' }
      },
      async createReadUrl(path, seconds) {
        readUrls.push({ path, seconds })
        return { signedUrl: `https://storage.test/read/${path}` }
      },
    },
    cronSecret,
  })

  // request('admin', 'POST', '/v1/areas', { name: 'Producción' })
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

  return { app, db, request, setNow, createdInAuth, deletedInAuth, uploadUrls, readUrls }
}
