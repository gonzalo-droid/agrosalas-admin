export type ItemType = 'salary' | 'bonus' | 'piecework' | 'deduction'

export type WorkerBalance = {
  workerId: string
  attendanceCents: number
  additionsCents: number // salary + bonus + piecework
  deductionsCents: number // stored positive
  totalCents: number // attendance + additions − deductions
  paidCents: number
  pendingCents: number // total − paid; negative = in favour of the company
}
export type BalanceTotals = Omit<WorkerBalance, 'workerId'>

// A deduction is stored as a positive amount: its type gives the sign.
export const signedCents = (type: ItemType, amountCents: number): number => (type === 'deduction' ? -amountCents : amountCents)

const sumBy = (rows: { workerId: string; cents: number }[]): Map<string, number> => {
  const sums = new Map<string, number>()
  for (const row of rows) sums.set(row.workerId, (sums.get(row.workerId) ?? 0) + row.cents)
  return sums
}

// One balance per worker of the list, in its order. Sums of workers outside the list are ignored.
export function buildBalances(
  workerIds: string[],
  attendance: { workerId: string; cents: number }[],
  items: { workerId: string; type: ItemType; cents: number }[],
  payments: { workerId: string; cents: number }[],
): WorkerBalance[] {
  const worked = sumBy(attendance)
  const added = sumBy(items.filter((item) => item.type !== 'deduction'))
  const deducted = sumBy(items.filter((item) => item.type === 'deduction'))
  const paid = sumBy(payments)
  return workerIds.map((workerId) => {
    const attendanceCents = worked.get(workerId) ?? 0
    const additionsCents = added.get(workerId) ?? 0
    const deductionsCents = deducted.get(workerId) ?? 0
    const totalCents = attendanceCents + additionsCents - deductionsCents
    const paidCents = paid.get(workerId) ?? 0
    return { workerId, attendanceCents, additionsCents, deductionsCents, totalCents, paidCents, pendingCents: totalCents - paidCents }
  })
}

const KEYS = ['attendanceCents', 'additionsCents', 'deductionsCents', 'totalCents', 'paidCents', 'pendingCents'] as const

export function sumBalances(balances: WorkerBalance[]): BalanceTotals {
  const totals: BalanceTotals = { attendanceCents: 0, additionsCents: 0, deductionsCents: 0, totalCents: 0, paidCents: 0, pendingCents: 0 }
  for (const balance of balances) for (const key of KEYS) totals[key] += balance[key]
  return totals
}

// The monthly salary of a position is kept in soles with two decimals.
export const salaryCents = (monthlySalary: number | null): number => (monthlySalary ? Math.round(monthlySalary * 100) : 0)
