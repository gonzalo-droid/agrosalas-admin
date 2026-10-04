import { between, eq, inArray, sql, type AnyColumn } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware.js'
import { areas, attendanceRecords, campaigns, payments, payrollItems, payrolls, workers } from '../db/schema.js'
import { validate } from '../lib/validate.js'
import { groupByCampaign, groupByWorker, type ReportLine, type ReportPayroll } from '../payroll/report-groups.js'
import { daysInRange, monthsInRange, sumByPeriod, weekStart, weeksInRange, type DayTotals } from '../payroll/report-periods.js'
import type { AppEnv, Db, Dependencies } from '../types.js'

const isoDate = z.iso.date()
const rangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.to >= r.from, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['to'] })
  .refine((r) => r.to < r.from || daysInRange(r.from, r.to) <= 366, { message: 'El rango no puede pasar de un año', path: ['to'] })

const NO_AREA = 'Sin área'
const bigintSum = (column: AnyColumn) =>
  sql<number>`coalesce(sum(${column}), 0)::bigint`.mapWith(Number)

// Attendance of the range added up by day.
async function attendanceByDay(db: Db, from: string, to: string): Promise<DayTotals[]> {
  return db
    .select({
      date: attendanceRecords.date,
      regularMinutes: bigintSum(attendanceRecords.regularMinutes),
      overtimeMinutes: bigintSum(attendanceRecords.overtimeMinutes),
      cents: bigintSum(attendanceRecords.amountCents),
    })
    .from(attendanceRecords)
    .where(between(attendanceRecords.date, from, to))
    .groupBy(attendanceRecords.date)
}

// The items of a payroll belong to the day the payroll starts, whichever day they were recorded. Deductions subtract.
async function itemsByPayrollStart(db: Db, from: string, to: string): Promise<{ date: string; cents: number }[]> {
  return db
    .select({
      date: payrolls.startDate,
      cents: sql<number>`coalesce(sum(case when ${payrollItems.type} = 'deduction' then -${payrollItems.amountCents} else ${payrollItems.amountCents} end), 0)::bigint`.mapWith(
        Number,
      ),
    })
    .from(payrollItems)
    .innerJoin(payrolls, eq(payrolls.id, payrollItems.payrollId))
    .where(between(payrolls.startDate, from, to))
    .groupBy(payrolls.startDate)
}

