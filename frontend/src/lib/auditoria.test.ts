import { describe, expect, it } from 'vitest'
import { ETIQUETA_ENTIDAD, resumenCambio } from './auditoria'

describe('resumenCambio', () => {
  it('en una edición lista solo lo que cambió, con antes y después', () => {
    const antes = { id: 'a1', name: 'Corte', payType: 'monthly', hourlyRate: null, active: true }
    const despues = { id: 'a1', name: 'Corte fino', payType: 'monthly', hourlyRate: 6.5, active: true }
    expect(resumenCambio('update', antes, despues)).toBe('Nombre: Corte → Corte fino; Tarifa por hora: — → 6.5')
  })

  it('en una edición sin diferencias dice que no hubo cambios', () => {
    const fila = { id: 'a1', name: 'Corte', active: true }
    expect(resumenCambio('update', fila, { ...fila })).toBe('Sin cambios')
    expect(resumenCambio('update', { ...fila, updatedAt: '2026-01-01' }, { ...fila, updatedAt: '2026-02-01' })).toBe('Sin cambios')
  })

  it('enmascara el DNI y el número de cuenta en ediciones, altas y bajas', () => {
    const editado = resumenCambio('update', { dni: '12345678' }, { dni: '87654321' })
    expect(editado).toBe('DNI: ••••5678 → ••••4321')

    const alta = resumenCambio('create', null, { number: '19412345678901', cci: '00219400123456789012', bank: 'BCP' })
    expect(alta).toBe('Número: ••••8901; CCI: ••••9012; Banco: BCP')
    expect(alta).not.toContain('1941234')

    const baja = resumenCambio('delete', { dni: '12345678', phone: '999888777', address: 'Av. Siempre Viva 742', emergencyContactPhone: '987' }, null)
    expect(baja).toBe('DNI: ••••5678; Teléfono: ••••8777; Dirección: •••• 742; Teléfono de emergencia: ••••')
    expect(baja).not.toContain('Siempre')
  })

  it('muestra null como un guion largo', () => {
    expect(resumenCambio('update', { phone: null, notes: 'a' }, { phone: '999888777', notes: null })).toBe(
      'Teléfono: — → ••••8777; Notas: a → —',
    )
  })

  it('nunca muestra ids ni marcas de tiempo', () => {
    const fila = { id: 'x', createdAt: '2026-01-01', updatedAt: '2026-01-02', name: 'Ana' }
    const resumen = resumenCambio('create', null, fila)
    expect(resumen).toBe('Nombre: Ana')
    expect(resumenCambio('delete', fila, null)).toBe('Nombre: Ana')
  })

  it('en una alta lista los campos que no son null y en una baja usa lo de antes', () => {
    expect(resumenCambio('create', null, { name: 'Corte', hourlyRate: null, active: true, areaIds: ['a', 'b'] })).toBe(
      'Nombre: Corte; Activo: true; Áreas: ["a","b"]',
    )
    expect(resumenCambio('delete', { name: 'Corte', monthlySalary: null, hourlyRate: 7 }, null)).toBe('Nombre: Corte; Tarifa por hora: 7')
  })

  it('lista las filas de miembros de grupo como cualquier otra', () => {
    expect(resumenCambio('update', null, { added: ['t1', 't2'] })).toBe('Agregados: ["t1","t2"]')
    expect(resumenCambio('update', { removed: 't1' }, null)).toBe('Quitado: t1')
  })

  it('devuelve un guion largo cuando no hay un objeto que resumir', () => {
    expect(resumenCambio('create', null, null)).toBe('—')
    expect(resumenCambio('delete', 'texto', null)).toBe('—')
    expect(resumenCambio('update', null, null)).toBe('—')
    expect(resumenCambio('create', null, 42)).toBe('—')
  })
})

describe('audit summary labels', () => {
  it('shows field names and enum values in Spanish', () => {
    expect(
      resumenCambio('update', { payType: 'hourly', hourlyRate: 6 }, { payType: 'monthly', hourlyRate: 7 }),
    ).toBe('Tipo de pago: Por hora → Mensual; Tarifa por hora: 6 → 7')
  })

  it('masks sensitive fields under their new names', () => {
    expect(resumenCambio('update', { phone: '987654321' }, { phone: '912345678' })).toBe(
      'Teléfono: ••••4321 → ••••5678',
    )
  })

  it('falls back to the raw key when a field has no label', () => {
    expect(resumenCambio('create', null, { somethingNew: 'x' })).toBe('somethingNew: x')
  })
})

describe('ETIQUETA_ENTIDAD', () => {
  it('traduce las ocho tablas auditadas', () => {
    expect(ETIQUETA_ENTIDAD).toEqual({
      workers: 'Trabajadores',
      worker_payment_methods: 'Métodos de pago',
      users: 'Usuarios',
      positions: 'Cargos',
      groups: 'Grupos',
      areas: 'Áreas',
      shifts: 'Turnos',
      campaigns: 'Campañas',
    })
  })
})
