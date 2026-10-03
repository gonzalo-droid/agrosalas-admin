import { between, eq, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import { requireRole } from '../auth/middleware'
import { areas, attendanceRecords, payrollItems, payrolls } from '../db/schema'
import { validate } from '../lib/validate'
import { daysInRange, monthsInRange, sumByPeriod, weekStart, weeksInRange, type DayTotals } from '../payroll/report-periods'
import type { AppEnv, Db, Dependencies } from '../types'

const isoDate = z.iso.date()
const rangeQuery = z
  .object({ from: isoDate, to: isoDate })
  .refine((r) => r.to >= r.from, { message: 'La fecha de fin no puede ser anterior a la de inicio', path: ['to'] })
  .refine((r) => r.to < r.from || daysInRange(r.from, r.to) <= 366, { message: 'El rango no puede pasar de un año', path: ['to'] })

const NO_AREA = 'Sin área'
const bigintSum = (column: typeof attendanceRecords.regularMinutes | typeof attendanceRecords.overtimeMinutes | typeof attendanceRecords.amountCents) =>
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
