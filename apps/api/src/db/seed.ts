import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import { devices, users } from './schema.js';
import { scriptLogger } from './script-logger.js';

const SEEDED_PATIENT_ID = '00000000-0000-4000-8000-000000000001';
const SEEDED_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
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
      passwordHash: 'MODULE_3_AUTH_NOT_IMPLEMENTED',
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
  scriptLogger.info(
    { patientId: SEEDED_PATIENT_ID, deviceId: SEEDED_DEVICE_ID },
    'seeded local patient and device',
  );
} finally {
  await client.end();
}
