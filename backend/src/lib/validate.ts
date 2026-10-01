import { zValidator } from '@hono/zod-validator'
import type { ValidationTargets } from 'hono'
import { z, type ZodType } from 'zod'

// Zod validation messages in Spanish; every route imports this module before validating.
z.config(z.locales.es())

// Same as zValidator, but answers with the API error format.
export const validate = <T extends keyof ValidationTargets, S extends ZodType>(target: T, schema: S) =>
  zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0]
      return c.json(
        { error: { code: 'validation', message: issue.message, field: issue.path.join('.') || undefined } },
        400,
      )
    }
  })

export const idSchema = z.object({ id: z.uuid() })

// For PATCH: a body without any known field is a caller error, not an edit.
export const withAtLeastOneField = <S extends z.ZodObject>(schema: S) =>
  schema.refine((values) => Object.keys(values).length > 0, {
    message: 'Indica al menos un campo para editar',
  })
