import { describe, expect, it } from 'vitest'
import { describePaymentMethod, optionName, canCreateWorker, workerView } from './worker-view'

describe('workerView', () => {
  it('admin and accounting edit everything', () => {
    for (const role of ['admin', 'accounting'] as const) {
      expect(workerView(role)).toEqual({ canEditRecord: true, paymentMethods: 'edit', groups: 'edit' })
    }
  })

  it('management sees the payment methods and groups without editing them', () => {
    expect(workerView('management')).toEqual({ canEditRecord: false, paymentMethods: 'view', groups: 'view' })
  })

  it('the coordinator sees the groups and receives no payment methods', () => {
    expect(workerView('coordinator')).toEqual({ canEditRecord: false, paymentMethods: 'hidden', groups: 'view' })
  })
})

describe('canCreateWorker', () => {
  it('only admin and accounting', () => {
    expect(canCreateWorker('admin')).toBe(true)
    expect(canCreateWorker('accounting')).toBe(true)
    expect(canCreateWorker('management')).toBe(false)
    expect(canCreateWorker('coordinator')).toBe(false)
  })
})

describe('optionName', () => {
  const list = [{ id: 'a1', name: 'Envasado' }]
  it('shows the name of the chosen option', () => {
    expect(optionName(list, 'a1')).toBe('Envasado')
  })

  it('without a value it says "Sin asignar"; if the list has not loaded yet, "…"', () => {
    expect(optionName(list, '')).toBe('Sin asignar')
    expect(optionName(undefined, 'a1')).toBe('…')
    expect(optionName(list, 'other')).toBe('…')
  })
})

describe('describePaymentMethod', () => {
  it('names the type, the bank and the number', () => {
    expect(describePaymentMethod({ type: 'yape', bank: null, number: '987654321' })).toBe('Yape 987654321')
    expect(describePaymentMethod({ type: 'bank_account', bank: 'BCP', number: '191-1234' })).toBe('Cuenta bancaria BCP 191-1234')
  })
})
