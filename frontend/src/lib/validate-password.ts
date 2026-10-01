export type NewPasswordErrors = { password?: string; repeat?: string }

// Checks the new password before sending it: each error goes under its own field.
export function validateNewPassword(password: string, repeat: string): NewPasswordErrors {
  const errors: NewPasswordErrors = {}
  if (password.length < 8) errors.password = 'Usa al menos 8 caracteres'
  if (password !== repeat) errors.repeat = 'Las contraseñas no coinciden'
  return errors
}

export const hasErrors = (errors: object) => Object.values(errors).some(Boolean)
