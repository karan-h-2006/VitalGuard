import { execSync } from 'child_process';

const API_URL = 'http://localhost:3000';

async function main() {
  console.log('\n--- B.8: Role Device Creation & AUTO_PROVISION Check ---');

  const ts = Date.now();
  const pwd = 'VitalGuardDemo!2026';

  // 1. Register a doctor
  const docEmail = `b8-doc-${ts}@vitalguard.local`;
  console.log(`Registering doctor: ${docEmail}`);
  const docRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'doctor',
      email: docEmail,
      password: pwd,
      institutionId: '00000000-0000-4000-8000-000000000011',
      medicalLicenseNo: `MD-${ts}`,
      specialization: 'Internal Medicine',
    }),
  });
  console.log('Doctor register response:', docRes.status);
  const docData = await docRes.json();
  const docUserId = docData.user?.id || docData.userId;

  // Query database for devices associated with doctor
  const docDevices = execSync(
    `docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM devices WHERE patient_id IN (SELECT id FROM users WHERE email = '${docEmail}');"`
  ).toString().trim();
  console.log('Devices created for doctor:', Number(docDevices));
  if (Number(docDevices) !== 0) {
    throw new Error('FAIL: Doctor registration wrongly created a device!');
  }
  console.log('CHECK PASSED: Registering doctor creates 0 devices.');

  // 2. Register a caregiver
  const careEmail = `b8-care-${ts}@vitalguard.local`;
  console.log(`\nRegistering caregiver: ${careEmail}`);
  const careRes = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      role: 'caregiver',
      email: careEmail,
      password: pwd,
    }),
  });
  console.log('Caregiver register response:', careRes.status);

  // Query database for devices associated with caregiver
  const careDevices = execSync(
    `docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM devices WHERE patient_id IN (SELECT id FROM users WHERE email = '${careEmail}');"`
  ).toString().trim();
  console.log('Devices created for caregiver:', Number(careDevices));
  if (Number(careDevices) !== 0) {
    throw new Error('FAIL: Caregiver registration wrongly created a device!');
  }
  console.log('CHECK PASSED: Registering caregiver creates 0 devices.');

  // 3. Test AUTO_PROVISION_SIMULATED_DEVICE=false via unit test execution
  console.log('\nRunning unit test verifying AUTO_PROVISION_SIMULATED_DEVICE=false creates no device...');
  const testOutput = execSync('pnpm --filter @vitalguard/api test test/unit/auto-provision-e2e.unit.test.ts').toString();
  console.log(testOutput);
  console.log('CHECK PASSED: AUTO_PROVISION_SIMULATED_DEVICE=false logic verified.');

  console.log('\n--- B.8 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
