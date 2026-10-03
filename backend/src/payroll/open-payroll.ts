import { and, eq } from 'drizzle-orm'
import { payrolls, payrollWorkers } from '../db/schema'
import { ApiError, notFound } from '../lib/errors'
import type { Tx } from '../types'

// Returns the payroll, or fails if it does not exist (404) or is closed (409), and locks its row until the
// transaction ends. Writes inside the payroll (attendance, items, payments) take 'share': they do not block each
// other, but they wait for a close in progress and make a close wait for them. Editing, closing and reopening the
// payroll take 'update'.
export async function findOpenPayroll(tx: Tx, id: string, lock: 'share' | 'update') {
  const [payroll] = await tx.select().from(payrolls).where(eq(payrolls.id, id)).for(lock)
  if (!payroll) throw notFound('La planilla')
  if (payroll.status === 'closed') throw new ApiError(409, 'payroll_closed', 'La planilla está cerrada')
  return payroll
}

export async function findPayrollMember(tx: Tx, payrollId: string, workerId: string): Promise<void> {
  const [member] = await tx
    .select({ workerId: payrollWorkers.workerId })
    .from(payrollWorkers)
    .where(and(eq(payrollWorkers.payrollId, payrollId), eq(payrollWorkers.workerId, workerId)))
  if (!member) throw new ApiError(400, 'not_in_payroll', 'El trabajador no está en esta planilla')
}
