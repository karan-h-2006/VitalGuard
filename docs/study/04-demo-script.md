# 04 — Demo Script (7-8 minutes)

**Author:** Rohan (241IT064, `@rniszn`, B.Tech IT NITK)  
**Project:** VitalGuard — Real-Time IoT Remote Patient Monitoring & Clinical Triage System  
**Presentation Context:** Final Evaluation / Viva  
**Target Duration:** 7 to 8 minutes

---

## 1. Pre-Demo Checklist (PowerShell)

Execute these verification commands in order in Windows PowerShell at least 10 minutes before the grader joins.

### 1.1 Verify Infrastructure Containers

Ensure Mosquitto (MQTT: 1883), RabbitMQ (AMQP: 5672, Mgmt: 15672), PostgreSQL (5432), and Redis (6379) are healthy:

```powershell
# From project root: c:\Users\rohan\repos\VitalGuard
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

_(All 4 containers must show `Up (healthy)`. If using dev alias, `infra/docker-compose.dev.yml` points to the same setup)._

### 1.2 Verify Database Schema & Seed Data

Ensure Drizzle migrations have run and default demo accounts are present:

```powershell
cd apps/api
pnpm db:migrate
pnpm db:seed
cd ../..
```

### 1.3 Start Services in Dedicated PowerShell Tabs

Open 4 separate PowerShell terminals:

- **Terminal 1 (Backend Fastify API - Port 3000):**
  ```powershell
  cd c:\Users\rohan\repos\VitalGuard\apps\api
  pnpm dev
  ```
- **Terminal 2 (Analytics & Processing Worker - Health Port 8081):**
  ```powershell
  cd c:\Users\rohan\repos\VitalGuard\apps\worker
  pnpm dev
  ```
- **Terminal 3 (Multi-Patient IoT Simulator - Health Port 8080):**
  ```powershell
  cd c:\Users\rohan\repos\VitalGuard
  pnpm sim
  ```
- **Terminal 4 (React Vite Frontend - Port 5173):**
  ```powershell
  cd c:\Users\rohan\repos\VitalGuard\apps\web
  pnpm dev
  ```

### 1.4 Health Checks Verification

Verify every subsystem reports healthy via `curl` or browser:

```powershell
# API Health (returns 200 OK with uptime)
curl http://localhost:3000/health

# Worker Health (Bridge + Ingest Consumer)
curl http://localhost:8081/healthz

# Simulator Health (Managed devices)
curl http://localhost:8080/healthz

# Web UI
# Navigate to: http://localhost:5173
```

### 1.5 Demo Account Credentials Cheat Sheet

| Role               | Email                             | Password              | Dashboard URL                         |
| :----------------- | :-------------------------------- | :-------------------- | :------------------------------------ |
| **Administrator**  | `admin-demo@vitalguard.local`     | `DemoAdmin!2026`      | `http://localhost:5173/administrator` |
| **Primary Doctor** | `doctor-demo@vitalguard.local`    | `VitalGuardDemo!2026` | `http://localhost:5173/doctor`        |
| **Demo Patient**   | `patient-demo@vitalguard.local`   | `VitalGuardDemo!2026` | `http://localhost:5173/patient`       |
| **Demo Caregiver** | `caregiver-demo@vitalguard.local` | `VitalGuardDemo!2026` | `http://localhost:5173/caregiver`     |

---

## 2. Demo Flow (Minute-by-Minute Guide)

> **Convention:**  
> **Bold text** = What you **SAY** aloud to the grader.  
> Regular text = What you **DO** (clicks, keystrokes, navigation).  
> _Italic text_ = What the grader observes on the screen.

---

### Step 1 (0:00 – 0:30): System Architecture & Landing Page

- **DO:** Open browser to `http://localhost:5173`. Scroll down the landing page showcasing features, roles, and real-time clinical monitoring highlights.
- **SAY:** **"Good morning. Today I am presenting VitalGuard, an end-to-end IoT patient monitoring and clinical triage platform. In traditional remote healthcare, hospitals face high latency and alert fatigue. VitalGuard solves this by streaming high-frequency biometric telemetry over MQTT through a distributed RabbitMQ queue to a real-time analytics worker. The worker computes statistical z-scores and linear regression trends, feeds an in-memory Redis cache, and streams live telemetry to our React web dashboard over WebSocket. I led the web frontend architecture in React 19, the Fastify API auth and governance layers, and the real-time WebSocket protocol."**
- _Grader sees:_ The polished, modern landing page with clean medical branding, active sign-in buttons, and responsive layout.

