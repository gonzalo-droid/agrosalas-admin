import { describe, expect, it } from 'vitest'
import { formatoFecha, formatoSoles, horaExtraPropuesta, rangoFechas } from './formato'

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

describe('formatoFecha', () => {
  it('pasa de AAAA-MM-DD a DD/MM/AAAA sin mover el día', () => {
    expect(formatoFecha('2026-10-04')).toBe('04/10/2026')
    expect(formatoFecha('2026-01-01')).toBe('01/01/2026')
  })

  it('muestra un guion cuando no hay fecha', () => {
    expect(formatoFecha(null)).toBe('—')
    expect(formatoFecha(undefined)).toBe('—')
    expect(formatoFecha('')).toBe('—')
  })
})

describe('rangoFechas', () => {
  it('describe el rango con sus dos extremos o con el que haya', () => {
    expect(rangoFechas('2026-10-04', '2026-10-10')).toBe('04/10/2026 a 10/10/2026')
    expect(rangoFechas('2026-10-04', null)).toBe('desde 04/10/2026')
    expect(rangoFechas(null, '2026-10-10')).toBe('hasta 10/10/2026')
    expect(rangoFechas(null, undefined)).toBe('')
  })
})
