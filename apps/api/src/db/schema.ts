import { sql } from 'drizzle-orm';
import {
  boolean,
  jsonb,
  integer,
  index,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', [
  'patient',
  'caregiver',
  'doctor',
  'administrator',
]);
export const deviceRegistrationStatusEnum = pgEnum(
  'device_registration_status',
  ['registered', 'de-registered'],
);
export const vitalTypeEnum = pgEnum('vital_type', [
  'heart_rate',
  'spo2',
  'temperature',
  'motion',
]);
export const severityTierEnum = pgEnum('severity_tier', [
  'Normal',
  'Watch',
  'Warning',
  'Critical',
]);
export const qualityFlagEnum = pgEnum('quality_flag', [
  'clean',
  'noisy',
  'implausible',
]);
export const alertStatusEnum = pgEnum('alert_status', [
  'open',
  'acknowledged',
  'escalated',
  'resolved',
]);
export const institutionTypeEnum = pgEnum('institution_type', [
  'hospital',
  'clinic',
  'institute',
]);
export const institutionStatusEnum = pgEnum('institution_status', [
  'active',
  'inactive',
]);
export const doctorApplicationStatusEnum = pgEnum('doctor_application_status', [
  'pending',
  'approved',
  'rejected',
  'suspended',
]);
export const patientAssignmentStatusEnum = pgEnum('patient_assignment_status', [
  'unassigned',
  'assigned',
]);
export const caregiverRequestStatusEnum = pgEnum('caregiver_request_status', [
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);
export const patientConsentStatusEnum = pgEnum('patient_consent_status', [
  'pending',
  'granted',
  'denied',
  'not_required',
]);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: userRoleEnum('role').notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  phoneNumber: varchar('phone_number', { length: 32 }),
  // Authentication logic is deliberately deferred to Module 3.
  passwordHash: text('password_hash').notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const devices = pgTable('devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id').references(() => users.id),
  registrationStatus: deviceRegistrationStatusEnum('registration_status')
    .notNull()
    .default('registered'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const associations = pgTable(
  'associations',
  {
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id),
    isPrimary: boolean('is_primary').notNull().default(false),
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [
    primaryKey({ columns: [table.patientId, table.doctorId] }),
    uniqueIndex('associations_one_primary_per_patient')
      .on(table.patientId)
      .where(sql`${table.isPrimary} = true`),
  ],
);

// A join table is used instead of a UUID array so each caregiver association
// receives a real database foreign key and can be queried/indexed safely.
export const associationCaregivers = pgTable(
  'association_caregivers',
  {
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id),
    caregiverId: uuid('caregiver_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.patientId, table.caregiverId] })],
);

export const vitalReadings = pgTable(
  'vital_readings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    deviceId: uuid('device_id')
      .notNull()
      .references(() => devices.id),
    patientId: uuid('patient_id').references(() => users.id),
    vitalType: vitalTypeEnum('vital_type').notNull(),
    value: numeric('value', { precision: 12, scale: 4 }).notNull(),
    timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
    // Module 3 owns classification; ingestion stores raw values only.
    severityTier: severityTierEnum('severity_tier'),
    qualityFlag: qualityFlagEnum('quality_flag').notNull().default('clean'),
    gap: boolean('gap').notNull().default(false),
  },
  (table) => [
    uniqueIndex('vital_readings_device_timestamp_type_unique').on(
      table.deviceId,
      table.timestamp,
      table.vitalType,
    ),
    index('vital_readings_patient_timestamp_index').on(
      table.patientId,
      table.timestamp,
    ),
  ],
);

export const baselines = pgTable(
  'baselines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id),
    vitalType: vitalTypeEnum('vital_type').notNull(),
    mean: numeric('mean', { precision: 12, scale: 4 }).notNull(),
    stddev: numeric('stddev', { precision: 12, scale: 4 }).notNull(),
    windowSize: varchar('window_size', { length: 64 }).notNull(),
    sampleCount: integer('sample_count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex('baselines_patient_vital_unique').on(
      table.patientId,
      table.vitalType,
    ),
  ],
);

export const thresholds = pgTable(
  'thresholds',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    patientId: uuid('patient_id')
      .notNull()
      .references(() => users.id),
    vitalType: vitalTypeEnum('vital_type').notNull(),
    minimum: numeric('minimum', { precision: 12, scale: 4 }),
    maximum: numeric('maximum', { precision: 12, scale: 4 }),
    clinicianOverride: boolean('clinician_override').notNull().default(false),
  },
  (table) => [
    uniqueIndex('thresholds_patient_vital_unique').on(
      table.patientId,
      table.vitalType,
    ),
  ],
);

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => users.id),
  severityTier: severityTierEnum('severity_tier').notNull(),
  triggeringVitals: text('triggering_vitals').array(),
  explanation: text('explanation').notNull(),
  status: alertStatusEnum('status').notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  ackDeadline: timestamp('ack_deadline', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  escalationLevel: integer('escalation_level').notNull().default(0),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const reports = pgTable('reports', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => users.id),
  periodStart: timestamp('period_start', { withTimezone: true }).notNull(),
  periodEnd: timestamp('period_end', { withTimezone: true }).notNull(),
  generatedAt: timestamp('generated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  filePath: text('file_path').notNull(),
  avgVitals: jsonb('avg_vitals').notNull(),
  alertCounts: jsonb('alert_counts').notNull(),
  trendWarningCount: integer('trend_warning_count').notNull().default(0),
});