---

### Step 2 (0:30 – 1:15): New Patient Self-Registration & Device Auto-Provisioning

- **DO:** Click **"Register"** or navigate to `http://localhost:5173/register`.
  - Select Role: **Patient**.
  - Enter Email: `eval-test@vitalguard.local`.
  - Enter Password: `VitalGuardDemo!2026`.
  - Select Preferred Institution: e.g., _City General Hospital_.
  - Click **"Create Account"**.
- **SAY:** **"First, let's look at patient onboarding. When a patient registers, our Fastify API validates inputs using Zod schemas and hashes passwords with Argon2id—which is memory-hard to prevent GPU brute-force attacks. In the backend transaction, we insert the user, initialize their clinical patient profile, and auto-provision an IoT telemetry device profile with simulated vitals. Notice that the patient account is initialized in an 'unassigned' state awaiting doctor pairing."**
- _Grader sees:_ The registration form submits seamlessly, receives a 201 Created with a signed JWT, and immediately redirects the user into their fresh patient portal.

---

### Step 3 (1:15 – 1:45): Patient Portal Entry & Authentication Model

- **DO:** Land on `http://localhost:5173/patient`. Observe the patient dashboard header displaying the user email and connection indicator.
- **SAY:** **"We are now authenticated as our new patient. Our client uses a custom AuthContext storing an HS256 JWT. However, unlike naive implementations that trust static tokens, our API authenticates every single HTTP request directly against PostgreSQL to check whether the account is suspended or requires a password reset. This gives us instant session revocation without maintaining stateful server sessions."**
- _Grader sees:_ The patient dashboard shell with status cards for Heart Rate, SpO2, and Temperature, initial empty states or baseline loading skeletons.

---

### Step 4 (1:45 – 2:45): Live Biometric Streaming over WebSocket & MQTT Pipeline

- **DO:** Keep the patient view on `http://localhost:5173/patient`. Point to the live pulse cards. (If viewing `patient-demo@vitalguard.local`, live updates stream every 500ms).
- **SAY:** **"Now watch the vitals stream in live. In the background, our Python multi-patient simulator publishes biometric packets every second over MQTT to topic `HMS/<device_id>/vitals`. The worker's MQTT bridge pushes them to RabbitMQ. The ingestion consumer computes statistical severity and writes to Redis key `patient:<id>:status`. On the frontend, our WebSocket client connects to `/ws?token=<JWT>` and issues a subscription for this patient ID. To maximize throughput and prevent DB lock contention, the Fastify WebSocket handler polls Redis every 500 milliseconds and pushes telemetry only when biometric values change."**
- _Grader sees:_ Heart Rate (BPM), SpO2 (%), and Body Temperature (°C) updating dynamically in real time with timestamp badges.

---

### Step 5 (2:45 – 3:15): Historical Trend Analytics (24-Hour Window)

- **DO:** Scroll down to the **"Vital History"** interactive Recharts area. Toggle between **Heart Rate**, **SpO2**, and **Temperature**, and click the **24h** range filter.
- **SAY:** **"Beyond instant telemetry, clinicians and patients need historical longitudinal context. The `/patients/:id/vitals/history` API queries timestamp-indexed PostgreSQL rows across 24-hour, 7-day, or 30-day windows. Our Recharts visualization dynamically renders continuous trends, allowing users to spot acute decompensation patterns or post-medication recovery curves."**
- _Grader sees:_ Responsive time-series charts rendering continuous physiological readings smoothly.

---

### Step 6 (3:15 – 4:00): Clinician Triage Dashboard & Priority Queuing

- **DO:** Click **"Log out"** from patient portal. Navigate to `/login` and sign in as the primary doctor:
  - Email: `doctor-demo@vitalguard.local`
  - Password: `VitalGuardDemo!2026`
  - Browser lands on `http://localhost:5173/doctor`.
- **SAY:** **"Now let's switch personas to a physician. I log in as `doctor-demo`. Doctors can only see patients explicitly assigned to them via the `associations` table. Notice how the triage dashboard orders patients: it implements our clinical priority queue—Critical patients ranked 4, Warning ranked 3, Watch ranked 2, and Normal ranked 1. A doctor immediately sees their most unstable patients at the top of their screen without manual sorting."**
- _Grader sees:_ The Doctor Triage board showing patient cards grouped or sorted by severity tier, with real-time indicators and open alert counts.

---

### Step 7 (4:00 – 4:30): Patient Detail View & Dynamic Severity Classification

