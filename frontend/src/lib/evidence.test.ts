import { describe, expect, it } from 'vitest'
import { EVIDENCE_ACCEPT, EVIDENCE_MAX_BYTES, evidenceProblem, isImage, scaledSize } from './evidence'

describe('evidenceProblem', () => {
  it('accepts JPG, PNG, WebP and PDF up to 5 MB', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']) {
      expect(evidenceProblem({ type, size: 1000 })).toBeNull()
    }
    expect(evidenceProblem({ type: 'image/jpeg', size: EVIDENCE_MAX_BYTES })).toBeNull()
  })

  it('names what is wrong', () => {
    expect(evidenceProblem({ type: 'image/gif', size: 1000 })).toBe('Formato no permitido: usa JPG, PNG, WebP o PDF')
    expect(evidenceProblem({ type: 'image/jpeg', size: EVIDENCE_MAX_BYTES + 1 })).toBe('El archivo no puede pasar de 5 MB')
    expect(evidenceProblem({ type: 'application/pdf', size: 0 })).toBe('El archivo está vacío')
  })

  it('lists the accepted types for the file input', () => {
    expect(EVIDENCE_ACCEPT).toBe('image/jpeg,image/png,image/webp,application/pdf')
    expect(isImage('image/png')).toBe(true)
    expect(isImage('application/pdf')).toBe(false)
  })
})

describe('scaledSize', () => {
  it('keeps the proportions with the longest side at 1600 px at most', () => {
    expect(scaledSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(scaledSize(3000, 4000)).toEqual({ width: 1200, height: 1600 })
    expect(scaledSize(1000, 3333)).toEqual({ width: 480, height: 1600 })
  })

  it('never enlarges an image', () => {
    expect(scaledSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
