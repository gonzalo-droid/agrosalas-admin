import { describe, expect, it } from 'vitest'
import { ErrorApiCliente } from './api'
import { crearLimitador, esSesionVencida } from './sesion-vencida'

describe('esSesionVencida', () => {
  it('reconoce el 401 de la API', () => {
    expect(esSesionVencida(new ErrorApiCliente({ codigo: 'no_autenticado', mensaje: 'Inicia sesión para continuar' }))).toBe(true)
  })

  it('no confunde otros errores', () => {
    expect(esSesionVencida(new ErrorApiCliente({ codigo: 'sin_permiso', mensaje: 'x' }))).toBe(false)
    expect(esSesionVencida(new ErrorApiCliente({ codigo: 'sin_conexion', mensaje: 'x' }))).toBe(false)
    expect(esSesionVencida(new Error('no_autenticado'))).toBe(false)
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
