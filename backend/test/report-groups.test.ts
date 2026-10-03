import { describe, expect, it } from 'vitest'
import { campaignKeyOf, groupByCampaign, groupByWorker } from '../src/payroll/report-groups.js'
import type { ReportLine, ReportPayroll, ReportWorker } from '../src/payroll/report-groups.js'

const payroll = (overrides: Partial<ReportPayroll> & Pick<ReportPayroll, 'id'>): ReportPayroll => ({
  name: overrides.id,
  type: 'weekly',
  startDate: '2026-10-05',
  endDate: '2026-10-11',
  status: 'open',
  campaignId: null,
  campaignName: null,
  ...overrides,
})

const line = (overrides: Partial<ReportLine> & Pick<ReportLine, 'payrollId' | 'workerId'>): ReportLine => ({
  workedDays: 0,
  regularMinutes: 0,
  overtimeMinutes: 0,
  attendanceCents: 0,
  itemsCents: 0,
  paidCents: 0,
  ...overrides,
})

const chile1 = payroll({ id: 'p-chile-2', name: 'Chile semana 2', startDate: '2026-10-12', endDate: '2026-10-18', campaignId: 'c-chile', campaignName: 'Contenedor Chile' })
const chile2 = payroll({ id: 'p-chile-1', name: 'Chile semana 1', campaignId: 'c-chile', campaignName: 'Contenedor Chile' })
const chileEmpty = payroll({ id: 'p-chile-3', name: 'Chile semana 3', startDate: '2026-10-19', endDate: '2026-10-25', campaignId: 'c-chile', campaignName: 'Contenedor Chile' })
const monthly = payroll({ id: 'p-month', name: 'Octubre', type: 'monthly', startDate: '2026-10-01', endDate: '2026-10-31', status: 'closed' })
const loose = payroll({ id: 'p-loose', name: 'Semana suelta' })
const payrolls = [loose, monthly, chile1, chile2, chileEmpty]

const workers: ReportWorker[] = [
  { id: 'w-quispe', firstName: 'Rosa', lastName: 'Quispe', dni: '72000001' },
  { id: 'w-huaman', firstName: 'Beto', lastName: 'Huamán', dni: null },
  { id: 'w-zapata', firstName: 'Ana', lastName: 'Zapata', dni: '72000003' },
]

const lines: ReportLine[] = [
  // Quispe works in both payrolls of the campaign.
  line({ payrollId: 'p-chile-1', workerId: 'w-quispe', workedDays: 5, regularMinutes: 2400, overtimeMinutes: 60, attendanceCents: 30000, itemsCents: 2000, paidCents: 10000 }),
  line({ payrollId: 'p-chile-2', workerId: 'w-quispe', workedDays: 4, regularMinutes: 1900, overtimeMinutes: 0, attendanceCents: 24000, itemsCents: -1000, paidCents: 5000 }),
  line({ payrollId: 'p-chile-1', workerId: 'w-huaman', workedDays: 3, regularMinutes: 1400, overtimeMinutes: 30, attendanceCents: 15000, itemsCents: 0, paidCents: 18000 }), // paid more than the total
  line({ payrollId: 'p-month', workerId: 'w-zapata', workedDays: 22, regularMinutes: 10560, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 150000, paidCents: 100000 }),
  line({ payrollId: 'p-loose', workerId: 'w-huaman', workedDays: 2, regularMinutes: 960, overtimeMinutes: 0, attendanceCents: 9000, itemsCents: 500, paidCents: 0 }),
]

describe('campaignKeyOf', () => {
  it('uses the campaign when there is one', () => {
    expect(campaignKeyOf(chile1)).toEqual({ key: 'c-chile', name: 'Contenedor Chile' })
  })

  it('puts a monthly payroll without campaign with the contract staff', () => {
    expect(campaignKeyOf(monthly)).toEqual({ key: 'contract', name: 'Personal con contrato' })
  })

  it('puts a weekly payroll without campaign under no campaign', () => {
    expect(campaignKeyOf(loose)).toEqual({ key: 'none', name: 'Sin campaña' })
  })
})

