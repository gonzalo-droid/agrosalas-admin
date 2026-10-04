import { and, eq, inArray } from 'drizzle-orm'
import { payrollItems, positions, workers } from '../db/schema.js'
import { recordAudit } from '../lib/audit.js'
import type { Tx } from '../types.js'
import { salaryCents } from './balance.js'

// A monthly payroll pays the contract staff with a salary item: one per contract worker whose position is monthly
// and has a salary. Whoever already has one keeps it. Returns how many were created.
export async function createSalaryItems(
  tx: Tx,
  userId: string,
  payroll: { id: string; type: 'weekly' | 'monthly' },
  workerIds: string[],
): Promise<number> {
  if (payroll.type !== 'monthly' || workerIds.length === 0) return 0
  const staff = await tx
    .select({ workerId: workers.id, monthlySalary: positions.monthlySalary })
    .from(workers)
    .innerJoin(positions, eq(positions.id, workers.positionId))
    .where(and(inArray(workers.id, workerIds), eq(workers.employmentType, 'contract'), eq(positions.payType, 'monthly')))
  const values = staff
    .map((row) => ({ workerId: row.workerId, amountCents: salaryCents(row.monthlySalary) }))
    .filter((row) => row.amountCents > 0)
    .map((row) => ({ ...row, payrollId: payroll.id, type: 'salary' as const, recordedBy: userId }))
  if (values.length === 0) return 0
  const created = await tx.insert(payrollItems).values(values).onConflictDoNothing().returning()
  for (const item of created) await recordAudit(tx, userId, 'create', 'payroll_items', item.id, null, item)
  return created.length
}
