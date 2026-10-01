import { describe, expect, it } from 'vitest'
import { validarClaveNueva } from './validar-clave'

describe('validarClaveNueva', () => {
  it('acepta una contraseña de 8 o más caracteres repetida igual', () => {
    expect(validarClaveNueva('12345678', '12345678')).toEqual({})
  })

  it('marca la longitud en el primer campo', () => {
    expect(validarClaveNueva('corta', 'corta')).toEqual({ clave: 'Usa al menos 8 caracteres' })
  })

  it('marca la diferencia en el campo de repetir', () => {
    expect(validarClaveNueva('12345678', '12345679')).toEqual({ repetir: 'Las contraseñas no coinciden' })
  })

  it('muestra los dos errores a la vez', () => {
    expect(validarClaveNueva('corta', 'otra')).toEqual({
      clave: 'Usa al menos 8 caracteres',
      repetir: 'Las contraseñas no coinciden',
    })
  })
})
