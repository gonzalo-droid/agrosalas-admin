import { describe, expect, it } from 'vitest'
import { ETIQUETA_ENTIDAD, resumenCambio } from './auditoria'

describe('resumenCambio', () => {
  it('en una edición lista solo lo que cambió, con antes y después', () => {
    const antes = { id: 'a1', nombre: 'Corte', tipoPago: 'mensual', tarifaHora: null, activo: true }
    const despues = { id: 'a1', nombre: 'Corte fino', tipoPago: 'mensual', tarifaHora: 6.5, activo: true }
    expect(resumenCambio('editar', antes, despues)).toBe('nombre: Corte → Corte fino; tarifaHora: — → 6.5')
  })

  it('en una edición sin diferencias dice que no hubo cambios', () => {
    const fila = { id: 'a1', nombre: 'Corte', activo: true }
    expect(resumenCambio('editar', fila, { ...fila })).toBe('Sin cambios')
    expect(resumenCambio('editar', { ...fila, actualizadoEn: '2026-01-01' }, { ...fila, actualizadoEn: '2026-02-01' })).toBe('Sin cambios')
  })

  it('enmascara el DNI y el número de cuenta en ediciones, altas y bajas', () => {
    const editado = resumenCambio('editar', { dni: '12345678' }, { dni: '87654321' })
    expect(editado).toBe('dni: ••••5678 → ••••4321')

    const alta = resumenCambio('crear', null, { numero: '19412345678901', cci: '00219400123456789012', banco: 'BCP' })
    expect(alta).toBe('numero: ••••8901; cci: ••••9012; banco: BCP')
    expect(alta).not.toContain('1941234')

    const baja = resumenCambio('eliminar', { dni: '12345678', telefono: '999888777', direccion: 'Av. Siempre Viva 742', emergenciaTelefono: '987' }, null)
    expect(baja).toBe('dni: ••••5678; telefono: ••••8777; direccion: •••• 742; emergenciaTelefono: ••••')
    expect(baja).not.toContain('Siempre')
  })

  it('muestra null como un guion largo', () => {
    expect(resumenCambio('editar', { telefono: null, notas: 'a' }, { telefono: '999888777', notas: null })).toBe(
      'telefono: — → ••••8777; notas: a → —',
    )
  })

  it('nunca muestra ids ni marcas de tiempo', () => {
    const fila = { id: 'x', creadoEn: '2026-01-01', actualizadoEn: '2026-01-02', nombre: 'Ana' }
    const resumen = resumenCambio('crear', null, fila)
    expect(resumen).toBe('nombre: Ana')
    expect(resumenCambio('eliminar', fila, null)).toBe('nombre: Ana')
  })

  it('en una alta lista los campos que no son null y en una baja usa lo de antes', () => {
    expect(resumenCambio('crear', null, { nombre: 'Corte', tarifaHora: null, activo: true, areaIds: ['a', 'b'] })).toBe(
      'nombre: Corte; activo: true; areaIds: ["a","b"]',
    )
    expect(resumenCambio('eliminar', { nombre: 'Corte', sueldoMensual: null, tarifaHora: 7 }, null)).toBe('nombre: Corte; tarifaHora: 7')
  })

  it('lista las filas de miembros de grupo como cualquier otra', () => {
    expect(resumenCambio('editar', null, { agregados: ['t1', 't2'] })).toBe('agregados: ["t1","t2"]')
    expect(resumenCambio('editar', { quitado: 't1' }, null)).toBe('quitado: t1')
  })

  it('devuelve un guion largo cuando no hay un objeto que resumir', () => {
    expect(resumenCambio('crear', null, null)).toBe('—')
    expect(resumenCambio('eliminar', 'texto', null)).toBe('—')
    expect(resumenCambio('editar', null, null)).toBe('—')
    expect(resumenCambio('crear', null, 42)).toBe('—')
  })
})

describe('ETIQUETA_ENTIDAD', () => {
  it('traduce las ocho tablas auditadas', () => {
    expect(ETIQUETA_ENTIDAD).toEqual({
      trabajadores: 'Trabajadores',
      trabajador_metodos_pago: 'Métodos de pago',
      usuarios: 'Usuarios',
      cargos: 'Cargos',
      grupos: 'Grupos',
      areas: 'Áreas',
      turnos: 'Turnos',
      campanas: 'Campañas',
    })
  })
})
