import type { CellValue } from './read-xlsx.js'

/** 'A' → 1, 'Z' → 26, 'AA' → 27. */
export const columnIndex = (letters: string): number => {
  let index = 0
  for (const letter of letters.toUpperCase()) index = index * 26 + (letter.charCodeAt(0) - 64)
  return index
}

export const columnLetters = (index: number): string => {
  let letters = ''
  for (let rest = index; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(65 + ((rest - 1) % 26)) + letters
  }
  return letters
}

export const cellRef = (column: string | number, row: number): string =>
  `${typeof column === 'number' ? columnLetters(column) : column}${row}`

/** Numbers, and text that holds a number; anything else (blank, words, missing) is null. */
export const numberAt = (sheet: Map<string, CellValue>, ref: string): number | null => {
  const value = sheet.get(ref)
  if (typeof value === 'number') return value
  if (value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const textAt = (sheet: Map<string, CellValue>, ref: string): string =>
  String(sheet.get(ref) ?? '').trim()

/** Excel stores a time as a fraction of the day: 0.3125 → 450 (07:30). */
export const minutesOfDay = (fraction: number): number => Math.round(fraction * 1440)
