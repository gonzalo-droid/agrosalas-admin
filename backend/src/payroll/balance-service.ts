import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { attendanceRecords, payrollItems, payrollWorkers, payments, workers } from '../db/schema.js'
import type { Db, Tx } from '../types.js'
import { buildBalances, type WorkerBalance } from './balance.js'

// One balance per worker of the payroll (or only of `workerIds`), in surname, name and id order.
export async function payrollBalances(db: Db | Tx, payrollId: string, workerIds?: string[]): Promise<WorkerBalance[]> {
  const members = await db
    .select({ id: workers.id })
    .from(payrollWorkers)
    .innerJoin(workers, eq(workers.id, payrollWorkers.workerId))
    .where(and(eq(payrollWorkers.payrollId, payrollId), workerIds ? inArray(payrollWorkers.workerId, workerIds) : undefined))
    .orderBy(asc(workers.lastName), asc(workers.firstName), asc(workers.id))
  const attendance = await db
    .select({
      workerId: attendanceRecords.workerId,
      cents: sql<number>`coalesce(sum(${attendanceRecords.amountCents}), 0)::bigint`.mapWith(Number),
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.payrollId, payrollId), workerIds ? inArray(attendanceRecords.workerId, workerIds) : undefined))
    .groupBy(attendanceRecords.workerId)
  const items = await db
    .select({
      workerId: payrollItems.workerId,
      type: payrollItems.type,
      cents: sql<number>`coalesce(sum(${payrollItems.amountCents}), 0)::bigint`.mapWith(Number),
    })
    .from(payrollItems)
    .where(and(eq(payrollItems.payrollId, payrollId), workerIds ? inArray(payrollItems.workerId, workerIds) : undefined))
    .groupBy(payrollItems.workerId, payrollItems.type)
  const paid = await db
    .select({
      workerId: payments.workerId,
      cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::bigint`.mapWith(Number),
    })
    .from(payments)
    .where(and(eq(payments.payrollId, payrollId), workerIds ? inArray(payments.workerId, workerIds) : undefined))
    .groupBy(payments.workerId)
  return buildBalances(
    members.map((member) => member.id),
    attendance,
    items,
    paid,
  )
}
