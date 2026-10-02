CREATE TYPE "public"."attendance_type" AS ENUM('worked', 'absence', 'leave', 'medical_leave');--> statement-breakpoint
CREATE TYPE "public"."payroll_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."payroll_type" AS ENUM('weekly', 'monthly');--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"worker_id" uuid NOT NULL,
	"date" date NOT NULL,
	"payroll_id" uuid NOT NULL,
	"type" "attendance_type" DEFAULT 'worked' NOT NULL,
	"clock_in_1" timestamp with time zone,
	"clock_out_1" timestamp with time zone,
	"clock_in_2" timestamp with time zone,
	"clock_out_2" timestamp with time zone,
	"worked_minutes" integer DEFAULT 0 NOT NULL,
	"regular_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_minutes" integer DEFAULT 0 NOT NULL,
	"overtime_edited" boolean DEFAULT false NOT NULL,
	"hourly_rate" numeric(10, 4) DEFAULT 0 NOT NULL,
	"overtime_rate" numeric(10, 4) DEFAULT 0 NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"area_id" uuid,
	"employment_type" "employment_type" NOT NULL,
	"note" text,
	"recorded_by" uuid NOT NULL,
	"source" text DEFAULT 'panel' NOT NULL,
	"needs_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attendance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payroll_workers" (
	"payroll_id" uuid NOT NULL,
	"worker_id" uuid NOT NULL,
	CONSTRAINT "payroll_workers_payroll_id_worker_id_pk" PRIMARY KEY("payroll_id","worker_id")
);
--> statement-breakpoint
ALTER TABLE "payroll_workers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"type" "payroll_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"campaign_id" uuid,
	"status" "payroll_status" DEFAULT 'open' NOT NULL,
	"created_by" uuid NOT NULL,
	"closed_by" uuid,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payrolls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."areas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_workers" ADD CONSTRAINT "payroll_workers_payroll_id_payrolls_id_fk" FOREIGN KEY ("payroll_id") REFERENCES "public"."payrolls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_workers" ADD CONSTRAINT "payroll_workers_worker_id_workers_id_fk" FOREIGN KEY ("worker_id") REFERENCES "public"."workers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_worker_date_unique" ON "attendance_records" USING btree ("worker_id","date");--> statement-breakpoint
CREATE INDEX "attendance_records_payroll_idx" ON "attendance_records" USING btree ("payroll_id","date");--> statement-breakpoint
CREATE INDEX "payrolls_dates_idx" ON "payrolls" USING btree ("start_date","end_date");