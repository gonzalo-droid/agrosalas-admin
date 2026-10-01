import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

// Supabase firma los tokens de sesión; se validan contra sus claves públicas (JWKS).
export function crearVerificador(claves: JWTVerifyGetKey, emisor: string) {
  return async (token: string): Promise<{ sub: string } | null> => {
    try {
      const { payload } = await jwtVerify(token, claves, { issuer: emisor, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? { sub: payload.sub } : null
    } catch {
      return null
    }
  }
}

export function crearVerificadorSupabase(supabaseUrl: string) {
  const emisor = `${supabaseUrl}/auth/v1`
  return crearVerificador(createRemoteJWKSet(new URL(`${emisor}/.well-known/jwks.json`)), emisor)
}
