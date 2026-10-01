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

  it('nombra las variables que faltan', () => {
    expect(() => leerEnv({ DATABASE_URL: 'x' })).toThrow(/SUPABASE_URL, SUPABASE_SECRET_KEY/)
  })
})
