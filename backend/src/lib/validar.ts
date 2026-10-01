import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z, type ZodType } from 'zod'

// Mensajes de validación de Zod en español; toda ruta importa este módulo antes de validar.
z.config(z.locales.es())

// Igual que zValidator, pero responde con el formato de error de la API.
export const validar = <D extends keyof ValidationTargets, E extends ZodType>(destino: D, esquema: E) =>
  zValidator(destino, esquema, (resultado, c) => {
    if (!resultado.success) {
      const problema = resultado.error.issues[0]
      return c.json(
        { error: { codigo: 'validacion', mensaje: problema.message, campo: problema.path.join('.') || undefined } },
        400,
      )
    }
  })

export const esquemaId = z.object({ id: z.uuid() })

// Para PATCH: un cuerpo sin ningún campo conocido es un error de quien llama, no una edición.
export const conAlgunCampo = <E extends z.ZodObject>(esquema: E) =>
  esquema.refine((valores) => Object.keys(valores).length > 0, {
    message: 'Indica al menos un campo para editar',
  })
