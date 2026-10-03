import { describe, expect, it } from 'vitest'
import { createTestApp } from './helpers'

describe('keep-alive', () => {
  it('queries the database with the cron secret', async () => {
    const t = await createTestApp()
    const response = await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer test-cron-secret-0123456789' } })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('answers 401 without the secret or with another one', async () => {
    const t = await createTestApp()
    expect((await t.app.request('/internal/keep-alive')).status).toBe(401)
    expect((await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401)
  })

  it('answers 401 when the API has no cron secret configured', async () => {
    const t = await createTestApp({ cronSecret: undefined })
    const response = await t.app.request('/internal/keep-alive', { headers: { Authorization: 'Bearer undefined' } })
    expect(response.status).toBe(401)
  })
})
