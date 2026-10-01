import { esSinConexion } from './errores-acceso'

export type ResultadoEnlace = 'recovery' | 'invalid' | 'network_error'

// Lo que se usa de supabase.auth (así las pruebas pueden pasar uno falso).
export type AuthParaRecuperar = {
  initialize(): Promise<{ error: unknown }>
  onAuthStateChange(callback: (evento: string) => void): { data: { subscription: { unsubscribe(): void } } }
  verifyOtp(parametros: { type: 'recovery'; token_hash: string }): Promise<{ error: unknown }>
}

// Decide si esta visita a /restablecer viene de un enlace de recuperación válido.
// Una sesión normal ya abierta en el navegador NUNCA cuenta como recuperación.
export function comprobarEnlaceDeRecuperacion(
  auth: AuthParaRecuperar,
  parametros: URLSearchParams,
  margenMs = 100,
): Promise<ResultadoEnlace> {
  const tokenHash = parametros.get('token_hash')
  if (tokenHash && parametros.get('type') === 'recovery') return verificarToken(auth, tokenHash)
  return esperarAvisoDeRecuperacion(auth, margenMs)
}

// Enlace con ?token_hash=…&type=recovery (plantilla de correo propia): funciona en cualquier dispositivo.
async function verificarToken(auth: AuthParaRecuperar, tokenHash: string): Promise<ResultadoEnlace> {
  await auth.initialize()
  const { error } = await auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
  if (!error) return 'recovery'
  return esSinConexion(error) ? 'network_error' : 'invalid'
}

// Enlace por defecto con ?code=… (PKCE). Al crearse, el cliente de auth-js canjea el código en initialize()
// usando el verificador que guardó resetPasswordForEmail en ESTE navegador; si el verificador estaba marcado
// como de recuperación, emite PASSWORD_RECOVERY en un setTimeout(0) programado dentro de initialize().
// Por eso la suscripción se registra antes de esperar initialize() y, cuando este termina, se espera un
// margen corto antes de concluir que no hubo aviso.
function esperarAvisoDeRecuperacion(auth: AuthParaRecuperar, margenMs: number): Promise<ResultadoEnlace> {
  return new Promise((resolver) => {
    let terminado = false
    let dejarDeEscuchar = () => {}
    const terminar = (resultado: ResultadoEnlace) => {
      if (terminado) return
      terminado = true
      dejarDeEscuchar()
      resolver(resultado)
    }

    const { data } = auth.onAuthStateChange((evento) => {
      if (evento === 'PASSWORD_RECOVERY') terminar('recovery')
    })
    dejarDeEscuchar = () => data.subscription.unsubscribe()
    if (terminado) dejarDeEscuchar()

    auth
      .initialize()
      .then(({ error }) => error, (error: unknown) => error)
      .then((error) => {
        setTimeout(() => terminar(esSinConexion(error) ? 'network_error' : 'invalid'), margenMs)
      })
  })
}
