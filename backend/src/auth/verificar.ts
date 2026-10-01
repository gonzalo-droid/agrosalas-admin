import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Errores de jose que significan "este token no es válido".
const ERRORES_DE_TOKEN = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JWKSNoMatchingKey,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
]

// Supabase firma los tokens de sesión; se validan contra sus claves públicas (JWKS).
// Devuelve null solo cuando el token es inválido; otros fallos (como no poder leer
// las claves públicas) se relanzan para que el manejador de errores los registre y responda 500.
export function crearVerificador(claves: JWTVerifyGetKey, emisor: string) {
  return async (token: string): Promise<{ sub: string } | null> => {
    try {
      const { payload } = await jwtVerify(token, claves, { issuer: emisor, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? { sub: payload.sub } : null
    } catch (err) {
      if (ERRORES_DE_TOKEN.some((clase) => err instanceof clase)) return null
      throw err
    }
  }
}

export function crearVerificadorSupabase(supabaseUrl: string) {
  const emisor = `${supabaseUrl}/auth/v1`
  return crearVerificador(createRemoteJWKSet(new URL(`${emisor}/.well-known/jwks.json`)), emisor)
}
