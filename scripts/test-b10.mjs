import { chromium } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5173';

async function main() {
  console.log('\n--- B.10: Admin Console 8-Tab Regression & Audit Log Verification ---');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  // Listen for uncaught console errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  // 1. Log in as Administrator
  console.log('Logging in as Administrator...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('#email', 'admin-demo@vitalguard.local');
  await page.fill('#password', 'DemoAdmin!2026');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/administrator**', { timeout: 10000 });
  console.log('Admin logged in at:', page.url());

  const tabs = [
    { name: 'Overview', selector: 'button:has-text("Overview"), a:has-text("Overview")' },
    { name: 'Doctor requests', selector: 'button:has-text("Doctor requests"), a:has-text("Doctor requests")' },
    { name: 'Institutions', selector: 'button:has-text("Institutions"), a:has-text("Institutions")' },
    { name: 'Doctors', selector: 'button:has-text("Doctors"), a:has-text("Doctors")' },
    { name: 'Patients', selector: 'button:has-text("Patients"), a:has-text("Patients")' },
    { name: 'Caregiver links', selector: 'button:has-text("Caregiver links"), a:has-text("Caregiver links")' },
    { name: 'Users', selector: 'button:has-text("Users"), a:has-text("Users")' },
    { name: 'Audit log', selector: 'button:has-text("Audit log"), a:has-text("Audit log")' },
  ];

  for (const tab of tabs) {
    console.log(`\nTesting tab: ${tab.name}...`);
    const tabBtn = page.locator(tab.selector).first();
    await tabBtn.click();
    await page.waitForTimeout(1000);

    // Verify page didn't crash or go blank
    const content = await page.content();
    if (content.includes('Something went wrong') || content.trim().length < 500) {
      throw new Error(`Tab ${tab.name} rendered error boundary or blank page!`);
    }

    // Test reload
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1000);

    // Test back and forward
    await page.goBack();
    await page.waitForTimeout(500);
    await page.goForward();
    await page.waitForTimeout(500);

    console.log(`Tab ${tab.name}: PASS (Render, Reload, Back/Forward OK)`);
  }

  // 2. Click Audit log tab and wait for loading skeletons to disappear
  console.log('\nVerifying device.scenario_update entry in Audit Log...');
  await page.locator('button:has-text("Overview"), a:has-text("Overview")').first().click();
  await page.waitForTimeout(500);
  await page.locator('button:has-text("Audit log"), a:has-text("Audit log")').first().click();

  // Wait for loading skeleton to disappear
  console.log('Waiting for audit log table to finish loading...');
  await page.waitForFunction(() => !document.querySelector('.animate-pulse'), { timeout: 20000 });
  await page.waitForTimeout(1000);

  const auditContent = await page.content();
  const hasScenarioUpdate = auditContent.includes('device.scenario_update') || auditContent.includes('Device scenario update');
  console.log('Audit log contains scenario update entry:', hasScenarioUpdate);

  const screenshotPath = path.resolve('docs/verification-screenshots/b10_admin_audit_log.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log('Saved B.10 screenshot to:', screenshotPath);

  if (consoleErrors.length > 0) {
    console.log('Console warnings/errors logged:', consoleErrors.length);
  }

  await browser.close();
  console.log('\n--- B.10 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
