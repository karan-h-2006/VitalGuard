# @vitalguard/web

Single Page Application (SPA) for VitalGuard built with **React**, **Vite**, **TypeScript**, and **Tailwind CSS**. It provides a role-tailored clinical interface for patients, caregivers, physicians, and system administrators.

---

## Portals and Features

- **Public Landing & Authentication**:
  - Landing page detailing the VitalGuard clinical telemetry solution.
  - `/login`: Role-aware authentication with JWT token storage in `localStorage`.
  - `/register`: Self-registration for patients, caregivers, and doctors (with medical license and institution selection).
  - `/change-password`: Mandatory first-login password update for bootstrapped administrators.
- **Patient Dashboard (`/patient`)**:
  - Real-time telemetry cards with live severity badges (Normal, Watch, Warning, Critical).
  - Simulated device indicator badge when telemetry is driven by virtual wearables.
  - Interactive historical time-series charts (Recharts) with 24-hour, 7-day, and 30-day range selectors.
  - Caregiver consent management (`/patient/access`) enabling patients to approve or revoke caregiver visibility.
  - Status banners for unassigned patient states awaiting clinical onboarding.
- **Caregiver Dashboard (`/caregiver`)**:
  - Multi-patient roster displaying vitals and open alert counts for consenting linked patients.
  - Direct submission of caregiver link requests.
- **Doctor Workstation (`/doctor`)**:
  - Application status screen (`/doctor/pending`) displayed until approved by an administrator.
  - Clinical triage roster sorted by alert severity and unacknowledged warnings.
  - Patient detail inspection with vital-sign threshold override controls.
  - Weekly clinical PDF report generation and download.
- **Administrator Console (`/administrator`)**:
  - Full-featured 8-tab governance suite:
    1. **Overview**: Metric aggregates (active institutions, approved doctors, assigned patients, 24h alerts).
    2. **Doctor Requests**: Review, approve, or reject physician license submissions.
    3. **Institutions**: Register and manage partner hospitals and clinics.
    4. **Doctors**: Active roster with suspension and reinstatement controls.
    5. **Patients**: Assignment to primary care physicians, transfer between clinics, and per-device simulation scenario injection (`normal`, `deteriorating`, `tachycardia`, etc.).
    6. **Caregiver Links**: Clinical oversight and approval for pending link requests.
    7. **Users**: User account oversight and emergency access suspension.
    8. **Audit Log**: Immutable audit stream with actor details, timestamps, and action metadata.
  - Notification drawer with mark-all-read functionality.

---

## Reliability and Error Boundaries

The application wraps routes with isolated React Error Boundaries:

- **Root Error Boundary**: Catches top-level layout failures and provides a graceful fallback with session retention.
- **Admin Error Boundary**: Isolates the `/administrator` console so component rendering exceptions show an inline error panel with a "Retry" button rather than a blank white screen or forced re-login.

---

## Local Development

1. **Environment Configuration**:

   ```powershell
   Copy-Item apps/web/.env.example apps/web/.env
   ```

2. **Start Development Server**:

   ```powershell
   pnpm --filter @vitalguard/web dev
   ```

3. Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Scripts

| Script      | Command                                   | Purpose                                            |
| ----------- | ----------------------------------------- | -------------------------------------------------- |
| `dev`       | `pnpm --filter @vitalguard/web dev`       | Starts Vite dev server (port 5173) with HMR        |
| `build`     | `pnpm --filter @vitalguard/web build`     | Builds production bundle to `dist/`                |
| `lint`      | `pnpm --filter @vitalguard/web lint`      | Validates code with ESLint                         |
| `typecheck` | `pnpm --filter @vitalguard/web typecheck` | Type-checks code with `tsc --noEmit`               |
| `test`      | `pnpm --filter @vitalguard/web test`      | Runs component tests with Vitest & Testing Library |
