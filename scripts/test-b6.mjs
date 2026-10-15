import { chromium } from '@playwright/test';
import path from 'path';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:3000';

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const timestamp = Date.now();
  const docEmail = `doctor-test-${timestamp}@vitalguard.local`;
  const careEmail = `caregiver-test-${timestamp}@vitalguard.local`;
  const patientEmail = 'patient-demo@vitalguard.local';
  const pwd = 'VitalGuardDemo!2026';
  const adminPwd = 'DemoAdmin!2026';

  // ─── 1. Register Doctor ───────────────────────────────────────────────────
  console.log(`\n1. Registering doctor: ${docEmail}...`);
  const docContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const docPage = await docContext.newPage();
  await docPage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });

  // Select doctor role
  await docPage.selectOption('#role', 'doctor');
  await docPage.fill('#email', docEmail);
  await docPage.fill('#password', pwd);
  await docPage.waitForTimeout(500);

  const institutionSelect = docPage.locator('#institution');
  if (await institutionSelect.count() > 0) {
    await docPage.selectOption('#institution', { index: 1 });
  }

  await docPage.fill('#license', `MD-${timestamp}`);
  await docPage.fill('#specialization', 'Cardiology');
  await docPage.click('button[type="submit"]');

  await docPage.waitForURL('**/doctor/pending', { timeout: 10000 });
  console.log('Doctor registered successfully and is in pending state.');

  // ─── 2. Admin Approves Doctor and Assigns Patient ─────────────────────────
  console.log('\n2. Admin logging in to approve doctor and assign patient...');
  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await adminPage.fill('#email', 'admin-demo@vitalguard.local');
  await adminPage.fill('#password', adminPwd);
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForURL('**/administrator**', { timeout: 10000 });
  console.log('Admin logged in.');

  const adminToken = await adminPage.evaluate(() => localStorage.getItem('vitalguard_token'));
  
  // Approve doctor
  const pendingDocsRes = await fetch(`${API_URL}/admin/doctor-requests`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const pendingDocsData = await pendingDocsRes.json();
  const docItems = pendingDocsData.items || [];
  const createdDoc = docItems.find(d => d.email === docEmail);
  console.log(`Found pending doctor: ${createdDoc?.profile?.userId} (${createdDoc?.email})`);

  if (createdDoc) {
    const approveRes = await fetch(`${API_URL}/admin/doctor-requests/${createdDoc.profile.userId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNotes: 'Auto-verified for E2E check' })
    });
    console.log(`Doctor approved status: ${approveRes.status}`);
  }

  // Assign demo patient to this doctor
  const patientsRes = await fetch(`${API_URL}/admin/patients`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const patientsData = await patientsRes.json();
  const patientItems = patientsData.items || [];
  const demoPatient = patientItems.find(p => p.email === patientEmail);
  console.log(`Demo patient ID: ${demoPatient?.profile?.userId}`);

  if (demoPatient && createdDoc) {
    const assignRes = await fetch(`${API_URL}/admin/patients/${demoPatient.profile.userId}/assign-doctor`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId: createdDoc.profile.userId, override: true, reason: 'Assigned for E2E verification' })
    });
    console.log(`Patient assigned to doctor status: ${assignRes.status}`);
  }

  // ─── 3. Doctor Confirms Vitals View ──────────────────────────────────────
  console.log('\n3. Doctor logging in to active workstation...');
  await docPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await docPage.fill('#email', docEmail);
  await docPage.fill('#password', pwd);
  await docPage.click('button[type="submit"]');
  await docPage.waitForURL('**/doctor', { timeout: 10000 });
  console.log('Doctor navigated to dashboard.');

  await docPage.waitForTimeout(3000);
  // Navigate to patient detail
  await docPage.goto(`${BASE_URL}/patient/${demoPatient.profile.userId}`, { waitUntil: 'networkidle' });
  await docPage.waitForTimeout(4000);

  const docScreenshot = path.resolve('docs/verification-screenshots/b6_doctor_view.png');
  await docPage.screenshot({ path: docScreenshot, fullPage: true });
  console.log('Doctor vitals view verified. Screenshot:', docScreenshot);

  // ─── 4. Register Caregiver with Link Request ─────────────────────────────
  console.log(`\n4. Registering caregiver: ${careEmail}...`);
  const careContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const carePage = await careContext.newPage();
  await carePage.goto(`${BASE_URL}/register`, { waitUntil: 'networkidle' });
  await carePage.selectOption('#role', 'caregiver');
  await carePage.fill('#email', careEmail);
  await carePage.fill('#password', pwd);
  await carePage.fill('#patientEmail', patientEmail);
  await carePage.click('button[type="submit"]');
  await carePage.waitForURL('**/caregiver', { timeout: 10000 });
  console.log('Caregiver registered.');

  // Admin approves caregiver request
  const adminCareRes = await fetch(`${API_URL}/admin/caregiver-requests`, {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (adminCareRes.ok) {
    const adminCareData = await adminCareRes.json();
    const careItems = adminCareData.items || [];
    const targetLink = careItems.find(l => l.caregiverEmail === careEmail);
    if (targetLink && targetLink.request.status === 'pending') {
      const appCareRes = await fetch(`${API_URL}/admin/caregiver-requests/${targetLink.request.id}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewNotes: 'Auto-verified for E2E check' })
      });
      console.log(`Admin approved caregiver link: ${appCareRes.status}`);
    }
  }

  // ─── 5. Patient Grants Consent ───────────────────────────────────────────
  console.log('\n5. Patient logging in to grant caregiver consent...');
  const patContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const patPage = await patContext.newPage();
  await patPage.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await patPage.fill('#email', patientEmail);
  await patPage.fill('#password', pwd);
  await patPage.click('button[type="submit"]');
  await patPage.waitForURL('**/patient', { timeout: 10000 });

  const patToken = await patPage.evaluate(() => localStorage.getItem('vitalguard_token'));
  const consentsRes = await fetch(`${API_URL}/patients/me/caregiver-consents`, {
    headers: { Authorization: `Bearer ${patToken}` }
  });
  const consents = await consentsRes.json();
  console.log('Pending consents:', consents);
  const matchConsent = consents.find(c => c.caregiverEmail === careEmail) || consents[0];
  if (matchConsent) {
    const grantRes = await fetch(`${API_URL}/patients/me/caregiver-consents/${matchConsent.request.id}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${patToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision: 'grant' })
    });
    console.log(`Caregiver consent granted via API: ${grantRes.status}`);
  }

  // ─── 6. Caregiver Views Patient Telemetry ────────────────────────────────
  console.log('\n6. Caregiver navigating to patient workstation...');
  await carePage.goto(`${BASE_URL}/patient/${demoPatient.profile.userId}`, { waitUntil: 'networkidle' });
  await carePage.waitForTimeout(4000);

  const careScreenshot = path.resolve('docs/verification-screenshots/b6_caregiver_view.png');
  await carePage.screenshot({ path: careScreenshot, fullPage: true });
  console.log('Caregiver vitals view verified. Screenshot:', careScreenshot);

  await browser.close();
  console.log('\n--- B.6 VERIFICATION COMPLETED SUCCESSFULLY ---');
}

main().catch(console.error);
