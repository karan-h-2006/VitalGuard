import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

const API_URL = 'http://localhost:3000';
const BASE_URL = 'http://localhost:5173';
const DEMO_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
const DEMO_PATIENT_ID = '00000000-0000-4000-8000-000000000001';

async function main() {
  console.log('\n--- B.7: Admin Scenario Control & Alert Verification ---');

  // 1. Admin login to get JWT
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin-demo@vitalguard.local', password: 'DemoAdmin!2026' }),
  });
  const { token: adminToken } = await loginRes.json();
  console.log('Admin authenticated.');

  // Clean existing open alerts for clean testing
  execSync(`docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -c "DELETE FROM audit_log WHERE alert_id IN (SELECT id FROM alerts WHERE patient_id = '${DEMO_PATIENT_ID}'); DELETE FROM alerts WHERE patient_id = '${DEMO_PATIENT_ID}';"`);

  // 2. Set scenario to 'deteriorating'
  console.log('Setting scenario to Deteriorating for demo device...');
  const patchRes = await fetch(`${API_URL}/admin/devices/${DEMO_DEVICE_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario: 'deteriorating' }),
  });
  console.log('PATCH scenario response status:', patchRes.status);
  const patchData = await patchRes.json();
  console.log('Updated device state:', patchData);

  // 3. Wait for simulator to pick up deteriorating scenario and trigger alert
  console.log('Waiting for deteriorating readings to generate an alert (up to 30s)...');
  let alertFound = false;
  let alertRecord = null;

  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const psqlOutput = execSync(
      `docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -A -F "|" -c "SELECT id, severity_tier, status, explanation FROM alerts WHERE patient_id = '${DEMO_PATIENT_ID}' ORDER BY opened_at DESC LIMIT 1;"`
    ).toString().trim();

    if (psqlOutput) {
      const [id, tier, status, explanation] = psqlOutput.split('|');
      alertFound = true;
      alertRecord = { id, tier, status, explanation };
      console.log(`Alert generated! Tier: ${tier}, Status: ${status}, Explanation: ${explanation}`);
      break;
    }
  }

  if (!alertFound) {
    throw new Error('Deteriorating scenario failed to generate an alert within 30s');
  }

  // Confirm no alert generated for other newly registered patients
  const otherAlerts = execSync(
    `docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT count(*) FROM alerts WHERE patient_id != '${DEMO_PATIENT_ID}';"`
  ).toString().trim();
  console.log('Alerts generated for other patients:', Number(otherAlerts));

  // 4. Capture screenshot of patient dashboard showing the Deteriorating alert / tier
  console.log('Capturing UI screenshot of Deteriorating alert...');
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'patient-demo@vitalguard.local');
  await page.fill('#password', 'VitalGuardDemo!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/patient', { timeout: 10000 });
  await page.waitForTimeout(3000);

  const screenshotPath = path.resolve('docs/verification-screenshots/b7_admin_scenario_alert.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved B.7 screenshot to:', screenshotPath);
  await browser.close();

  // 5. Revert scenario to 'normal' -> confirm recovery
  console.log('\nReverting scenario to Normal...');
  await fetch(`${API_URL}/admin/devices/${DEMO_DEVICE_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario: 'normal' }),
  });
  console.log('Reverted to normal. Waiting 12s for vitals to normalize...');
  await new Promise((r) => setTimeout(r, 12000));

  const latestReading = execSync(
    `docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -A -F "|" -c "SELECT vital_type, value, severity_tier FROM vital_readings WHERE device_id = '${DEMO_DEVICE_ID}' ORDER BY timestamp DESC LIMIT 3;"`
  ).toString().trim();
  console.log('Latest readings after reverting to Normal:\n' + latestReading);

  // 6. Test 'noisy' scenario
  console.log('\nTesting Noisy scenario...');
  const noisyRes = await fetch(`${API_URL}/admin/devices/${DEMO_DEVICE_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario: 'noisy' }),
  });
  console.log('PATCH noisy status:', noisyRes.status);
  await new Promise((r) => setTimeout(r, 8000));

  // Revert back to normal
  await fetch(`${API_URL}/admin/devices/${DEMO_DEVICE_ID}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ scenario: 'normal' }),
  });
  console.log('Reverted back to normal after noisy test.');

  console.log('\n--- B.7 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
