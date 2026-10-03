import { describe, expect, it } from 'vitest'
import {
  cellRef,
  columnIndex,
  columnLetters,
  minutesOfDay,
  numberAt,
  textAt,
} from '../../scripts/import-excel/grid'
import type { CellValue } from '../../scripts/import-excel/read-xlsx'

describe('column helpers', () => {
  it('converts letters to indexes', () => {
    expect(columnIndex('A')).toBe(1)
    expect(columnIndex('Z')).toBe(26)
    expect(columnIndex('AA')).toBe(27)
    expect(columnIndex('BG')).toBe(59)
  })

  it('round-trips letters and indexes', () => {
    for (const letters of ['A', 'Z', 'AA', 'AZ', 'BA', 'BG', 'BN']) {
      expect(columnLetters(columnIndex(letters))).toBe(letters)
    }
    expect(columnLetters(27)).toBe('AA')
  })

  it('builds references from letters or indexes', () => {
    expect(cellRef('B', 24)).toBe('B24')
    expect(cellRef(59, 3)).toBe('BG3')
  })
})

describe('numberAt / textAt', () => {
  const sheet = new Map<string, CellValue>([
    ['A1', 12.5],
    ['A2', '7.5'],
    ['A3', ' 8.25 '],
    ['A4', 'abc'],
    ['A5', ''],
    ['A6', '   '],
    ['A7', '7,5'],
    ['B1', '  hola '],
    ['B2', 3],
  ])

  it('reads numbers and numeric text', () => {
    expect(numberAt(sheet, 'A1')).toBe(12.5)
    expect(numberAt(sheet, 'A2')).toBe(7.5)
    expect(numberAt(sheet, 'A3')).toBe(8.25)
  })

  it('returns null for non-numeric, blank or missing cells', () => {
    expect(numberAt(sheet, 'A4')).toBeNull()
    expect(numberAt(sheet, 'A5')).toBeNull()
    expect(numberAt(sheet, 'A6')).toBeNull()
    expect(numberAt(sheet, 'A7')).toBeNull()
    expect(numberAt(sheet, 'Z99')).toBeNull()
  })

  it('reads text trimmed, and empty when missing', () => {
    expect(textAt(sheet, 'B1')).toBe('hola')
    expect(textAt(sheet, 'B2')).toBe('3')
    expect(textAt(sheet, 'Z99')).toBe('')
  })
})

describe('minutesOfDay', () => {
  it('rounds a day fraction to the minute', () => {
    expect(minutesOfDay(0.3125)).toBe(450)
    expect(minutesOfDay(0.54166666666666663)).toBe(780)
    expect(minutesOfDay(0.7833333)).toBe(1128)
  })
})
