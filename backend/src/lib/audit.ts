import { auditLog } from '../db/schema'
import type { Db, Tx } from '../types'

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
