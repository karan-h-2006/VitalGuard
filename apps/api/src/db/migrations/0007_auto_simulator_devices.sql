ALTER TABLE devices ADD COLUMN is_simulated boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE devices ADD COLUMN sim_scenario text DEFAULT 'normal';--> statement-breakpoint
CREATE UNIQUE INDEX devices_one_simulated_per_patient ON devices (patient_id) WHERE is_simulated = true AND registration_status = 'registered';--> statement-breakpoint
UPDATE devices SET is_simulated = true, sim_scenario = 'normal' WHERE id = '00000000-0000-4000-8000-000000000002';--> statement-breakpoint
INSERT INTO devices (id, patient_id, registration_status, is_simulated, sim_scenario, created_at)
SELECT gen_random_uuid(), users.id, 'registered', true, 'normal', now()
FROM users
WHERE users.role = 'patient'
  AND NOT EXISTS (
    SELECT 1 FROM devices WHERE devices.patient_id = users.id AND devices.registration_status = 'registered'
  );
