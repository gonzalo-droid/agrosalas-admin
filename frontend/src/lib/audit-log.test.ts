import { describe, expect, it } from 'vitest'
import { ENTITY_LABEL, summarizeChange } from './audit-log'

describe('summarizeChange', () => {
  it('lists only what changed in an update, with before and after', () => {
    const before = { id: 'a1', name: 'Corte', payType: 'monthly', hourlyRate: null, active: true }
    const after = { id: 'a1', name: 'Corte fino', payType: 'monthly', hourlyRate: 6.5, active: true }
    expect(summarizeChange('update', before, after)).toBe('Nombre: Corte → Corte fino; Tarifa por hora: — → 6.5')
  })

  it('says there were no changes when an update has no differences', () => {
    const row = { id: 'a1', name: 'Corte', active: true }
    expect(summarizeChange('update', row, { ...row })).toBe('Sin cambios')
    expect(summarizeChange('update', { ...row, updatedAt: '2026-01-01' }, { ...row, updatedAt: '2026-02-01' })).toBe('Sin cambios')
  })

  it('masks the DNI and the account number in updates, creations and deletions', () => {
    const edited = summarizeChange('update', { dni: '12345678' }, { dni: '87654321' })
    expect(edited).toBe('DNI: ••••5678 → ••••4321')

    const created = summarizeChange('create', null, { number: '19412345678901', cci: '00219400123456789012', bank: 'BCP' })
    expect(created).toBe('Número: ••••8901; CCI: ••••9012; Banco: BCP')
    expect(created).not.toContain('1941234')

    const deleted = summarizeChange('delete', { dni: '12345678', phone: '999888777', address: 'Av. Siempre Viva 742', emergencyContactPhone: '987' }, null)
    expect(deleted).toBe('DNI: ••••5678; Teléfono: ••••8777; Dirección: •••• 742; Teléfono de emergencia: ••••')
    expect(deleted).not.toContain('Siempre')
  })

  it('shows null as an em dash', () => {
    expect(summarizeChange('update', { phone: null, notes: 'a' }, { phone: '999888777', notes: null })).toBe(
      'Teléfono: — → ••••8777; Notas: a → —',
    )
  })

  it('never shows ids or timestamps', () => {
    const row = { id: 'x', createdAt: '2026-01-01', updatedAt: '2026-01-02', name: 'Ana' }
    const summary = summarizeChange('create', null, row)
    expect(summary).toBe('Nombre: Ana')
    expect(summarizeChange('delete', row, null)).toBe('Nombre: Ana')
  })

  it('lists the non-null fields on a creation and uses the previous values on a deletion', () => {
    expect(summarizeChange('create', null, { name: 'Corte', hourlyRate: null, active: true, areaIds: ['a', 'b'] })).toBe(
      'Nombre: Corte; Activo: true; Áreas: ["a","b"]',
    )
    expect(summarizeChange('delete', { name: 'Corte', monthlySalary: null, hourlyRate: 7 }, null)).toBe('Nombre: Corte; Tarifa por hora: 7')
  })

  it('lists group member rows like any other', () => {
    expect(summarizeChange('update', null, { added: ['t1', 't2'] })).toBe('Agregados: ["t1","t2"]')
    expect(summarizeChange('update', { removed: 't1' }, null)).toBe('Quitado: t1')
  })

  it('returns an em dash when there is no object to summarize', () => {
    expect(summarizeChange('create', null, null)).toBe('—')
    expect(summarizeChange('delete', 'texto', null)).toBe('—')
    expect(summarizeChange('update', null, null)).toBe('—')
    expect(summarizeChange('create', null, 42)).toBe('—')
  })
})

describe('audit summary labels', () => {
  it('shows field names and enum values in Spanish', () => {
    expect(
      summarizeChange('update', { payType: 'hourly', hourlyRate: 6 }, { payType: 'monthly', hourlyRate: 7 }),
    ).toBe('Tipo de pago: Por hora → Mensual; Tarifa por hora: 6 → 7')
  })

  it('masks sensitive fields under their new names', () => {
    expect(summarizeChange('update', { phone: '987654321' }, { phone: '912345678' })).toBe(
      'Teléfono: ••••4321 → ••••5678',
    )
  })

  it('falls back to the raw key when a field has no label', () => {
    expect(summarizeChange('create', null, { somethingNew: 'x' })).toBe('somethingNew: x')
  })
})

describe('ENTITY_LABEL', () => {
  it('translates the eight audited tables', () => {
    expect(ENTITY_LABEL).toEqual({
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
