import { formatCents } from './format'

// What a person types as an amount: "68.23" or "68,23", up to two decimals and up to 999 999.99 (the API's cap).
const AMOUNT = /^(\d{1,6})(?:[.,](\d{1,2}))?$/

export function parseSolesToCents(text: string): number | null {
  const match = AMOUNT.exec(text.trim())
  if (!match) return null
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'))
}

// 6823 → "68.23", to fill an input.
export const centsToInput = (cents: number): string => `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`

// A payment proposes what is pending; a balance in favour of the company proposes nothing.
export const proposedPaymentCents = (pendingCents: number): number => Math.max(0, pendingCents)

// "S/ 28.23", or "S/ 10.00 a favor de la empresa" when more than the total was paid.
export const pendingText = (pendingCents: number): string =>
  pendingCents < 0 ? `${formatCents(-pendingCents)} a favor de la empresa` : formatCents(pendingCents)

// "+S/ 20.00", "−S/ 10.00" (a real minus sign), or a dash when there is nothing: the items of a balance.
export const signedCentsText = (cents: number): string => (cents === 0 ? '–' : cents > 0 ? `+${formatCents(cents)}` : `−${formatCents(-cents)}`)
