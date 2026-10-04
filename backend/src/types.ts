import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type * as schema from './db/schema.js'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

export type Role = (typeof schema.roleEnum.enumValues)[number]

export type SessionUser = {
  id: string
  email: string
  name: string
  role: Role
  areaIds: string[]
}

export type AppEnv = { Variables: { user: SessionUser } }

export interface AuthAdmin {
  createUser(email: string, password: string): Promise<{ id: string }>
  deleteUser(id: string): Promise<void>
}

export interface EvidenceStorage {
  // A signed URL (and its token) to upload one file to that path of the private bucket.
  createUploadUrl(path: string): Promise<{ signedUrl: string; token: string }>
  // A signed URL to read the file, valid for that many seconds.
  createReadUrl(path: string, expiresInSeconds: number): Promise<{ signedUrl: string }>
}

export type Dependencies = {
  db: Db
  // Returns the Supabase Auth user id, or null if the token is not valid.
  verifyToken: (token: string) => Promise<{ sub: string } | null>
  authAdmin: AuthAdmin
  panelOrigin: string
  // The clock. Injected so that tests never depend on the real time.
  now: () => Date
  evidence: EvidenceStorage
  // Secret of the daily Vercel cron (GET /internal/keep-alive). Without it the route always answers 401.
  cronSecret?: string
}
