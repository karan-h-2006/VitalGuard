CREATE TABLE "reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "patient_id" uuid NOT NULL REFERENCES "users"("id"),
  "period_start" timestamp with time zone NOT NULL,
  "period_end" timestamp with time zone NOT NULL,
  "generated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "file_path" text NOT NULL,
  "avg_vitals" jsonb NOT NULL,
  "alert_counts" jsonb NOT NULL,
  "trend_warning_count" integer DEFAULT 0 NOT NULL
);
