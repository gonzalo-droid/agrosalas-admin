import { NextResponse } from 'next/server'
import { describe, expect, it } from 'vitest'
import { aplicarCabeceras, pasarSesion } from './respuesta-sesion'

const SIN_CACHE = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

describe('aplicarCabeceras', () => {
  it('pone las cabeceras en la respuesta', () => {
    const respuesta = aplicarCabeceras(NextResponse.next(), SIN_CACHE)
    expect(respuesta.headers.get('cache-control')).toBe(SIN_CACHE['Cache-Control'])
    expect(respuesta.headers.get('expires')).toBe('0')
    expect(respuesta.headers.get('pragma')).toBe('no-cache')
  })
})

describe('pasarSesion', () => {
  it('copia las cookies (con sus opciones) y las cabeceras a la redirección', () => {
    const desde = NextResponse.next()
    desde.cookies.set('sb-ref-auth-token', 'nuevo', { path: '/', maxAge: 400, sameSite: 'lax' })
    desde.cookies.set('sb-ref-auth-token.1', '', { path: '/', maxAge: 0 })

    const redireccion = pasarSesion(desde, NextResponse.redirect('http://localhost/login'), SIN_CACHE)

    expect(redireccion.status).toBe(307)
    expect(redireccion.headers.get('location')).toBe('http://localhost/login')
    expect(redireccion.cookies.get('sb-ref-auth-token')).toMatchObject({ value: 'nuevo', path: '/', maxAge: 400, sameSite: 'lax' })
    // La orden de borrar un trozo viejo de la cookie también se conserva.
    expect(redireccion.cookies.get('sb-ref-auth-token.1')).toMatchObject({ value: '', maxAge: 0 })
    expect(redireccion.headers.get('cache-control')).toBe(SIN_CACHE['Cache-Control'])
  })

  it('sin cookies ni cabeceras deja la redirección como estaba', () => {
    const redireccion = pasarSesion(NextResponse.next(), NextResponse.redirect('http://localhost/login'), {})
    expect(redireccion.cookies.getAll()).toEqual([])
    expect(redireccion.headers.get('cache-control')).toBeNull()
  })
})
