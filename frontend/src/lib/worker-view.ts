// What each role sees and can touch in a worker's record. The API is what enforces the permissions;
// this only avoids showing buttons that would fail or empty sections.
export type Role = 'admin' | 'management' | 'accounting' | 'coordinator'
export type Access = 'edit' | 'view' | 'hidden'

const EDITORS = ['admin', 'accounting']

export const canCreateWorker = (role: Role) => EDITORS.includes(role)

export function workerView(role: Role): { canEditRecord: boolean; paymentMethods: Access; groups: Exclude<Access, 'hidden'> } {
  if (EDITORS.includes(role)) return { canEditRecord: true, paymentMethods: 'edit', groups: 'edit' }
  // The API does not send payment methods (bank data) to the coordinator.
  return { canEditRecord: false, paymentMethods: role === 'management' ? 'view' : 'hidden', groups: 'view' }
}

// Text of a select in read-only mode: the name of the chosen option.
export function optionName(list: { id: string; name: string }[] | undefined, id: string) {
  if (!id) return 'Sin asignar'
  return list?.find((x) => x.id === id)?.name ?? '…'
}

export const PAYMENT_METHOD_LABEL = { yape: 'Yape', plin: 'Plin', bank_account: 'Cuenta bancaria' } as const
export type PaymentMethodType = keyof typeof PAYMENT_METHOD_LABEL

// "Cuenta bancaria BCP 191-1234": to confirm before removing it and to name the buttons of each row.
export const describePaymentMethod = (m: { type: PaymentMethodType; bank: string | null; number: string }) =>
  [PAYMENT_METHOD_LABEL[m.type], m.bank, m.number].filter(Boolean).join(' ')
