import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { hashPassword } from '../auth/passwords.js';
import { env } from '../env.js';
import {
  associationCaregivers,
  associations,
  caregiverLinkRequests,
  doctorProfiles,
  devices,
  institutions,
  patientProfiles,
  users,
} from './schema.js';
import { scriptLogger } from './script-logger.js';

const SEEDED_PATIENT_ID = '00000000-0000-4000-8000-000000000001';
const SEEDED_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
const SEEDED_CAREGIVER_ID = '00000000-0000-4000-8000-000000000003';
const SEEDED_DOCTOR_ID = '00000000-0000-4000-8000-000000000004';
const SEEDED_PENDING_DOCTOR_ID = '00000000-0000-4000-8000-000000000005';
const SEEDED_UNASSIGNED_PATIENT_ID = '00000000-0000-4000-8000-000000000006';
const DEMO_INSTITUTION_ID = '00000000-0000-4000-8000-000000000011';
const DEMO_PASSWORD = 'VitalGuardDemo!2026';
const client = postgres(env.DATABASE_URL, { max: 1 });
const database = drizzle(client);

try {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  await database
    .insert(institutions)
    .values({
      id: DEMO_INSTITUTION_ID,
      name: 'VitalGuard Demo Clinic',
      type: 'clinic',
      city: 'Demo City',
      status: 'active',
    })
    .onConflictDoUpdate({
      target: institutions.id,
      set: {
        name: 'VitalGuard Demo Clinic',
        type: 'clinic',
        city: 'Demo City',
        status: 'active',
      },
    });
  await database
    .insert(users)
    .values({
      id: SEEDED_PATIENT_ID,
      role: 'patient',
      email: 'patient-demo@vitalguard.local',
      phoneNumber: null,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'patient', phoneNumber: null, passwordHash },
    });
  await database
    .insert(users)
    .values({
      id: SEEDED_PENDING_DOCTOR_ID,
      role: 'doctor',
      email: 'doctor-pending@vitalguard.local',
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'doctor', passwordHash },
    });
  await database
    .insert(users)
    .values({
      id: SEEDED_UNASSIGNED_PATIENT_ID,
      role: 'patient',
      email: 'patient-unassigned@vitalguard.local',
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'patient', passwordHash },
    });
  await database
    .insert(doctorProfiles)
    .values({
      userId: SEEDED_PENDING_DOCTOR_ID,
      institutionId: DEMO_INSTITUTION_ID,
      medicalLicenseNo: 'DEMO-LICENSE-002',
      specialization: 'Cardiology',
      status: 'pending',
    })
    .onConflictDoUpdate({
      target: doctorProfiles.userId,
      set: { institutionId: DEMO_INSTITUTION_ID, status: 'pending' },
    });
  await database
    .insert(users)
    .values({
      id: SEEDED_CAREGIVER_ID,
      role: 'caregiver',
      email: 'caregiver-demo@vitalguard.local',
      phoneNumber: '+15555550123',
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'caregiver', phoneNumber: '+15555550123', passwordHash },
    });
  await database
    .insert(users)
    .values({
      id: SEEDED_DOCTOR_ID,
      role: 'doctor',
      email: 'doctor-demo@vitalguard.local',
      phoneNumber: null,
      passwordHash,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { role: 'doctor', phoneNumber: null, passwordHash },
    });
  await database
    .insert(doctorProfiles)
    .values({
      userId: SEEDED_DOCTOR_ID,
      institutionId: DEMO_INSTITUTION_ID,
      medicalLicenseNo: 'DEMO-LICENSE-001',
      specialization: 'Primary Care',
      status: 'approved',
    })
    .onConflictDoUpdate({
      target: doctorProfiles.userId,
      set: { institutionId: DEMO_INSTITUTION_ID, status: 'approved' },
    });
  await database
    .insert(devices)
    .values({
      id: SEEDED_DEVICE_ID,
      patientId: SEEDED_PATIENT_ID,
      registrationStatus: 'registered',
    })
    .onConflictDoNothing();
  await database
    .insert(patientProfiles)
    .values({
      userId: SEEDED_PATIENT_ID,
      preferredInstitutionId: DEMO_INSTITUTION_ID,
      assignmentStatus: 'assigned',
    })
    .onConflictDoUpdate({
      target: patientProfiles.userId,
      set: {
        preferredInstitutionId: DEMO_INSTITUTION_ID,
        assignmentStatus: 'assigned',
      },
    });
  await database
    .insert(patientProfiles)
    .values({
      userId: SEEDED_UNASSIGNED_PATIENT_ID,
      assignmentStatus: 'unassigned',
    })
    .onConflictDoUpdate({
      target: patientProfiles.userId,
      set: { assignmentStatus: 'unassigned' },
    });
  await database
    .insert(associations)
    .values({
      patientId: SEEDED_PATIENT_ID,
      doctorId: SEEDED_DOCTOR_ID,
    })
    .onConflictDoNothing();
  await database
    .insert(associations)
    .values({
      patientId: SEEDED_PATIENT_ID,
      doctorId: SEEDED_DOCTOR_ID,
      isPrimary: true,
    })
    .onConflictDoUpdate({
      target: [associations.patientId, associations.doctorId],
      set: { isPrimary: true },
    });
  await database
    .insert(caregiverLinkRequests)
    .values({
      caregiverId: SEEDED_CAREGIVER_ID,
      patientId: SEEDED_UNASSIGNED_PATIENT_ID,
      requestedPatientEmail: 'patient-unassigned@vitalguard.local',
      relationshipNote: 'Demo pending request',
      status: 'pending',
      patientConsent: 'pending',
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
