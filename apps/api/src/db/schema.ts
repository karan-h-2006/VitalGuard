import {
  boolean,
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

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  role: userRoleEnum('role').notNull(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  // Authentication logic is deliberately deferred to Module 3.
  passwordHash: text('password_hash').notNull(),
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
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
  },
  (table) => [primaryKey({ columns: [table.patientId, table.doctorId] })],
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

export const baselines = pgTable('baselines', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => users.id),
  vitalType: vitalTypeEnum('vital_type').notNull(),
  mean: numeric('mean', { precision: 12, scale: 4 }).notNull(),
  stddev: numeric('stddev', { precision: 12, scale: 4 }).notNull(),
  windowSize: varchar('window_size', { length: 64 }),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const thresholds = pgTable('thresholds', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => users.id),
  vitalType: vitalTypeEnum('vital_type').notNull(),
  minimum: numeric('minimum', { precision: 12, scale: 4 }),
  maximum: numeric('maximum', { precision: 12, scale: 4 }),
  clinicianOverride: boolean('clinician_override').notNull().default(false),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  patientId: uuid('patient_id')
    .notNull()
    .references(() => users.id),
  severityTier: severityTierEnum('severity_tier').notNull(),
  triggeringVitals: text('triggering_vitals').array(),
  status: alertStatusEnum('status').notNull().default('open'),
  openedAt: timestamp('opened_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
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
