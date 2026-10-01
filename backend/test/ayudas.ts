import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { crearApp } from '../src/app'
import * as schema from '../src/db/schema'
import type { Rol } from '../src/tipos'

// Un usuario por rol. En las pruebas, el token es el nombre del rol.
export const USUARIOS: Record<Rol, string> = {
  admin: '00000000-0000-4000-8000-000000000001',
  gerencia: '00000000-0000-4000-8000-000000000002',
  contabilidad: '00000000-0000-4000-8000-000000000003',
  coordinador: '00000000-0000-4000-8000-000000000004',
}

export async function crearPrueba() {
  const db = drizzle(new PGlite(), { schema })
  await migrate(db, { migrationsFolder: './drizzle' })

  await db.insert(schema.usuarios).values(
    (Object.keys(USUARIOS) as Rol[]).map((rol) => ({
      id: USUARIOS[rol],
      correo: `${rol}@prueba.test`,
      nombre: `Usuario ${rol}`,
      rol,
    })),
  )

  let siguienteAuthId = 100
  const creadosEnAuth: { id: string; correo: string }[] = []

  const app = crearApp({
    db,
    verificarToken: async (token) => (token in USUARIOS ? { sub: USUARIOS[token as Rol] } : null),
    authAdmin: {
      async crearUsuario(correo) {
        const id = `00000000-0000-4000-8000-${String(siguienteAuthId++).padStart(12, '0')}`
        creadosEnAuth.push({ id, correo })
        return { id }
      },
    },
    origenPanel: 'http://localhost:3000',
  })

  // pedir('admin', 'POST', '/v1/areas', { nombre: 'Producción' })
  async function pedir(rol: Rol | null, metodo: string, ruta: string, cuerpo?: unknown) {
    const respuesta = await app.request(ruta, {
      method: metodo,
      headers: {
        ...(rol ? { Authorization: `Bearer ${rol}` } : {}),
        ...(cuerpo === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await respuesta.json()
    return { status: respuesta.status, json }
  }

  return { app, db, pedir, creadosEnAuth }
}
