CREATE UNIQUE INDEX "thresholds_patient_vital_unique" ON "thresholds" USING btree ("patient_id","vital_type");