- **DO:** Click on a patient in the triage list (e.g. `patient-demo`) to open the detailed patient assessment modal/view.
- **SAY:** **"When inspecting an individual patient, we see their real-time biometric readings, threshold limits, and their automated Severity Classification badge. Our analytics worker evaluates five strict clinical rules: multi-vital correlation fires Critical; a static threshold breach combined with an anomalous z-score fires Critical; threshold breaches or linear regression slope warnings trigger Warning; while baseline drift flags Watch. Notice that fall detection was explicitly removed from our ruleset to eliminate false positives in bed-bound patients."**
- _Grader sees:_ The patient detail modal showing exact current numbers, threshold boundaries, active severity badges, and alert histories.

---

### Step 8 (4:30 – 5:15): Administrator Console, Institution Governance & Doctor Approvals

- **DO:** Log out and log in as the administrator:
  - Email: `admin-demo@vitalguard.local`
  - Password: `DemoAdmin!2026`
  - Browser redirects to `http://localhost:5173/administrator`.
  - Click the **"Doctor Requests"** tab.
- **SAY:** **"Next is clinical governance. Medical platforms cannot allow self-onboarded doctors immediate access to protected health information. When a doctor registers, their status is set to 'pending'. On this Administrator Console, the admin reviews the doctor's medical license number, institution affiliation, and clinical specialization. Upon admin approval, the status flips to 'approved' and the doctor is authorized to receive patient assignments. The admin also manages healthcare institutions and pairs unassigned patients to authorized doctors."**
- _Grader sees:_ Administrator dashboard tabs: Overview, Institutions, Doctors, Patients, Caregivers, Audit Log. The Doctor Requests table shows pending applications with Approve/Reject actions.

---

### Step 9 (5:15 – 5:45): Audit Logging & Regulatory Compliance

- **DO:** Click the **"Audit Log"** tab in the Administrator Console.
- **SAY:** **"In healthcare compliance—such as HIPAA and GDPR—every administrative privilege must be auditable. In `admin-routes.ts`, every doctor approval, patient assignment, account suspension, or institution update is committed within a PostgreSQL transaction to the `admin_audit_log` table. The log captures the actor ID, action type, IP address, pre-action state, and post-action state. This guarantees tamper-evident traceability."**
- _Grader sees:_ The audit log table with timestamps, actor emails, specific actions (`doctor.approve`, `patient.assign_doctor`), target IDs, and structured JSON diffs.

---

### Step 10 (5:45 – 6:15): Alert Pipeline, Caregiver Consents & Automated PDF Reports

- **DO:** Stay on the admin or doctor dashboard and gesture toward the architectural cohesion.
- **SAY:** **"Finally, VitalGuard incorporates two automated background workflows: First, caregiver access requires dual-key consent: a caregiver submits a link request, an administrator approves it, and the patient must explicitly consent via their portal before an `association_caregivers` record is granted. Second, our worker runs a scheduled cron job every Sunday at midnight using `node-cron`. It aggregates weekly biometric averages and alert frequencies, generates a structured PDF report using raw stream formatting, stores it on the filesystem, and links it in the `reports` table for doctor and caregiver downloads. This completes the loop from raw sensor data to executive clinical summaries."**
- _Grader sees:_ The full feature set represented cleanly across the interface.

---

### Wrap-Up (6:15 – 6:45): Conclusion & Handover for Q&A

- **SAY:** **"To summarize: VitalGuard combines real-time IoT ingestion with robust healthcare governance, memory-hard authentication, strict role-based access control, and responsive clinician dashboards. That concludes my walkthrough, and I am ready for questions on the codebase."**

---

## 3. Backup Talking Points (If Live Services Glitch)

If any subsystem stalls during the live presentation, stay calm, explain what is occurring in the architecture, and show the exact source code:

