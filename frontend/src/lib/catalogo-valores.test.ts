import { describe, expect, it } from 'vitest'
import { camposVisibles, cuerpoParaEnviar, type CampoCatalogo, type Valores } from './catalogo-valores'

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
    const campos = [campo({ nombre: 'clave', tipo: 'clave' })]
    expect(cuerpoParaEnviar(campos, { clave: '  secreta 1  ' }, false)).toEqual({ clave: '  secreta 1  ' })
    expect(cuerpoParaEnviar(campos, { clave: '' }, false)).toEqual({ clave: null })
  })

  it('omite los campos solo al crear cuando se edita y los incluye al crear', () => {
    const campos = [campo({ nombre: 'correo', tipo: 'correo', soloAlCrear: true }), campo({ nombre: 'nombre', tipo: 'texto' })]
    const valores: Valores = { correo: 'a@b.pe', nombre: 'Ana' }
    expect(cuerpoParaEnviar(campos, valores, true)).toEqual({ nombre: 'Ana' })
    expect(cuerpoParaEnviar(campos, valores, false)).toEqual({ correo: 'a@b.pe', nombre: 'Ana' })
  })

  it('manda null en un campo oculto por visibleSi y no lo cuenta entre los visibles', () => {
    const campos = [
      campo({ nombre: 'tipoPago', tipo: 'opcion' }),
      campo({ nombre: 'sueldo', tipo: 'numero', visibleSi: (v) => v.tipoPago === 'mensual' }),
    ]
    const valores: Valores = { tipoPago: 'por_hora', sueldo: '1800' }
    expect(cuerpoParaEnviar(campos, valores, false)).toEqual({ tipoPago: 'por_hora', sueldo: null })
    expect(camposVisibles(campos, valores, false).map((c) => c.nombre)).toEqual(['tipoPago'])
    expect(camposVisibles(campos, { ...valores, tipoPago: 'mensual' }, false).map((c) => c.nombre)).toEqual(['tipoPago', 'sueldo'])
  })

  it('deja pasar las casillas y las listas de opciones', () => {
    const campos = [campo({ nombre: 'temporal', tipo: 'casilla' }), campo({ nombre: 'areaIds', tipo: 'opciones' })]
    expect(cuerpoParaEnviar(campos, { temporal: true, areaIds: ['x', 'y'] }, false)).toEqual({ temporal: true, areaIds: ['x', 'y'] })
    expect(cuerpoParaEnviar(campos, { temporal: false, areaIds: [] }, false)).toEqual({ temporal: false, areaIds: [] })
  })
})

describe('camposVisibles', () => {
  it('quita los campos solo al crear cuando se edita', () => {
    const campos = [campo({ nombre: 'clave', tipo: 'clave', soloAlCrear: true }), campo({ nombre: 'nombre', tipo: 'texto' })]
    expect(camposVisibles(campos, {}, true).map((c) => c.nombre)).toEqual(['nombre'])
    expect(camposVisibles(campos, {}, false).map((c) => c.nombre)).toEqual(['clave', 'nombre'])
  })
})
