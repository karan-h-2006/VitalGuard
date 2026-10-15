import { chromium } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

async function testPatientRegistration(browser, email, password) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log(`\nRegistering new patient: ${email}...`);
  await page.goto('http://localhost:5173/register', { waitUntil: 'networkidle' });

  // Default role is patient
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  
  const submitStart = Date.now();
  await page.click('button[type="submit"]');

  console.log('Submitted registration. Waiting for patient dashboard...');
  await page.waitForURL('**/patient', { timeout: 15000 });
  const registerRedirectTime = ((Date.now() - submitStart) / 1000).toFixed(2);
  console.log(`Redirected to /patient in ${registerRedirectTime}s`);

  console.log('Polling for first telemetry reading...');
  const telemetryStart = Date.now();
  let firstReadingTime = null;
  let hrText = '';
  let spo2Text = '';
  let tempText = '';

  // Poll until heart rate shows a real number (not '--' or empty)
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(500);
    const content = await page.content();
    // Look for Heart Rate number
    const match = content.match(/(\d{2,3}(?:\.\d)?)\s*(?:<[^>]+>\s*)*bpm/i);
    if (match) {
      firstReadingTime = ((Date.now() - telemetryStart) / 1000).toFixed(2);
      hrText = match[1];
      const spo2Match = content.match(/(\d{2,3}(?:\.\d)?)\s*(?:<[^>]+>\s*)*%/i);
      const tempMatch = content.match(/(\d{2}(?:\.\d)?)\s*(?:<[^>]+>\s*)*°?C/i);
      spo2Text = spo2Match ? spo2Match[1] : '';
      tempText = tempMatch ? tempMatch[1] : '';
      break;
    }
  }

  console.log(`First telemetry reading received in ${firstReadingTime}s (Target <= 15s)`);
  console.log(`Vitals: Heart Rate = ${hrText} bpm, SpO2 = ${spo2Text}%, Temp = ${tempText} C`);

  return { context, page, firstReadingTime, hrText, spo2Text, tempText };
}

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const p1Email = `patient-auto-${Date.now()}a@vitalguard.local`;
  const p2Email = `patient-auto-${Date.now()}b@vitalguard.local`;
  const pwd = 'VitalGuardDemo!2026';

  // Test Patient 1
  const p1 = await testPatientRegistration(browser, p1Email, pwd);
  const screenshotPath = path.resolve('docs/verification-screenshots/b5_new_patient_vitals.png');
  await p1.page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved B.5 screenshot to:', screenshotPath);

  // Test Patient 2
  const p2 = await testPatientRegistration(browser, p2Email, pwd);

  console.log('\n--- Telemetry Comparison ---');
  console.log(`Patient 1 (${p1Email}): HR=${p1.hrText}, SpO2=${p1.spo2Text}, Temp=${p1.tempText}`);
  console.log(`Patient 2 (${p2Email}): HR=${p2.hrText}, SpO2=${p2.spo2Text}, Temp=${p2.tempText}`);

  const readingsDiffer = (p1.hrText !== p2.hrText) || (p1.spo2Text !== p2.spo2Text) || (p1.tempText !== p2.tempText);
  console.log('Patients have different baseline telemetry values:', readingsDiffer);

  await p1.context.close();
  await p2.context.close();
  await browser.close();

  // Postgres verification for zero duplicate devices
  console.log('\n--- Database Zero Duplicate Check ---');
  try {
    const output = execSync('docker exec infra-postgres-1 psql -U vitalguard -d vitalguard -t -c "SELECT patient_id, count(*) FROM devices GROUP BY patient_id HAVING count(*) > 1;"')
      .toString()
      .trim();
    if (!output) {
      console.log('CHECK PASSED: Exactly 0 patients have duplicate devices.');
    } else {
      console.error('CHECK FAILED: Found duplicate devices:', output);
    }
  } catch (err) {
    console.error('Database query error:', err.message);
  }
}

main().catch(console.error);
