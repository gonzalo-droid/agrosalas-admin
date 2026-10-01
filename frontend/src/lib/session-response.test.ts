import { NextResponse } from 'next/server'
import { describe, expect, it } from 'vitest'
import { applyHeaders, carrySession } from './session-response'

const NO_CACHE = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

describe('applyHeaders', () => {
  it('puts the headers on the response', () => {
    const response = applyHeaders(NextResponse.next(), NO_CACHE)
    expect(response.headers.get('cache-control')).toBe(NO_CACHE['Cache-Control'])
    expect(response.headers.get('expires')).toBe('0')
    expect(response.headers.get('pragma')).toBe('no-cache')
  })
})

describe('carrySession', () => {
  it('copies the cookies (with their options) and the headers to the redirect', () => {
    const from = NextResponse.next()
    from.cookies.set('sb-ref-auth-token', 'fresh', { path: '/', maxAge: 400, sameSite: 'lax' })
    from.cookies.set('sb-ref-auth-token.1', '', { path: '/', maxAge: 0 })

    const redirect = carrySession(from, NextResponse.redirect('http://localhost/login'), NO_CACHE)

    expect(redirect.status).toBe(307)
    expect(redirect.headers.get('location')).toBe('http://localhost/login')
    expect(redirect.cookies.get('sb-ref-auth-token')).toMatchObject({ value: 'fresh', path: '/', maxAge: 400, sameSite: 'lax' })
    // The order to delete an old chunk of the cookie is kept too.
    expect(redirect.cookies.get('sb-ref-auth-token.1')).toMatchObject({ value: '', maxAge: 0 })
    expect(redirect.headers.get('cache-control')).toBe(NO_CACHE['Cache-Control'])
  })

  it('without cookies or headers leaves the redirect as it was', () => {
    const redirect = carrySession(NextResponse.next(), NextResponse.redirect('http://localhost/login'), {})
    expect(redirect.cookies.getAll()).toEqual([])
    expect(redirect.headers.get('cache-control')).toBeNull()
  })
})
