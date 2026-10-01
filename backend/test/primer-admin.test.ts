import { eq } from 'drizzle-orm'
import { describe, expect, it } from 'vitest'
import { crearPrimerAdmin } from '../src/auth/primer-admin'
import { auditoria, usuarios } from '../src/db/schema'
import type { AuthAdmin } from '../src/tipos'
import { USUARIOS, crearPrueba } from './ayudas'

const datos = { correo: 'jefe@prueba.test', nombre: 'Jefa Admin', clave: 'clave-segura-9' }

describe('crearPrimerAdmin', () => {
  it('crea el administrador y deja la fila de auditoría', async () => {
    const p = await crearPrueba()
    const id = '00000000-0000-4000-8000-0000000000aa'
    const authAdmin: AuthAdmin = {
      async crearUsuario() {
        return { id }
      },
      async eliminarUsuario() {},
    }

    const creado = await crearPrimerAdmin(p.db, authAdmin, datos)

    expect(creado.id).toBe(id)
    expect(creado.rol).toBe('admin')
    const [fila] = await p.db.select().from(usuarios).where(eq(usuarios.id, id))
    expect(fila).toMatchObject({ correo: 'jefe@prueba.test', nombre: 'Jefa Admin', rol: 'admin', activo: true })
    const filas = await p.db.select().from(auditoria).where(eq(auditoria.entidadId, id))
    expect(filas).toHaveLength(1)
    expect(filas[0]).toMatchObject({ accion: 'crear', entidad: 'usuarios', usuarioId: id })
    expect(JSON.stringify(filas[0])).not.toContain(datos.clave)
  })

  it('elimina la cuenta de login si no puede guardar el usuario', async () => {
    const p = await crearPrueba()
    const eliminados: string[] = []
    const authAdmin: AuthAdmin = {
      async crearUsuario() {
        // Un id que ya existe en usuarios fuerza el fallo de la base después del alta.
        return { id: USUARIOS.admin }
      },
      async eliminarUsuario(id) {
        eliminados.push(id)
      },
    }
    const antes = await p.db.select().from(auditoria)

    await expect(crearPrimerAdmin(p.db, authAdmin, datos)).rejects.toThrow()

    expect(eliminados).toEqual([USUARIOS.admin])
    const despues = await p.db.select().from(auditoria)
    expect(despues).toHaveLength(antes.length)
  })
})
