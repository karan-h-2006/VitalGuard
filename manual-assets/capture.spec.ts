import { test, expect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const output = resolve(
  fileURLToPath(new URL('./screenshots/', import.meta.url)),
);

const ids = {
  patient: '7a5a6c41-9683-4c27-86f1-583590afb201',
  patientUnassigned: 'f7839043-c038-43b8-a1f4-3be34561f038',
  doctor: '8bb9e6d4-5c38-4fa1-a047-39df020afb17',
  doctorCasey: '3239a4a8-c272-4c06-94ca-05267f033e30',
  caregiver: '22ed3eb4-f559-4e02-9c79-1066c1f74afe',
  institution: 'ca53f497-ffba-4c49-832e-263995a19f53',
  device: '00000000-0000-4000-8000-000000000002',
};

const email = {
  patient: 'patient.avery@example.test',
  patientUnassigned: 'patient.morgan@example.test',
  doctor: 'doctor.jordan@example.test',
  doctorCasey: 'doctor.casey@example.test',
  caregiver: 'caregiver.riley@example.test',
  admin: 'admin.taylor@example.test',
};

const now = new Date().toISOString();

const org = {
  id: ids.institution,
  name: 'Northstar Community Clinic',
  type: 'clinic',
  city: 'Sampleton',
  status: 'active',
};

const doctorJordan = {
  profile: {
    userId: ids.doctor,
    status: 'approved',
    specialization: 'Cardiology',
    medicalLicenseNo: 'DEMO-LIC-2048',
    rejectionReason: null,
    institutionId: ids.institution,
  },
  email: email.doctor,
  institutionName: org.name,
  institutionStatus: 'active',
  patientCount: 1,
};

const triage = [
  {
    patientId: ids.patient,
    patientEmail: email.patient,
    status: {
      severityTier: 'Critical',
      explanation:
        'Heart rate is above the configured threshold. Contact the care team.',
      latestVitals: {
        heart_rate: { value: 128, timestamp: now },
        spo2: { value: 91, timestamp: now },
        temperature: { value: 37.8, timestamp: now },
        motion: { value: 0.4, timestamp: now },
      },
      timestamp: now,
    },
    openAlertCount: 2,
    lastReadingAt: now,
  },
  {
    patientId: ids.patientUnassigned,
    patientEmail: email.patientUnassigned,
    status: {
      severityTier: 'Normal',
      explanation: null,
      latestVitals: {},
      timestamp: now,
    },
    openAlertCount: 0,
    lastReadingAt: null,
  },
];

const audit = [
  {
    id: 'd2bff154-9bdb-44ab-8c37-3f9f6b606c45',
    createdAt: now,
    action: 'patient.assign_doctor',
    actorId: '9f2b01cc-e16f-4d10-97db-99c328613cdf',
    actorEmail: email.admin,
    actorRole: 'administrator',
    targetId: ids.patient,
    targetLabel: 'patient: ' + email.patient,
    before: { doctorId: null },
    after: { doctorId: ids.doctor },
    reason: null,
  },
  {
    id: 'e3cf0265-aced-55bc-9d48-4e0f7c717d56',
    createdAt: now,
    action: 'device.update_scenario',
    actorId: '9f2b01cc-e16f-4d10-97db-99c328613cdf',
    actorEmail: email.admin,
    actorRole: 'administrator',
    targetId: ids.device,
    targetLabel: 'device: ' + ids.device.slice(0, 8),
    before: { scenario: 'normal' },
    after: { scenario: 'deteriorating' },
    reason: null,
  },
];

test.use({
  baseURL: 'http://127.0.0.1:5173',
  browserName: 'chromium',
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  colorScheme: 'light',
  launchOptions: {
    executablePath:
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  },
});

function response(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

async function capture(page: Page, name: string, element: Locator) {
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch {
    // Polling or background requests should not stall screenshot capture
  }
  await expect(element).toBeVisible();
  await expect(page.locator('footer')).toBeVisible();
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        caret-color: transparent !important;
      }
      vite-error-overlay, [data-vite-dev-overlay] {
        display: none !important;
      }
    `,
  });
  await element.scrollIntoViewIfNeeded();
  await element.evaluate((el) => {
    (el as HTMLElement).style.outline = '2px solid #e53935';
    (el as HTMLElement).style.outlineOffset = '2px';
  });
  await page.screenshot({ path: join(output, name + '.png'), fullPage: true });
  await element.evaluate((el) => {
    (el as HTMLElement).style.outline = '';
    (el as HTMLElement).style.outlineOffset = '';
  });
}

async function signIn(page: Page, userEmail: string, role: string) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.locator('input#email').fill(userEmail);
  await page.locator('input#password').fill('DemoOnly!2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/' + role);
  try {
    await page.waitForLoadState('networkidle', { timeout: 3000 });
  } catch {
    // Ignore timeout
  }
}

test('capture fresh VitalGuard user manual assets', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    class MockWebSocket extends EventTarget {
      readyState = 1;
      url = '';
      constructor(url: string) {
        super();
        this.url = url;
        setTimeout(() => {
          this.dispatchEvent(new Event('open'));
        }, 5);
      }
      send() {}
      close() {
        this.readyState = 3;
        this.dispatchEvent(new Event('close'));
      }
    }
    // @ts-expect-error mock WS
    window.WebSocket = MockWebSocket;
  });

  let activeRole = 'patient';
  let patientAssignmentStatus = 'unassigned';
  let caregiverHasPatients = false;
  let caregiverRequestSubmitted = false;
  let doctorApplicationStatus = 'approved';
  let doctorApproved = false;
  let caregiverLinkApproved = false;
  let institutionCreated = false;
  let patientScenario = 'deteriorating';
  let requirePasswordChange = false;

  let noticeItems = [
    {
      id: '8d7fd94b-ef5c-4520-8fce-59880164b56c',
      title: 'Patient assigned to your care',
      body: 'Avery Chen now appears on your triage workstation.',
      createdAt: now,
    },
  ];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();

    if (path === '/api/auth/login') {
      const submitted = request.postDataJSON() as {
        email: string;
        password?: string;
      };
      if (submitted.email === 'invalid@example.test') {
        return route.fulfill(
          response({ message: 'Invalid email or password.' }, 401),
        );
      }

      const role = submitted.email.includes('admin')
        ? 'administrator'
        : submitted.email.includes('doctor')
          ? 'doctor'
          : submitted.email.includes('caregiver')
            ? 'caregiver'
            : 'patient';

      activeRole = role;

      doctorApplicationStatus = submitted.email.includes('pending')
        ? 'pending'
        : 'approved';

      const mustChange = submitted.email.includes('password-change');
      requirePasswordChange = mustChange;

      const payload = Buffer.from(
        JSON.stringify({
          sub: role === 'patient' ? ids.patient : 'demo-' + role,
          role,
          exp: 4102444800,
        }),
      ).toString('base64');

      return route.fulfill(
        response({
          token: 'demo.' + payload + '.only',
          user: {
            userId: role === 'patient' ? ids.patient : 'demo-' + role,
            email: submitted.email,
            role,
          },
          mustChangePassword: mustChange,
        }),
      );
    }

    if (path === '/api/auth/me') {
      return route.fulfill(
        response({ mustChangePassword: requirePasswordChange }),
      );
    }

    if (path === '/api/auth/logout') {
      return route.fulfill(response({ ok: true }));
    }

    if (path === '/api/auth/change-password') {
      const body = request.postDataJSON() as { currentPassword?: string };
      if (body.currentPassword === 'WrongCurrentPassword!2026') {
        return route.fulfill(
          response(
            { message: 'The current password provided is incorrect.' },
            400,
          ),
        );
      }
      return route.fulfill(
        response({
          message: 'Password updated. Sign in again with your new password.',
        }),
      );
    }

    if (path === '/api/doctors/me/application') {
      return route.fulfill(
        response({
          status: doctorApplicationStatus,
          rejectionReason: null,
          reapplicationCount: 0,
          mayReapply: false,
        }),
      );
    }

    if (path === '/api/institutions') {
      const baseOrgs = [org];
      if (institutionCreated) {
        baseOrgs.push({
          id: 'e45f9021-99cc-4e89-bd71-859a22f98012',
          name: 'Eastside Sample Hospital',
          type: 'hospital',
          city: 'Sampleton',
          status: 'active',
        });
      }
      return route.fulfill(
        response(
          path.endsWith('/institutions')
            ? baseOrgs
            : { items: baseOrgs, total: baseOrgs.length },
        ),
      );
    }

    if (path === '/api/notifications' && method === 'GET') {
      return route.fulfill(response(noticeItems));
    }

    if (path === '/api/notifications/read-all') {
      noticeItems = [];
      return route.fulfill(response({ ok: true }));
    }

    if (path.includes('/api/notifications/') && path.endsWith('/read')) {
      noticeItems = noticeItems.filter((item) => !path.includes(item.id));
      return route.fulfill(response({ ok: true }));
    }

    if (path === '/api/patients/me/profile') {
      return route.fulfill(
        response({
          userId: ids.patient,
          assignmentStatus: patientAssignmentStatus,
          preferredInstitutionId: ids.institution,
        }),
      );
    }

    if (path === '/api/patients/me/access') {
      return route.fulfill(
        response([
          {
            caregiverId: ids.caregiver,
            email: email.caregiver,
          },
        ]),
      );
    }

    if (path === '/api/patients/me/caregiver-consents') {
      return route.fulfill(
        response([
          {
            request: {
              id: '1df1ba5f-b481-4c79-9d02-019195f5b382',
              relationshipNote: 'Family caregiver providing daily support',
            },
            caregiverEmail: email.caregiver,
          },
        ]),
      );
    }

    if (path.includes('/api/patients/me/caregiver-consents/')) {
      return route.fulfill(response({ ok: true }));
    }

    if (path.includes('/api/patients/me/caregivers/')) {
      return route.fulfill({ status: 204, body: '' });
    }

    if (path === '/api/patients') {
      if (activeRole === 'caregiver' && !caregiverHasPatients) {
        return route.fulfill(response([]));
      }
      return route.fulfill(response(triage));
    }

    if (path === '/api/caregiver/link-requests' && method === 'GET') {
      if (!caregiverRequestSubmitted) {
        return route.fulfill(response([]));
      }
      return route.fulfill(
        response([
          {
            id: 'request-demo-123',
            status: 'pending',
            patientConsent: 'pending',
            createdAt: now,
          },
        ]),
      );
    }

    if (path === '/api/caregiver/link-requests' && method === 'POST') {
      caregiverRequestSubmitted = true;
      return route.fulfill(
        response({ id: 'request-demo-123', status: 'pending' }, 201),
      );
    }

    if (path.endsWith('/vitals/latest')) {
      return route.fulfill(
        response({
          status: {
            severityTier: 'Critical',
            explanation:
              'Heart rate is above the configured threshold. Contact the care team.',
            timestamp: now,
            latestVitals: {
              heart_rate: { value: 128, timestamp: now },
              spo2: { value: 91, timestamp: now },
              temperature: { value: 37.8, timestamp: now },
              motion: { value: 0.4, timestamp: now },
            },
          },
          device: {
            id: ids.device,
            isSimulated: true,
            registrationStatus: 'registered',
            simScenario: patientScenario,
          },
        }),
      );
    }

    if (path.endsWith('/device')) {
      return route.fulfill(
        response({
          id: ids.device,
          isSimulated: true,
          registrationStatus: 'registered',
          simScenario: patientScenario,
        }),
      );
    }

    if (path.endsWith('/vitals/history')) {
      return route.fulfill(
        response({
          points: Array.from({ length: 12 }, (_, i) => ({
            timestamp: new Date(Date.now() - (11 - i) * 3600000).toISOString(),
            value: 85 + i * 3 + (i % 3) * 4,
          })),
        }),
      );
    }

    if (path.endsWith('/reports') && method === 'POST') {
      return route.fulfill(response({ id: 'report-demo-weekly' }, 201));
    }

    if (path.endsWith('/reports')) {
      return route.fulfill(
        response([{ id: 'report-demo-weekly', createdAt: now }]),
      );
    }

    if (path.includes('/reports/') && path.endsWith('/download')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-1.4 demo weekly report',
      });
    }

    if (path === '/api/admin/overview') {
      return route.fulfill(
        response({
          pendingDoctors: doctorApproved ? 0 : 1,
          unassignedPatients: 1,
          pendingCaregiverRequests: caregiverLinkApproved ? 0 : 1,
          activeInstitutions: institutionCreated ? 2 : 1,
          recentActivity: [
            {
              id: 'activity-demo-1',
              action: 'patient.assign_doctor',
              createdAt: now,
            },
            {
              id: 'activity-demo-2',
              action: 'device.update_scenario',
              createdAt: now,
            },
          ],
        }),
      );
    }

    if (path === '/api/admin/doctor-requests') {
      return route.fulfill(
        response({
          items: doctorApproved
            ? []
            : [
                {
                  profile: {
                    userId: ids.doctorCasey,
                    status: 'pending',
                    specialization: 'Internal Medicine',
                    medicalLicenseNo: 'DEMO-LIC-9099',
                    rejectionReason: null,
                    institutionId: ids.institution,
                  },
                  email: email.doctorCasey,
                  institutionName: org.name,
                  institutionStatus: 'active',
                  patientCount: 0,
                },
              ],
          total: doctorApproved ? 0 : 1,
        }),
      );
    }

    if (path.includes('/approve')) {
      if (path.includes('/doctors/')) doctorApproved = true;
      if (path.includes('/caregiver-requests/')) caregiverLinkApproved = true;
      return route.fulfill(response({ ok: true }));
    }

    if (
      path === '/api/admin/institutions' ||
      path.startsWith('/api/admin/institutions?')
    ) {
      const items = [org];
      if (institutionCreated) {
        items.push({
          id: 'e45f9021-99cc-4e89-bd71-859a22f98012',
          name: 'Eastside Sample Hospital',
          type: 'hospital',
          city: 'Sampleton',
          status: 'active',
        });
      }
      return route.fulfill(response({ items, total: items.length }));
    }

    if (
      path === '/api/admin/doctors' ||
      path.startsWith('/api/admin/doctors?')
    ) {
      return route.fulfill(response({ items: [doctorJordan], total: 1 }));
    }

    if (path.startsWith('/api/admin/patients')) {
      return route.fulfill(
        response({
          items: [
            {
              profile: {
                userId: ids.patient,
                assignmentStatus: 'assigned',
                preferredInstitutionId: ids.institution,
              },
              email: email.patient,
              doctorIds: [ids.doctor],
              doctors: [
                { doctorId: ids.doctor, email: email.doctor, isPrimary: true },
              ],
              device: {
                id: ids.device,
                isSimulated: true,
                registrationStatus: 'registered',
                simScenario: patientScenario,
              },
            },
            {
              profile: {
                userId: ids.patientUnassigned,
                assignmentStatus: 'unassigned',
                preferredInstitutionId: null,
              },
              email: email.patientUnassigned,
              doctorIds: [],
              doctors: [],
              device: null,
            },
          ],
          total: 2,
        }),
      );
    }

    if (path.startsWith('/api/admin/devices/')) {
      const payload = request.postDataJSON() as { scenario?: string };
      if (payload?.scenario) {
        patientScenario = payload.scenario;
      }
      return route.fulfill(response({ ok: true }));
    }

    if (path.startsWith('/api/admin/caregiver-requests')) {
      return route.fulfill(
        response({
          items: caregiverLinkApproved
            ? []
            : [
                {
                  request: {
                    id: '1df1ba5f-b481-4c79-9d02-019195f5b382',
                    caregiverId: ids.caregiver,
                    requestedPatientEmail: email.patient,
                    status: 'pending',
                    patientConsent: 'pending',
                  },
                  caregiverEmail: email.caregiver,
                },
              ],
          total: caregiverLinkApproved ? 0 : 1,
        }),
      );
    }

    if (path.startsWith('/api/admin/users')) {
      return route.fulfill(
        response({
          items: [
            {
              id: ids.patient,
              email: email.patient,
              role: 'patient',
              createdAt: now,
              isSuspended: false,
            },
            {
              id: ids.caregiver,
              email: email.caregiver,
              role: 'caregiver',
              createdAt: now,
              isSuspended: false,
            },
          ],
          total: 2,
        }),
      );
    }

    if (path.startsWith('/api/admin/audit-log')) {
      return route.fulfill(response({ items: audit, total: audit.length }));
    }

    if (method === 'PATCH' || method === 'POST' || method === 'DELETE') {
      return route.fulfill(response({ ok: true }));
    }

    return route.fulfill(response([]));
  });

  // ==========================================
  // SECTION 1: ACCESS, LANDING & REGISTRATION
  // ==========================================

  // 01. Public Landing Page
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await capture(
    page,
    '01_landing_page',
    page.getByRole('link', { name: 'Sign in' }).first(),
  );

  // 02. Empty Sign In Form
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await capture(page, '02_login_empty', page.locator('input#email'));

  // 03. Filled Sign In Form
  await page.locator('input#email').fill(email.patient);
  await page.locator('input#password').fill('DemoOnly!2026');
  await capture(
    page,
    '03_login_filled',
    page.getByRole('button', { name: 'Sign in' }),
  );

  // 04. Sign In Validation Error State
  await page.locator('input#email').fill('invalid@example.test');
  await page.locator('input#password').fill('WrongPassword!2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await capture(page, '04_login_validation_error', page.getByRole('alert'));

  // 05. Default Empty Registration Form
  await page.goto('/register', { waitUntil: 'domcontentloaded' });
  await capture(
    page,
    '05_registration_empty',
    page.getByRole('button', { name: 'Create account' }),
  );

  // 06. Filled Doctor Registration Form
  await page.locator('select#role').selectOption('doctor');
  await page.locator('input#email').fill(email.doctorCasey);
  await page.locator('input#password').fill('DemoOnly!2026');
  await page.locator('select#institution').selectOption(ids.institution);
  await page.locator('input#license').fill('DEMO-LIC-9099');
  await page.locator('input#specialization').fill('Internal Medicine');
  await capture(
    page,
    '06_registration_doctor_filled',
    page.getByRole('button', { name: 'Create account' }),
  );

  // 07. Doctor Pending Review Station
  await signIn(page, 'doctor.pending@example.test', 'doctor/pending');
  await capture(
    page,
    '07_doctor_application_locked',
    page.getByText(/pending review/i).first(),
  );
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  // ==========================================
  // SECTION 2: PATIENT WORKSTATION & PRIVACY
  // ==========================================

  // 08. Patient Dashboard: Awaiting Physician Assignment
  patientAssignmentStatus = 'unassigned';
  await signIn(page, email.patient, 'patient');
  await capture(
    page,
    '08_patient_dashboard_unassigned',
    page.getByText('Awaiting Physician Assignment'),
  );

  // 09. Patient Dashboard: Live Telemetry & Critical Status Note
  patientAssignmentStatus = 'assigned';
  await page.reload({ waitUntil: 'domcontentloaded' });
  await capture(
    page,
    '09_patient_dashboard_vitals_critical',
    page.getByText('Critical Tier'),
  );

  // 10. Patient History & Trends Range Filter (7d)
  await page.getByRole('button', { name: '7d' }).click();
  await capture(
    page,
    '10_patient_history_range_filter',
    page.getByRole('button', { name: '7d' }),
  );

  // 11. Patient Access: Pending Caregiver Consent Request
  await page.getByRole('link', { name: 'Who can see my data?' }).click();
  await capture(
    page,
    '11_patient_access_consent_pending',
    page.getByRole('button', { name: 'Grant access' }),
  );

  // 12. Patient Access: Grant Consent Success
  await page.getByRole('button', { name: 'Grant access' }).click();
  await expect(page.getByText('Caregiver access granted.')).toBeVisible();
  await capture(
    page,
    '12_patient_access_granted_success',
    page.getByText('Caregiver access granted.'),
  );

  // 13. Patient Access: Revoke Caregiver Access
  await page.getByRole('button', { name: 'Revoke access' }).click();
  await expect(page.getByText('Caregiver access revoked.')).toBeVisible();
  await capture(
    page,
    '13_patient_access_revoked',
    page.getByText('Caregiver access revoked.'),
  );

  // 14. Global Notifications: Unread Items
  await page.getByRole('button', { name: /Notifications/ }).click();
  await capture(
    page,
    '14_notifications_unread_panel',
    page.getByRole('button', { name: /Patient assigned/ }),
  );

  // 15. Global Notifications: Caught Up Empty State
  await page.getByRole('button', { name: /Patient assigned/ }).click();
  await capture(
    page,
    '15_notifications_caught_up_empty',
    page.getByText("You're all caught up."),
  );

  // 16. Sign Out Transition
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await capture(
    page,
    '16_logout_redirect_login',
    page.getByRole('button', { name: 'Sign in' }),
  );

  // ==========================================
  // SECTION 3: DOCTOR CLINICAL TRIAGE
  // ==========================================

  // 17. Doctor Triage Workstation: Patient Roster
  await signIn(page, email.doctor, 'doctor');
  await capture(
    page,
    '17_doctor_triage_roster',
    page.getByRole('cell', { name: email.patient }),
  );

  // 18. Doctor Inspection: Patient Detail View & Trend Chart
  await page.getByRole('row').filter({ hasText: email.patient }).click();
  await capture(
    page,
    '18_doctor_patient_detail_view',
    page.getByText('History & Trends'),
  );

  // 19. Doctor Report: Generate Weekly PDF Report
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Weekly Report' }).click();
  await downloadPromise;
  await capture(
    page,
    '19_doctor_weekly_report_download',
    page.getByRole('button', { name: 'Generate Weekly Report' }),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  // ==========================================
  // SECTION 4: CAREGIVER WORKSTATION
  // ==========================================

  // 20. Caregiver Request: Empty Access Form
  caregiverHasPatients = false;
  caregiverRequestSubmitted = false;
  await signIn(page, email.caregiver, 'caregiver');
  await capture(
    page,
    '20_caregiver_request_empty',
    page.getByRole('button', { name: 'Request link' }),
  );

  // 21. Caregiver Request: Filled Form
  await page.locator('input#patientEmail').fill(email.patient);
  await page
    .locator('textarea#relationshipNote')
    .fill('Primary family caregiver managing post-op monitoring.');
  await capture(
    page,
    '21_caregiver_request_filled',
    page.getByRole('button', { name: 'Request link' }),
  );

  // 22. Caregiver Request: Submitted Confirmation
  await page.getByRole('button', { name: 'Request link' }).click();
  await expect(
    page.getByText('Request submitted for administrator review.'),
  ).toBeVisible();
  await capture(
    page,
    '22_caregiver_request_submitted',
    page.getByText('Request submitted for administrator review.'),
  );

  // 23. Caregiver Dashboard: Active Triage View with Consented Patients
  caregiverHasPatients = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await capture(
    page,
    '23_caregiver_triage_roster',
    page.getByRole('cell', { name: email.patient }),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  // ==========================================
  // SECTION 5: ADMINISTRATOR GOVERNANCE CONSOLE
  // ==========================================

  // 24. Admin Overview Tab
  await signIn(page, email.admin, 'administrator');
  await capture(
    page,
    '24_admin_overview',
    page.getByRole('heading', { name: 'Overview' }),
  );

  // 25. Admin Doctor Requests Tab: Pending Application
  await page.getByRole('button', { name: 'Doctor requests' }).click();
  await capture(
    page,
    '25_admin_doctor_requests_pending',
    page.getByRole('button', { name: 'Approve' }),
  );

  // 26. Admin Doctor Requests Tab: Approved Feedback
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await capture(
    page,
    '26_admin_doctor_request_approved',
    page.getByText('Saved.'),
  );

  // 27. Admin Institutions Tab: Create Institution Filled
  await page.getByRole('button', { name: 'Institutions' }).click();
  await page.getByLabel('Institution name').fill('Eastside Sample Hospital');
  await page.getByLabel('City').fill('Sampleton');
  await capture(
    page,
    '27_admin_institutions_form_filled',
    page.getByRole('button', { name: 'Create' }),
  );

  // 28. Admin Institutions Tab: Created Success Feedback
  institutionCreated = true;
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await capture(page, '28_admin_institution_created', page.getByText('Saved.'));

  // 29. Admin Doctors Tab: Filter & Search
  await page.getByRole('button', { name: 'Doctors' }).click();
  await capture(
    page,
    '29_admin_doctors_filter_search',
    page.getByLabel('Doctor status'),
  );

  // 30. Admin Patients Tab: Roster & Assignment Filter
  await page.getByRole('button', { name: 'Patients' }).click();
  await capture(
    page,
    '30_admin_patients_all',
    page.getByRole('combobox', { name: 'Patient assignment' }),
  );

  // 31. Admin Patients Tab: Physician Transfer Selected
  await page.getByLabel('Doctor for ' + email.patient).selectOption(ids.doctor);
  await capture(
    page,
    '31_admin_patient_transfer_selected',
    page.getByRole('button', { name: 'Transfer' }),
  );

  // 32. Admin Patients Tab: Device Telemetry & Scenario Selector Control
  await page
    .getByLabel('Scenario for ' + email.patient)
    .selectOption('deteriorating');
  await capture(
    page,
    '32_admin_patient_scenario_control',
    page.getByLabel('Scenario for ' + email.patient),
  );

  // 33. Admin Caregiver Links Tab: Pending Link Review
  await page.getByRole('button', { name: 'Caregiver links' }).click();
  await capture(
    page,
    '33_admin_caregiver_links_review',
    page.getByRole('button', { name: 'Approve' }),
  );

  // 34. Admin Caregiver Links Tab: Link Approved
  await page.getByRole('button', { name: 'Approve' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await capture(
    page,
    '34_admin_caregiver_link_approved',
    page.getByText('Saved.'),
  );

  // 35. Admin Users Tab: Account Governance
  await page.getByRole('button', { name: 'Users' }).click();
  await capture(
    page,
    '35_admin_users_table',
    page.getByRole('cell', { name: email.patient }).first(),
  );

  // 36. Admin Audit Log Tab: Filtered Entries
  await page.getByRole('button', { name: 'Audit log' }).click();
  await page.getByLabel('Filter actor email or UUID').fill(email.admin);
  await page.getByLabel('Filter action').fill('patient.assign_doctor');
  await page.getByLabel('Audit from date').fill('2026-01-01');
  await capture(
    page,
    '36_admin_audit_log_filtered',
    page.getByText('Assigned doctor').first(),
  );

  // 37. Admin Audit Log Tab: Expanded State Diff Details
  await page.getByText('Details').first().click();
  await capture(
    page,
    '37_admin_audit_log_details',
    page.locator('details').first(),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');

  // ==========================================
  // SECTION 6: PASSWORD SETTINGS & FINAL LOGOUT
  // ==========================================

  // 38. Change Password: Empty Form
  await signIn(page, 'patient.password-change@example.test', 'change-password');
  await capture(
    page,
    '38_change_password_empty',
    page.getByRole('button', { name: 'Update password' }),
  );

  // 39. Change Password: Valid Filled Form
  await page.locator('input#currentPassword').fill('OldDemoPassword!2026');
  await page.locator('input#newPassword').fill('NewSecurePassword!2026');
  await capture(
    page,
    '39_change_password_filled',
    page.getByRole('button', { name: 'Update password' }),
  );

  // 40. Change Password: Error Banner
  await page.locator('input#currentPassword').fill('WrongCurrentPassword!2026');
  await page.getByRole('button', { name: 'Update password' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await capture(page, '40_change_password_error', page.getByRole('alert'));

  // 41. Final Signed Out State
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await capture(
    page,
    '41_final_signed_out',
    page.getByRole('button', { name: 'Sign in' }),
  );
});
