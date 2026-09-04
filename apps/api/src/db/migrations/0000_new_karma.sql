CREATE TYPE "public"."alert_status" AS ENUM('open', 'acknowledged', 'escalated', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."device_registration_status" AS ENUM('registered', 'de-registered');--> statement-breakpoint
CREATE TYPE "public"."quality_flag" AS ENUM('clean', 'noisy', 'implausible');--> statement-breakpoint
CREATE TYPE "public"."severity_tier" AS ENUM('Normal', 'Watch', 'Warning', 'Critical');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('patient', 'caregiver', 'doctor', 'administrator');--> statement-breakpoint
CREATE TYPE "public"."vital_type" AS ENUM('heart_rate', 'spo2', 'temperature', 'motion');--> statement-breakpoint
CREATE TABLE "alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"severity_tier" "severity_tier" NOT NULL,
	"triggering_vitals" text[],
	"status" "alert_status" DEFAULT 'open' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_caregivers" (
	"patient_id" uuid NOT NULL,
	"caregiver_id" uuid NOT NULL,
	CONSTRAINT "association_caregivers_patient_id_caregiver_id_pk" PRIMARY KEY("patient_id","caregiver_id")
);
--> statement-breakpoint
CREATE TABLE "associations" (
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	CONSTRAINT "associations_patient_id_doctor_id_pk" PRIMARY KEY("patient_id","doctor_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alert_id" uuid,
	"transition" text NOT NULL,
	"acting_user" uuid,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"vital_type" "vital_type" NOT NULL,
	"mean" numeric(12, 4) NOT NULL,
	"stddev" numeric(12, 4) NOT NULL,
	"window_size" varchar(64),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid,
	"registration_status" "device_registration_status" DEFAULT 'registered' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "thresholds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"vital_type" "vital_type" NOT NULL,
	"minimum" numeric(12, 4),
	"maximum" numeric(12, 4),
	"clinician_override" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"email" varchar(320) NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vital_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"device_id" uuid NOT NULL,
	"patient_id" uuid,
	"vital_type" "vital_type" NOT NULL,
	"value" numeric(12, 4) NOT NULL,
	"timestamp" timestamp with time zone NOT NULL,
	"severity_tier" "severity_tier",
	"quality_flag" "quality_flag" DEFAULT 'clean' NOT NULL,
	"gap" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_caregivers" ADD CONSTRAINT "association_caregivers_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_caregivers" ADD CONSTRAINT "association_caregivers_caregiver_id_users_id_fk" FOREIGN KEY ("caregiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associations" ADD CONSTRAINT "associations_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "associations" ADD CONSTRAINT "associations_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_alert_id_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alerts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_acting_user_users_id_fk" FOREIGN KEY ("acting_user") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "thresholds" ADD CONSTRAINT "thresholds_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vital_readings" ADD CONSTRAINT "vital_readings_patient_id_users_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vital_readings_device_timestamp_type_unique" ON "vital_readings" USING btree ("device_id","timestamp","vital_type");--> statement-breakpoint
CREATE INDEX "vital_readings_patient_timestamp_index" ON "vital_readings" USING btree ("patient_id","timestamp");