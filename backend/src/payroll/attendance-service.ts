import type { SessionUser } from '../types'

type MoneyKey = 'hourlyRate' | 'overtimeRate' | 'amountCents'
type Redacted<T> = Omit<T, MoneyKey> & Record<MoneyKey, number | null>

// The coordinator sees hours but never money: the amounts are removed on the server, not hidden on the screen.
export function redactMoney<T extends Record<MoneyKey, number>>(user: SessionUser, record: T): Redacted<T> {
  if (user.role !== 'coordinator') return record
  return { ...record, hourlyRate: null, overtimeRate: null, amountCents: null }
}