export const auditLog = pgTable('audit_log', {
  eventId: uuid('event_id').defaultRandom().primaryKey(),
  alertId: uuid('alert_id').references(() => alerts.id),
  transition: text('transition').notNull(),
  actingUser: uuid('acting_user').references(() => users.id),
  timestamp: timestamp('timestamp', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const institutions = pgTable(
  'institutions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    type: institutionTypeEnum('type').notNull(),
    address: text('address'),
    city: varchar('city', { length: 128 }),
    contactEmail: varchar('contact_email', { length: 320 }),
    contactPhone: varchar('contact_phone', { length: 32 }),
    status: institutionStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdBy: uuid('created_by').references(() => users.id),
  },
  (table) => [
    uniqueIndex('institutions_name_lower_unique').on(sql`lower(${table.name})`),
  ],
);

export const doctorProfiles = pgTable('doctor_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  institutionId: uuid('institution_id')
    .notNull()
    .references(() => institutions.id),
  medicalLicenseNo: varchar('medical_license_no', { length: 128 }).notNull(),
  specialization: varchar('specialization', { length: 255 }).notNull(),
  status: doctorApplicationStatusEnum('status').notNull().default('pending'),
  submittedAt: timestamp('submitted_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  reapplicationCount: integer('reapplication_count').notNull().default(0),
});

export const patientProfiles = pgTable('patient_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id),
  preferredInstitutionId: uuid('preferred_institution_id').references(
    () => institutions.id,
  ),
  assignmentStatus: patientAssignmentStatusEnum('assignment_status')
    .notNull()
    .default('unassigned'),
  registeredAt: timestamp('registered_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const caregiverLinkRequests = pgTable('caregiver_link_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  caregiverId: uuid('caregiver_id')
    .notNull()
    .references(() => users.id),
  patientId: uuid('patient_id').references(() => users.id),
  requestedPatientEmail: varchar('requested_patient_email', { length: 320 }),
  relationshipNote: text('relationship_note'),
  status: caregiverRequestStatusEnum('status').notNull().default('pending'),
  patientConsent: patientConsentStatusEnum('patient_consent')
    .notNull()
    .default('pending'),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id),
    type: varchar('type', { length: 64 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    body: text('body').notNull(),
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('notifications_recipient_created_index').on(
      table.recipientId,
      table.createdAt,
    ),
  ],
);

export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id')
      .notNull()
      .references(() => users.id),
    action: varchar('action', { length: 128 }).notNull(),
    targetType: varchar('target_type', { length: 64 }).notNull(),
    targetId: uuid('target_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    reason: text('reason'),
    ip: varchar('ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('admin_audit_log_created_index').on(table.createdAt)],
);
