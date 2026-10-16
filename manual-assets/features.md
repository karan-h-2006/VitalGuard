# VitalGuard user-facing feature guide

The application has four primary account roles: patient, caregiver, doctor, and administrator. Patients, caregivers, and doctors can register publicly through the web portal; administrator accounts are provisioned via system deployment. This guide catalogs every user-facing route, interface component, and user action, ordered in the sequence a first-time user encounters the system: access & registration -> role dashboards -> core care & governance actions -> alerts & clinical reports -> privacy & security settings -> session termination.

Each capability is labeled **[NEW]**, **[CHANGED]**, or **[UNCHANGED]** relative to the prior user manual edition.

---

## 1. Access, landing, and account setup

- **Public landing page** (`/`, unauthenticated visitors) **[NEW]**:
  - Serves as the public front door and platform overview before signing in.
  - Features a dynamic hero with rotating vital labels (`heart rate`, `blood oxygen (SpO2)`, `temperature`, `motion & orientation`), live platform capability marquee, architectural overview, role-specific capability summaries (Patient, Doctor, Caregiver, Administrator), interactive FAQ accordion, and student engineering project attribution for NITK Surathkal IT303.
  - Provides prominent navigation and action links to Sign in (`/login`) and Register (`/register`).
- **Sign in** (`/login`, all roles) **[CHANGED]**:
  - Redesigned with a split desktop presentation featuring a dark branding panel with radial ambient lighting, platform highlights (~5-second MQTT ingest frequency, role-based triage), and project disclaimer.
  - Form includes email and password inputs with field-level placeholders and validation, inline error alert banner for invalid credentials, session-expired warning notification (`?expired=true`), "Back to home" navigation, and a direct link to register.
  - Submitting disables the button with an active loading indicator to prevent duplicate submissions.
- **User registration** (`/register`, patient, caregiver, doctor) **[CHANGED]**:
  - Features the matching split-screen branded layout with an interactive role selection dropdown (`Patient`, `Caregiver`, `Doctor`).
  - Minimum password length requirement of 10 characters with client and server validation.
  - Dynamic role-specific fields:
    - **Patient**: Optional preferred healthcare institution selector.
    - **Caregiver**: Optional linked patient email input.
    - **Doctor**: Required institution selector, medical license number, and clinical specialization. Doctor accounts enter a pending verification state upon registration.
  - Form validation prevents empty required submissions and presents readable inline error alerts.
- **Doctor application pending review** (`/doctor/pending`, pending or rejected doctors) **[CHANGED]**:
  - Dedicated landing workstation explaining clinical access restrictions while credentials undergo administrative review.
  - Displays dynamic status badge (`pending`, `rejected`, `approved`) and verification timeline explanation.
  - In the event of application rejection, displays the administrator's review feedback and provides an inline reapplication form (allowing updated institution selection, medical license number, and specialization) if eligible.
- **Change password** (`/change-password`, authenticated users) **[CHANGED]**:
  - Accessible when a security password change is enforced or directly via the route.
  - Restyled with modern Card and Alert primitives; requires current password verification and enforces a strict 12-character minimum for the new password.
  - Inline error feedback on incorrect current password; successful update displays confirmation and invalidates active session tokens, requiring fresh authentication.

---

## 2. Dashboards and primary workstations

- **Patient vitals workstation** (`/patient`, patient role) **[CHANGED]**:
  - Bracketed portal badge, patient workstation heading, and quick-action navigation link to **Who can see my data?** (`/patient/access`).
  - **Awaiting Physician Assignment banner**: Appears automatically when an account is newly registered and pending administrative assignment to an approved doctor.
  - **Simulated device indicator**: Displays an outline badge (`Simulated device (demo)`) when telemetry originates from the automated multi-patient edge simulator.
  - **Telemetry waiting state**: Shows an animated radar pulse indicator and connection status when a device is newly provisioned or awaiting its first telemetry sample.
  - **Live vital cards**: 4 biometric metric cards displaying real-time values, timestamp, and units:
    - _Heart Rate_ (bpm, rose icon)
    - _SpO2_ (%, sky blue icon)
    - _Temperature_ (°C, amber icon)
    - _Acceleration_ (m/s², purple icon) **[CHANGED]**: Renamed from generic motion/fall detection to reflect 3-axis accelerometer telemetry.
  - **Clinical severity badge**: Color-coded severity tier pill (**Normal**, **Watch**, **Warning**, **Critical**).
  - **Clinical status note**: Contextual banner displayed when physiological thresholds or anomaly detection algorithms detect abnormal trends.
  - **History & Trends chart**: Interactive Recharts time-series visualization supporting vital parameter selection (Heart Rate, SpO2, Temperature, Motion) and time-window toggle pills (`24h`, `7d`, `30d`) with formatted hover tooltips.
