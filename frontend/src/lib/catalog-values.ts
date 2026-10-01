export type Value = string | boolean | string[]
export type Values = Record<string, Value>
export type CatalogRow = { id: string } & Record<string, unknown>

export type CatalogField = {
  name: string
  label: string
  type: 'text' | 'email' | 'password' | 'time' | 'date' | 'number' | 'checkbox' | 'select' | 'multiselect'
  // An inactive option is offered only when editing a row that already has it (so it can be seen and removed).
  options?: { value: string; label: string; inactive?: boolean }[]
  required?: boolean
  createOnly?: boolean
  help?: string
  // If it returns false the field is not shown, not required and is sent as null.
  visibleIf?: (values: Values) => boolean
}

export function initialValue(field: CatalogField, row: CatalogRow | null): Value {
  const raw = row?.[field.name]
  if (field.type === 'checkbox') return Boolean(raw)
  if (field.type === 'multiselect') return Array.isArray(raw) ? (raw as string[]) : []
  if (raw == null) return field.type === 'select' ? (field.options?.[0]?.value ?? '') : ''
  return field.type === 'time' ? String(raw).slice(0, 5) : String(raw)
}

// The fields drawn in the form.
export function visibleFields(fields: CatalogField[], values: Values, isEdit: boolean): CatalogField[] {
  return fields.filter((f) => !(isEdit && f.createOnly) && (f.visibleIf?.(values) ?? true))
}

function toRequestValue(field: CatalogField, value: Value | undefined): unknown {
  if (typeof value !== 'string') return value
  // The password is sent as it is: trimming it would change what the person typed.
  if (field.type === 'password') return value === '' ? null : value
  const text = value.trim()
  if (text === '') return null
  return field.type === 'number' ? Number(text) : text
}

// What is sent to the API: numbers as numbers, and empty or hidden values as null.
export function buildRequestBody(fields: CatalogField[], values: Values, isEdit: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {}
  for (const f of fields) {
    if (isEdit && f.createOnly) continue
    const hidden = f.visibleIf ? !f.visibleIf(values) : false
    body[f.name] = hidden ? null : toRequestValue(f, values[f.name])
  }
  return body
}

// Applies a form change. `derive` proposes other fields (e.g. the overtime rate from the regular one)
// only when creating: when editing it would overwrite a value chosen on purpose.
export function applyChange(
  values: Values,
  field: string,
  value: Value,
  derive: ((field: string, values: Values) => Partial<Values>) | undefined,
  isEdit: boolean,
): Values {
  const next = { ...values, [field]: value }
  return isEdit || !derive ? next : ({ ...next, ...derive(field, next) } as Values)
}

// The options offered: the active ones and, when editing, the inactive ones the row already has (marked).
export function visibleOptions(field: CatalogField, row: CatalogRow | null): { value: string; label: string }[] {
  const current = row?.[field.name]
  const has = (value: string) => (Array.isArray(current) ? current.includes(value) : current === value)
  return (field.options ?? [])
    .filter((o) => !o.inactive || has(o.value))
    .map((o) => ({ value: o.value, label: o.inactive ? `${o.label} (inactiva)` : o.label }))
}
