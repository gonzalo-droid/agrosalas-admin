export type PaymentMedium = 'yape' | 'plin' | 'transfer' | 'cash'

// The medium of a payment made with a registered method of the worker.
export const MEDIUM_OF = { yape: 'yape', plin: 'plin', bank_account: 'transfer' } as const

type Method = { type: keyof typeof MEDIUM_OF; number: string; bank: string | null; cci: string | null; holderName: string }

// The text copied into the payment, so that its history does not change if the method is edited later.
export const describeMethod = (method: Method): string =>
  [
    method.type === 'bank_account' && method.bank ? `${method.bank} ${method.number}` : method.number,
    method.type === 'bank_account' && method.cci ? `CCI ${method.cci}` : null,
    `Titular: ${method.holderName}`,
  ]
    .filter(Boolean)
    .join(' · ')
