import { describe, expect, it } from 'vitest'
import { applyChange, buildRequestBody, visibleFields, visibleOptions, type CatalogField, type Values } from './catalog-values'

const field = (f: Partial<CatalogField> & Pick<CatalogField, 'name' | 'type'>): CatalogField => ({ label: f.name, ...f })

describe('buildRequestBody', () => {
  it('sends numbers as numbers and empty ones as null', () => {
    const fields = [field({ name: 'a', type: 'number' }), field({ name: 'b', type: 'number' })]
    expect(buildRequestBody(fields, { a: '6.25', b: '' }, false)).toEqual({ a: 6.25, b: null })
  })

  it('sends null for empty texts, emails, times and dates and trims the text', () => {
    const fields = [
      field({ name: 't', type: 'text' }),
      field({ name: 'c', type: 'email' }),
      field({ name: 'h', type: 'time' }),
      field({ name: 'f', type: 'date' }),
      field({ name: 'n', type: 'text' }),
    ]
    const values: Values = { t: '   ', c: '', h: '', f: '', n: '  Ana  ' }
    expect(buildRequestBody(fields, values, false)).toEqual({ t: null, c: null, h: null, f: null, n: 'Ana' })
  })

  it('does not trim the password', () => {
    const fields = [field({ name: 'password', type: 'password' })]
    expect(buildRequestBody(fields, { password: '  secreta 1  ' }, false)).toEqual({ password: '  secreta 1  ' })
    expect(buildRequestBody(fields, { password: '' }, false)).toEqual({ password: null })
  })

  it('omits the create-only fields when editing and includes them when creating', () => {
    const fields = [field({ name: 'email', type: 'email', createOnly: true }), field({ name: 'name', type: 'text' })]
    const values: Values = { email: 'a@b.pe', name: 'Ana' }
    expect(buildRequestBody(fields, values, true)).toEqual({ name: 'Ana' })
    expect(buildRequestBody(fields, values, false)).toEqual({ email: 'a@b.pe', name: 'Ana' })
  })

  it('sends null for a field hidden by visibleIf and does not count it among the visible ones', () => {
    const fields = [
      field({ name: 'payType', type: 'select' }),
      field({ name: 'monthlySalary', type: 'number', visibleIf: (v) => v.payType === 'monthly' }),
    ]
    const values: Values = { payType: 'hourly', monthlySalary: '1800' }
    expect(buildRequestBody(fields, values, false)).toEqual({ payType: 'hourly', monthlySalary: null })
    expect(visibleFields(fields, values, false).map((f) => f.name)).toEqual(['payType'])
    expect(visibleFields(fields, { ...values, payType: 'monthly' }, false).map((f) => f.name)).toEqual(['payType', 'monthlySalary'])
  })

  it('lets checkboxes and option lists through', () => {
    const fields = [field({ name: 'temporary', type: 'checkbox' }), field({ name: 'areaIds', type: 'multiselect' })]
    expect(buildRequestBody(fields, { temporary: true, areaIds: ['x', 'y'] }, false)).toEqual({ temporary: true, areaIds: ['x', 'y'] })
    expect(buildRequestBody(fields, { temporary: false, areaIds: [] }, false)).toEqual({ temporary: false, areaIds: [] })
  })
})

describe('visibleFields', () => {
  it('drops the create-only fields when editing', () => {
    const fields = [field({ name: 'password', type: 'password', createOnly: true }), field({ name: 'name', type: 'text' })]
    expect(visibleFields(fields, {}, true).map((f) => f.name)).toEqual(['name'])
    expect(visibleFields(fields, {}, false).map((f) => f.name)).toEqual(['password', 'name'])
  })
})

describe('applyChange', () => {
  const derive = (name: string, v: Values) => (name === 'regular' ? { overtime: String(Number(v.regular) * 1.25) } : {})

  it('when creating, proposes the derived fields', () => {
    expect(applyChange({ regular: '', overtime: '' }, 'regular', '10', derive, false)).toEqual({ regular: '10', overtime: '12.5' })
  })

  it('when editing, never overwrites what was already there', () => {
    expect(applyChange({ regular: '10', overtime: '15' }, 'regular', '12', derive, true)).toEqual({ regular: '12', overtime: '15' })
  })

  it('without derive only the field changes', () => {
    expect(applyChange({ a: 'x' }, 'a', 'y', undefined, false)).toEqual({ a: 'y' })
  })
})

describe('visibleOptions', () => {
  const areas = field({
    name: 'areaIds',
    type: 'multiselect',
    options: [
      { value: 'a1', label: 'Envasado' },
      { value: 'a2', label: 'Almacén', inactive: true },
      { value: 'a3', label: 'Campo', inactive: true },
    ],
  })

  it('when creating, only the active ones', () => {
    expect(visibleOptions(areas, null)).toEqual([{ value: 'a1', label: 'Envasado' }])
  })

  it('when editing, also the inactive ones the row already has, marked', () => {
    expect(visibleOptions(areas, { id: 'u1', areaIds: ['a2'] })).toEqual([
      { value: 'a1', label: 'Envasado' },
      { value: 'a2', label: 'Almacén (inactiva)' },
    ])
  })

  it('also holds for a single option', () => {
    const position = field({ name: 'positionId', type: 'select', options: [{ value: 'c1', label: 'Viejo', inactive: true }] })
    expect(visibleOptions(position, { id: 'x', positionId: 'c1' })).toEqual([{ value: 'c1', label: 'Viejo (inactiva)' }])
  })
})
