import { describe, expect, it } from 'vitest'
import { closingCheck } from './closing'

const marks = (c1: string | null, o1: string | null, c2: string | null = null, o2: string | null = null) => ({
  clockIn1: c1, clockOut1: o1, clockIn2: c2, clockOut2: o2,
})

describe('closingCheck', () => {
  it('lists the workers whose pending amount is not zero, in the order of the balances', () => {
    const check = closingCheck(
      [{ workerId: 'w2', pendingCents: -3000 }, { workerId: 'w1', pendingCents: 0 }, { workerId: 'w3', pendingCents: 2823 }],
      [],
    )
    expect(check.pending).toEqual([{ workerId: 'w2', pendingCents: -3000 }, { workerId: 'w3', pendingCents: 2823 }])
  })

  it('counts the records flagged for review and the worked days with a stretch still open', () => {
    const check = closingCheck(
      [],
      [
        { type: 'worked' as const, needsReview: true, ...marks('a', 'b') },
        { type: 'worked' as const, needsReview: false, ...marks('a', null) },
        { type: 'worked' as const, needsReview: true, ...marks('a', 'b', 'c', null) },
        { type: 'absence' as const, needsReview: false, ...marks(null, null) },
      ],
    )
    expect(check.needsReview).toBe(2)
    expect(check.openStretches).toBe(2)
  })

  it('is empty when everything is settled', () => {
    expect(closingCheck([{ workerId: 'w1', pendingCents: 0 }], [])).toEqual({ pending: [], needsReview: 0, openStretches: 0 })
  })
})
