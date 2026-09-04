ALTER TABLE "baselines" ALTER COLUMN "window_size" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "baselines" ADD COLUMN "sample_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "baselines_patient_vital_unique" ON "baselines" USING btree ("patient_id","vital_type");