// The payroll x worker lines of the payrolls that start in the range: attendance, signed items and payments, each
// added up in one grouped query over those payrolls. A worker is on a line if any of the three mentions them.
async function payrollLines(db: Db, from: string, to: string): Promise<{ payrolls: ReportPayroll[]; lines: ReportLine[] }> {
  const payrollRows = await db
    .select({
      id: payrolls.id,
      name: payrolls.name,
      type: payrolls.type,
      startDate: payrolls.startDate,
      endDate: payrolls.endDate,
      status: payrolls.status,
      campaignId: payrolls.campaignId,
      campaignName: campaigns.name,
    })
    .from(payrolls)
    .leftJoin(campaigns, eq(campaigns.id, payrolls.campaignId))
    .where(between(payrolls.startDate, from, to))
  if (payrollRows.length === 0) return { payrolls: [], lines: [] }
  const ids = payrollRows.map((payroll) => payroll.id)

  const [attendance, items, paid] = await Promise.all([
    db
      .select({
        payrollId: attendanceRecords.payrollId,
        workerId: attendanceRecords.workerId,
        workedDays: sql<number>`count(*) filter (where ${attendanceRecords.type} = 'worked')`.mapWith(Number),
        regularMinutes: bigintSum(attendanceRecords.regularMinutes),
        overtimeMinutes: bigintSum(attendanceRecords.overtimeMinutes),
        attendanceCents: bigintSum(attendanceRecords.amountCents),
      })
      .from(attendanceRecords)
      .where(inArray(attendanceRecords.payrollId, ids))
      .groupBy(attendanceRecords.payrollId, attendanceRecords.workerId),
    db
      .select({
        payrollId: payrollItems.payrollId,
        workerId: payrollItems.workerId,
        itemsCents: sql<number>`coalesce(sum(case when ${payrollItems.type} = 'deduction' then -${payrollItems.amountCents} else ${payrollItems.amountCents} end), 0)::bigint`.mapWith(
          Number,
        ),
      })
      .from(payrollItems)
      .where(inArray(payrollItems.payrollId, ids))
      .groupBy(payrollItems.payrollId, payrollItems.workerId),
    db
      .select({ payrollId: payments.payrollId, workerId: payments.workerId, paidCents: bigintSum(payments.amountCents) })
      .from(payments)
      .where(inArray(payments.payrollId, ids))
      .groupBy(payments.payrollId, payments.workerId),
  ])

  const lines = new Map<string, ReportLine>()
  const lineOf = (payrollId: string, workerId: string) => {
    const key = `${payrollId}:${workerId}`
    let line = lines.get(key)
    if (!line) {
      line = { payrollId, workerId, workedDays: 0, regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, paidCents: 0 }
      lines.set(key, line)
    }
    return line
  }
  for (const { payrollId, workerId, ...sums } of attendance) Object.assign(lineOf(payrollId, workerId), sums)
  for (const { payrollId, workerId, itemsCents } of items) lineOf(payrollId, workerId).itemsCents = itemsCents
  for (const { payrollId, workerId, paidCents } of paid) lineOf(payrollId, workerId).paidCents = paidCents
  return { payrolls: payrollRows, lines: [...lines.values()] }
}

async function workersOf(db: Db, lines: ReportLine[]) {
  const workerIds = [...new Set(lines.map((line) => line.workerId))]
  if (workerIds.length === 0) return []
  return db
    .select({ id: workers.id, firstName: workers.firstName, lastName: workers.lastName, dni: workers.dni })
    .from(workers)
    .where(inArray(workers.id, workerIds))
}

