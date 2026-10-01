import { describe, expect, it } from 'vitest'
import { rangoMostrado, totalPaginas } from './paginas'

describe('totalPaginas', () => {
  it('redondea hacia arriba y nunca baja de 1', () => {
    expect(totalPaginas(0, 25)).toBe(1)
    expect(totalPaginas(25, 25)).toBe(1)
    expect(totalPaginas(26, 25)).toBe(2)
  })
})

describe('rangoMostrado', () => {
  it('describe el tramo visible', () => {
    expect(rangoMostrado(1, 25, 73)).toBe('Mostrando 1–25 de 73')
    expect(rangoMostrado(3, 25, 73)).toBe('Mostrando 51–73 de 73')
    expect(rangoMostrado(1, 25, 0)).toBe('Sin resultados')
  })
})
