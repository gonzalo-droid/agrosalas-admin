import { usuarios } from '../db/schema'
import { recordAudit } from '../lib/audit'
import type { AuthAdmin, Db } from '../types'

export async function createFirstAdmin(
  db: Db,
  authAdmin: AuthAdmin,
  input: { email: string; name: string; password: string },
) {
  const { id } = await authAdmin.createUser(input.email, input.password)
  try {
    return await db.transaction(async (tx) => {
      const [created] = await tx.insert(usuarios).values({ id, correo: input.email, nombre: input.name, rol: 'admin' }).returning()
      // The administrator is the author of their own creation.
      await recordAudit(tx, id, 'crear', 'usuarios', id, null, created)
      return created
    })
  } catch (error) {
    // A login account without a row in usuarios is useless and would block the email on retry, so it is deleted.
    try {
      await authAdmin.deleteUser(id)
    } catch (cleanupError) {
      console.error('Could not delete the orphaned login account', id, cleanupError)
    }
    throw error
  }
}
