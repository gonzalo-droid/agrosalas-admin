import { eq } from 'drizzle-orm'
import { payrolls } from '../db/schema'
import { ApiError, notFound } from '../lib/errors'
import type { Db, Tx } from '../types'

// Returns the payroll, or fails if it does not exist (404) or is closed (409).
export async function findOpenPayroll(db: Db | Tx, id: string) {
  const [payroll] = await db.select().from(payrolls).where(eq(payrolls.id, id))
  if (!payroll) throw notFound('La planilla')
  if (payroll.status === 'closed') throw new ApiError(409, 'payroll_closed', 'La planilla está cerrada')
  return payroll
}
