import { describe, expect, it } from 'vitest'
import { descripcionMetodo, nombreOpcion, puedeCrearTrabajador, vistaTrabajador } from './trabajador-vista'

describe('vistaTrabajador', () => {
  it('admin y contabilidad editan todo', () => {
    for (const rol of ['admin', 'accounting'] as const) {
      expect(vistaTrabajador(rol)).toEqual({ editarFicha: true, metodosPago: 'editar', grupos: 'editar' })
    }
  })

  it('gerencia ve los métodos de pago y los grupos sin editarlos', () => {
    expect(vistaTrabajador('management')).toEqual({ editarFicha: false, metodosPago: 'ver', grupos: 'ver' })
  })

  it('el coordinador ve los grupos y no recibe métodos de pago', () => {
    expect(vistaTrabajador('coordinator')).toEqual({ editarFicha: false, metodosPago: 'ocultar', grupos: 'ver' })
  })
})

describe('puedeCrearTrabajador', () => {
  it('solo admin y contabilidad', () => {
    expect(puedeCrearTrabajador('admin')).toBe(true)
    expect(puedeCrearTrabajador('accounting')).toBe(true)
    expect(puedeCrearTrabajador('management')).toBe(false)
    expect(puedeCrearTrabajador('coordinator')).toBe(false)
  })
})

describe('nombreOpcion', () => {
  const lista = [{ id: 'a1', name: 'Envasado' }]
  it('muestra el nombre de la opción elegida', () => {
    expect(nombreOpcion(lista, 'a1')).toBe('Envasado')
  })

  it('sin valor dice "Sin asignar"; si aún no cargó la lista, "…"', () => {
    expect(nombreOpcion(lista, '')).toBe('Sin asignar')
    expect(nombreOpcion(undefined, 'a1')).toBe('…')
    expect(nombreOpcion(lista, 'otro')).toBe('…')
  })
})

describe('descripcionMetodo', () => {
  it('nombra el tipo, el banco y el número', () => {
    expect(descripcionMetodo({ type: 'yape', bank: null, number: '987654321' })).toBe('Yape 987654321')
    expect(descripcionMetodo({ type: 'bank_account', bank: 'BCP', number: '191-1234' })).toBe('Cuenta bancaria BCP 191-1234')
  })
})
