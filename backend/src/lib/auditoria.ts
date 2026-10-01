import { auditoria } from '../db/schema'
import type { Db, Tx } from '../tipos'

type Accion = 'crear' | 'editar' | 'eliminar'

export async function registrarAuditoria(
  db: Db | Tx,
  usuarioId: string,
  accion: Accion,
  entidad: string,
  entidadId: string,
  antes: unknown,
  despues: unknown,
) {
  await db.insert(auditoria).values({ usuarioId, accion, entidad, entidadId, antes, despues })
}
