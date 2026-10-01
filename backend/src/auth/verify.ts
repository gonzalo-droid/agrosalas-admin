import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose'

// jose errors that mean "this token is not valid".
const TOKEN_ERRORS = [
  errors.JWTExpired,
  errors.JWTClaimValidationFailed,
  errors.JWTInvalid,
  errors.JWSInvalid,
  errors.JWSSignatureVerificationFailed,
  errors.JWKSNoMatchingKey,
  errors.JOSEAlgNotAllowed,
  errors.JOSENotSupported,
]

// Supabase signs the session tokens; they are validated against its public keys (JWKS).
// Returns null only when the token is invalid; other failures (such as being unable to read
// the public keys) are rethrown so the error handler logs them and answers 500.
export function createVerifier(keys: JWTVerifyGetKey, issuer: string) {
  return async (token: string): Promise<{ sub: string } | null> => {
    try {
      const { payload } = await jwtVerify(token, keys, { issuer, audience: 'authenticated' })
      return typeof payload.sub === 'string' ? { sub: payload.sub } : null
    } catch (err) {
      if (TOKEN_ERRORS.some((errorClass) => err instanceof errorClass)) return null
      throw err
    }
  }
}

export function createSupabaseVerifier(supabaseUrl: string) {
  const issuer = `${supabaseUrl}/auth/v1`
  return createVerifier(createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)), issuer)
}
