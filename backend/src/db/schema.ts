import { sql } from 'drizzle-orm'
import {
  boolean, date, index, integer, jsonb, numeric, pgEnum, pgTable, primaryKey, text, time, timestamp, uniqueIndex, uuid,
} from 'drizzle-orm/pg-core'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}

export const roleEnum = pgEnum('user_role', ['admin', 'management', 'accounting', 'coordinator'])
export const employmentTypeEnum = pgEnum('employment_type', ['temporary', 'contract'])
export const workerStatusEnum = pgEnum('worker_status', ['active', 'terminated'])
export const payTypeEnum = pgEnum('pay_type', ['hourly', 'monthly'])
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['yape', 'plin', 'bank_account'])
export const auditActionEnum = pgEnum('audit_action', ['create', 'update', 'delete'])

// id = the user's id in Supabase Auth
export const users = pgTable('users', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: roleEnum('role').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const areas = pgTable('areas', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const userAreas = pgTable(
  'user_areas',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    areaId: uuid('area_id').notNull().references(() => areas.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.areaId] })],
).enableRLS()

export const shifts = pgTable('shifts', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const campaigns = pgTable('campaigns', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const positions = pgTable('positions', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  payType: payTypeEnum('pay_type').notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 4, mode: 'number' }),
  overtimeRate: numeric('overtime_rate', { precision: 10, scale: 4, mode: 'number' }),
  monthlySalary: numeric('monthly_salary', { precision: 10, scale: 2, mode: 'number' }),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull().unique(),
  temporary: boolean('temporary').notNull().default(false),
  startDate: date('start_date'),
  endDate: date('end_date'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}).enableRLS()

export const workers = pgTable(
  'workers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dni: text('dni'),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    phone: text('phone'),
    email: text('email'),
    address: text('address'),
    emergencyContactName: text('emergency_contact_name'),
    emergencyContactPhone: text('emergency_contact_phone'),
    areaId: uuid('area_id').references(() => areas.id),
    positionId: uuid('position_id').references(() => positions.id),
    shiftId: uuid('shift_id').references(() => shifts.id),
    employmentType: employmentTypeEnum('employment_type').notNull(),
    hireDate: date('hire_date'),
    status: workerStatusEnum('status').notNull().default('active'),
    notes: text('notes'),
    ...timestamps,
  },
  (t) => [uniqueIndex('workers_dni_unique').on(t.dni), index('workers_area_idx').on(t.areaId)],
).enableRLS()

export const groupWorkers = pgTable(
  'group_workers',
  {
    groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.groupId, t.workerId] })],
).enableRLS()

export const workerPaymentMethods = pgTable(
  'worker_payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id').notNull().references(() => workers.id, { onDelete: 'cascade' }),
    type: paymentMethodTypeEnum('type').notNull(),
    number: text('number').notNull(),
    bank: text('bank'),
    cci: text('cci'),
    holderName: text('holder_name').notNull(),
    // "primary" is a reserved word in SQL, hence the is_ prefix.
    isPrimary: boolean('is_primary').notNull().default(false),
    ...timestamps,
  },
  (t) => [uniqueIndex('worker_payment_methods_primary_unique').on(t.workerId).where(sql`is_primary`)],
).enableRLS()

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id),
    action: auditActionEnum('action').notNull(),
    entity: text('entity').notNull(),
    entityId: uuid('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_entity_idx').on(t.entity, t.entityId)],
).enableRLS()

export const payrollTypeEnum = pgEnum('payroll_type', ['weekly', 'monthly'])
export const payrollStatusEnum = pgEnum('payroll_status', ['open', 'closed'])
export const attendanceTypeEnum = pgEnum('attendance_type', ['worked', 'absence', 'leave', 'medical_leave'])

export const payrolls = pgTable(
  'payrolls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    type: payrollTypeEnum('type').notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    campaignId: uuid('campaign_id').references(() => campaigns.id),
    status: payrollStatusEnum('status').notNull().default('open'),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    closedBy: uuid('closed_by').references(() => users.id),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('payrolls_dates_idx').on(t.startDate, t.endDate)],
).enableRLS()

export const payrollWorkers = pgTable(
  'payroll_workers',
  {
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id, { onDelete: 'cascade' }),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
  },
  (t) => [primaryKey({ columns: [t.payrollId, t.workerId] })],
).enableRLS()

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workerId: uuid('worker_id').notNull().references(() => workers.id),
    // The date of the first clock-in, in Lima time.
    date: date('date').notNull(),
    payrollId: uuid('payroll_id').notNull().references(() => payrolls.id),
    type: attendanceTypeEnum('type').notNull().default('worked'),
    clockIn1: timestamp('clock_in_1', { withTimezone: true }),
    clockOut1: timestamp('clock_out_1', { withTimezone: true }),
    clockIn2: timestamp('clock_in_2', { withTimezone: true }),
    clockOut2: timestamp('clock_out_2', { withTimezone: true }),
    workedMinutes: integer('worked_minutes').notNull().default(0),
    regularMinutes: integer('regular_minutes').notNull().default(0),
    overtimeMinutes: integer('overtime_minutes').notNull().default(0),
    overtimeEdited: boolean('overtime_edited').notNull().default(false),
    // Copied from the worker's position when the record is created; editable per record.
    hourlyRate: numeric('hourly_rate', { precision: 10, scale: 4, mode: 'number' }).notNull().default(0),
    overtimeRate: numeric('overtime_rate', { precision: 10, scale: 4, mode: 'number' }).notNull().default(0),
    amountCents: integer('amount_cents').notNull().default(0),
    // Copies of the worker's values on that day.
    areaId: uuid('area_id').references(() => areas.id),
    employmentType: employmentTypeEnum('employment_type').notNull(),
    note: text('note'),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    source: text('source').notNull().default('panel'),
    needsReview: boolean('needs_review').notNull().default(false),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('attendance_records_worker_date_unique').on(t.workerId, t.date),
    index('attendance_records_payroll_idx').on(t.payrollId, t.date),
  ],
).enableRLS()
