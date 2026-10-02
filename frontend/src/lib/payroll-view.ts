import { isoWeek, monthOf, weekOf } from './lima-time'

export const PAYROLL_TYPE_LABEL = { weekly: 'Semanal', monthly: 'Mensual' } as const
export type PayrollType = keyof typeof PAYROLL_TYPE_LABEL

export const PAYROLL_STATUS_LABEL = {
  upcoming: 'Por iniciar',
  in_progress: 'En curso',
  to_pay: 'Por pagar',
  closed: 'Cerrada',
} as const
export type PayrollDisplayStatus = keyof typeof PAYROLL_STATUS_LABEL

// What the user sees: an open payroll is upcoming, in progress or to pay, depending on today's date in Lima.
export function payrollDisplayStatus(
  payroll: { status: 'open' | 'closed'; startDate: string; endDate: string },
  today: string,
): PayrollDisplayStatus {
  if (payroll.status === 'closed') return 'closed'
  if (today > payroll.endDate) return 'to_pay'
  if (today < payroll.startDate) return 'upcoming'
  return 'in_progress'
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

// Name and dates proposed in the new payroll form: this week (Monday to Sunday) or this month.
export function suggestedPayroll(type: PayrollType, today: string, campaignName?: string): { name: string; startDate: string; endDate: string } {
  const range = type === 'weekly' ? weekOf(today) : monthOf(today)
  const period = type === 'weekly' ? `Semana ${isoWeek(today)}` : `${MONTHS[Number(today.slice(5, 7)) - 1]} ${today.slice(0, 4)}`
  return { name: campaignName ? `${period} · ${campaignName}` : period, startDate: range.start, endDate: range.end }
}

// Admin, accounting and management see the money; the coordinator never does (the API sends null). Hiding by role is a
// convenience, and a role that is not known yet sees nothing.
export const seesMoney = (role: 'admin' | 'management' | 'accounting' | 'coordinator' | undefined): boolean =>
  role === 'admin' || role === 'accounting' || role === 'management'
