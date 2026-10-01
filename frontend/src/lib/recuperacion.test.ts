import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { describe, expect, it, vi } from 'vitest'
import { comprobarEnlaceDeRecuperacion, type AuthParaRecuperar } from './recuperacion'

// Imita a auth-js: initialize() resuelve y los avisos de la URL salen después, en un setTimeout(0).
function authFalso({
  eventos = [] as string[],
  errorInicio = null as unknown,
  errorVerificacion = null as unknown,
} = {}) {
  const oyentes = new Map<number, (evento: string) => void>()
  let siguiente = 0
  const auth = {
    initialize: vi.fn(async () => {
      setTimeout(() => eventos.forEach((e) => oyentes.forEach((o) => o(e))), 0)
      return { error: errorInicio }
    }),
    onAuthStateChange: vi.fn((callback: (evento: string) => void) => {
      const id = siguiente++
      oyentes.set(id, callback)
      return { data: { subscription: { unsubscribe: () => oyentes.delete(id) } } }
    }),
    verifyOtp: vi.fn(async () => ({ error: errorVerificacion })),
  }
  return { auth: auth satisfies AuthParaRecuperar, oyentes }
}

const conParametros = (texto: string) => new URLSearchParams(texto)

describe('comprobarEnlaceDeRecuperacion con token_hash', () => {
  it('confirma la recuperación si Supabase acepta el token', async () => {
    const { auth } = authFalso()
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('token_hash=abc&type=recovery'))).resolves.toBe('recuperacion')
    expect(auth.verifyOtp).toHaveBeenCalledWith({ type: 'recovery', token_hash: 'abc' })
  })

  it('no es una recuperación si el token venció o ya se usó', async () => {
    const { auth } = authFalso({ errorVerificacion: new AuthApiError('Token has expired', 403, 'otp_expired') })
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('token_hash=abc&type=recovery'))).resolves.toBe('invalido')
  })

  it('distingue la falta de conexión', async () => {
    const { auth } = authFalso({ errorVerificacion: new AuthRetryableFetchError('Failed to fetch', 0) })
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('token_hash=abc&type=recovery'))).resolves.toBe('sin_conexion')
  })

  it('ignora un token_hash que no es de recuperación', async () => {
    const { auth } = authFalso()
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('token_hash=abc&type=signup'), 5)).resolves.toBe('invalido')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })
})

describe('comprobarEnlaceDeRecuperacion con ?code=', () => {
  it('confirma la recuperación cuando llega PASSWORD_RECOVERY y deja de escuchar', async () => {
    const { auth, oyentes } = authFalso({ eventos: ['PASSWORD_RECOVERY'] })
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('code=xyz'), 5)).resolves.toBe('recuperacion')
    expect(oyentes.size).toBe(0)
  })

  it('una sesión normal ya abierta no cuenta como recuperación', async () => {
    const { auth, oyentes } = authFalso({ eventos: ['INITIAL_SESSION', 'SIGNED_IN'] })
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('code=xyz'), 5)).resolves.toBe('invalido')
    expect(oyentes.size).toBe(0)
  })

  it('sin código ni aviso, tampoco', async () => {
    const { auth } = authFalso()
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros(''), 5)).resolves.toBe('invalido')
  })

  it('distingue la falta de conexión al canjear el código', async () => {
    const { auth } = authFalso({ errorInicio: new AuthRetryableFetchError('Failed to fetch', 0) })
    await expect(comprobarEnlaceDeRecuperacion(auth, conParametros('code=xyz'), 5)).resolves.toBe('sin_conexion')
  })

  it('se suscribe antes de que termine la inicialización', async () => {
    const { auth } = authFalso({ eventos: ['PASSWORD_RECOVERY'] })
    await comprobarEnlaceDeRecuperacion(auth, conParametros('code=xyz'), 5)
    expect(auth.onAuthStateChange.mock.invocationCallOrder[0]).toBeLessThan(auth.initialize.mock.invocationCallOrder[0])
  })
})
