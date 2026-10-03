import { describe, expect, it } from 'vitest'
import { buildBalances, salaryCents, signedCents, sumBalances } from '../src/payroll/balance'

describe('signedCents', () => {
  it('adds salary, bonus and piecework and subtracts a deduction', () => {
    expect(signedCents('salary', 150000)).toBe(150000)
    expect(signedCents('bonus', 2000)).toBe(2000)
    expect(signedCents('piecework', 3550)).toBe(3550)
    expect(signedCents('deduction', 1000)).toBe(-1000)
  })
})

describe('buildBalances', () => {
  const balances = buildBalances(
    ['w1', 'w2', 'w3'],
    [{ workerId: 'w1', cents: 6823 }, { workerId: 'w2', cents: 5000 }],
    [
      { workerId: 'w1', type: 'bonus', cents: 2000 },
      { workerId: 'w1', type: 'deduction', cents: 1000 },
      { workerId: 'w3', type: 'salary', cents: 150000 },
    ],
    [{ workerId: 'w1', cents: 5000 }, { workerId: 'w2', cents: 6000 }],
  )

  it('returns one balance per worker, in the order given', () => {
    expect(balances.map((b) => b.workerId)).toEqual(['w1', 'w2', 'w3'])
  })

  it('adds attendance and items and subtracts deductions and payments', () => {
    expect(balances[0]).toEqual({
      workerId: 'w1',
      attendanceCents: 6823,
      additionsCents: 2000,
      deductionsCents: 1000,
      totalCents: 7823,
      paidCents: 5000,
      pendingCents: 2823,
    })
  })

  it('leaves a negative pending amount when more than the total was paid', () => {
    expect(balances[1].totalCents).toBe(5000)
    expect(balances[1].pendingCents).toBe(-1000)
  })

  it('gives a worker with only a salary that salary as total and pending', () => {
    expect(balances[2]).toMatchObject({ attendanceCents: 0, additionsCents: 150000, totalCents: 150000, paidCents: 0, pendingCents: 150000 })
  })

  it('ignores sums of workers that are not in the list', () => {
    expect(buildBalances(['w1'], [{ workerId: 'other', cents: 999 }], [], [])).toEqual([
      { workerId: 'w1', attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 },
    ])
  })

  it('adds up every balance', () => {
    expect(sumBalances(balances)).toEqual({
      attendanceCents: 11823,
      additionsCents: 152000,
      deductionsCents: 1000,
      totalCents: 162823,
      paidCents: 11000,
      pendingCents: 151823,
    })
    expect(sumBalances([])).toEqual({ attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 })
  })
})

describe('salaryCents', () => {
  it('turns the monthly salary of a position into cents', () => {
    expect(salaryCents(1500)).toBe(150000)
    expect(salaryCents(1025.5)).toBe(102550)
    expect(salaryCents(1130.29)).toBe(113029)
  })

  it('is zero without a salary', () => {
    expect(salaryCents(null)).toBe(0)
    expect(salaryCents(0)).toBe(0)
  })
})
