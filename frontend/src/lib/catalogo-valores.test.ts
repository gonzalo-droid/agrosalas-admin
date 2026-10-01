import { describe, expect, it } from 'vitest'
import { aplicarCambio, camposVisibles, cuerpoParaEnviar, opcionesVisibles, type CampoCatalogo, type Valores } from './catalogo-valores'

const campo = (c: Partial<CampoCatalogo> & Pick<CampoCatalogo, 'nombre' | 'tipo'>): CampoCatalogo => ({ etiqueta: c.nombre, ...c })

describe('cuerpoParaEnviar', () => {
  it('manda los números como número y los vacíos como null', () => {
    const campos = [campo({ nombre: 'a', tipo: 'numero' }), campo({ nombre: 'b', tipo: 'numero' })]
    expect(cuerpoParaEnviar(campos, { a: '6.25', b: '' }, false)).toEqual({ a: 6.25, b: null })
  })

  it('manda null en los textos, correos, horas y fechas vacíos y recorta el texto', () => {
    const campos = [
      campo({ nombre: 't', tipo: 'texto' }),
      campo({ nombre: 'c', tipo: 'correo' }),
      campo({ nombre: 'h', tipo: 'hora' }),
      campo({ nombre: 'f', tipo: 'fecha' }),
      campo({ nombre: 'n', tipo: 'texto' }),
    ]
    const valores: Valores = { t: '   ', c: '', h: '', f: '', n: '  Ana  ' }
    expect(cuerpoParaEnviar(campos, valores, false)).toEqual({ t: null, c: null, h: null, f: null, n: 'Ana' })
  })

  it('no recorta la contraseña', () => {
    const campos = [campo({ nombre: 'password', tipo: 'clave' })]
    expect(cuerpoParaEnviar(campos, { password: '  secreta 1  ' }, false)).toEqual({ password: '  secreta 1  ' })
    expect(cuerpoParaEnviar(campos, { password: '' }, false)).toEqual({ password: null })
  })

  it('omite los campos solo al crear cuando se edita y los incluye al crear', () => {
    const campos = [campo({ nombre: 'email', tipo: 'correo', soloAlCrear: true }), campo({ nombre: 'name', tipo: 'texto' })]
    const valores: Valores = { email: 'a@b.pe', name: 'Ana' }
    expect(cuerpoParaEnviar(campos, valores, true)).toEqual({ name: 'Ana' })
    expect(cuerpoParaEnviar(campos, valores, false)).toEqual({ email: 'a@b.pe', name: 'Ana' })
  })

  it('manda null en un campo oculto por visibleSi y no lo cuenta entre los visibles', () => {
    const campos = [
      campo({ nombre: 'payType', tipo: 'opcion' }),
      campo({ nombre: 'monthlySalary', tipo: 'numero', visibleSi: (v) => v.payType === 'monthly' }),
    ]
    const valores: Valores = { payType: 'hourly', monthlySalary: '1800' }
    expect(cuerpoParaEnviar(campos, valores, false)).toEqual({ payType: 'hourly', monthlySalary: null })
    expect(camposVisibles(campos, valores, false).map((c) => c.nombre)).toEqual(['payType'])
    expect(camposVisibles(campos, { ...valores, payType: 'monthly' }, false).map((c) => c.nombre)).toEqual(['payType', 'monthlySalary'])
  })

  it('deja pasar las casillas y las listas de opciones', () => {
    const campos = [campo({ nombre: 'temporary', tipo: 'casilla' }), campo({ nombre: 'areaIds', tipo: 'opciones' })]
    expect(cuerpoParaEnviar(campos, { temporary: true, areaIds: ['x', 'y'] }, false)).toEqual({ temporary: true, areaIds: ['x', 'y'] })
    expect(cuerpoParaEnviar(campos, { temporary: false, areaIds: [] }, false)).toEqual({ temporary: false, areaIds: [] })
  })
})

describe('camposVisibles', () => {
  it('quita los campos solo al crear cuando se edita', () => {
    const campos = [campo({ nombre: 'password', tipo: 'clave', soloAlCrear: true }), campo({ nombre: 'name', tipo: 'texto' })]
    expect(camposVisibles(campos, {}, true).map((c) => c.nombre)).toEqual(['name'])
    expect(camposVisibles(campos, {}, false).map((c) => c.nombre)).toEqual(['password', 'name'])
  })
})

describe('aplicarCambio', () => {
  const derivar = (campo: string, v: Valores) => (campo === 'normal' ? { extra: String(Number(v.normal) * 1.25) } : {})

  it('al crear, propone los campos derivados', () => {
    expect(aplicarCambio({ normal: '', extra: '' }, 'normal', '10', derivar, false)).toEqual({ normal: '10', extra: '12.5' })
  })

  it('al editar, nunca pisa lo que ya estaba', () => {
    expect(aplicarCambio({ normal: '10', extra: '15' }, 'normal', '12', derivar, true)).toEqual({ normal: '12', extra: '15' })
  })

  it('sin derivar solo cambia el campo', () => {
    expect(aplicarCambio({ a: 'x' }, 'a', 'y', undefined, false)).toEqual({ a: 'y' })
  })
})

describe('opcionesVisibles', () => {
  const areas = campo({
    nombre: 'areaIds',
    tipo: 'opciones',
    opciones: [
      { valor: 'a1', etiqueta: 'Envasado' },
      { valor: 'a2', etiqueta: 'Almacén', inactiva: true },
      { valor: 'a3', etiqueta: 'Campo', inactiva: true },
    ],
  })

  it('al crear, solo las activas', () => {
    expect(opcionesVisibles(areas, null)).toEqual([{ valor: 'a1', etiqueta: 'Envasado' }])
  })

  it('al editar, también las inactivas que la fila ya tiene, marcadas', () => {
    expect(opcionesVisibles(areas, { id: 'u1', areaIds: ['a2'] })).toEqual([
      { valor: 'a1', etiqueta: 'Envasado' },
      { valor: 'a2', etiqueta: 'Almacén (inactiva)' },
    ])
  })

  it('vale también para una opción única', () => {
    const rol = campo({ nombre: 'positionId', tipo: 'opcion', opciones: [{ valor: 'c1', etiqueta: 'Viejo', inactiva: true }] })
    expect(opcionesVisibles(rol, { id: 'x', positionId: 'c1' })).toEqual([{ valor: 'c1', etiqueta: 'Viejo (inactiva)' }])
  })
})
