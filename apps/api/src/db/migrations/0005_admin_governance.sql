CREATE TYPE institution_type AS ENUM ('hospital', 'clinic', 'institute');--> statement-breakpoint
CREATE TYPE institution_status AS ENUM ('active', 'inactive');--> statement-breakpoint
CREATE TYPE doctor_application_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TYPE patient_assignment_status AS ENUM ('unassigned', 'assigned');--> statement-breakpoint
CREATE TYPE caregiver_request_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE patient_consent_status AS ENUM ('pending', 'granted', 'denied', 'not_required');--> statement-breakpoint

ALTER TABLE users ADD COLUMN must_change_password boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE associations ADD COLUMN is_primary boolean NOT NULL DEFAULT false;--> statement-breakpoint
CREATE UNIQUE INDEX associations_one_primary_per_patient ON associations(patient_id) WHERE is_primary = true;--> statement-breakpoint

CREATE TABLE institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(255) NOT NULL,
  type institution_type NOT NULL,
  address text,
  city varchar(128),
  contact_email varchar(320),
  contact_phone varchar(32),
  status institution_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES users(id)
);--> statement-breakpoint
CREATE UNIQUE INDEX institutions_name_lower_unique ON institutions(lower(name));--> statement-breakpoint

INSERT INTO institutions (id, name, type, status)
VALUES ('00000000-0000-4000-8000-000000000010', 'Legacy / Unassigned Institution', 'institute', 'active');--> statement-breakpoint

CREATE TABLE doctor_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  institution_id uuid NOT NULL REFERENCES institutions(id),
  medical_license_no varchar(128) NOT NULL,
  specialization varchar(255) NOT NULL,
  status doctor_application_status NOT NULL DEFAULT 'pending',
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  reapplication_count integer NOT NULL DEFAULT 0
);--> statement-breakpoint
INSERT INTO doctor_profiles (user_id, institution_id, medical_license_no, specialization, status)
SELECT id, '00000000-0000-4000-8000-000000000010', 'LEGACY-' || replace(id::text, '-', ''), 'Unspecified', 'approved'
FROM users WHERE role = 'doctor';--> statement-breakpoint

CREATE TABLE patient_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id),
  preferred_institution_id uuid REFERENCES institutions(id),
  assignment_status patient_assignment_status NOT NULL DEFAULT 'unassigned',
  registered_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
INSERT INTO patient_profiles (user_id, assignment_status)
SELECT u.id, CASE WHEN EXISTS (SELECT 1 FROM associations a WHERE a.patient_id = u.id) THEN 'assigned'::patient_assignment_status ELSE 'unassigned'::patient_assignment_status END
FROM users u WHERE u.role = 'patient';--> statement-breakpoint
UPDATE associations a SET is_primary = true WHERE doctor_id = (SELECT a2.doctor_id FROM associations a2 WHERE a2.patient_id = a.patient_id ORDER BY a2.doctor_id LIMIT 1);--> statement-breakpoint

CREATE TABLE caregiver_link_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caregiver_id uuid NOT NULL REFERENCES users(id),
  patient_id uuid REFERENCES users(id),
  requested_patient_email varchar(320),
  relationship_note text,
  status caregiver_request_status NOT NULL DEFAULT 'pending',
  patient_consent patient_consent_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id),
  type varchar(64) NOT NULL,
  title varchar(255) NOT NULL,
  body text NOT NULL,
  payload jsonb,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX notifications_recipient_created_index ON notifications(recipient_id, created_at);--> statement-breakpoint
CREATE TABLE admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES users(id),
  action varchar(128) NOT NULL,
  target_type varchar(64) NOT NULL,
  target_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  ip varchar(64),
  created_at timestamptz NOT NULL DEFAULT now()
);--> statement-breakpoint
CREATE INDEX admin_audit_log_created_index ON admin_audit_log(created_at);--> statement-breakpoint
