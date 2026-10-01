import { describe, expect, it } from 'vitest'
import { leerEnv } from '../src/env'

const completo = {
  DATABASE_URL: 'postgres://u:c@host:5432/postgres',
  SUPABASE_URL: 'https://proyecto.supabase.co',
  SUPABASE_SECRET_KEY: 'secreta',
}

describe('leerEnv', () => {
  it('aplica los valores por defecto', () => {
    expect(leerEnv(completo)).toMatchObject({ ORIGEN_PANEL: 'http://localhost:3000', PUERTO: 8787 })
  })

  it('quita la barra final de SUPABASE_URL y ORIGEN_PANEL', () => {
    const env = leerEnv({ ...completo, SUPABASE_URL: 'https://proyecto.supabase.co/', ORIGEN_PANEL: 'http://localhost:3000/' })
    expect(env.SUPABASE_URL).toBe('https://proyecto.supabase.co')
    expect(env.ORIGEN_PANEL).toBe('http://localhost:3000')
  })

  it('lee PUERTO como número', () => {
    expect(leerEnv({ ...completo, PUERTO: '9000' }).PUERTO).toBe(9000)
  })

  it.each(['', '0', '70000'])('rechaza PUERTO=%j y lo nombra', (puerto) => {
    expect(() => leerEnv({ ...completo, PUERTO: puerto })).toThrow(/PUERTO/)
  })

  it('nombra las variables que faltan', () => {
    expect(() => leerEnv({ DATABASE_URL: 'x' })).toThrow(/SUPABASE_URL, SUPABASE_SECRET_KEY/)
  })
})
