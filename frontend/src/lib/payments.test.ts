import { describe, expect, it } from 'vitest'
import { ITEM_TYPE_LABEL, PAYMENT_MEDIUM_LABEL, defaultPayOption, payOptions, paymentBody, signedItemCents } from './payments'

const yape = { id: 'm1', type: 'yape' as const, number: '987654321', bank: null, holderName: 'Rosa Quispe', isPrimary: false }
const bank = { id: 'm2', type: 'bank_account' as const, number: '19412345678901', bank: 'BCP', holderName: 'Rosa Quispe', isPrimary: true }

describe('labels', () => {
  it('names every item type and medium in Spanish', () => {
    expect(ITEM_TYPE_LABEL).toEqual({ salary: 'Sueldo', bonus: 'Bono', piecework: 'Destajo', deduction: 'Descuento' })
    expect(PAYMENT_MEDIUM_LABEL).toEqual({ yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', cash: 'Efectivo' })
  })

  it('subtracts a deduction', () => {
    expect(signedItemCents('bonus', 2000)).toBe(2000)
    expect(signedItemCents('deduction', 1000)).toBe(-1000)
  })
})

describe('payOptions', () => {
  it('puts the primary method first, then the others, cash and the unregistered ones', () => {
    const options = payOptions([yape, bank])
    expect(options.map((o) => o.key)).toEqual(['method:m2', 'method:m1', 'cash', 'other:yape', 'other:plin', 'other:transfer'])
    expect(options[0]).toEqual({ key: 'method:m2', label: 'BCP 19412345678901 · Rosa Quispe', medium: 'transfer', paymentMethodId: 'm2', needsDetail: false })
    expect(options[1].label).toBe('Yape 987654321 · Rosa Quispe')
    expect(options[2]).toEqual({ key: 'cash', label: 'Efectivo', medium: 'cash', needsDetail: false })
    expect(options[3]).toEqual({ key: 'other:yape', label: 'Otro Yape', medium: 'yape', needsDetail: true })
    expect(options[5].label).toBe('Otra transferencia')
  })

  it('chooses the first option: the primary method, or cash when the worker has none', () => {
    expect(defaultPayOption(payOptions([yape, bank]))).toBe('method:m2')
    expect(defaultPayOption(payOptions([]))).toBe('cash')
  })
})

describe('paymentBody', () => {
  const base = { payrollId: 'p1', workerId: 'w1', date: '2026-10-05', amountCents: 6823, evidencePath: null, note: '  ' }

  it('sends a registered method by its id and no detail', () => {
    const option = payOptions([bank])[0]
    expect(paymentBody({ ...base, option, detail: 'ignored' })).toEqual({
      payrollId: 'p1', workerId: 'w1', date: '2026-10-05', amountCents: 6823, method: 'transfer', paymentMethodId: 'm2',
      methodDetail: null, evidencePath: null, note: null,
    })
  })

  it('sends the typed detail of an unregistered method, and null when it is blank', () => {
    const option = payOptions([]).find((o) => o.key === 'other:yape')!
    expect(paymentBody({ ...base, option, detail: ' 999888777 hermana ' }).methodDetail).toBe('999888777 hermana')
    expect(paymentBody({ ...base, option, detail: ' ' }).methodDetail).toBeNull()
  })

  it('sends cash without method id, the evidence path and a trimmed note', () => {
    const option = payOptions([]).find((o) => o.key === 'cash')!
    const body = paymentBody({ ...base, option, detail: '', evidencePath: 'payrolls/p1/w1/f.jpg', note: ' adelanto ' })
    expect(body).toEqual({ ...base, method: 'cash', methodDetail: null, evidencePath: 'payrolls/p1/w1/f.jpg', note: 'adelanto' })
    expect('paymentMethodId' in body).toBe(false)
  })
})
