CREATE TYPE "public"."payment_medium" AS ENUM('yape', 'plin', 'transfer', 'cash');--> statement-breakpoint
CREATE TYPE "public"."payroll_item_type" AS ENUM('salary', 'bonus', 'piecework', 'deduction');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"method" "payment_medium" NOT NULL,
	"method_detail" text,
	"evidence_path" text,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payroll_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	"type" "payroll_item_type" NOT NULL,
	"amount_cents" integer NOT NULL,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payroll_items_amount_positive" CHECK ("payroll_items"."amount_cents" > 0)
);
--> statement-breakpoint
ALTER TABLE "payroll_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_member_fk" FOREIGN KEY ("payroll_id","worker_id") REFERENCES "public"."payroll_workers"("payroll_id","worker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_member_fk" FOREIGN KEY ("payroll_id","worker_id") REFERENCES "public"."payroll_workers"("payroll_id","worker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_evidence_unique" ON "payments" USING btree ("evidence_path") WHERE evidence_path is not null;--> statement-breakpoint
CREATE INDEX "payments_payroll_idx" ON "payments" USING btree ("payroll_id","worker_id");--> statement-breakpoint
CREATE INDEX "payments_worker_idx" ON "payments" USING btree ("worker_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX "payroll_items_salary_unique" ON "payroll_items" USING btree ("payroll_id","worker_id") WHERE type = 'salary';--> statement-breakpoint
CREATE INDEX "payroll_items_payroll_idx" ON "payroll_items" USING btree ("payroll_id","worker_id");--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_member_fk" FOREIGN KEY ("payroll_id","worker_id") REFERENCES "public"."payroll_workers"("payroll_id","worker_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_minutes_not_negative" CHECK ("attendance_records"."worked_minutes" >= 0 and "attendance_records"."regular_minutes" >= 0 and "attendance_records"."overtime_minutes" >= 0);--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_money_not_negative" CHECK ("attendance_records"."hourly_rate" >= 0 and "attendance_records"."overtime_rate" >= 0 and "attendance_records"."amount_cents" >= 0);--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_dates_order" CHECK ("payrolls"."end_date" >= "payrolls"."start_date");