import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIASES,
  aliasDni,
  applyAlias,
  foldAccents,
  nameKey,
  normalizeName,
  parseAliases,
  similarNames,
  splitName,
  unusedAliases,
  workerKey,
} from '../../scripts/import-excel/names'

describe('normalizeName', () => {
  it('puts one space after the comma', () => {
    expect(normalizeName('PEREZ ROJAS,ANA')).toBe('PEREZ ROJAS, ANA')
    expect(normalizeName('PEREZ ROJAS, ANA')).toBe('PEREZ ROJAS, ANA')
    expect(normalizeName('PEREZ ROJAS ,  ANA')).toBe('PEREZ ROJAS, ANA')
  })

  it('trims, collapses spaces and upper-cases', () => {
    expect(normalizeName('  ramos   vargas,  elena ')).toBe('RAMOS VARGAS, ELENA')
  })

  it('leaves names without a comma alone', () => {
    expect(normalizeName(' 3 ')).toBe('3')
  })
})

describe('splitName', () => {
  it('splits surnames and given name at the comma', () => {
    expect(splitName('RAMOS VARGAS, ELENA')).toEqual({
      lastName: 'RAMOS VARGAS',
      firstName: 'ELENA',
    })
  })

  it('keeps everything in lastName without a comma', () => {
    expect(splitName('ELENA')).toEqual({ lastName: 'ELENA', firstName: '' })
  })
})

// The two kinds of alias seen in the workbook: a name written as a number, and a second given name added on another sheet.
const ALIASES = { '3': 'PEREZ ROJAS, ANA', 'TORRES DIAZ, JOSE LUIS': 'TORRES DIAZ, LUIS' }

describe('aliases', () => {
  it('ships no aliases: they hold real names and only come from a file outside the repository', () => {
    expect(DEFAULT_ALIASES).toEqual({})
  })

  it('maps the given aliases', () => {
    expect(applyAlias('3', ALIASES)).toBe('PEREZ ROJAS, ANA')
    expect(applyAlias('TORRES DIAZ, JOSE LUIS', ALIASES)).toBe('TORRES DIAZ, LUIS')
  })

  it('returns other names unchanged', () => {
    expect(applyAlias('RAMOS VARGAS, ELENA', ALIASES)).toBe('RAMOS VARGAS, ELENA')
  })
})

describe('similarNames', () => {
  it('pairs the same surnames when one given name contains the other', () => {
    const pairs = similarNames([
      'TORRES DIAZ, LUIS',
      'TORRES DIAZ, JOSE LUIS',
      'RAMOS VARGAS, ELENA',
    ])
    expect(pairs).toEqual([['TORRES DIAZ, LUIS', 'TORRES DIAZ, JOSE LUIS']])
  })

  it('does not pair different given names with the same surnames', () => {
    expect(similarNames(['PEREZ ROJAS, ANA', 'PEREZ ROJAS, CARMEN'])).toEqual([])
  })

  it('pairs names with the same surnames and a different given name only when contained', () => {
    expect(similarNames(['A B, ANA', 'C D, ANA'])).toEqual([])
  })
})

describe('matching keys', () => {
  it('folds accents and the ñ', () => {
    expect(foldAccents('PÉREZ MUÑOZ, MARÍA JOSÉ')).toBe('PEREZ MUNOZ, MARIA JOSE')
  })

  it('gives the same key to a stored worker and to the Excel name, whatever the accents, case and spaces', () => {
    expect(nameKey('quispe  mamaní', ' luis')).toBe('QUISPE MAMANI, LUIS')
    expect(workerKey('QUISPE MAMANI, LUIS')).toBe('QUISPE MAMANI, LUIS')
    expect(workerKey('QUISPE MAMANÍ, LUÍS')).toBe('QUISPE MAMANI, LUIS')
  })

  it('keys a name without given name by its surnames alone, on both sides', () => {
    expect(nameKey('QUISPE', '')).toBe('QUISPE')
    expect(workerKey('QUISPE')).toBe('QUISPE')
  })

  it('keeps a DNI alias as its own key', () => {
    expect(workerKey('dni:12345678')).toBe('dni:12345678')
    expect(aliasDni('dni:12345678')).toBe('12345678')
    expect(aliasDni('PEREZ ROJAS, ANA')).toBeNull()
  })
})

describe('parseAliases', () => {
  it('normalises both sides of a name alias', () => {
    expect(parseAliases({ ' torres diaz ,jose luis ': 'Torres Diaz, Luis', 3: 'perez rojas, ana' })).toEqual({
      'TORRES DIAZ, JOSE LUIS': 'TORRES DIAZ, LUIS',
      '3': 'PEREZ ROJAS, ANA',
    })
  })

  it('reads an alias to the DNI of an existing worker', () => {
    expect(parseAliases({ 'PEREZ ROJAS, ANA': ' DNI: 12345678 ' })).toEqual({ 'PEREZ ROJAS, ANA': 'dni:12345678' })
  })

  it('refuses a DNI alias without eight digits, a value that is not text and a file that is not an object', () => {
    expect(() => parseAliases({ 'PEREZ ROJAS, ANA': 'dni:1234' })).toThrow(/8 dígitos/)
    expect(() => parseAliases({ 'PEREZ ROJAS, ANA': 3 })).toThrow(/debe ser un texto/)
    expect(() => parseAliases(['PEREZ ROJAS, ANA'])).toThrow(/objeto JSON/)
    expect(() => parseAliases(null)).toThrow(/objeto JSON/)
  })
})

describe('unusedAliases', () => {
  it('lists the keys that match no name as written in the sheets, normalised', () => {
    const aliases = { '3': 'PEREZ ROJAS, ANA', 'TORRES DIAZ, JOSE LUIS': 'TORRES DIAZ, LUIS', 'X Y, Z': 'dni:12345678' }
    expect(unusedAliases(aliases, [' torres  diaz,jose luis', 'PEREZ ROJAS, ANA'])).toEqual(['3', 'X Y, Z'])
    expect(unusedAliases(aliases, ['3', 'TORRES DIAZ, JOSE LUIS', 'x y, z'])).toEqual([])
  })
})
