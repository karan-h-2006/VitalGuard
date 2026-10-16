# 05 — Viva Q&A: My Part (API + Web)

**Candidate:** Rohan (241IT064, `@rniszn`, B.Tech IT NITK)  
**Project:** VitalGuard — Real-Time IoT Remote Patient Monitoring & Clinical Triage System  
**Ownership Domain:** Backend API (`apps/api`: Authentication, RBAC, Governance, Dashboards, WebSocket, Reports) & Frontend (`apps/web`: React 19 SPA, Triage UI, Patient/Doctor/Admin Portals, State & Auth Architecture).

---

## Table of Contents

1. [Authentication (15 Questions)](#1-authentication)
2. [Authorization & RBAC (12 Questions)](#2-authorization--rbac)
3. [Dashboard & WebSocket (10 Questions)](#3-dashboard--websocket)
4. [Reports & Longitudinal Data (5 Questions)](#4-reports--longitudinal-data)
5. [Governance & Administrative Controls (10 Questions)](#5-governance--administrative-controls)
6. [Frontend & React Web (10 Questions)](#6-frontend--react-web)
7. [Testing, Architecture & Quality (5 Questions)](#7-testing-architecture--quality)
8. [Trick Questions & Edge Cases (10 Questions)](#8-trick-questions--edge-cases)

---

## 1. Authentication

#### Q1: How does VitalGuard handle user authentication across the API and frontend?

**A:** We use JSON Web Tokens (JWT) signed with the HS256 algorithm via the `jose` library in `apps/api/src/auth/tokens.ts`. When a user submits valid credentials to `/auth/login`, the server returns a token containing their user ID and role. The React client stores this token in `localStorage` under `vitalguard_token` and attaches it as a `Bearer` header on every subsequent HTTP request. On the API side, Fastify's `app.authenticate` decorator verifies the cryptographic signature and checks the database on every call to ensure the account is active.

#### Q2: Why did you choose Argon2id over bcrypt or PBKDF2?

**A:** Argon2id is the winner of the Password Hashing Competition and provides state-of-the-art resistance against both GPU and side-channel attacks. Unlike bcrypt, which is purely CPU-bound and vulnerable to parallelized GPU cracking, Argon2id is memory-hard—it requires a substantial amount of RAM per hashing attempt. This makes mass hardware brute-force attacks economically and computationally unviable. In our code, password hashing is handled cleanly in `apps/api/src/auth/passwords.ts`.

#### Q3: What password policies and length constraints are enforced by the system?

**A:** We enforce password rules in `apps/api/src/auth/passwords.ts` and validate incoming payloads using Zod schemas in `features/auth/routes.ts`. Standard accounts for patients, caregivers, and doctors require a minimum length of 8 characters. For administrator accounts, we enforce a stricter minimum of at least 12 characters, both at initial bootstrap and whenever an administrator password is changed via `/auth/change-password`.

#### Q4: Why does login return `INVALID_CREDENTIALS` for both non-existent emails and wrong passwords?

**A:** Returning distinct error messages like "User not found" versus "Incorrect password" introduces a serious user enumeration vulnerability. An attacker could use that feedback to compile a list of registered patients, doctors, or administrators. By returning an identical `401 Unauthorized` with code `INVALID_CREDENTIALS` in `apps/api/src/features/auth/routes.ts` regardless of which condition failed, we prevent enumeration completely.

#### Q5: How does the login rate limiting mechanism work?

**A:** In `apps/api/src/features/auth/routes.ts`, we track failed login attempts in an in-memory `Map` keyed by `${request.ip}:${email}`. Standard user accounts permit a maximum of 5 attempts within a 60-second sliding window (`LOGIN_RATE_LIMIT_MAX = 5`, `LOGIN_RATE_LIMIT_WINDOW_SECONDS = 60`). Once the threshold is crossed, subsequent attempts return an HTTP `429 Too Many Requests` with code `LOGIN_RATE_LIMITED` until the window expires.

#### Q6: Why are administrator login rate limits stricter than standard accounts?

**A:** Administrator accounts hold system-wide privileges, including modifying institution profiles, approving doctors, and viewing audit logs. In `apps/api/src/env.ts`, we configure `ADMIN_LOGIN_RATE_LIMIT_MAX = 3` and `ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS = 300`. Restricting admins to 3 attempts per 5-minute window dramatically limits brute-force and credential-stuffing attacks against high-value credentials.

#### Q7: What happens when a user exceeds their allowed login attempts?

**A:** The API immediately rejects the request before verifying passwords or touching the database, returning HTTP `429` with `{ code: 'LOGIN_RATE_LIMITED', message: 'too many login attempts; try again later' }`. In the React frontend, `LoginPage.tsx` catches this specific error code and renders an alert informing the user that their account is temporarily throttled.

#### Q8: How are JWT tokens constructed and signed?

**A:** In `apps/api/src/auth/tokens.ts`, `signToken` uses `new SignJWT(...)` from `jose`. We embed `sub` set to `userId`, a `role` claim, and for patients, a `patientId` claim matching their user ID. The header is configured with `{ alg: 'HS256' }`, stamped with `setIssuedAt()`, given an expiration timestamp, and signed using our cryptographically random `JWT_SECRET`.

#### Q9: What are the token expiration durations in VitalGuard?

**A:** Standard tokens for patients, doctors, and caregivers expire in 1 hour (`JWT_EXPIRES_IN = '1h'`). Administrator tokens expire in 30 minutes (`ADMIN_JWT_EXPIRES_IN = '30m'`). These defaults are loaded and validated through our Zod environment parser in `apps/api/src/env.ts`.

#### Q10: Why does the administrator JWT have a shorter expiration window?

**A:** Administrator sessions present the largest blast radius if compromised. Having a 30-minute expiration window reduces the window of exposure if an administrator steps away from their terminal or suffers a token theft. It aligns with standard healthcare compliance guidelines requiring aggressive re-authentication for administrative roles.

#### Q11: How does the API enforce the `mustChangePassword` requirement?

**A:** During the `app.authenticate` pre-handler in `apps/api/src/plugins/auth.ts`, we query `users.mustChangePassword` from PostgreSQL. If `true`, the plugin blocks the request with HTTP `403` and code `PASSWORD_CHANGE_REQUIRED`, unless the user is requesting `/auth/change-password`, `/auth/me`, or `/auth/logout`. Once the user successfully posts to `/auth/change-password`, the flag is cleared in the database.

#### Q12: How does the frontend respond when `PASSWORD_CHANGE_REQUIRED` is received?

**A:** In `apps/web/src/shared/api-fetch.ts`, our global `apiFetch` wrapper inspects responses. When it detects HTTP `403` with code `PASSWORD_CHANGE_REQUIRED`, it dispatches a window event `vitalguard:password-change-required`. `AuthContext` listens for this event, updates `mustChangePassword: true`, and immediately redirects the user to `/change-password` without clearing their session.

#### Q13: How does account suspension take effect for active sessions?

**A:** Because `app.authenticate` in `apps/api/src/plugins/auth.ts` queries PostgreSQL on every single API request, suspension takes effect instantaneously. If `account.isSuspended` is true, the server returns HTTP `403` with code `ACCOUNT_SUSPENDED` for all routes except `/auth/me` and `/auth/logout`. Even if an attacker holds a valid, unexpired JWT, they are locked out immediately upon admin suspension.

#### Q14: What is the purpose of the `/auth/me` endpoint?

**A:** Implemented in `apps/api/src/features/auth/routes.ts`, `/auth/me` returns the authenticated user's current record (`id`, `role`, `email`, `mustChangePassword`) directly from the database. On frontend initialization, `AuthContext` calls `/auth/me` to ensure that local storage state is synchronized with current database reality, immediately catching external suspensions or role changes.

#### Q15: How does logout work in your stateless JWT architecture?

**A:** When a user clicks Log Out, the frontend `logout()` function removes `vitalguard_token` from `localStorage`, resets React state in `AuthContext`, and calls the backend `POST /auth/logout`. The API endpoint returns `204 No Content`. While the token remains cryptographically valid until its expiration timestamp, client-side purging combined with server-side account suspension checks provides a robust, lightweight logout experience.

---

## 2. Authorization & RBAC

#### Q16: How is Role-Based Access Control (RBAC) enforced in VitalGuard?

**A:** RBAC is implemented using Fastify pre-handler decorators in `apps/api/src/plugins/auth.ts`. We have `requireRoles(...roles)` which restricts routes to specific roles like `administrator`. We also use specialized decorators: `requireApprovedDoctor()` ensures a doctor's credentialing status is approved, and `requireAssociation()` validates clinical relationships between clinicians and patients before granting access to vitals.

#### Q17: What is the `decideRbacAccess` function and why did you extract it?

**A:** In `apps/api/src/plugins/auth.ts`, `decideRbacAccess` is a pure function that takes the role, user ID, patient ID, association boolean, and doctor approval flag, and returns a boolean. We extracted this logic so that all authorization rules could be unit-tested across every role permutation without requiring mock databases or network overhead.

#### Q18: How do you prevent horizontal privilege escalation between patients?

**A:** Patients must never see another patient's medical records. In `requireAssociation()`, if `authUser.role === 'patient'`, we verify `authUser.userId === targetPatientId`. If a patient attempts to query `/patients/:id/vitals/latest` with another patient's UUID, the comparison evaluates to false and the API immediately halts with `403 Forbidden: not authorized for this patient`.

#### Q19: How does the system restrict doctors to only their assigned patients?

**A:** When a doctor accesses `/patients/:patientId/vitals/*`, `requireAssociation()` executes a database query against the `associations` table checking for an active record where `doctorId = authUser.userId` and `patientId = targetPatientId`. If no pairing exists, access is denied with HTTP `403`. This ensures strict clinical tenancy between doctors and patient cohorts.

#### Q20: Why isn't the doctor's approval status embedded inside the JWT token?

**A:** A doctor's approval status is dynamic and subject to administrative governance. If an administrator suspends or revokes a doctor's license in the morning, a token that had "approved" baked into its claims would allow that doctor to access confidential patient data until the token expired. Checking approval in the database on route execution ensures revocation is immediate.

#### Q21: What happens if an unapproved doctor tries to call `/patients`?

**A:** In `apps/api/src/features/dashboard/routes.ts`, the `/patients` triage endpoint queries `doctorProfiles` for the requesting doctor. If `profile.status !== 'approved'`, the request is immediately halted with HTTP `403` and `{ code: 'DOCTOR_NOT_APPROVED', message: 'doctor account is not approved' }`. On the frontend, this triggers a redirect to `/doctor/pending`.

#### Q22: How are caregivers authorized to access patient records?

**A:** Caregivers are authorized via the `association_caregivers` table. In `requireAssociation()`, if `authUser.role === 'caregiver'`, the system queries `associationCaregivers` for a match between `caregiverId` and `patientId`. Caregivers only see telemetry for patients who have granted explicit consent.

#### Q23: Can an administrator view any patient's vitals or reports?

**A:** Yes. In `apps/api/src/plugins/auth.ts`, `decideRbacAccess` returns `true` if `authUser.role === 'administrator'`. This allows hospital administrators to troubleshoot technical ingestion issues, inspect device connectivity, and monitor clinical operations across all registered institutions.

#### Q24: What is the caregiver linking workflow from request to approval?

**A:** When a caregiver registers or requests access with a patient's email, a row is inserted into `caregiver_link_requests` with status `pending`. An administrator reviews and approves the request in `/admin/caregiver-requests/:id/approve`. If `REQUIRE_PATIENT_CONSENT` is enabled, the patient receives a notification and must explicitly grant consent in their patient portal. Only after patient consent is granted is an active row inserted into `association_caregivers`.

#### Q25: Who can manage or transfer patient-doctor associations?

**A:** Only administrators can assign or transfer associations, enforced by `canManageAssociations` in `apps/api/src/plugins/auth.ts`. Doctor assignments are managed through `/admin/patients/:patientId/assign-doctor` and transfers through `/admin/patients/:patientId/transfer`. Clinicians cannot arbitrarily add patients to their own panels without administrative governance.

#### Q26: What happens if an administrator assigns a doctor with an institution mismatch?

**A:** In `apps/api/src/features/governance/admin-routes.ts`, `assessDoctorAssignment()` checks if the patient's `preferredInstitutionId` matches the doctor's `institutionId`. If they differ and the administrator did not supply `override: true` and a non-empty `reason`, the API rejects the transaction with HTTP `409` and code `INSTITUTION_PREFERENCE_MISMATCH`.

#### Q27: How does doctor suspension automatically protect patient care?

**A:** When an administrator suspends a doctor via `/admin/doctors/:userId/suspend`, the transaction updates the doctor's status to `suspended` and deletes all their rows in `associations`. For every affected patient, if no secondary doctor exists, their status reverts to `unassigned`. If secondary doctors exist, the primary flag is automatically transferred to the next physician, ensuring continuity of care.

---

## 3. Dashboard & WebSocket

#### Q28: How is real-time biometric streaming delivered to the React dashboard?

**A:** We use Fastify's `@fastify/websocket` plugin on route `/ws?token=<JWT>` in `apps/api/src/features/dashboard/routes.ts`. Once connected, the client transmits a `{ type: 'subscribe', patientId: '...' }` message. The server validates the user's authorization to view that patient, sets up a 500ms interval polling Redis key `patient:<patientId>:status`, and pushes updates whenever values change.

#### Q29: How does the WebSocket authenticate incoming connections?

**A:** The WebSocket protocol does not support custom HTTP headers during the initial browser handshake. Therefore, the client sends the JWT as a query string parameter (`/ws?token=<JWT>`). The server extracts this token in the connection handler, calls `verifyToken()`, and immediately terminates the socket with WebSocket close code `4401` if the token is missing, expired, or invalid.

#### Q30: How does the WebSocket enforce authorization for a specific patient?

**A:** When the client sends `{ type: 'subscribe', patientId }`, the socket handler calls the helper function `associated(app, user.userId, user.role, patientId)` in `features/dashboard/routes.ts`. If the user is a doctor without an active approval or association, or a patient requesting another patient's data, the socket is immediately terminated with close code `4403: not authorized for this patient`.

#### Q31: How does the WebSocket know when data has changed?

**A:** In `apps/api/src/features/dashboard/routes.ts`, the timer calls `readRawStatus(patientId)`, which reads the serialized JSON string from Redis key `patient:<patientId>:status`. The server keeps a local variable `previous`. If `raw && raw !== previous`, the server updates `previous = raw` and pushes `wrapStatusPush(raw)` to the socket. If the string has not changed, no network frame is sent, saving bandwidth.

#### Q32: Why use Redis instead of querying PostgreSQL directly every 500ms?

**A:** Redis is an in-memory key-value store that fulfills queries in microseconds without disk I/O. If dozens of clinicians and patients have dashboards open, polling PostgreSQL every 500ms would cause hundreds of queries per second, resulting in severe database connection pool exhaustion and lock contention. Redis acts as a high-throughput cache for current biometric state.

#### Q33: What is the payload envelope sent over the WebSocket?

**A:** The function `wrapStatusPush()` wraps the raw status JSON in a standardized envelope:

```json
{
  "type": "status",
  "source": "redis",
  "status": {
    "vitals": { "heart_rate": 78, "spo2": 98, "temperature": 36.8 },
    "severityTier": "Normal",
    "timestamp": "2026-10-16T09:30:00Z"
  }
}
```

This matches the exact data shape returned by the HTTP `/vitals/latest` REST route.

#### Q34: How does the Doctor Triage dashboard prioritize patients?

**A:** In `apps/api/src/features/dashboard/routes.ts`, `sortPatientsByTriage` sorts the patient array using `TRIAGE_RANK`: Critical is 4, Warning is 3, Watch is 2, and Normal is 1. Patients in acute crisis appear at the very top of the doctor's screen, accompanied by an open alert count and their most recent timestamp.

#### Q35: How does the vital history endpoint work?

**A:** The route `GET /patients/:patientId/vitals/history` queries the `vital_readings` table in PostgreSQL. It filters by `patientId`, `vitalType` (`heart_rate`, `spo2`, `temperature`, `motion`), and timestamps greater than or equal to a computed cutoff (`since = Date.now() - hours * 3,600,000`). It returns an ordered time-series array used by the frontend charts.

#### Q36: What time ranges are supported by the history route?

**A:** Handled by `parseHistoryRangeHours()` in `apps/api/src/features/dashboard/routes.ts`: `24h` evaluates to 24 hours (default), `7d` evaluates to 168 hours, and `30d` evaluates to 720 hours. Any unrecognized query parameter returns 0, causing the handler to respond with HTTP `400 Bad Request`.

#### Q37: How does the frontend prevent memory leaks with WebSocket connections?

**A:** In our React components, the WebSocket connection is established inside a `useEffect` hook. The effect's cleanup return function explicitly removes all message and error event listeners and invokes `socket.close()`. This guarantees that navigating away from the dashboard tears down both the client socket and the server's polling interval.

---

## 4. Reports & Longitudinal Data

#### Q38: How are weekly clinical PDF reports generated in VitalGuard?

**A:** In `apps/api/src/features/dashboard/reports.ts`, `generateWeeklyReport()` performs a database query across the last 7 days for a given patient. It aggregates biometric readings and alert severities, writes a valid PDF-1.4 binary file to the `generated-reports/` directory on disk, and records the report metadata and file path in the `reports` database table.

#### Q39: What data is aggregated inside the weekly report?

**A:** The pure function `computeReportAggregations()` calculates:

1. `avgVitals`: Mathematical mean for each vital metric (`heart_rate`, `spo2`, `temperature`) over the 7-day window.
2. `alertCounts`: Total count of alerts categorized by severity tier (`Critical`, `Warning`, `Watch`, `Normal`).

#### Q40: How is the automated weekly report generation scheduled?

**A:** In `apps/worker/src/reports.ts`, `startWeeklyReportsJob()` uses `node-cron` with schedule `0 0 * * 0` (every Sunday at midnight). When triggered, it queries all registered patients in PostgreSQL and invokes `generateWeeklyReport()` for each, ensuring updated clinical summaries are waiting for doctors on Monday morning.

#### Q41: Who can download generated clinical reports?

**A:** Access to `/patients/:patientId/reports/:reportId/download` is guarded by `requireAssociation()`. The patient themselves, their assigned doctors, their approved caregivers, and administrators may download reports. Unauthorized requests are blocked with HTTP `403`.

#### Q42: How does the API stream PDF files to the client?

**A:** In `apps/api/src/features/dashboard/routes.ts`, the download route looks up the report record, sets the `Content-Type` header to `application/pdf`, and sets `Content-Disposition` to `attachment; filename="vitalguard-<patientId>-<date>.pdf"`. It then uses Node's `createReadStream(report.filePath)` to pipe the binary stream directly to the Fastify reply object without buffering the entire file into memory.

---

## 5. Governance & Administrative Controls

#### Q43: What is the role of the `adminAuditLog` table?

**A:** The `admin_audit_log` table provides an immutable, tamper-evident record of all administrative actions. Defined in `apps/api/src/db/schema.ts`, it stores the `actorId`, `action` string, `targetType`, `targetId`, `before` state JSON, `after` state JSON, optional justification `reason`, `ip` address, and creation timestamp.

#### Q44: Why is audit logging compliance-critical in VitalGuard?

**A:** In medical IoT systems handling Protected Health Information (PHI), regulations like HIPAA and GDPR mandate strict accountability. Administrators must be able to demonstrate who authorized a physician, who transferred a patient, when an account was suspended, and why an institutional preference was overridden.

#### Q45: How does the doctor approval workflow operate?

**A:** When a doctor registers, their status is set to `pending`. In `apps/api/src/features/governance/admin-routes.ts`, an administrator accesses `/admin/doctor-requests`, reviews their medical license number, institution affiliation, and specialization, and invokes `/approve` or `/reject`. The decision is recorded in the audit log, and an email notification is dispatched to the doctor.

#### Q46: Can a rejected doctor reapply?

**A:** Yes. Under `/doctors/me/reapply`, a doctor whose application was rejected can resubmit updated licensing and institutional credentials. However, we enforce a strict guard: `reapplicationCount < 3`. If a doctor has been rejected 3 times, the API halts with `409 REAPPLICATION_LIMIT_REACHED`, requiring offline administrative intervention.

#### Q47: How does institution deactivation safeguard ongoing patient care?

**A:** In `apps/api/src/features/governance/admin-routes.ts`, patching an institution to `status: 'inactive'` blocks new patient and doctor registrations from selecting that facility. However, existing doctors and patient assignments remain active to avoid abruptly abandoning current patients. The API returns an explicit warning containing the count of affected doctors and patients.

#### Q48: Can administrators create additional administrator accounts?

**A:** By default, no. In `apps/api/src/features/auth/routes.ts`, `POST /admin/users` checks `env.ALLOW_ADDITIONAL_ADMINS`. If false, the route returns HTTP `403: ADDITIONAL_ADMINS_DISABLED`. If enabled, the new admin password must be at least 12 characters and is marked with `mustChangePassword: true`.

#### Q49: Can an administrator suspend another administrator?

**A:** No. In `apps/api/src/features/governance/admin-routes.ts`, the `/admin/users/:userId/suspend` handler explicitly checks if `before.role === 'administrator'` or `before.id === request.authUser.userId`. If true, it returns `409 ADMIN_SUSPENSION_FORBIDDEN`. This prevents rogue administrators or compromised credentials from locking out other system operators.

#### Q50: What is the difference between user suspension and doctor suspension?

**A:** Standard user suspension (`/admin/users/:userId/suspend`) simply flips `isSuspended: true`, blocking API calls. In contrast, doctor suspension (`/admin/doctors/:userId/suspend`) is a complex clinical workflow: it sets the profile to `suspended`, deletes all rows in `associations`, returns unassigned patients to the unassigned queue, reassigns primary doctors, and dispatches an audit alert.

#### Q51: How does the system handle notifications for governance actions?

**A:** In `apps/api/src/features/governance/notifications.ts`, `notifyAdmins()` broadcasts administrative notifications into the `notifications` table for all users with the `administrator` role. For external alerts, `emailUser()` dispatches transactional emails using the Resend API if `RESEND_API_KEY` is present, or falls back to logger output in development.

#### Q52: How does the admin audit log resolve human-readable labels?

**A:** The audit log stores raw UUIDs for foreign keys. In `apps/api/src/features/governance/admin-routes.ts`, `resolveAuditLogLabels()` batch-queries the `users` and `institutions` tables for all distinct actor and target IDs in the page, mapping raw UUIDs to readable emails (`actorEmail`) and hospital names (`targetLabel`).

---

## 6. Frontend & React Web

#### Q53: What technology stack is used in the frontend?

**A:** `apps/web` is built with React 19, TypeScript, and Vite. Styling is handled via Tailwind CSS and `@fontsource/plus-jakarta-sans`. Navigation is powered by `react-router-dom` v7. Charts are rendered using `recharts`, and iconography is provided by `lucide-react`.

#### Q54: How are client-side routes protected in `app.tsx`?

**A:** We use a `<ProtectedRoute>` component in `apps/web/src/shared/auth/protected-route.tsx`. It reads `user` and `token` from `useAuth()`. If unauthenticated, it redirects to `/login`. If the route specifies `allowedRoles` and the user's role is not included, it redirects them to their designated home dashboard via `DashboardRedirect`.

#### Q55: What is the purpose of the custom `apiFetch` wrapper?

**A:** Located in `apps/web/src/shared/api-fetch.ts`, `apiFetch` wraps the native browser `fetch`. It automatically attaches `Content-Type: application/json` for requests with bodies, attaches authorization headers, and intercepts responses to handle authentication side effects globally.

#### Q56: Why does `apiFetch` dispatch custom window events?

**A:** To avoid tight coupling between plain TypeScript utility functions and React state hooks, `apiFetch` uses custom DOM events: `vitalguard:session-expired` on 401s and `vitalguard:password-change-required` on 403s. `AuthContext` listens for these events centrally, decoupling network handling from component trees.

#### Q57: How do Error Boundaries protect the clinical user experience?

**A:** In `apps/web/src/components/ui/error-boundary.tsx`, we implement React error boundaries at both the `app` root and the `admin` feature level. If a chart rendering error or malformed data payload triggers an unhandled React error, the boundary catches it, logs the trace, and renders a clean recovery card without crashing the entire browser session.

#### Q58: How does the Patient Dashboard render real-time vitals smoothly?

**A:** In `apps/web/src/features/patient/patient-page.tsx`, incoming WebSocket messages update a localized React state object containing latest biometric values. The Recharts line graph consumes an immutable append-only buffer of historical points, avoiding unnecessary full-tree re-renders while updating metrics live.

#### Q59: How does the Doctor Dashboard display real-time patient triage?

**A:** In `apps/web/src/features/doctor/doctor-page.tsx` and `shared/components/triage-dashboard.tsx`, the doctor triage view displays patient cards organized by severity tier. As live alerts arrive or vitals shift, patient cards reflect updated severity badges, with critical patients positioned prominently for immediate clinical intervention.

#### Q60: How does the Caregiver interface differ from the Doctor view?

**A:** In `apps/web/src/features/caregiver/caregiver-page.tsx`, caregivers view read-only vitals and summaries for family members who granted them consent. Caregivers do not have access to doctor triage controls, institution configuration, or threshold override capabilities.

#### Q61: How does the UI handle forced password changes?

**A:** If `mustChangePassword` is true in `AuthContext`, the user is locked to `ChangePasswordPage.tsx`. All other protected navigation routes redirect back to `/change-password` until the user submits a new, valid password meeting our security requirements.

#### Q62: How does the UI handle data loading states?

**A:** We use custom `Skeleton` components in `apps/web/src/components/ui/skeleton.tsx`. When routes or charts are loading, animated pulse placeholders matching the geometry of metric cards and tables are displayed, preventing cumulative layout shift (CLS) and improving perceived responsiveness.

---

## 7. Testing, Architecture & Quality

#### Q63: What testing frameworks and tools are used in VitalGuard?

**A:** We use Vitest for both backend and frontend unit testing. Vitest provides native ESM execution and fast TypeScript compilation without additional build steps. For the API, Fastify's `.inject()` utility tests HTTP endpoints without binding to physical network sockets.

#### Q64: Why did you extract pure functions across the codebase?

**A:** Functions like `decideRbacAccess`, `assessDoctorAssignment`, `parseHistoryRangeHours`, and `computeReportAggregations` contain critical business logic. By stripping them of database queries and side-effects, we can test boundary conditions, edge cases, and unexpected inputs with 100% test reliability and sub-millisecond execution times.

#### Q65: How are database migrations executed and managed?

**A:** We use Drizzle ORM and Drizzle Kit. Migrations are written as versioned SQL scripts in `apps/api/src/db/migrations/` and tracked in `_journal.json`. Running `pnpm db:migrate` executes pending migrations against PostgreSQL inside transactions, ensuring atomic schema evolution.

#### Q66: How do API tests verify security and edge cases?

**A:** Our test suite in `apps/api/src/` uses synthetic JWT tokens signed with test secrets to exercise route handlers. Tests systematically verify that missing tokens yield 401, wrong roles yield 403, invalid UUIDs yield 400, and non-existent records yield 404.

#### Q67: How do you verify code quality and style across the monorepo?

**A:** We use ESLint 9 with TypeScript-ESLint, Prettier for deterministic formatting, and Husky with `lint-staged` on git commit hooks. Furthermore, `pnpm typecheck` runs `tsc --noEmit` across all workspace packages, preventing type regressions.

---

## 8. Trick Questions & Edge Cases

#### Q68: What if an attacker steals the JWT from `localStorage`?

**A:** First, VitalGuard mitigates stolen tokens through our mandatory database check: Fastify's `app.authenticate` decorator queries PostgreSQL on every request for `isSuspended` and `mustChangePassword`. If an administrator notices suspicious activity, suspending the user or setting `mustChangePassword = true` revokes access immediately on their next API call. Second, administrator tokens have an aggressive 30-minute expiration lifetime. Finally, in production, token theft is prevented by enforcing strict Content Security Policies (CSP) to eliminate XSS vectors.

#### Q69: Why do you return the same error for wrong email and wrong password?

**A:** Returning identical responses (`401 Unauthorized` with `{ code: 'INVALID_CREDENTIALS', message: 'invalid credentials' }`) prevents user enumeration attacks. If our API returned "User not found" for invalid emails and "Incorrect password" for valid emails, an attacker could automate requests to discover which healthcare staff, doctors, and patients have accounts in the system.

#### Q70: Why Argon2 over bcrypt?

**A:** Argon2id is memory-hard, whereas bcrypt is purely compute-bound. In modern cryptanalysis, attackers utilize clusters of specialized GPUs or ASIC rigs that execute billions of bcrypt computations per second because each attempt requires negligible RAM. Argon2id forces each hash attempt to allocate megabytes of memory, rendering GPU parallelism ineffective and making offline password cracking computationally and financially prohibitive.

#### Q71: Where is the session stored? Isn't `localStorage` insecure?

**A:** Yes, storing tokens in `localStorage` carries an acknowledged risk of token extraction if the application suffers an XSS vulnerability. We chose `localStorage` to allow our decoupled React Single Page Application (SPA) to easily attach Bearer tokens across different hostnames during development. In our architecture, the primary defense is preventing XSS entirely through React's auto-escaping, strict Zod input validation, and CSP headers. For a production hospital deployment, migrating to an `httpOnly`, `Secure`, `SameSite=Strict` cookie would be the ideal defense-in-depth enhancement.

#### Q72: Why doesn't the JWT include the doctor's approval status?

**A:** Doctor approval status is mutable and clinically sensitive. If approval were stored in the JWT claims, an administrator who revokes or suspends a doctor's credentials would have no effect on their active session; the doctor could continue querying patient data until the token expired. By omitting status from the JWT and checking the `doctor_profiles` table on each sensitive request, revocation is instantaneous.

#### Q73: How does the WebSocket know when data changed?

**A:** The WebSocket route in `apps/api/src/features/dashboard/routes.ts` establishes a 500ms polling interval against Redis key `patient:<id>:status`. The handler stores a reference to the previously transmitted serialized string (`previous`). On each tick, it retrieves `raw = await readRawStatus(patientId)`. If and only if `raw !== previous`, the server updates `previous = raw` and transmits the new data frame to the client. If the reading is unchanged, no message is sent.

#### Q74: Why do you use Redis instead of just querying PostgreSQL every 500ms?

**A:** Redis is an in-memory key-value store optimized for microsecond lookups with minimal CPU overhead. PostgreSQL is a relational database designed for complex transactional persistence involving disk I/O, query parsing, and connection pooling. If 100 clinical dashboards are open, querying Postgres every 500ms would generate 200 SQL queries per second, rapidly exhausting database connection pools and degrading API performance. Redis handles this polling load effortlessly.

#### Q75: What happens if the analytics worker crashes?

**A:** VitalGuard is built on a message-oriented architecture using RabbitMQ. The worker's ingest consumer uses manual message acknowledgments (`noAck: false`). If the worker crashes while processing telemetry, unacknowledged messages remain safely queued in RabbitMQ's persistent queue (`vitalguard.vitals.ingest`). When the worker restarts, it immediately consumes the backlog with zero biometric data loss.

#### Q76: Can two doctors see the same patient?

**A:** Yes. The database schema in `apps/api/src/db/schema.ts` implements a many-to-many relationship via the `associations` table, where each row links a `patientId` and a `doctorId`. The table also contains an `isPrimary` boolean column. This allows a primary care physician and one or more medical specialists (e.g., cardiologists, pulmonologists) to simultaneously monitor the same patient's telemetry.

#### Q77: What is the audit log for, and why can't administrators delete records?

**A:** The audit log (`admin_audit_log` table) is a compliance requirement under healthcare regulations such as HIPAA and GDPR. It tracks all administrative mutations—approvals, suspensions, transfers, and overrides. To guarantee non-repudiation and prevent insider tampering, our API provides `GET /admin/audit-log` for searching and filtering, but deliberately provides no `DELETE` or `UPDATE` routes for audit log records. Once written, the log is permanent.
