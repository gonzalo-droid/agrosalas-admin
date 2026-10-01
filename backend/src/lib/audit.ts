import { auditoria } from '../db/schema'
import type { Db, Tx } from '../types'

type AuditAction = 'crear' | 'editar' | 'eliminar'

export async function recordAudit(
  db: Db | Tx,
  userId: string,
  action: AuditAction,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  await db.insert(auditoria).values({ usuarioId: userId, accion: action, entidad: entity, entidadId: entityId, antes: before, despues: after })
}
