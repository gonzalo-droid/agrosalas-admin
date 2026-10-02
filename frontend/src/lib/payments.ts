export const ITEM_TYPE_LABEL = { salary: 'Sueldo', bonus: 'Bono', piecework: 'Destajo', deduction: 'Descuento' } as const
export type ItemType = keyof typeof ITEM_TYPE_LABEL

export const PAYMENT_MEDIUM_LABEL = { yape: 'Yape', plin: 'Plin', transfer: 'Transferencia', cash: 'Efectivo' } as const
export type PaymentMedium = keyof typeof PAYMENT_MEDIUM_LABEL

// A deduction is stored positive: its type gives the sign.
export const signedItemCents = (type: ItemType, amountCents: number): number => (type === 'deduction' ? -amountCents : amountCents)

type Method = { id: string; type: 'yape' | 'plin' | 'bank_account'; number: string; bank: string | null; holderName: string; isPrimary: boolean }

export type PayOption = { key: string; label: string; medium: PaymentMedium; paymentMethodId?: string; needsDetail: boolean }

const MEDIUM_OF = { yape: 'yape', plin: 'plin', bank_account: 'transfer' } as const
const METHOD_NAME = { yape: 'Yape', plin: 'Plin', bank_account: null } as const

// The registered methods of the worker (the primary one first), cash, and a Yape, Plin or transfer that is not registered.
export function payOptions(methods: Method[]): PayOption[] {
  const ordered = [...methods.filter((m) => m.isPrimary), ...methods.filter((m) => !m.isPrimary)]
  return [
    ...ordered.map((m) => ({
      key: `method:${m.id}`,
      label: `${[METHOD_NAME[m.type] ?? m.bank, m.number].filter(Boolean).join(' ')} · ${m.holderName}`,
      medium: MEDIUM_OF[m.type],
      paymentMethodId: m.id,
      needsDetail: false,
    })),
    { key: 'cash', label: 'Efectivo', medium: 'cash', needsDetail: false },
    { key: 'other:yape', label: 'Otro Yape', medium: 'yape', needsDetail: true },
    { key: 'other:plin', label: 'Otro Plin', medium: 'plin', needsDetail: true },
    { key: 'other:transfer', label: 'Otra transferencia', medium: 'transfer', needsDetail: true },
  ]
}

export const defaultPayOption = (options: PayOption[]): string => options[0].key

type PaymentInput = {
  payrollId: string
  workerId: string
  date: string
  amountCents: number
  option: PayOption
  detail: string
  evidencePath: string | null
  note: string
}

// The body of POST /v1/payments. A registered method goes by its id: the server copies its number and holder.
export function paymentBody({ option, detail, note, ...rest }: PaymentInput) {
  return {
    ...rest,
    method: option.medium,
    ...(option.paymentMethodId ? { paymentMethodId: option.paymentMethodId } : {}),
    methodDetail: option.needsDetail ? detail.trim() || null : null,
    note: note.trim() || null,
  }
}
