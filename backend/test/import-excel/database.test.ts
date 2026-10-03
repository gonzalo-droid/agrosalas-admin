import { describe, expect, it } from 'vitest'
import { describeDatabase } from '../../scripts/import-excel/database.js'

describe('describeDatabase', () => {
  it('names the host and the project of a direct Supabase connection, never the user or password', () => {
    const text = describeDatabase('postgresql://postgres:s3cret@db.abcdefghijklmnopqrst.supabase.co:5432/postgres')
    expect(text).toBe('Base de datos: db.abcdefghijklmnopqrst.supabase.co (proyecto abcdefghijklmnopqrst)')
    expect(text).not.toContain('s3cret')
  })

  it('takes the project from the user of a pooler connection without printing the user', () => {
    const text = describeDatabase('postgresql://postgres.abcdefghijklmnopqrst:s3cret@aws-0-sa-east-1.pooler.supabase.com:6543/postgres')
    expect(text).toBe('Base de datos: aws-0-sa-east-1.pooler.supabase.com (proyecto abcdefghijklmnopqrst)')
    expect(text).not.toContain('postgres.')
    expect(text).not.toContain('s3cret')
  })

  it('names only the host when there is no project', () => {
    expect(describeDatabase('postgres://app:s3cret@localhost:5432/agrosalas')).toBe('Base de datos: localhost')
  })

  it('does not echo a value that is not a URL', () => {
    expect(() => describeDatabase('app:s3cret-not-a-url')).toThrow('DATABASE_URL no es una URL válida.')
    try {
      describeDatabase('app:s3cret-not-a-url')
    } catch (error) {
      expect(String(error)).not.toContain('s3cret')
    }
  })
})
