import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { createVerifier } from '../src/auth/verify'

const ISSUER = 'https://project.supabase.co/auth/v1'

async function setup() {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
  const verify = createVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER)
  const sign = (issuer: string, audience: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('5m')
      .sign(privateKey)
  return { verify, sign }
}

describe('createVerifier', () => {
  it('accepts a token signed by the expected issuer', async () => {
    const { verify, sign } = await setup()
    expect(await verify(await sign(ISSUER, 'authenticated'))).toEqual({ sub: 'user-1' })
  })

  it('rejects another issuer, another audience and text that is not a token', async () => {
    const { verify, sign } = await setup()
    expect(await verify(await sign('https://other.supabase.co/auth/v1', 'authenticated'))).toBeNull()
    expect(await verify(await sign(ISSUER, 'anon'))).toBeNull()
    expect(await verify('not-a-token')).toBeNull()
  })

  it('rejects a token signed with another key under the same kid', async () => {
    const { verify } = await setup()
    const { privateKey: foreignKey } = await generateKeyPair('ES256')
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(foreignKey)
    expect(await verify(token)).toBeNull()
  })

  it('rejects an expired token', async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256')
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
    const verify = createVerifier(createLocalJWKSet({ keys: [jwk] }), ISSUER)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(privateKey)
    expect(await verify(token)).toBeNull()
  })

  it('rethrows failures that are not about the token, such as being unable to read the public keys', async () => {
    const { sign } = await setup()
    const verify = createVerifier(async () => {
      throw new Error('JWKS unavailable')
    }, ISSUER)
    await expect(verify(await sign(ISSUER, 'authenticated'))).rejects.toThrow('JWKS unavailable')
  })

  it('rejects a token signed with an algorithm that the key set does not support', async () => {
    const { verify } = await setup()
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', kid: 'k1' })
      .setSubject('user-1')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode('a-secret-of-at-least-32-bytes-for-hs256'))
    expect(await verify(token)).toBeNull()
  })
})
