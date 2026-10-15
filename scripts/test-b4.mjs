import { chromium } from '@playwright/test';
import path from 'path';

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  console.log('Navigating to login page...');
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });

  console.log('Filling login form...');
  await page.fill('input[type="email"], input[name="email"]', 'patient-demo@vitalguard.local');
  await page.fill('input[type="password"], input[name="password"]', 'VitalGuardDemo!2026');
  await page.click('button[type="submit"]');

  console.log('Waiting for patient dashboard navigation...');
  await page.waitForURL('**/patient/**', { timeout: 10000 }).catch(async () => {
    console.log('Current URL:', page.url());
    await page.screenshot({ path: 'docs/verification-screenshots/b4_debug.png' });
  });

  console.log('URL reached:', page.url());

  // Wait for telemetry data / cards
  console.log('Waiting for vitals display...');
  await page.waitForTimeout(5000);

  // Check for simulated badge
  const content = await page.content();
  const hasSimulated = /simulated/i.test(content);
  console.log('Contains SIMULATED label:', hasSimulated);

  const screenshotPath = path.resolve('docs/verification-screenshots/b4_patient_demo_vitals.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved screenshot to:', screenshotPath);

  await browser.close();
}

run().catch(console.error);