1. **If WebSocket doesn't update live in browser:**
   - _What to say:_ **"In development mode, Vite's hot-module reload can occasionally detach the WebSocket stream. Let me show you the subscription logic in `apps/api/src/features/dashboard/routes.ts`: the server verifies the JWT, checks doctor-patient association via `associated()`, and polls Redis key `patient:<id>:status` every 500ms. If the string diffs from previous, it calls `wrapStatusPush()`."**
   - _Code to show:_ [routes.ts](file:///c:/Users/rohan/repos/VitalGuard/apps/api/src/features/dashboard/routes.ts#L241-L308)
2. **If Simulator doesn't send telemetry:**
   - _What to say:_ **"The Python simulator queries `GET /internal/simulated-devices` on the API using the `SIMULATOR_SERVICE_TOKEN`. If the API was restarted, the simulator re-syncs devices on its next 10-second polling cycle. Here in `apps/api/src/features/auth/routes.ts`, when a patient registers, `AUTO_PROVISION_SIMULATED_DEVICE` automatically creates an active simulated device linked to that patient ID."**
3. **If Doctor Triage list is empty:**
   - _What to say:_ **"The doctor triage endpoint `/patients` enforces clinical isolation. A doctor can only see patients with an active record in the `associations` table. If we check the database seed in `apps/api/src/db/seed.ts`, `doctor-demo` is explicitly associated with `patient-demo`. Let me open the administrator panel and assign our new patient to `doctor-demo` to demonstrate live association."**
4. **If Worker crashes or fails:**
   - _What to say:_ **"The beauty of our message broker topology is fault tolerance: RabbitMQ persists unacknowledged messages in the `vitalguard.vitals.ingest` queue. When the worker restarts, it immediately consumes the backlog with zero data loss."**
5. **If PDF download fails:**
   - _What to say:_ **"The PDF report generation is implemented in `apps/api/src/features/dashboard/reports.ts`. It performs SQL aggregation on `vital_readings` and `alerts` over the 7-day period, outputs a valid PDF-1.4 binary stream, and streams it back via Fastify with `Content-Type: application/pdf`."**

---

## 4. Top 5 Common Demo Failures and Quick Recovery

| #     | Failure Symptom                                       | Underlying Cause                                           | Quick Recovery Command (PowerShell)                                                                  |
| :---- | :---------------------------------------------------- | :--------------------------------------------------------- | :--------------------------------------------------------------------------------------------------- |
| **1** | **Port conflict / Address in use (3000, 5173, 5432)** | Stale node or docker process holding port                  | `Get-Process node, python -ErrorAction SilentlyContinue \| Stop-Process -Force` then restart service |
| **2** | **"INVALID_CREDENTIALS" on demo accounts**            | Database was recreated but not seeded                      | `cd apps/api; pnpm db:seed`                                                                          |
| **3** | **WebSocket closed with 4403**                        | Association missing or doctor is not approved              | Ensure logged in as `doctor-demo` (approved) or `patient-demo` viewing own vitals                    |
| **4** | **HTTP 429 Too Many Requests**                        | Exceeded login rate limit (5 per 60s, or admin 3 per 300s) | Restart API process in Terminal 1 (in-memory rate limit Map clears on restart)                       |
| **5** | **Docker container unready / exited**                 | Out-of-order startup in compose                            | `docker compose -f infra/docker-compose.yml restart redis postgres rabbitmq mosquitto`               |

---

## 5. Things NOT to Show (Unless Asked)

To ensure a smooth evaluation and avoid getting sidetracked by known trade-offs, keep these points in mind:

1. **Do NOT open DevTools `Application -> Local Storage` voluntarily:**
   - _Why:_ It shows `vitalguard_token` in `localStorage`. If asked, acknowledge that `httpOnly` cookies are safer against XSS, but localStorage was chosen for cross-origin SPA flexibility and defended with CSP and strict sanitization.
2. **Do NOT open the in-memory rate limiter code voluntarily:**
   - _Why:_ It uses a process-memory `Map<string, { count, resetAt }>` in `auth/routes.ts` rather than Redis `INCR`. If asked, explain it was implemented in-memory for zero external network overhead in single-instance deployments, but would be migrated to Redis `EXPIRE` for multi-instance horizontal scaling.
3. **Do NOT inspect the `generated-reports/` folder on local disk:**
   - _Why:_ Storing PDFs on local disk rather than S3/Azure Blob Storage is a prototype simplification.
4. **Do NOT volunteer that the WebSocket polls Redis:**
   - _Why:_ Pure Redis Pub/Sub is architecturally cleaner; our 500ms polling with value-diffing is a pragmatic change-detection mechanism.
5. **Do NOT highlight synthetic noise in simulator data:**
   - _Why:_ Point toward the statistical classification (z-scores, trends) rather than the mathematical simplicity of the simulator generator.

---

## 6. One-Liner Quick Recovery Script

If everything crashes or you need a complete cold restart in 30 seconds:

```powershell
# Run from c:\Users\rohan\repos\VitalGuard in PowerShell:
docker compose -f infra/docker-compose.yml up -d; cd apps/api; pnpm db:migrate; pnpm db:seed; cd ../..
```

_(Then restart API, Worker, Simulator, and Web in their respective terminals)._
