-- Doctor availability feature (additive only, no data loss)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doctor_availability') THEN
    CREATE TYPE doctor_availability AS ENUM ('available', 'unavailable');
  END IF;
END $$;

ALTER TABLE doctor_profiles
  ADD COLUMN IF NOT EXISTS availability_status doctor_availability NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS availability_note text,
  ADD COLUMN IF NOT EXISTS availability_updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS unavailable_until timestamptz;

ALTER TABLE doctor_profiles
  DROP CONSTRAINT IF EXISTS doctor_profiles_availability_note_length;
ALTER TABLE doctor_profiles
  ADD CONSTRAINT doctor_profiles_availability_note_length
    CHECK (char_length(availability_note) <= 200);

-- Backfill: all existing approved doctors are available (default already covers this)
-- unavailable_until: NULL means indefinitely unavailable when status=unavailable
