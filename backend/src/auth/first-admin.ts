import { users } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import type { AuthAdmin, Db } from '../types.js'

export async function createFirstAdmin(
  db: Db,
  authAdmin: AuthAdmin,
  input: { email: string; name: string; password: string },
) {
  const { id } = await authAdmin.createUser(input.email, input.password)
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(users).values({ id, email: input.email, name: input.name, role: 'admin' }).returning()
      // The administrator is the author of their own creation.
      await recordAudit(tx, id, 'create', 'users', id, null, created)
      return created
    })
  } catch (error) {
    // A login account without a row in users is useless and would block the email on retry, so it is deleted.
    try {
      await authAdmin.deleteUser(id)
    } catch (cleanupError) {
      console.error('Could not delete the orphaned login account', id, cleanupError)
    }
    throw error
  }
}
