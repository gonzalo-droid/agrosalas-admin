import { auditLog } from '../db/schema.js'
import type { Db, Tx } from '../types.js'

type AuditAction = 'create' | 'update' | 'delete'

export async function recordAudit(
  db: Db | Tx,
  userId: string,
  action: AuditAction,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(auditLog).values({ userId, action, entity, entityId, before, after })
}
