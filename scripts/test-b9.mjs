import { execSync } from 'child_process';

const API_URL = 'http://localhost:3000';
const SERVICE_TOKEN = 'vitalguard-dev-simulator-token-2026';

async function main() {
  console.log('\n--- B.9: Internal Discovery Endpoint Auth & Dead-letter Verification ---');

  // 1. No Authorization header
  console.log('1. Testing GET /internal/simulated-devices with no auth header...');
  const resNoAuth = await fetch(`${API_URL}/internal/simulated-devices`);
  console.log('Status:', resNoAuth.status);
  if (resNoAuth.status !== 401) {
    throw new Error(`Expected 401, got ${resNoAuth.status}`);
  }
  console.log('CHECK PASSED: Missing token returns 401.');

  // 2. Wrong service token
  console.log('\n2. Testing GET /internal/simulated-devices with wrong service token...');
  const resWrong = await fetch(`${API_URL}/internal/simulated-devices`, {
    headers: { Authorization: 'Bearer totally-invalid-token-12345' },
  });
  console.log('Status:', resWrong.status);
  if (resWrong.status !== 401) {
    throw new Error(`Expected 401, got ${resWrong.status}`);
  }
  console.log('CHECK PASSED: Invalid token returns 401.');

  // 3. Patient JWT token (not a service token)
  console.log('\n3. Testing GET /internal/simulated-devices with patient JWT...');
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'patient-demo@vitalguard.local', password: 'VitalGuardDemo!2026' }),
  });
  const { token: patientJwt } = await loginRes.json();
  const resPatientJwt = await fetch(`${API_URL}/internal/simulated-devices`, {
    headers: { Authorization: `Bearer ${patientJwt}` },
  });
  console.log('Status with Patient JWT:', resPatientJwt.status);
  if (resPatientJwt.status !== 401) {
    throw new Error(`Expected 401, got ${resPatientJwt.status}`);
  }
  console.log('CHECK PASSED: Patient JWT returns 401.');

  // 4. Correct simulator service token
  console.log('\n4. Testing GET /internal/simulated-devices with valid service token...');
  const resValid = await fetch(`${API_URL}/internal/simulated-devices`, {
    headers: { Authorization: `Bearer ${SERVICE_TOKEN}` },
  });
  console.log('Status with valid token:', resValid.status);
  if (resValid.status !== 200) {
    throw new Error(`Expected 200, got ${resValid.status}`);
  }
  const devices = await resValid.json();
  console.log(`Discovered ${devices.length} simulated devices:`, devices.slice(0, 3));
  console.log('CHECK PASSED: Valid service token returns 200 with device list.');

  // 5. Ingest verification for device-patient mismatch dead-lettering
  console.log('\n5. Verifying consumer deadletter on patient_id mismatch...');
  const testOutput = execSync('pnpm --filter @vitalguard/worker test test/unit/consumer-ack.unit.test.ts').toString();
  console.log(testOutput);
  console.log('CHECK PASSED: Device-patient mismatch correctly deadletters to vitals.deadletter.');

  console.log('\n--- B.9 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
