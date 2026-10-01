import { describe, expect, it } from 'vitest'
import { correctedPage, shownRange, totalPages } from './pagination'

describe('totalPages', () => {
  it('rounds up and never goes below 1', () => {
    expect(totalPages(0, 25)).toBe(1)
    expect(totalPages(25, 25)).toBe(1)
    expect(totalPages(26, 25)).toBe(2)
  })
})

describe('shownRange', () => {
  it('describes the visible stretch', () => {
    expect(shownRange(1, 25, 73)).toBe('Mostrando 1–25 de 73')
    expect(shownRange(3, 25, 73)).toBe('Mostrando 51–73 de 73')
    expect(shownRange(1, 25, 0)).toBe('Sin resultados')
  })
})

describe('correctedPage', () => {
  it('goes to the last page if the requested one is past the total', () => {
    expect(correctedPage(5, 25, 73, 0)).toBe(3)
    expect(correctedPage(2, 25, 1, 0)).toBe(1)
  })

  it('changes nothing if there are rows, if there are no results or if it is already the last one', () => {
    expect(correctedPage(2, 25, 73, 25)).toBeNull()
    expect(correctedPage(3, 25, 0, 0)).toBeNull()
    expect(correctedPage(3, 25, 73, 0)).toBeNull()
  })
})
