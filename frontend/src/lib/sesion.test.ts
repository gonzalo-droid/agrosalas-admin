import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { terminarSesion } from './sesion'

function preparar(signOut: () => Promise<unknown>) {
  const cliente = new QueryClient()
  cliente.setQueryData(['yo'], { nombre: 'Ana' })
  const router = { replace: vi.fn(), refresh: vi.fn() }
  const auth = { signOut: vi.fn(signOut) }
  return { cliente, router, auth }
}

describe('terminarSesion', () => {
  it('cierra solo esta sesión, vacía la caché y va al ingreso', async () => {
    const { cliente, router, auth } = preparar(async () => ({ error: null }))
    await terminarSesion(cliente, router, auth)
    expect(auth.signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(cliente.getQueryData(['yo'])).toBeUndefined()
    expect(router.replace).toHaveBeenCalledWith('/login')
    expect(router.refresh).toHaveBeenCalled()
  })

  it('aunque signOut falle, vacía la caché y va al ingreso', async () => {
    const { cliente, router, auth } = preparar(async () => {
      throw new Error('falló')
    })
    await expect(terminarSesion(cliente, router, auth)).rejects.toThrow('falló')
    expect(cliente.getQueryData(['yo'])).toBeUndefined()
    expect(router.replace).toHaveBeenCalledWith('/login')
  })

  it('no se repite mientras una salida está en curso', async () => {
    let terminar = () => {}
    const { cliente, router, auth } = preparar(() => new Promise((r) => (terminar = () => r({ error: null }))))
    const primera = terminarSesion(cliente, router, auth)
    const segunda = terminarSesion(cliente, router, auth)
    terminar()
    await Promise.all([primera, segunda])
    expect(auth.signOut).toHaveBeenCalledTimes(1)
    expect(router.replace).toHaveBeenCalledTimes(1)
    // Terminada la salida, se puede volver a salir (por ejemplo, tras otro ingreso).
    auth.signOut.mockImplementation(async () => ({ error: null }))
    await terminarSesion(cliente, router, auth)
    expect(auth.signOut).toHaveBeenCalledTimes(2)
  })
})
