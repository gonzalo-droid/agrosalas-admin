import { beforeAll, describe, expect, it } from 'vitest'
import { createTestApp, USERS } from './helpers'
import { auditLog } from '../src/db/schema'

let t: Awaited<ReturnType<typeof createTestApp>>
beforeAll(async () => {
  t = await createTestApp()
  // Every name change leaves an audit row.
  for (const name of ['Uno Uno', 'Dos Dos', 'Tres Tres']) {
    await t.request('admin', 'PATCH', '/v1/me', { name })
  }
})

describe('/v1/audit-log', () => {
  it('only the administrator can read it', async () => {
    for (const role of ['management', 'accounting', 'coordinator'] as const) {
      expect((await t.request(role, 'GET', '/v1/audit-log')).status).toBe(403)
    }
  })

  it('paginates, returns the total and sorts from the most recent to the oldest', async () => {
    const r = await t.request('admin', 'GET', '/v1/audit-log?pageSize=2')
    expect(r.status).toBe(200)
    expect(r.json).toMatchObject({ total: 3, page: 1, pageSize: 2 })
    expect(r.json.items.map((row: { after: { name: string } }) => row.after.name)).toEqual(['Tres Tres', 'Dos Dos'])

    const second = await t.request('admin', 'GET', '/v1/audit-log?pageSize=2&page=2')
    expect(second.json.items).toHaveLength(1)
  })

  it('includes the name of who made the change and filters by table', async () => {
    const r = await t.request('admin', 'GET', '/v1/audit-log?entity=users')
    expect(r.json.total).toBe(3)
    expect(r.json.items[0]).toMatchObject({ action: 'update', entity: 'users', userName: 'Tres Tres' })
    expect((await t.request('admin', 'GET', '/v1/audit-log?entity=areas')).json.total).toBe(0)
  })

  it('uses 25 rows by default and rejects more than 100', async () => {
    expect((await t.request('admin', 'GET', '/v1/audit-log')).json.pageSize).toBe(25)
    const r = await t.request('admin', 'GET', '/v1/audit-log?pageSize=101')
    expect(r.status).toBe(400)
    expect(r.json.error.field).toBe('pageSize')
  })

  it('paginates without repeating or skipping rows even when they share the same date', async () => {
    // Insert 5 audit rows with exactly the same createdAt
    await t.db.insert(auditLog).values(
      Array.from({ length: 5 }, () => ({
        userId: USERS.admin,
        action: 'create' as const,
        entity: 'tie',
        entityId: USERS.admin,
        before: null,
        after: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })),
    )

    // Request the 5 pages, 1 row per page
    const ids: string[] = []
    const first = await t.request('admin', 'GET', '/v1/audit-log?entity=tie&pageSize=1&page=1')
    expect(first.json.total).toBe(5)
    for (let page = 1; page <= 5; page++) {
      const res = await t.request('admin', 'GET', `/v1/audit-log?entity=tie&pageSize=1&page=${page}`)
      expect(res.json.items).toHaveLength(1)
      ids.push(res.json.items[0].id)
    }

    // Check that all the ids are different
    expect(new Set(ids).size).toBe(5)
  })
})
