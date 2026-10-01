import { usuarios } from '../db/schema'
import { registrarAuditoria } from '../lib/auditoria'
import type { AuthAdmin, Db } from '../tipos'

export async function crearPrimerAdmin(
  db: Db,
  authAdmin: AuthAdmin,
  datos: { correo: string; nombre: string; clave: string },
) {
  const { id } = await authAdmin.crearUsuario(datos.correo, datos.clave)
  try {
    return await db.transaction(async (tx) => {
      const [nuevo] = await tx.insert(usuarios).values({ id, correo: datos.correo, nombre: datos.nombre, rol: 'admin' }).returning()
      // El administrador es el autor de su propia creación.
      await registrarAuditoria(tx, id, 'crear', 'usuarios', id, null, nuevo)
      return nuevo
    })
  } catch (error) {
    // La cuenta de login sin fila en usuarios no sirve y bloquearía el correo al reintentar, así que se elimina.
    try {
      await authAdmin.eliminarUsuario(id)
    } catch (errorLimpieza) {
      console.error('No se pudo eliminar la cuenta de acceso huérfana', id, errorLimpieza)
    }
    throw error
  }
}
