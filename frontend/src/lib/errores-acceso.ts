// Convierte los errores de Supabase Auth (auth-js) en el texto que se muestra en las pantallas de acceso.
// Se mira la forma del error (name, status, code), no su clase, para aceptar cualquier cosa que se lance.
type ErrorAuth = { name?: unknown; status?: unknown; code?: unknown }

export const SIN_CONEXION = 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.'
const DEMASIADOS_INTENTOS = 'Hubo demasiados intentos. Espera unos minutos y vuelve a intentarlo.'
const CLAVE_DEBIL = 'La contraseña es muy débil o muy conocida. Usa una más larga, mezclando letras y números.'
const MISMA_CLAVE = 'La contraseña nueva debe ser distinta de la actual.'

const RATE_LIMIT = ['over_request_rate_limit', 'over_email_send_rate_limit', 'over_sms_send_rate_limit']

const forma = (error: unknown): ErrorAuth => (typeof error === 'object' && error !== null ? (error as ErrorAuth) : {})

// fetch falló antes de llegar a Supabase: auth-js lo entrega como AuthRetryableFetchError con status 0.
export function esSinConexion(error: unknown) {
  const e = forma(error)
  return e.name === 'AuthRetryableFetchError' && (e.status === 0 || e.status === undefined)
}

const esDemasiadosIntentos = (error: unknown) => {
  const e = forma(error)
  return e.status === 429 || RATE_LIMIT.includes(String(e.code))
}

// Lo que vale igual para todas las pantallas; null si el error no es de esos casos.
function mensajeComun(error: unknown): string | null {
  if (esSinConexion(error)) return SIN_CONEXION
  if (esDemasiadosIntentos(error)) return DEMASIADOS_INTENTOS
  return null
}

function mensajeClaveNueva(error: unknown): string | null {
  const { code } = forma(error)
  if (code === 'weak_password') return CLAVE_DEBIL
  if (code === 'same_password') return MISMA_CLAVE
  return mensajeComun(error)
}

// updateUser({ password }) en la pantalla de nueva contraseña (enlace del correo).
export const mensajeRestablecer = (error: unknown) => mensajeClaveNueva(error) ?? 'No se pudo guardar la contraseña'
