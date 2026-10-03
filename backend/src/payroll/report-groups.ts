export type ReportPayroll = {
  id: string
  name: string
  type: 'weekly' | 'monthly'
  startDate: string
  endDate: string
  status: 'open' | 'closed'
  campaignId: string | null
  campaignName: string | null
}
export type ReportLine = {
  payrollId: string
  workerId: string
  workedDays: number
  regularMinutes: number
  overtimeMinutes: number
  attendanceCents: number
  itemsCents: number // signed: additions − deductions
  paidCents: number
}
export type ReportWorker = { id: string; firstName: string; lastName: string; dni: string | null }
export type Money = { totalCents: number; paidCents: number; pendingCents: number }
export type WorkerRow = {
  workerId: string
  firstName: string
  lastName: string
  dni: string | null
  workedDays: number
  regularMinutes: number
  overtimeMinutes: number
  attendanceCents: number
  itemsCents: number
} & Money
export type CampaignRow = {
  key: string // the campaign id, 'contract' or 'none'
  campaignId: string | null
  name: string // the campaign name, 'Personal con contrato' or 'Sin campaña'
  payrollCount: number
  people: number
  workedDays: number
  regularMinutes: number
  overtimeMinutes: number
  payrolls: ({ id: string; name: string; startDate: string; endDate: string; status: 'open' | 'closed' } & Money)[]
  workers: WorkerRow[]
} & Money

const CONTRACT = { key: 'contract', name: 'Personal con contrato' }
const NONE = { key: 'none', name: 'Sin campaña' }

// A monthly payroll without campaign is the contract staff; a weekly one is just not in a campaign.
export const campaignKeyOf = (payroll: ReportPayroll): { key: string; name: string } => {
  if (payroll.campaignId) return { key: payroll.campaignId, name: payroll.campaignName ?? '' }
  return payroll.type === 'monthly' ? CONTRACT : NONE
}

const money = (totalCents: number, paidCents: number): Money => ({ totalCents, paidCents, pendingCents: totalCents - paidCents })

const compareText = (a: string, b: string) => a.localeCompare(b, 'es')

export function groupByWorker(lines: ReportLine[], workers: ReportWorker[]): WorkerRow[] {
  const byId = new Map(workers.map((worker) => [worker.id, worker]))
  const sums = new Map<string, Omit<WorkerRow, 'totalCents' | 'paidCents' | 'pendingCents'> & { paidCents: number }>()
  for (const line of lines) {
    let sum = sums.get(line.workerId)
    if (!sum) {
      const worker = byId.get(line.workerId)
      sum = {
        workerId: line.workerId,
        firstName: worker?.firstName ?? '',
        lastName: worker?.lastName ?? '',
        dni: worker?.dni ?? null,
        workedDays: 0,
        regularMinutes: 0,
        overtimeMinutes: 0,
        attendanceCents: 0,
        itemsCents: 0,
        paidCents: 0,
      }
      sums.set(line.workerId, sum)
    }
    sum.workedDays += line.workedDays
    sum.regularMinutes += line.regularMinutes
    sum.overtimeMinutes += line.overtimeMinutes
    sum.attendanceCents += line.attendanceCents
    sum.itemsCents += line.itemsCents
    sum.paidCents += line.paidCents
  }
  return [...sums.values()]
    .map((sum) => ({ ...sum, ...money(sum.attendanceCents + sum.itemsCents, sum.paidCents) }))
    .sort((a, b) => compareText(a.lastName, b.lastName) || compareText(a.firstName, b.firstName) || compareText(a.workerId, b.workerId))
}

export function groupByCampaign(payrolls: ReportPayroll[], lines: ReportLine[], workers: ReportWorker[]): CampaignRow[] {
  const linesByPayroll = new Map<string, ReportLine[]>()
  for (const line of lines) linesByPayroll.set(line.payrollId, [...(linesByPayroll.get(line.payrollId) ?? []), line])

  const groups = new Map<string, { key: string; name: string; campaignId: string | null; payrolls: ReportPayroll[] }>()
  for (const payroll of payrolls) {
    const { key, name } = campaignKeyOf(payroll)
    const group = groups.get(key) ?? { key, name, campaignId: payroll.campaignId, payrolls: [] }
    group.payrolls.push(payroll)
    groups.set(key, group)
  }

  // Campaigns by name first, then the contract staff, then what is in no campaign.
  const rank = (key: string) => (key === CONTRACT.key ? 1 : key === NONE.key ? 2 : 0)

  return [...groups.values()]
    .sort((a, b) => rank(a.key) - rank(b.key) || compareText(a.name, b.name))
    .map((group) => {
      const groupLines = group.payrolls.flatMap((payroll) => linesByPayroll.get(payroll.id) ?? [])
      const sum = (pick: (line: ReportLine) => number) => groupLines.reduce((total, line) => total + pick(line), 0)
      return {
        key: group.key,
        campaignId: group.campaignId,
        name: group.name,
        payrollCount: group.payrolls.length,
        people: new Set(groupLines.map((line) => line.workerId)).size,
        workedDays: sum((line) => line.workedDays),
        regularMinutes: sum((line) => line.regularMinutes),
        overtimeMinutes: sum((line) => line.overtimeMinutes),
        ...money(sum((line) => line.attendanceCents + line.itemsCents), sum((line) => line.paidCents)),
        payrolls: [...group.payrolls]
          .sort((a, b) => compareText(a.startDate, b.startDate) || compareText(a.id, b.id))
          .map((payroll) => {
            const own = linesByPayroll.get(payroll.id) ?? []
            const total = own.reduce((acc, line) => acc + line.attendanceCents + line.itemsCents, 0)
            const paid = own.reduce((acc, line) => acc + line.paidCents, 0)
            return { id: payroll.id, name: payroll.name, startDate: payroll.startDate, endDate: payroll.endDate, status: payroll.status, ...money(total, paid) }
          }),
        workers: groupByWorker(groupLines, workers),
      }
    })
}
