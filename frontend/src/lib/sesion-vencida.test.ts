import { describe, expect, it } from 'vitest'
import { ErrorApiCliente } from './api'
import { crearLimitador, esSesionVencida } from './sesion-vencida'

describe('esSesionVencida', () => {
  it('reconoce el 401 de la API', () => {
    expect(esSesionVencida(new ErrorApiCliente({ code: 'unauthenticated', message: 'Inicia sesión para continuar' }))).toBe(true)
  })

  it('no confunde otros errores', () => {
    expect(esSesionVencida(new ErrorApiCliente({ code: 'forbidden', message: 'x' }))).toBe(false)
    expect(esSesionVencida(new ErrorApiCliente({ code: 'network_error', message: 'x' }))).toBe(false)
    expect(esSesionVencida(new Error('unauthenticated'))).toBe(false)
  })
})

describe('crearLimitador', () => {
  it('deja pasar una vez por intervalo', () => {
    let ahora = 1_000
    const puede = crearLimitador(10_000, () => ahora)
    expect(puede()).toBe(true)
    expect(puede()).toBe(false)
    ahora += 9_999
    expect(puede()).toBe(false)
    ahora += 1
    expect(puede()).toBe(true)
  })
})
