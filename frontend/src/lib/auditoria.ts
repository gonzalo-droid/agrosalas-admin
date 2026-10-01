export const ETIQUETA_ENTIDAD: Record<string, string> = {
  workers: 'Trabajadores',
  worker_payment_methods: 'Métodos de pago',
  users: 'Usuarios',
  positions: 'Cargos',
  groups: 'Grupos',
  areas: 'Áreas',
  shifts: 'Turnos',
  campaigns: 'Campañas',
}

export const FIELD_LABEL: Record<string, string> = {
  name: 'Nombre',
  email: 'Correo',
  role: 'Rol',
  active: 'Activo',
  areaIds: 'Áreas',
  startTime: 'Hora de inicio',
  endTime: 'Hora de fin',
  startDate: 'Fecha de inicio',
  endDate: 'Fecha de fin',
  payType: 'Tipo de pago',
  hourlyRate: 'Tarifa por hora',
  overtimeRate: 'Tarifa por hora extra',
  monthlySalary: 'Sueldo mensual',
  temporary: 'Temporal',
  dni: 'DNI',
  firstName: 'Nombres',
  lastName: 'Apellidos',
  phone: 'Teléfono',
  address: 'Dirección',
  emergencyContactName: 'Contacto de emergencia',
  emergencyContactPhone: 'Teléfono de emergencia',
  areaId: 'Área',
  positionId: 'Cargo',
  shiftId: 'Turno',
  employmentType: 'Modalidad',
  hireDate: 'Fecha de ingreso',
  status: 'Estado',
  notes: 'Notas',
  workerId: 'Trabajador',
  type: 'Tipo',
  number: 'Número',
  bank: 'Banco',
  cci: 'CCI',
  holderName: 'Titular',
  isPrimary: 'Principal',
  added: 'Agregados',
  removed: 'Quitado',
}

// Enum values of the contract, by field. Anything missing here is shown as it comes.
export const VALUE_LABEL: Record<string, Record<string, string>> = {
  role: { admin: 'Administrador', management: 'Gerencia', accounting: 'Contabilidad', coordinator: 'Coordinador' },
  employmentType: { temporary: 'Temporal', contract: 'Contrato' },
  status: { active: 'Activo', terminated: 'Cesado' },
  payType: { hourly: 'Por hora', monthly: 'Mensual' },
  type: { yape: 'Yape', plin: 'Plin', bank_account: 'Cuenta bancaria' },
}

const IGNORED = new Set(['id', 'createdAt', 'updatedAt'])
// Personal and bank data: the audit log only shows the last characters.
const SENSITIVE = new Set(['dni', 'phone', 'address', 'emergencyContactPhone', 'number', 'cci'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const label = (key: string) => FIELD_LABEL[key] ?? key

function show(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—'
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (SENSITIVE.has(key)) return text.length <= 4 ? '••••' : `••••${text.slice(-4)}`
  return VALUE_LABEL[key]?.[text] ?? text
}

// Readable summary of an audit row. It never returns the full JSON or complete personal data.
export function resumenCambio(action: 'create' | 'update' | 'delete', before: unknown, after: unknown): string {
  if (action === 'update' && isObject(before) && isObject(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !IGNORED.has(k))
    const changes = keys
      .filter((k) => JSON.stringify(before[k] ?? null) !== JSON.stringify(after[k] ?? null))
      .map((k) => `${label(k)}: ${show(k, before[k])} → ${show(k, after[k])}`)
    return changes.length > 0 ? changes.join('; ') : 'Sin cambios'
  }

  const row = action === 'delete' ? before : action === 'create' ? after : (after ?? before)
  if (!isObject(row)) return '—'
  const fields = Object.entries(row)
    .filter(([k, v]) => !IGNORED.has(k) && v !== null && v !== undefined)
    .map(([k, v]) => `${label(k)}: ${show(k, v)}`)
  return fields.length > 0 ? fields.join('; ') : '—'
}
