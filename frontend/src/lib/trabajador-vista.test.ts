import { describe, expect, it } from 'vitest'
import { descripcionMetodo, nombreOpcion, puedeCrearTrabajador, vistaTrabajador } from './trabajador-vista'

describe('vistaTrabajador', () => {
  it('admin y contabilidad editan todo', () => {
    for (const rol of ['admin', 'contabilidad'] as const) {
      expect(vistaTrabajador(rol)).toEqual({ editarFicha: true, metodosPago: 'editar', grupos: 'editar' })
    }
  })

  it('gerencia ve los métodos de pago y los grupos sin editarlos', () => {
    expect(vistaTrabajador('gerencia')).toEqual({ editarFicha: false, metodosPago: 'ver', grupos: 'ver' })
  })

  it('el coordinador ve los grupos y no recibe métodos de pago', () => {
    expect(vistaTrabajador('coordinador')).toEqual({ editarFicha: false, metodosPago: 'ocultar', grupos: 'ver' })
  })
})

describe('puedeCrearTrabajador', () => {
  it('solo admin y contabilidad', () => {
    expect(puedeCrearTrabajador('admin')).toBe(true)
    expect(puedeCrearTrabajador('contabilidad')).toBe(true)
    expect(puedeCrearTrabajador('gerencia')).toBe(false)
    expect(puedeCrearTrabajador('coordinador')).toBe(false)
  })
})

describe('nombreOpcion', () => {
  const lista = [{ id: 'a1', nombre: 'Envasado' }]
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
    expect(descripcionMetodo({ tipo: 'yape', banco: null, numero: '987654321' })).toBe('Yape 987654321')
    expect(descripcionMetodo({ tipo: 'cuenta_bancaria', banco: 'BCP', numero: '191-1234' })).toBe('Cuenta bancaria BCP 191-1234')
  })
})
