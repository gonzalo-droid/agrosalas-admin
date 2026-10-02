import { hasOpenStretch, type AttendanceType } from './attendance'

type ClosingRecord = {
  type: AttendanceType
  needsReview: boolean
  clockIn1: string | null
  clockOut1: string | null
  clockIn2: string | null
  clockOut2: string | null
}

// What the close dialog warns about: who still has a balance, and the records that may be wrong.
export function closingCheck(balances: { workerId: string; pendingCents: number }[], records: ClosingRecord[]) {
  return {
    pending: balances.filter((b) => b.pendingCents !== 0).map(({ workerId, pendingCents }) => ({ workerId, pendingCents })),
    needsReview: records.filter((r) => r.needsReview).length,
    openStretches: records.filter((r) => hasOpenStretch(r)).length,
  }
}
