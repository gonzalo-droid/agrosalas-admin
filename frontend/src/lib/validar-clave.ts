export type ErroresClaveNueva = { clave?: string; repetir?: string }

// Revisa la contraseña nueva antes de mandarla: cada error va bajo su propio campo.
export function validarClaveNueva(clave: string, repetir: string): ErroresClaveNueva {
  const errores: ErroresClaveNueva = {}
  if (clave.length < 8) errores.clave = 'Usa al menos 8 caracteres'
  if (clave !== repetir) errores.repetir = 'Las contraseñas no coinciden'
  return errores
}

export const hayErrores = (errores: object) => Object.values(errores).some(Boolean)
