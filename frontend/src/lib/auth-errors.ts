// Turns Supabase Auth (auth-js) errors into the text shown on the access screens.
// The shape of the error (name, status, code) is checked, not its class, to accept anything that is thrown.
type AuthErrorShape = { name?: unknown; status?: unknown; code?: unknown }

export const NO_CONNECTION = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'
const TOO_MANY_ATTEMPTS = 'Hubo demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
const WEAK_PASSWORD = 'La contraseña es muy débil o muy conocida. Usa una más larga, mezclando letras y números.'
const SAME_PASSWORD = 'La contraseña nueva debe ser distinta de la actual.'

const RATE_LIMIT = ['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit']

const shapeOf = (error: unknown): AuthErrorShape => (typeof error === 'object' && error !== null ? (error as AuthErrorShape) : {})

// fetch failed before reaching Supabase: auth-js delivers it as an AuthRetryableFetchError with status 0.
export function isNetworkError(error: unknown) {
  const e = shapeOf(error)
  return e.name === 'AuthRetryableFetchError' && (e.status === 0 || e.status === undefined)
}

const isTooManyAttempts = (error: unknown) => {
  const e = shapeOf(error)
  return e.status === 429 || RATE_LIMIT.includes(String(e.code))
}

// What is the same for every screen; null if the error is not one of those cases.
function commonMessage(error: unknown): string | null {
  if (isNetworkError(error)) return NO_CONNECTION
  if (isTooManyAttempts(error)) return TOO_MANY_ATTEMPTS
  return null
}

function newPasswordMessage(error: unknown): string | null {
  const { code } = shapeOf(error)
  if (code === 'weak_password') return WEAK_PASSWORD
  if (code === 'same_password') return SAME_PASSWORD
  return commonMessage(error)
}

// updateUser({ password }) on the new-password screen (link from the email).
export const resetMessage = (error: unknown) => newPasswordMessage(error) ?? 'No se pudo guardar la contraseña'

// Credentials rejected by Supabase, or missing (auth-js detects it before calling).
const isInvalidCredentials = (error: unknown) => {
  const { code, name } = shapeOf(error)
  return code === 'invalid_credentials' || name === 'AuthInvalidCredentialsError'
}

// signInWithPassword on the sign-in screen.
export const signInMessage = (error: unknown) =>
  isInvalidCredentials(error)
    ? 'Correo o contraseña incorrectos'
    : (commonMessage(error) ?? 'No se pudo iniciar sesión. Inténtalo de nuevo.')

// resetPasswordForEmail on "Recuperar contraseña".
export const recoveryMessage = (error: unknown) =>
  commonMessage(error) ?? 'No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.'

// Profile: the current password is asked for again (signInWithPassword) before changing it.
export const currentPasswordMessage = (error: unknown) =>
  isInvalidCredentials(error)
    ? 'La contraseña actual no es correcta'
    : (commonMessage(error) ?? 'No se pudo comprobar la contraseña actual')

// Profile: updateUser({ password }).
export const passwordChangeMessage = (error: unknown) => newPasswordMessage(error) ?? 'No se pudo cambiar la contraseña'
