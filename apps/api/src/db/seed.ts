import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import {
  associationCaregivers,
  associations,
  devices,
  users,
} from './schema.js';
import { scriptLogger } from './script-logger.js';

const SEEDED_PATIENT_ID = '00000000-0000-4000-8000-000000000001';
const SEEDED_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
const SEEDED_CAREGIVER_ID = '00000000-0000-4000-8000-000000000003';
const SEEDED_DOCTOR_ID = '00000000-0000-4000-8000-000000000004';
const client = postgres(env.DATABASE_URL, { max: 1 });
const database = drizzle(client);

try {
  // Module 3 replaces this non-authenticating placeholder with real account setup.
  await database
    .insert(users)
    .values({
      id: SEEDED_PATIENT_ID,
      role: 'patient',
      email: 'patient-demo@vitalguard.local',
      phoneNumber: null,
      passwordHash: 'MODULE_3_AUTH_NOT_IMPLEMENTED',
    })
    .onConflictDoNothing();
  await database
    .insert(users)
    .values({
      id: SEEDED_CAREGIVER_ID,
      role: 'caregiver',
      email: 'caregiver-demo@vitalguard.local',
      phoneNumber: '+15555550123',
      passwordHash: 'MODULE_4_AUTH_NOT_IMPLEMENTED',
    })
    .onConflictDoNothing();
  await database
    .insert(users)
    .values({
      id: SEEDED_DOCTOR_ID,
      role: 'doctor',
      email: 'doctor-demo@vitalguard.local',
      phoneNumber: null,
      passwordHash: 'MODULE_4_AUTH_NOT_IMPLEMENTED',
    })
    .onConflictDoNothing();
  await database
    .insert(devices)
    .values({
      id: SEEDED_DEVICE_ID,
      patientId: SEEDED_PATIENT_ID,
      registrationStatus: 'registered',
    })
    .onConflictDoNothing();
  await database
    .insert(associations)
    .values({
      patientId: SEEDED_PATIENT_ID,
      doctorId: SEEDED_DOCTOR_ID,
    })
    .onConflictDoNothing();
  await database
    .insert(associationCaregivers)
    .values({
      patientId: SEEDED_PATIENT_ID,
      caregiverId: SEEDED_CAREGIVER_ID,
    })
    .onConflictDoNothing();
  scriptLogger.info(
    {
      patientId: SEEDED_PATIENT_ID,
      deviceId: SEEDED_DEVICE_ID,
      caregiverId: SEEDED_CAREGIVER_ID,
      doctorId: SEEDED_DOCTOR_ID,
    },
    'seeded local patient, device, caregiver, doctor, and associations',
  );
} finally {
  await client.end();
}
