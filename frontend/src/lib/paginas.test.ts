import { describe, expect, it } from 'vitest'
import { paginaCorregida, rangoMostrado, totalPaginas } from './paginas'

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

describe('paginaCorregida', () => {
  it('lleva a la última página si la pedida quedó fuera del total', () => {
    expect(paginaCorregida(5, 25, 73, 0)).toBe(3)
    expect(paginaCorregida(2, 25, 1, 0)).toBe(1)
  })

  it('no cambia nada si hay filas, si no hay resultados o si ya es la última', () => {
    expect(paginaCorregida(2, 25, 73, 25)).toBeNull()
    expect(paginaCorregida(3, 25, 0, 0)).toBeNull()
    expect(paginaCorregida(3, 25, 73, 0)).toBeNull()
  })
})
