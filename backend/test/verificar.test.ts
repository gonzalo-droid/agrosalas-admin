import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'
import { crearVerificador } from '../src/auth/verificar'

const EMISOR = 'https://proyecto.supabase.co/auth/v1'

async function preparar() {
  const { publicKey, privateKey } = await generateKeyPair('ES256')
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'ES256' }
  const verificar = crearVerificador(createLocalJWKSet({ keys: [jwk] }), EMISOR)
  const firmar = (emisor: string, audiencia: string) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'ES256', kid: 'k1' })
      .setSubject('usuario-1')
      .setIssuer(emisor)
      .setAudience(audiencia)
      .setExpirationTime('5m')
      .sign(privateKey)
  return { verificar, firmar }
}

describe('crearVerificador', () => {
  it('acepta un token firmado por el emisor esperado', async () => {
    const { verificar, firmar } = await preparar()
    expect(await verificar(await firmar(EMISOR, 'authenticated'))).toEqual({ sub: 'usuario-1' })
  })

  it('rechaza otro emisor, otra audiencia y texto que no es un token', async () => {
    const { verificar, firmar } = await preparar()
    expect(await verificar(await firmar('https://otro.supabase.co/auth/v1', 'authenticated'))).toBeNull()
    expect(await verificar(await firmar(EMISOR, 'anon'))).toBeNull()
    expect(await verificar('no-es-un-token')).toBeNull()
  })
})