describe('groupByWorker', () => {
  it('adds up the lines of every payroll of a worker and sorts by last name', () => {
    expect(groupByWorker(lines, workers)).toEqual([
      { workerId: 'w-huaman', firstName: 'Beto', lastName: 'Huamán', dni: null, workedDays: 5, regularMinutes: 2360, overtimeMinutes: 30, attendanceCents: 24000, itemsCents: 500, totalCents: 24500, paidCents: 18000, pendingCents: 6500 },
      { workerId: 'w-quispe', firstName: 'Rosa', lastName: 'Quispe', dni: '72000001', workedDays: 9, regularMinutes: 4300, overtimeMinutes: 60, attendanceCents: 54000, itemsCents: 1000, totalCents: 55000, paidCents: 15000, pendingCents: 40000 },
      { workerId: 'w-zapata', firstName: 'Ana', lastName: 'Zapata', dni: '72000003', workedDays: 22, regularMinutes: 10560, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 150000, totalCents: 150000, paidCents: 100000, pendingCents: 50000 },
    ])
  })

  it('leaves out workers without lines and shows a negative pending when paid exceeds the total', () => {
    const rows = groupByWorker(lines.filter((l) => l.payrollId === 'p-chile-1' && l.workerId === 'w-huaman'), workers)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ workerId: 'w-huaman', totalCents: 15000, paidCents: 18000, pendingCents: -3000 })
  })

  it('breaks ties on first name and then id', () => {
    const twins: ReportWorker[] = [
      { id: 'b', firstName: 'Luis', lastName: 'Mamani', dni: null },
      { id: 'a', firstName: 'Luis', lastName: 'Mamani', dni: null },
      { id: 'c', firstName: 'Ana', lastName: 'Mamani', dni: null },
    ]
    const twinLines = twins.map((w) => line({ payrollId: 'p', workerId: w.id }))
    expect(groupByWorker(twinLines, twins).map((row) => row.workerId)).toEqual(['c', 'a', 'b'])
  })
})

describe('groupByCampaign', () => {
  const groups = groupByCampaign(payrolls, lines, workers)

  it('orders campaigns by name, then contract staff, then no campaign', () => {
    expect(groups.map((g) => g.key)).toEqual(['c-chile', 'contract', 'none'])
    expect(groups.map((g) => g.name)).toEqual(['Contenedor Chile', 'Personal con contrato', 'Sin campaña'])
    expect(groups.map((g) => g.campaignId)).toEqual(['c-chile', null, null])
  })

  it('adds up the campaign: payroll count, people counted once, days, minutes and money', () => {
    expect(groups[0]).toMatchObject({
      payrollCount: 3,
      people: 2,
      workedDays: 12,
      regularMinutes: 5700,
      overtimeMinutes: 90,
      totalCents: 70000,
      paidCents: 33000,
      pendingCents: 37000,
    })
  })

  it('lists the payrolls with their money, by start date, and a payroll without lines with zeros', () => {
    expect(groups[0].payrolls).toEqual([
      { id: 'p-chile-1', name: 'Chile semana 1', startDate: '2026-10-05', endDate: '2026-10-11', status: 'open', totalCents: 47000, paidCents: 28000, pendingCents: 19000 },
      { id: 'p-chile-2', name: 'Chile semana 2', startDate: '2026-10-12', endDate: '2026-10-18', status: 'open', totalCents: 23000, paidCents: 5000, pendingCents: 18000 },
      { id: 'p-chile-3', name: 'Chile semana 3', startDate: '2026-10-19', endDate: '2026-10-25', status: 'open', totalCents: 0, paidCents: 0, pendingCents: 0 },
    ])
  })

  it('groups the workers of the campaign across its payrolls', () => {
    expect(groups[0].workers.map((w) => [w.workerId, w.workedDays, w.totalCents, w.paidCents, w.pendingCents])).toEqual([
      ['w-huaman', 3, 15000, 18000, -3000],
      ['w-quispe', 9, 55000, 15000, 40000],
    ])
  })

  it('keeps the contract staff and the loose payrolls apart', () => {
    expect(groups[1]).toMatchObject({ payrollCount: 1, people: 1, workedDays: 22, totalCents: 150000, paidCents: 100000, pendingCents: 50000 })
    expect(groups[1].payrolls).toEqual([
      { id: 'p-month', name: 'Octubre', startDate: '2026-10-01', endDate: '2026-10-31', status: 'closed', totalCents: 150000, paidCents: 100000, pendingCents: 50000 },
    ])
    expect(groups[2]).toMatchObject({ payrollCount: 1, people: 1, workedDays: 2, totalCents: 9500, paidCents: 0, pendingCents: 9500 })
  })

  it('shows an empty group when its payrolls have no lines', () => {
    const [group] = groupByCampaign([chileEmpty], [], workers)
    expect(group).toMatchObject({ key: 'c-chile', payrollCount: 1, people: 0, workedDays: 0, totalCents: 0, workers: [] })
  })
})
