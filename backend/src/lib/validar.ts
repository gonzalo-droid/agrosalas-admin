import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z, type ZodType } from 'zod'

// Igual que zValidator, pero responde con el formato de error de la API.
export const validar = <D extends keyof ValidationTargets, E extends ZodType>(destino: D, esquema: E) =>
  zValidator(destino, esquema, (resultado, c) => {
    if (!resultado.success) {
      const problema = resultado.error.issues[0]
      return c.json(
        { error: { codigo: 'validacion', mensaje: problema.message, campo: problema.path.join('.') } },
        400,
      )
    }
  })

export const esquemaId = z.object({ id: z.uuid() })
