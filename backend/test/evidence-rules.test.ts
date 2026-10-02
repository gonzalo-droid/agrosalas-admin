import { describe, expect, it } from 'vitest'
import { EVIDENCE_MAX_BYTES, evidencePath, isEvidencePathOf } from '../src/payroll/evidence'
import { describeMethod, MEDIUM_OF } from '../src/payroll/payment-method'

const PAYROLL = '11111111-1111-4111-8111-111111111111'
const WORKER = '22222222-2222-4222-8222-222222222222'
const FILE = '33333333-3333-4333-8333-333333333333'

describe('evidence path', () => {
  it('is built from the payroll, the worker, the file id and the extension of the type', () => {
    expect(evidencePath(PAYROLL, WORKER, FILE, 'image/jpeg')).toBe(`payrolls/${PAYROLL}/${WORKER}/${FILE}.jpg`)
    expect(evidencePath(PAYROLL, WORKER, FILE, 'application/pdf')).toBe(`payrolls/${PAYROLL}/${WORKER}/${FILE}.pdf`)
  })

  it('is accepted only for its own payroll and worker', () => {
    const path = evidencePath(PAYROLL, WORKER, FILE, 'image/webp')
    expect(isEvidencePathOf(path, PAYROLL, WORKER)).toBe(true)
    expect(isEvidencePathOf(path, WORKER, PAYROLL)).toBe(false)
    expect(isEvidencePathOf(path, PAYROLL, FILE)).toBe(false)
  })

  it('rejects anything that is not a file id with an allowed extension', () => {
    const prefix = `payrolls/${PAYROLL}/${WORKER}/`
    expect(isEvidencePathOf(`${prefix}../other.jpg`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`${prefix}${FILE}.exe`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`${prefix}${FILE}.jpg/extra`, PAYROLL, WORKER)).toBe(false)
    expect(isEvidencePathOf(`x/${prefix}${FILE}.jpg`, PAYROLL, WORKER)).toBe(false)
  })

  it('allows files up to 5 MB', () => {
    expect(EVIDENCE_MAX_BYTES).toBe(5 * 1024 * 1024)
  })
})

describe('payment method', () => {
  it('maps the method of a worker to the medium of a payment', () => {
    expect(MEDIUM_OF).toEqual({ yape: 'yape', plin: 'plin', bank_account: 'transfer' })
  })

  it('describes a Yape or Plin number with its holder', () => {
    expect(describeMethod({ type: 'yape', number: '987654321', bank: null, cci: null, holderName: 'Rosa Quispe' })).toBe('987654321 · Titular: Rosa Quispe')
  })

  it('describes a bank account with its bank and CCI when it has them', () => {
    expect(
      describeMethod({ type: 'bank_account', number: '19412345678901', bank: 'BCP', cci: '00219400123456789012', holderName: 'Rosa Quispe' }),
    ).toBe('BCP 19412345678901 · CCI 00219400123456789012 · Titular: Rosa Quispe')
    expect(describeMethod({ type: 'bank_account', number: '19412345678901', bank: null, cci: null, holderName: 'Rosa Quispe' })).toBe(
      '19412345678901 · Titular: Rosa Quispe',
    )
  })
})
