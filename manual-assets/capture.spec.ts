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
  doctor: '8bb9e6d4-5c38-4fa1-a047-39df020afb17',
  institution: 'ca53f497-ffba-4c49-832e-263995a19f53',
};
const email = {
  patient: 'patient.avery@example.test',
  doctor: 'doctor.jordan@example.test',
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
const doctor = {
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
const patient = {
  profile: {
    userId: ids.patient,
    assignmentStatus: 'assigned',
    preferredInstitutionId: ids.institution,
  },
  email: email.patient,
  doctorIds: [ids.doctor],
  doctors: [{ doctorId: ids.doctor, email: email.doctor, isPrimary: true }],
};
const triage = [
  {
    patientId: ids.patient,
    patientEmail: email.patient,
    status: { severityTier: 'Critical' },
    openAlertCount: 2,
    lastReadingAt: now,
  },
  {
    patientId: 'f7839043-c038-43b8-a1f4-3be34561f038',
    patientEmail: 'patient.morgan@example.test',
    status: { severityTier: 'Normal' },
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
  await page.waitForLoadState('networkidle');
  await expect(page.locator('footer')).toBeVisible();
  await page.addStyleTag({
    content:
      '*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}',
  });
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
  await page.getByPlaceholder('Email address').fill(userEmail);
  await page.getByPlaceholder('Password').fill('DemoOnly!2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('**/' + role);
  await page.waitForLoadState('networkidle');
}

test('capture combined VitalGuard user manual flow', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir(output, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  let pendingRequest = true;
  let activeRole = 'patient';
  let doctorApplicationStatus = 'approved';
  let requirePasswordChange = false;
  let noticeItems = [
    {
      id: '8d7fd94b-ef5c-4520-8fce-59880164b56c',
      title: 'Patient assigned to your care',
      body: 'Avery Chen now appears on your triage list.',
      createdAt: now,
    },
  ];
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (path === '/api/auth/login') {
      const submitted = request.postDataJSON() as { email: string };
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
      requirePasswordChange = submitted.email.includes('password-change');
      const payload = btoa(
        JSON.stringify({
          sub: role === 'patient' ? ids.patient : 'demo-' + role,
          role,
          exp: 4102444800,
        }),
      ).replace(/=/g, '');
      return route.fulfill(response({ token: 'demo.' + payload + '.only' }));
    }
    if (path === '/api/auth/me')
      return route.fulfill(
        response({ mustChangePassword: requirePasswordChange }),
      );
    if (path === '/api/auth/logout')
      return route.fulfill(response({ ok: true }));
    if (path === '/api/auth/change-password') {
      return route.fulfill(
        response({ message: 'The current password is incorrect.' }, 400),
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
      return route.fulfill(
        response(
          path.endsWith('/institutions') ? [org] : { items: [org], total: 1 },
        ),
      );
    }
    if (path === '/api/notifications' && method === 'GET')
      return route.fulfill(response(noticeItems));
    if (path === '/api/notifications/read-all') {
      noticeItems = [];
      return route.fulfill(response({ ok: true }));
    }
    if (path.includes('/api/notifications/') && path.endsWith('/read')) {
      noticeItems = noticeItems.filter((item) => !path.includes(item.id));
      return route.fulfill(response({ ok: true }));
    }
    if (path === '/api/patients/me/profile') {
      return route.fulfill(response({ assignmentStatus: 'assigned' }));
    }
    if (path === '/api/patients/me/access') {
      return route.fulfill(
        response([
          {
            caregiverId: '22ed3eb4-f559-4e02-9c79-1066c1f74afe',
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
              relationshipNote: 'Family caregiver',
            },
            caregiverEmail: email.caregiver,
          },
        ]),
      );
    }
    if (path.includes('/api/patients/me/caregiver-consents/'))
      return route.fulfill(response({ ok: true }));
    if (path.includes('/api/patients/me/caregivers/'))
      return route.fulfill({ status: 204, body: '' });
    if (path === '/api/patients') {
      return route.fulfill(response(activeRole === 'caregiver' ? [] : triage));
    }
    if (path === '/api/caregiver/link-requests' && method === 'GET')
      return route.fulfill(response([]));
    if (path === '/api/caregiver/link-requests')
      return route.fulfill(
        response({ id: 'request-demo', status: 'pending' }, 201),
      );
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
    if (path.endsWith('/reports') && method === 'POST')
      return route.fulfill(response({ id: 'report-demo' }, 201));
    if (path.endsWith('/reports'))
      return route.fulfill(response([{ id: 'report-demo', createdAt: now }]));
    if (path.includes('/reports/') && path.endsWith('/download')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/pdf',
        body: '%PDF-demo',
      });
    }
    if (path === '/api/admin/overview') {
      return route.fulfill(
        response({
          pendingDoctors: pendingRequest ? 1 : 0,
          unassignedPatients: 1,
          pendingCaregiverRequests: 1,
          activeInstitutions: 1,
          recentActivity: [
            {
              id: 'activity-demo',
              action: 'patient.assign_doctor',
              createdAt: now,
            },
          ],
        }),
      );
    }
    if (path === '/api/admin/doctor-requests') {
      return route.fulfill(
        response({
          items: pendingRequest
            ? [
                {
                  ...doctor,
                  profile: {
                    ...doctor.profile,
                    userId: '3239a4a8-c272-4c06-94ca-05267f033e30',
                    status: 'pending',
                  },
                  email: 'doctor.casey@example.test',
                },
              ]
            : [],
          total: pendingRequest ? 1 : 0,
        }),
      );
    }
    if (
      path.includes('/approve') ||
      path.includes('/reinstate') ||
      path.includes('/assign-doctor') ||
      path.includes('/transfer') ||
      path.includes('/read') ||
      path.includes('/caregiver-requests/')
    ) {
      pendingRequest = false;
      return route.fulfill(response({ ok: true }));
    }
    if (
      path === '/api/admin/institutions' ||
      path.startsWith('/api/admin/institutions?')
    ) {
      return route.fulfill(response({ items: [org], total: 1 }));
    }
    if (
      path === '/api/admin/doctors' ||
      path.startsWith('/api/admin/doctors?')
    ) {
      return route.fulfill(response({ items: [doctor], total: 1 }));
    }
    if (path.startsWith('/api/admin/patients')) {
      return route.fulfill(
        response({
          items: [
            patient,
            {
              profile: {
                userId: triage[1].patientId,
                assignmentStatus: 'unassigned',
                preferredInstitutionId: null,
              },
              email: triage[1].patientEmail,
              doctorIds: [],
              doctors: [],
            },
          ],
          total: 2,
        }),
      );
    }
    if (path.startsWith('/api/admin/caregiver-requests')) {
      return route.fulfill(
        response({
          items: [
            {
              request: {
                id: '1df1ba5f-b481-4c79-9d02-019195f5b382',
                caregiverId: '22ed3eb4-f559-4e02-9c79-1066c1f74afe',
                requestedPatientEmail: email.patient,
                status: 'pending',
                patientConsent: 'pending',
              },
              caregiverEmail: email.caregiver,
            },
          ],
          total: 1,
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
          ],
          total: 1,
        }),
      );
    }
    if (path.startsWith('/api/admin/audit-log'))
      return route.fulfill(response({ items: audit, total: audit.length }));
    if (method === 'PATCH' || method === 'POST' || method === 'DELETE') {
      return route.fulfill(response({ ok: true }));
    }
    return route.fulfill(response([]));
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await capture(page, '01_login_empty', page.getByPlaceholder('Email address'));
  await page.getByPlaceholder('Email address').fill(email.patient);
  await page.getByPlaceholder('Password').fill('DemoOnly!2026');
  await capture(
    page,
    '02_login_filled',
    page.getByRole('button', { name: 'Sign in' }),
  );

  await page.goto('/register');
  await capture(
    page,
    '03_registration_empty',
    page.getByRole('button', { name: 'Create account' }),
  );
  await page.getByLabel('Account type').selectOption('doctor');
  await page.getByLabel('Email address').fill('doctor.new@example.test');
  await page.getByLabel('Password').fill('DemoOnly!2026');
  await page.getByLabel('Institution').selectOption(ids.institution);
  await page.getByLabel('Medical license number').fill('DEMO-LIC-3001');
  await page.getByLabel('Specialization').fill('Family medicine');
  await capture(
    page,
    '04_registration_doctor_filled',
    page.getByRole('button', { name: 'Create account' }),
  );

  await signIn(page, email.patient, 'patient');
  await capture(
    page,
    '05_patient_dashboard_vitals_alert',
    page.getByText('Critical', { exact: true }).first(),
  );
  await page.getByRole('link', { name: 'Who can see my data?' }).click();
  await capture(
    page,
    '06_patient_access_consent',
    page.getByRole('button', { name: 'Grant access' }),
  );
  await page.getByRole('button', { name: 'Deny' }).click();
  await capture(
    page,
    '07_patient_access_after_decision',
    page.getByText('Request denied.'),
  );
  await page.getByRole('button', { name: 'Revoke access' }).click();
  await capture(
    page,
    '08_patient_revoke_access',
    page.getByText('Caregiver access revoked.'),
  );

  await page.getByRole('button', { name: /Notifications/ }).click();
  await capture(
    page,
    '09_notifications_unread',
    page.getByRole('button', { name: /Patient assigned/ }),
  );
  await page.getByRole('button', { name: /Patient assigned/ }).click();
  await capture(
    page,
    '10_notifications_empty',
    page.getByText('You’re all caught up.'),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await capture(
    page,
    '11_logout_login',
    page.getByRole('button', { name: 'Sign in' }),
  );

  await signIn(page, email.doctor, 'doctor');
  await capture(
    page,
    '12_doctor_triage',
    page.getByRole('cell', { name: email.patient }),
  );
  await page.getByRole('row').filter({ hasText: email.patient }).click();
  await capture(
    page,
    '13_patient_detail_chart',
    page.getByText('History & Trends'),
  );
  await page.getByRole('button', { name: '7d' }).click();
  await capture(
    page,
    '14_patient_trend_filter',
    page.getByRole('button', { name: '7d' }),
  );
  const report = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Generate Weekly Report' }).click();
  await report;
  await capture(
    page,
    '15_weekly_report_generated',
    page.getByRole('button', { name: 'Generate Weekly Report' }),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await signIn(page, email.caregiver, 'caregiver');
  await capture(
    page,
    '16_caregiver_request_empty',
    page.getByRole('button', { name: 'Request link' }),
  );
  await page.getByLabel('Patient email').fill(email.patient);
  await page
    .getByLabel('Relationship note (optional)')
    .fill('Family caregiver');
  await capture(
    page,
    '17_caregiver_request_filled',
    page.getByRole('button', { name: 'Request link' }),
  );
  await page.getByRole('button', { name: 'Request link' }).click();
  await capture(
    page,
    '18_caregiver_request_submitted',
    page.getByText('Request submitted for administrator review.'),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await signIn(page, email.admin, 'administrator');
  await capture(
    page,
    '19_admin_overview',
    page.getByRole('heading', { name: 'Overview' }),
  );
  await page.getByRole('button', { name: 'Doctor requests' }).click();
  await capture(
    page,
    '20_doctor_request_pending',
    page.getByRole('button', { name: 'Approve' }),
  );
  await page.getByRole('button', { name: 'Approve' }).dblclick();
  await expect(page.getByText('Saved.')).toBeVisible();
  await capture(page, '21_doctor_request_approved', page.getByText('Saved.'));

  await page.getByRole('button', { name: 'Institutions' }).click();
  await page
    .getByPlaceholder('Institution name')
    .fill('Eastside Sample Hospital');
  await page.getByPlaceholder('City').fill('Sampleton');
  await capture(
    page,
    '22_institution_form_filled',
    page.getByRole('button', { name: 'Create' }),
  );
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await capture(page, '23_institution_created', page.getByText('Saved.'));

  await page.getByRole('button', { name: 'Patients' }).click();
  await capture(
    page,
    '24_admin_patients_all',
    page.getByRole('combobox', { name: 'Patient assignment' }),
  );
  await page.getByLabel('Patient assignment').selectOption('assigned');
  await capture(
    page,
    '25_admin_patients_assigned_filter',
    page.getByRole('combobox', { name: 'Patient assignment' }),
  );
  await page.getByLabel('Doctor for ' + email.patient).selectOption(ids.doctor);
  await capture(
    page,
    '26_patient_assignment_selected',
    page.getByRole('button', { name: 'Transfer' }),
  );

  await page.getByRole('button', { name: 'Caregiver links' }).click();
  await capture(
    page,
    '27_admin_caregiver_link_review',
    page.getByRole('button', { name: 'Approve' }),
  );
  await page.getByRole('button', { name: 'Approve' }).click();
  await capture(
    page,
    '28_admin_caregiver_link_approved',
    page.getByText('Saved.'),
  );

  await page.getByRole('button', { name: 'Audit log' }).click();
  await page.getByPlaceholder('Actor email or ID').fill(email.admin);
  await page.getByPlaceholder('Action').fill('patient.assign_doctor');
  await page.getByLabel('Audit from date').fill('2026-01-01');
  await capture(
    page,
    '29_admin_audit_filtered',
    page.getByText('Assigned doctor').first(),
  );
  await page.getByText('Details').first().click();
  await capture(
    page,
    '30_admin_audit_details',
    page.locator('details').first(),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await signIn(page, 'doctor.pending@example.test', 'doctor/pending');
  await capture(
    page,
    '31_doctor_application_locked',
    page.getByRole('heading', { name: 'pending review' }),
  );

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await signIn(page, 'patient.password-change@example.test', 'change-password');
  await capture(
    page,
    '32_change_password_empty',
    page.getByRole('button', { name: 'Update password' }),
  );
  await page.getByLabel('Current password').fill('OldDemoPassword!2026');
  await page.getByLabel('New password').fill('NewDemoPassword!2026');
  await capture(
    page,
    '33_change_password_filled',
    page.getByRole('button', { name: 'Update password' }),
  );
  await page.getByRole('button', { name: 'Update password' }).click();
  await capture(page, '34_change_password_error', page.getByRole('alert'));

  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.waitForURL('**/login');
  await capture(
    page,
    '35_final_signed_out',
    page.getByRole('button', { name: 'Sign in' }),
  );
});
