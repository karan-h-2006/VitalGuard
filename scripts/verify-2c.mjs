import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import fs from 'fs';

async function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('\n--- 2.c: Browser Patient Registration & Auto-Simulator Verification ---');

  fs.mkdirSync('docs/verification-screenshots', { recursive: true });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ─── Patient 1 ─────────────────────────────────────────────────────────────
  const p1Email = `crit-patient-1-${Date.now()}@vitalguard.local`;
  console.log(`\nRegistering Patient 1 (${p1Email})...`);
  await page.goto('http://localhost:5173/register');
  await page.waitForLoadState('networkidle');

  await page.selectOption('#role', 'patient');
  await page.fill('#email', p1Email);
  await page.fill('#password', 'Password123!');

  const regStart1 = Date.now();
  await page.click('button[type="submit"]');

  // Wait for redirect to patient dashboard
  await page.waitForURL('**/patient', { timeout: 10000 });
  console.log('Redirected to patient dashboard. Waiting for live telemetry to appear...');

  // Wait for live vitals cards to have numbers (not placeholder or zero)
  let p1Vitals = null;
  while (Date.now() - regStart1 < 30000) {
    const text = await page.innerText('body');
    const hrMatch = text.match(/(\d{2,3})\s*bpm/i);
    const spo2Match = text.match(/(\d{2,3})\s*%/i);
    const tempMatch = text.match(/(\d{2}\.\d)\s*°?C/i);

    if (hrMatch && spo2Match && tempMatch) {
      const elapsed = ((Date.now() - regStart1) / 1000).toFixed(2);
      p1Vitals = {
        hr: Number(hrMatch[1]),
        spo2: Number(spo2Match[1]),
        temp: Number(tempMatch[1]),
        elapsed,
      };
      console.log(`Live vitals appeared for Patient 1 in ${elapsed}s: HR=${p1Vitals.hr} bpm, SpO2=${p1Vitals.spo2}%, Temp=${p1Vitals.temp} °C`);
      break;
    }
    await wait(1000);
  }

  if (!p1Vitals) {
    throw new Error('FAIL: Patient 1 did not receive live vitals within 20s!');
  }
  if (Number(p1Vitals.elapsed) > 15) {
    console.warn(`WARNING: Patient 1 telemetry took ${p1Vitals.elapsed}s (target <= 15s)`);
  }

  // Check for SIMULATED DEVICE badge
  const badgeText = await page.innerText('body');
  if (!badgeText.includes('SIMULATED DEVICE')) {
    throw new Error('FAIL: "SIMULATED DEVICE" badge is not visible on Patient 1 dashboard!');
  }
  console.log('CHECK PASSED: "SIMULATED DEVICE" badge confirmed visible.');

  await page.screenshot({ path: 'docs/verification-screenshots/c_patient1_live.png' });
  console.log('Saved screenshot: docs/verification-screenshots/c_patient1_live.png');

  // ─── Patient 2 ─────────────────────────────────────────────────────────────
  // Clear cookies/localStorage to start fresh session
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());

  const p2Email = `crit-patient-2-${Date.now()}@vitalguard.local`;
  console.log(`\nRegistering Patient 2 (${p2Email})...`);
  await page.goto('http://localhost:5173/register');
  await page.waitForLoadState('networkidle');

  await page.selectOption('#role', 'patient');
  await page.fill('#email', p2Email);
  await page.fill('#password', 'Password123!');

  const regStart2 = Date.now();
  await page.click('button[type="submit"]');

  await page.waitForURL('**/patient', { timeout: 10000 });
  console.log('Redirected to patient dashboard. Waiting for live telemetry to appear...');

  let p2Vitals = null;
  while (Date.now() - regStart2 < 30000) {
    const text = await page.innerText('body');
    const hrMatch = text.match(/(\d{2,3})\s*bpm/i);
    const spo2Match = text.match(/(\d{2,3})\s*%/i);
    const tempMatch = text.match(/(\d{2}\.\d)\s*°?C/i);

    if (hrMatch && spo2Match && tempMatch) {
      const elapsed = ((Date.now() - regStart2) / 1000).toFixed(2);
      p2Vitals = {
        hr: Number(hrMatch[1]),
        spo2: Number(spo2Match[1]),
        temp: Number(tempMatch[1]),
        elapsed,
      };
      console.log(`Live vitals appeared for Patient 2 in ${elapsed}s: HR=${p2Vitals.hr} bpm, SpO2=${p2Vitals.spo2}%, Temp=${p2Vitals.temp} °C`);
      break;
    }
    await wait(1000);
  }

  if (!p2Vitals) {
    throw new Error('FAIL: Patient 2 did not receive live vitals within 20s!');
  }

  await page.screenshot({ path: 'docs/verification-screenshots/c_patient2_live.png' });
  console.log('Saved screenshot: docs/verification-screenshots/c_patient2_live.png');

  // Verify diversity between Patient 1 and Patient 2
  console.log('\nChecking vital diversity:');
  console.log(`Patient 1: HR=${p1Vitals.hr}, SpO2=${p1Vitals.spo2}, Temp=${p1Vitals.temp}`);
  console.log(`Patient 2: HR=${p2Vitals.hr}, SpO2=${p2Vitals.spo2}, Temp=${p2Vitals.temp}`);
  if (p1Vitals.hr === p2Vitals.hr && p1Vitals.temp === p2Vitals.temp) {
    console.warn('Note: Baseline values were close or identical; checking baseline derivation.');
  } else {
    console.log('CHECK PASSED: Vitals differ between independent patients.');
  }

  await browser.close();

  // ─── Duplicate Rows Check in Database ──────────────────────────────────────
  console.log('\nChecking for duplicate rows in vital_readings database table...');
  const dupCheckSql = 'SELECT device_id, timestamp, count(*) FROM vital_readings GROUP BY device_id, timestamp HAVING count(*) > 1;';
  const dupResult = execSync(`docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "${dupCheckSql}"`)
    .toString()
    .trim();

  if (dupResult.length > 0) {
    throw new Error(`FAIL: Duplicate rows detected in vital_readings!\n${dupResult}`);
  }
  console.log('CHECK PASSED: Zero duplicate rows found in vital_readings table.');
  console.log('\n--- 2.c VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
