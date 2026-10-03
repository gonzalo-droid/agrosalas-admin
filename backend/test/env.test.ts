import { describe, expect, it } from 'vitest'
import { readEnv } from '../src/env.js'

const complete = {
  DATABASE_URL: 'postgres://u:c@host:5432/postgres',
  SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SECRET_KEY: 'secret',
}

describe('readEnv', () => {
  it('applies the default values', () => {
    expect(readEnv(complete)).toMatchObject({ PANEL_ORIGIN: 'http://localhost:3000', PORT: 8787 })
  })

  it('defaults EVIDENCE_BUCKET to payment-evidence and reads it when given', () => {
    expect(readEnv(complete).EVIDENCE_BUCKET).toBe('payment-evidence')
    expect(readEnv({ ...complete, EVIDENCE_BUCKET: 'otro' }).EVIDENCE_BUCKET).toBe('otro')
  })

  it('strips the trailing slash from SUPABASE_URL and PANEL_ORIGIN', () => {
    const env = readEnv({ ...complete, SUPABASE_URL: 'https://project.supabase.co/', PANEL_ORIGIN: 'http://localhost:3000/' })
    expect(env.SUPABASE_URL).toBe('https://project.supabase.co')
    expect(env.PANEL_ORIGIN).toBe('http://localhost:3000')
  })

  it('reads PORT as a number', () => {
    expect(readEnv({ ...complete, PORT: '9000' }).PORT).toBe(9000)
  })

  it.each(['', '0', '70000'])('rejects PORT=%j and names it', (port) => {
    expect(() => readEnv({ ...complete, PORT: port })).toThrow(/PORT/)
  })

  it('treats CRON_SECRET as optional and requires 16 or more characters when given', () => {
    expect(readEnv(complete).CRON_SECRET).toBeUndefined()
    expect(readEnv({ ...complete, CRON_SECRET: 'a'.repeat(16) }).CRON_SECRET).toBe('a'.repeat(16))
    expect(() => readEnv({ ...complete, CRON_SECRET: 'short' })).toThrow(/CRON_SECRET/)
  })

  it('names the missing variables', () => {
    expect(() => readEnv({ DATABASE_URL: 'x' })).toThrow(/SUPABASE_URL, SUPABASE_SECRET_KEY/)
  })
})
