import { describe, expect, it } from 'vitest'
import { centsToInput, parseSolesToCents, pendingText, proposedPaymentCents, signedCentsText } from './money'

describe('parseSolesToCents', () => {
  it('reads soles with a point or a comma and up to two decimals', () => {
    expect(parseSolesToCents('68.23')).toBe(6823)
    expect(parseSolesToCents('68,23')).toBe(6823)
    expect(parseSolesToCents('68.5')).toBe(6850)
    expect(parseSolesToCents('68')).toBe(6800)
    expect(parseSolesToCents(' 1200.05 ')).toBe(120005)
    expect(parseSolesToCents('999999.99')).toBe(99999999)
  })

  it('rejects anything else', () => {
    for (const text of ['', ' ', 'abc', '-5', '1.234', '1.2.3', '1000000', '68.', '.50', '1,000.50', 'S/ 10']) {
      expect(parseSolesToCents(text)).toBeNull()
    }
  })
})

describe('centsToInput', () => {
  it('writes cents as soles for an input', () => {
    expect(centsToInput(6823)).toBe('68.23')
    expect(centsToInput(6800)).toBe('68.00')
    expect(centsToInput(5)).toBe('0.05')
  })
})

describe('proposedPaymentCents', () => {
  it('proposes the pending amount, never a negative one', () => {
    expect(proposedPaymentCents(2823)).toBe(2823)
    expect(proposedPaymentCents(0)).toBe(0)
    expect(proposedPaymentCents(-1000)).toBe(0)
  })
})

describe('pendingText', () => {
  it('says when the balance is in favour of the company', () => {
    expect(pendingText(2823)).toBe('S/ 28.23')
    expect(pendingText(0)).toBe('S/ 0.00')
    expect(pendingText(-1000)).toBe('S/ 10.00 a favor')
  })
})

describe('signedCentsText', () => {
  it('writes the sign of an amount, with a real minus', () => {
    expect(signedCentsText(2000)).toBe('+S/ 20.00')
    expect(signedCentsText(-1000)).toBe('−S/ 10.00')
  })

  it('writes a dash when there is nothing', () => {
    expect(signedCentsText(0)).toBe('–')
  })
})
