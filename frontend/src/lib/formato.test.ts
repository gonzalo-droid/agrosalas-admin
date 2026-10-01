import { describe, expect, it } from 'vitest'
import { formatoSoles, horaExtraPropuesta } from './formato'

describe('formatoSoles', () => {
  it('muestra dos decimales y un guion cuando no hay monto', () => {
    expect(formatoSoles(7.8125)).toBe('S/ 7.81')
    expect(formatoSoles(1800)).toBe('S/ 1,800.00')
    expect(formatoSoles(null)).toBe('–')
  })
})

describe('horaExtraPropuesta', () => {
  it('es la hora normal más 25 %', () => {
    expect(horaExtraPropuesta(6.25)).toBe(7.8125)
    expect(horaExtraPropuesta(10)).toBe(12.5)
    expect(horaExtraPropuesta(30)).toBe(37.5)
  })
})