- **Doctor clinical triage workstation** (`/doctor`, approved doctor role) **[CHANGED]**:
  - Prioritized multi-patient clinical roster sorted by severity tier (**Critical** > **Warning** > **Watch** > **Normal**).
  - Table columns display patient email, truncated patient ID, live severity tier badge, active open alert counter badge, and relative last-reading timestamp (e.g., "just now", "10m ago", or "Never").
  - Selecting any patient row seamlessly loads their full live vital cards, status explanation, and historical telemetry trend chart.
  - **Weekly Clinical PDF Report generation**: Download button (`Generate Weekly Report`) that triggers worker-side PDF synthesis and direct browser download of `vitalguard-[patientId]-weekly-report.pdf`.
  - Back button navigation to return from detail view to the triage roster.
- **Caregiver workstation** (`/caregiver`, caregiver role) **[CHANGED]**:
  - Dual-mode interface based on linked patient status:
    - **Active triage view**: When authorized patient relationships exist, renders the full clinical triage dashboard displaying vitals, severity tiers, and alert indicators for all consenting patients.
    - **Access request view**: When no patients are linked yet, provides an access request form requiring the target patient's registered email address and an optional relationship note (up to 500 characters).
  - **Request status tracker**: Displays submitted access requests with live administrative review status (`pending`, `approved`, `rejected`) and patient consent decision (`pending`, `granted`, `denied`).
- **Administrator governance console** (`/administrator`, administrator role) **[CHANGED]**:
  - Unified 8-tab governance workstation providing system overview, licensing, resource assignment, and audit inspection:
    1. _Overview_: Summary metric cards (Pending Doctors, Unassigned Patients, Pending Caregiver Links, Active Institutions) and a real-time audit feed of recent governance actions.
    2. _Doctor requests_: Triage queue for unverified doctor applications.
    3. _Institutions_: Healthcare organization registry and status management.
    4. _Doctors_: Approved and suspended clinical practitioner directory.
    5. _Patients_: Patient roster, physician assignment, institution filtering, and device simulation control.
    6. _Caregiver links_: Pending access requests and manual relationship provisioning.
    7. _Users_: System-wide account registry and security state management.
    8. _Audit log_: Tamper-evident forensic audit trail.
- **Global notification center** (all authenticated roles) **[CHANGED]**:
  - Integrated into the sticky top navigation header across all portals.
  - Bell trigger button with an unread badge indicator counter.
  - Flyout dropdown panel displaying timestamped system notices (such as patient assignment confirmations, link approvals, and triage escalations).
  - Actions to mark individual notices as read or batch mark all notifications as read.
  - Clean empty state banner ("You're all caught up. No unread notifications at this time.") when all notices are read.

---

## 3. Core governance and clinical management actions

- **Doctor verification review** (administrator -> _Doctor requests_) **[CHANGED]**:
  - Filterable list of pending physician credentials displaying applicant email, institution affiliation, medical license number, and clinical specialty.
  - One-click **Approve** action immediately unlocks clinical triage workstation access.
  - **Reject** action prompts for an explicit clinical rejection rationale stored for doctor reapplication feedback. Duplicate submissions are locked with busy states.
- **Institution management** (administrator -> _Institutions_) **[CHANGED]**:
  - Institution directory with type badges (`Hospital`, `Clinic`, `Institute`) and location.
  - Interactive search bar filtering institutions by name or city.
  - **Create institution form**: Enforces unique name, organization type selection, and optional city.
  - **Status toggles**: One-click Activate / Deactivate controls to manage clinical affiliation eligibility.
- **Doctor directory and suspension governance** (administrator -> _Doctors_) **[CHANGED]**:
  - Clinical roster with status filter (`All`, `Approved`, `Suspended`, `Rejected`) and keyword search.
  - Displays affiliated institution, medical license, specialization, and active assigned patient count.
  - **Emergency Suspension**: Allows administrators to immediately suspend a doctor's clinical privileges with a mandatory audit reason.
  - **Reinstatement**: One-click reactivation restoring triage workstation access.
- **Patient assignment and simulation scenario control** (administrator -> _Patients_) **[CHANGED / EXPANDED]**:
  - Patient management table with assignment filter (`All`, `Unassigned`, `Assigned`), institution filter, and keyword search.
  - Shows preferred institution, current attending physicians, and **Primary** doctor designation.
  - **Assign / Transfer physician**: Dropdown selector allowing initial physician assignment or patient transfer between approved doctors, with institution override validation.
  - **Unassign physician**: Allows removing an assigned doctor from a patient's care team.
  - **Device telemetry and scenario control** **[NEW]**: Displays device ID, `Simulated` vs `Hardware` badge, and for simulated devices, provides an interactive **Scenario selector** (`Normal`, `Deteriorating`, `Noisy`) to dynamically inject physiological anomalies into the edge simulator.
