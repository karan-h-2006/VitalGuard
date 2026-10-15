import { spawn } from 'child_process';

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n--- B.13: Scale Check & Max Devices Cap Verification ---');

  // Test 1: Verify SIM_MAX_DEVICES cap enforcement on manager
  console.log('Testing SIM_MAX_DEVICES=3 cap with live API (which has 5 registered devices)...');
  const env = {
    ...process.env,
    SIM_MAX_DEVICES: '3',
    SIMULATOR_HEALTH_PORT: '8083',
    SIM_DISCOVERY_INTERVAL_SECONDS: '2',
    VITALS_INTERVAL_SECONDS: '2',
  };

  const simProcess = spawn(
    '.\\simulator\\.venv\\Scripts\\python.exe',
    ['simulator/manager.py'],
    { env, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let output = '';
  simProcess.stdout.on('data', (d) => (output += d.toString()));
  simProcess.stderr.on('data', (d) => (output += d.toString()));

  await wait(5000);

  const res = await fetch('http://localhost:8083/healthz');
  const health = await res.json();
  console.log('Healthz response with cap=3:', health);

  simProcess.kill('SIGTERM');

  console.log('Manager log snippet:');
  console.log(output.split('\n').filter(l => l.includes('cap') || l.includes('exceeding') || l.includes('Discovered')).join('\n'));

  if (health.active_devices !== 3) {
    throw new Error(`FAIL: Expected 3 active devices, got ${health.active_devices}`);
  }
  if (!output.includes('exceeding SIM_MAX_DEVICES cap (3)')) {
    throw new Error('FAIL: Warning log about exceeding SIM_MAX_DEVICES cap was not found!');
  }
  console.log('CHECK PASSED: Cap warning logged and active devices capped at 3.');

  // Test 2: Scale registration up to 25 patients on API
  console.log('\nRegistering patients up to 25 total to verify API provisioning under scale...');
  const currentCountRes = await fetch('http://localhost:3000/internal/simulated-devices', {
    headers: { Authorization: 'Bearer vitalguard-dev-simulator-token-2026' }
  });
  const currentDevices = await currentCountRes.json();
  console.log(`Currently registered simulated devices: ${currentDevices.length}`);

  const toCreate = Math.max(0, 25 - currentDevices.length);
  console.log(`Creating ${toCreate} additional patients to reach 25...`);

  const startTime = Date.now();
  for (let i = 0; i < toCreate; i++) {
    const email = `scale-patient-${Date.now()}-${i}@vitalguard.local`;
    const regRes = await fetch('http://localhost:3000/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'Password123!',
        fullName: `Scale Patient ${i}`,
        role: 'patient',
        phone: `+1555${String(1000000 + i).slice(-7)}`,
      }),
    });
    if (!regRes.ok) {
      const errText = await regRes.text();
      throw new Error(`Registration failed for ${email}: ${errText}`);
    }
  }
  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Created ${toCreate} patients in ${durationSec}s.`);

  // Verify internal/simulated-devices returns >= 25
  const updatedCountRes = await fetch('http://localhost:3000/internal/simulated-devices', {
    headers: { Authorization: 'Bearer vitalguard-dev-simulator-token-2026' }
  });
  const updatedDevices = await updatedCountRes.json();
  console.log(`Total registered simulated devices in API: ${updatedDevices.length}`);
  if (updatedDevices.length < 25) {
    throw new Error(`FAIL: Expected at least 25 simulated devices, found ${updatedDevices.length}`);
  }

  // Verify primary simulator discovers all 25 devices
  console.log('Waiting 12s for primary simulator discovery poll...');
  await wait(12000);
  const primHealthRes = await fetch('http://localhost:8080/healthz');
  const primHealth = await primHealthRes.json();
  console.log(`Primary simulator active devices: ${primHealth.active_devices}`);
  if (primHealth.active_devices < 25) {
    throw new Error(`FAIL: Primary simulator only has ${primHealth.active_devices} devices active, expected >= 25`);
  }

  console.log('CHECK PASSED: System gracefully handles 25 concurrent simulated devices.');
  console.log('\n--- B.13 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