export const reportsRoutes = ({ db }: Dependencies) =>
  new Hono<AppEnv>()
    .get('/costs/weekly', requireRole('admin', 'accounting', 'management'), validate('query', rangeQuery), async (c) => {
      const { from, to } = c.req.valid('query')
      const weeks = weeksInRange(from, to)
      const rows = sumByPeriod(
        weeks.map((week) => week.start),
        weekStart,
        await attendanceByDay(db, from, to),
        await itemsByPayrollStart(db, from, to),
      )
      const items = rows.map(({ period, ...totals }, index) => ({ weekStart: period, weekEnd: weeks[index].end, ...totals }))
      return c.json({ items, totals: totalsOf(rows) })
    })
    .get('/costs/monthly', requireRole('admin', 'accounting', 'management'), validate('query', rangeQuery), async (c) => {
      const { from, to } = c.req.valid('query')
      const rows = sumByPeriod(
        monthsInRange(from, to),
        (date) => date.slice(0, 7),
        await attendanceByDay(db, from, to),
        await itemsByPayrollStart(db, from, to),
      )
      const items = rows.map(({ period, ...totals }) => ({ month: period, ...totals }))
      return c.json({ items, totals: totalsOf(rows) })
    })
    .get('/costs/by-area', requireRole('admin', 'accounting', 'management'), validate('query', rangeQuery), async (c) => {
      const { from, to } = c.req.valid('query')
      const rows = await db
        .select({
          areaId: attendanceRecords.areaId,
          areaName: areas.name,
          workedDays: sql<number>`count(*) filter (where ${attendanceRecords.type} = 'worked')`.mapWith(Number),
          regularMinutes: bigintSum(attendanceRecords.regularMinutes),
          overtimeMinutes: bigintSum(attendanceRecords.overtimeMinutes),
          attendanceCents: bigintSum(attendanceRecords.amountCents),
        })
        .from(attendanceRecords)
        .leftJoin(areas, eq(areas.id, attendanceRecords.areaId))
        .where(between(attendanceRecords.date, from, to))
        .groupBy(attendanceRecords.areaId, areas.name)
      const items = rows
        .map((row) => ({ ...row, areaName: row.areaName ?? NO_AREA }))
        // Named areas by name, "Sin área" always last.
        .sort((a, b) => Number(a.areaId === null) - Number(b.areaId === null) || a.areaName.localeCompare(b.areaName, 'es'))
      const itemsCents = (await itemsByPayrollStart(db, from, to)).reduce((sum, row) => sum + row.cents, 0)
      const attendanceCents = items.reduce((sum, row) => sum + row.attendanceCents, 0)
      return c.json({
        items,
        itemsCents,
        totals: {
          workedDays: items.reduce((sum, row) => sum + row.workedDays, 0),
          regularMinutes: items.reduce((sum, row) => sum + row.regularMinutes, 0),
          overtimeMinutes: items.reduce((sum, row) => sum + row.overtimeMinutes, 0),
          attendanceCents,
          itemsCents,
          totalCents: attendanceCents + itemsCents,
        },
      })
    })
    .get('/costs/by-campaign', requireRole('admin', 'accounting', 'management'), validate('query', rangeQuery), async (c) => {
      const { from, to } = c.req.valid('query')
      const { payrolls: inRange, lines } = await payrollLines(db, from, to)
      const items = groupByCampaign(inRange, lines, await workersOf(db, lines))
      const sum = (pick: (row: (typeof items)[number]) => number) => items.reduce((total, row) => total + pick(row), 0)
      const totalCents = sum((row) => row.totalCents)
      const paidCents = sum((row) => row.paidCents)
      return c.json({
        items,
        totals: {
          payrollCount: sum((row) => row.payrollCount),
          // Distinct workers over all the lines: a person in two campaigns counts once.
          people: new Set(lines.map((line) => line.workerId)).size,
          workedDays: sum((row) => row.workedDays),
          regularMinutes: sum((row) => row.regularMinutes),
          overtimeMinutes: sum((row) => row.overtimeMinutes),
          totalCents,
          paidCents,
          pendingCents: totalCents - paidCents,
        },
      })
    })
    .get('/costs/by-worker', requireRole('admin', 'accounting', 'management'), validate('query', rangeQuery), async (c) => {
      const { from, to } = c.req.valid('query')
      const { lines } = await payrollLines(db, from, to)
      const items = groupByWorker(lines, await workersOf(db, lines))
      const sum = (pick: (row: (typeof items)[number]) => number) => items.reduce((total, row) => total + pick(row), 0)
      const totalCents = sum((row) => row.totalCents)
      const paidCents = sum((row) => row.paidCents)
      return c.json({
        items,
        totals: {
          people: items.length,
          workedDays: sum((row) => row.workedDays),
          regularMinutes: sum((row) => row.regularMinutes),
          overtimeMinutes: sum((row) => row.overtimeMinutes),
          attendanceCents: sum((row) => row.attendanceCents),
          itemsCents: sum((row) => row.itemsCents),
          totalCents,
          paidCents,
          pendingCents: totalCents - paidCents,
        },
      })
    })

function totalsOf(rows: { regularMinutes: number; overtimeMinutes: number; attendanceCents: number; itemsCents: number; totalCents: number }[]) {
  const totals = { regularMinutes: 0, overtimeMinutes: 0, attendanceCents: 0, itemsCents: 0, totalCents: 0 }
  for (const row of rows) {
    totals.regularMinutes += row.regularMinutes
    totals.overtimeMinutes += row.overtimeMinutes
    totals.attendanceCents += row.attendanceCents
    totals.itemsCents += row.itemsCents
    totals.totalCents += row.totalCents
  }
  return totals
}
