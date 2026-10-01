import { z } from 'zod'

// Sin barra final: con ella el emisor del token y el origen de CORS nunca coinciden.
const url = () => z.url().transform((valor) => valor.replace(/\/+$/, ''))

const esquema = z.object({
  DATABASE_URL: z.string().min(1),
  SUPABASE_URL: url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  ORIGEN_PANEL: url().default('http://localhost:3000'),
  PUERTO: z.coerce.number().int().min(1).max(65535).default(8787),
})

export type Env = z.infer<typeof esquema>

export function leerEnv(origen: Record<string, string | undefined> = process.env): Env {
  const resultado = esquema.safeParse(origen)
  if (!resultado.success) {
    const faltan = resultado.error.issues.map((i) => i.path.join('.')).join(', ')
    throw new Error(`Variables de entorno inválidas o ausentes: ${faltan}`)
  }
  return resultado.data
}