- **Caregiver link governance** (administrator -> _Caregiver links_) **[CHANGED]**:
  - Administrative review queue for pending caregiver-patient link requests, showing applicant email, target patient email, relationship notes, and patient consent status.
  - Approve or Reject actions (with mandatory rejection reasoning).
  - **Direct link creation**: Form allowing administrators to establish direct caregiver-patient associations by user IDs for institutional care arrangements.
- **Patient consent management** (patient -> _Who can see my data?_) **[CHANGED]**:
  - Dedicated privacy interface accessible from the patient dashboard.
  - **Pending requests list**: Shows verified caregiver requests awaiting patient consent with caregiver email and relationship note.
  - **Grant access**: Immediately authorizes the caregiver to view live vitals and triage status.
  - **Deny request**: Permanently denies the request without disclosing medical data.
  - **Active caregivers roster**: Lists all individuals with active view permissions, complete with a one-click **Revoke access** button.
- **User account governance** (administrator -> _Users_) **[CHANGED]**:
  - Complete user directory filterable by role (`Patient`, `Caregiver`, `Administrator`).
  - Search by user email or unique identifier.
  - Suspend and Reinstate account controls for non-doctor accounts (doctor suspension is handled in the specialized clinical Doctors tab).
- **Forensic audit log inspection** (administrator -> _Audit log_) **[CHANGED]**:
  - Tamper-evident chronological audit feed of all administrative, clinical, and security actions.
  - Multi-parameter filtering: Actor email or ID, Action slug (e.g. `patient.assign_doctor`, `user.suspend`), and Date range (`From` and `To` date pickers).
  - Collapsible **Details** disclosure on each log row showing structured JSON before/after state diffs and context payloads.

---

## 4. Alerts, telemetry, and reporting

- **Continuous physiological telemetry** **[CHANGED]**:
  - Wearable sensors and edge simulator stream Heart Rate, SpO2, Temperature, and 3-axis Acceleration over MQTT QoS 1 into the message broker.
  - Real-time updates delivered to browser workstations over WebSocket connections (`/api/ws`) with automated polling fallback (every 3 seconds) until telemetry streams are established.
- **Hierarchical clinical severity classification** **[CHANGED]**:
  - Dynamic sliding-window baselines and z-score anomaly detection categorize patient status into four discrete tiers:
    - **Normal** (green badge): Biometrics within resting physiological limits.
    - **Watch** (blue/slate badge): Minor variance or transient deviation detected.
    - **Warning** (amber badge): Significant physiological departure; registers in triage tables and opens clinical alert.
    - **Critical** (red badge): Acute clinical emergency (e.g. severe tachycardia or desaturation); triggers visual alerts, status explanation notes, open alert increment, and automated sandbox email/SMS dispatch.
- **Weekly clinical PDF reports** **[UNCHANGED]**:
  - Doctor triage workstation allows on-demand compilation of weekly physiological summary reports.
  - Produces downloadable PDF files containing patient vitals, statistical distributions, and alert histories.

---

## 5. Security, settings, and privacy

- **Caregiver access authorization** (`/patient/access`) **[CHANGED]**:
  - Granular patient-controlled consent architecture; no caregiver can inspect telemetry without two-party agreement (administrator verification followed by patient consent).
  - Instant revocation capability immediately disconnects caregiver views.
- **Account credential rotation** (`/change-password`) **[CHANGED]**:
  - Self-service password updates enforcing standard enterprise complexity requirements (12+ characters).
  - Automatic session invalidation upon password modification.

---

## 6. Session termination

- **Sign out** (all authenticated roles) **[CHANGED]**:
  - Standardized button in the top application header featuring an icon and clear label.
  - Submits a POST request to `/api/auth/logout`, purges client authentication tokens and cached user state from local storage and memory, and redirects to the Sign in interface (`/login`).

---

## Capture scope and execution notes

- **Active client-side routes**:
  - Public / unauthenticated: `/`, `/login`, `/register`.
  - Role-protected: `/patient`, `/patient/access`, `/doctor`, `/doctor/pending`, `/caregiver`, `/administrator`, `/change-password`.
  - Administrator sections are client-side tab state views (`?tab=overview|doctor-requests|institutions|doctors|patients|caregivers|users|audit`) sharing the `/administrator` route.
- **Shared copyright footer**:
  - Present and verified across all application pages: `© 2026 Team 27 (DM Vikas, Karan H, Rohan G), NITK Surathkal. Developed for the Software Engineering course.`
  - The public landing page additionally includes the NITK Surathkal course project attribution block in its primary layout.
- **Automated capture strategy**:
  - Playwright running Chromium with viewport 1440x900 at deviceScaleFactor 2 and light color scheme.
  - All captures employ fabricated synthetic test fixtures adhering to zero production credential disclosure.
  - Highlighting outlines (`2px solid #e53935`, offset 2px) are applied to the active UI element for each documented manual step and cleared after capture.
