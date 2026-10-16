# 10 — One-Page Cheat Sheet

**Candidate:** Rohan (241IT064, `@rniszn`, B.Tech IT NITK)  
**Project:** VitalGuard — Remote Patient Telemetry & Critical Care Monitoring System  
**Role:** Full-Stack Auth, Security, WebSockets, Governance, Admin & Web Frontend (F.18–F.26)

---

## 1. What It Is (In 2 Sentences)

**VitalGuard** is an end-to-end IoT vital-sign telemetry and hospital management system that continuously ingests patient vitals, classifies clinical deterioration via a 5-tier severity engine, and alerts medical staff in real time. It connects **Patients**, **Caregivers**, **Doctors**, and **Administrators** through dedicated, role-tailored web dashboards backed by live WebSocket telemetry and clinical governance.

---

## 2. Stack at a Glance

- **IoT Simulator**: Python multi-device generator (`simulator/manager.py`), MQTT publisher (`pnpm sim`).
- **Broker & Queue**: Eclipse Mosquitto MQTT (`HMS/<device_id>/vitals`) $\rightarrow$ bridge $\rightarrow$ RabbitMQ (`telemetry_exchange`).
- **Worker & Analytics**: Python 3.11 worker, z-score anomaly detection, OLS trend regression, 5-tier severity engine.
- **Datastores**: PostgreSQL 16 (Drizzle ORM; relational state & time-series) + Redis 7 (latest vitals cache, 500ms status).
- **Backend API**: Fastify (TypeScript), Node.js 20, Argon2id, JWT (HS256), `/ws` WebSocket, PDFKit weekly reports.
- **Frontend Web**: React 18 (TypeScript), Vite, Tailwind CSS, Recharts, Lucide icons, responsive multi-role layout.

---

## 3. Telemetry Data Flow (One-Liner Chain)

`Simulator/Wearable` $\rightarrow$ `Mosquitto MQTT (1883)` $\rightarrow$ `MQTT Bridge` $\rightarrow$ `RabbitMQ (5672)` $\rightarrow$ `Python Worker` $\rightarrow$ `Postgres (5432) + Redis (6379)` $\rightarrow$ `Fastify WS (/ws)` $\rightarrow$ `React Web (5173)`

---

## 4. 5 Severity Classification Rules (In Priority Order)

1. **Correlation $\rightarrow$ Critical**: HR and $\text{SpO}_2$ are both simultaneously abnormal (e.g., tachycardia + hypoxia).
2. **Threshold + Anomalous $\rightarrow$ Critical**: Breaches static clinical boundary **AND** $|z| > 3.0$ standard deviations.
3. **Threshold OR Anomalous OR Trend $\rightarrow$ Warning**: Single boundary breach, $|z| > 3.0$, or regression slope $> 0.05/\text{min}$.
4. **Watch Anomaly $\rightarrow$ Watch**: Baseline anomaly ($2.0 < |z| \le 3.0$) with no threshold breach.
5. **Else $\rightarrow$ Normal**: Physiological reading is within baseline and standard clinical limits.

---

## 5. Rohan's Ownership (F.18–F.26)

- **Auth & Access Control (F.18–F.21)**: Argon2id password hashing, HS256 JWT, DB-backed revocation check on every request, in-memory rate limiting, dual-consent caregiver access model.
- **Real-Time Telemetry & Reports (F.22–F.24)**: Fastify WebSocket push (`GET /ws?token=...`), live triage workstation (Critical $>$ Warning $>$ Watch $>$ Normal), automated Sunday midnight PDFKit reports.
- **Admin Governance & Web (F.25–F.26)**: 8-tab Admin Console (doctor approvals, suspensions, clinic assignment, scenario injection), immutable audit logs, full React 18 web client (`apps/web`).

---

## 6. Key Authentication Facts

- **Password Hashing**: **Argon2id** (memory-hard, resistant to GPU/ASIC brute-force cracking; RFC 9106).
- **Token Format**: **HS256 JWT** signed with secret ($\ge 32$ chars); 15-minute lifespan; passed via `Authorization: Bearer <token>`.
- **Anti-Enumeration**: Constant-time comparison; returns identical `INVALID_CREDENTIALS` (HTTP 401) for unknown email or wrong password.
- **Near-Immediate Revocation**: Fastify `authenticate` decorator queries Postgres on **every request** to verify `is_suspended = false` and `must_change_password = false`.
- **Brute-Force Rate Limiter**: Process-local in-memory sliding window `Map` (Admin: 3 attempts/300s; Doctor/User: 5 attempts/60s).

---

## 7. JWT Claims Payload

`{ sub: "<UUID>", role: "patient"|"caregiver"|"doctor"|"administrator", iat: 1713000000, exp: 1713000900, patientId: "<UUID>" }` _(Note: `patientId` claim is included only for patient accounts)._

---

## 8. WebSocket in 2 Lines

Client opens `GET /ws?token=<JWT>`; server verifies token and establishes connection. A 500ms server-side `setInterval` timer polls Redis hash `patient:<id>:status` and flushes a JSON frame to the browser **only if the telemetry payload has changed**.

---

## 9. Weaknesses & Honest Viva Answers

| Known Weakness              | What You Say If Asked                                                                                     | Production-Grade Upgrade                                                                       |
| :-------------------------- | :-------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------- |
| **JWT in `localStorage`**   | "Academic prototype trade-off for rapid SPA tab sync; acknowledged XSS vulnerability."                    | `httpOnly`, `SameSite=Strict` cookies with short expiry + Redis-backed refresh token rotation. |
| **In-Memory Rate Limiter**  | "Map-based state is per-process; resets on reboot and does not synchronize across API replicas."          | Distributed Redis token-bucket limiter using `ioredis`.                                        |
| **Local Disk Reports**      | "PDFKit writes to `generated-reports/` on local disk; multi-container clusters cannot share files."       | S3 or MinIO object storage bucket with pre-signed ephemeral download links.                    |
| **WebSocket Polling Redis** | "500ms polling decouples ingestion from API, but wastes cycles and creates a connection-per-client loop." | Event-driven architecture using Redis Pub/Sub channels or Server-Sent Events (SSE).            |
| **Simulated IoT Telemetry** | "Educational project (NITK IT303); data is mathematically simulated to avoid clinical patient risk."      | ESP32/Arduino microcontroller streaming identical JSON schema over Mosquitto MQTT.             |

---

## 10. Database Tables at a Glance (PostgreSQL)

| Table Name                    | 3-Word Purpose                  | Key Relationship                                                                  |
| :---------------------------- | :------------------------------ | :-------------------------------------------------------------------------------- |
| **`users`**                   | Identity and credentials        | Parent of all user roles, devices, and audit entries                              |
| **`patient_profiles`**        | Patient clinical metadata       | 1:1 with `users.id`; links to preferred `institutions`                            |
| **`doctor_profiles`**         | Doctor medical credentials      | 1:1 with `users.id`; medical license & admin approval state                       |
| **`institutions`**            | Hospitals and clinics           | Parent of doctor affiliations and patient preferences                             |
| **`devices`**                 | Edge telemetry units            | Bound to `patient_id`; flags simulated vs. physical                               |
| **`vital_readings`**          | Time-series telemetry records   | Sensor readings with quality flags and severity tiers                             |
| **`baselines`**               | Statistical baseline windows    | 7-day rolling mean ($\mu$) and standard deviation ($\sigma$)                      |
| **`thresholds`**              | Personalized clinical limits    | Clinician-configured custom min/max overrides per vital                           |
| **`alerts`**                  | Active clinical incidents       | Incident lifecycle (`open` $\rightarrow$ `acknowledged` $\rightarrow$ `resolved`) |
| **`associations`**            | Doctor-patient assignments      | Links doctors to patients; enforces `is_primary` flag                             |
| **`association_caregivers`**  | Caregiver-patient links         | Grants read-only telemetry access to approved caregivers                          |
| **`caregiver_link_requests`** | Caregiver consent requests      | Dual governance: Admin approval + Patient consent                                 |
| **`reports`**                 | Weekly generated summaries      | Metadata and local disk path for generated PDF files                              |
| **`notifications`**           | In-app user notifications       | Targeted alert dispatches with read/unread status                                 |
| **`audit_log`**               | Alert state transitions         | Tracks doctor acknowledgments and SLA escalation history                          |
| **`admin_audit_log`**         | Administrative security actions | Immutable record of suspensions, approvals, and mutations                         |

---

## 11. Demo Accounts & Seed Credentials

| Role              | Email                             | Password              | What to Showcase                                                        |
| :---------------- | :-------------------------------- | :-------------------- | :---------------------------------------------------------------------- |
| **Administrator** | `admin-demo@vitalguard.local`     | `DemoAdmin!2026`      | 8-tab governance console, doctor licensing approval, scenario injection |
| **Doctor**        | `doctor-demo@vitalguard.local`    | `VitalGuardDemo!2026` | Real-time triage workstation, threshold override, live vitals chart     |
| **Patient**       | `patient-demo@vitalguard.local`   | `VitalGuardDemo!2026` | Personal vitals stream, historical charts, caregiver consent approval   |
| **Caregiver**     | `caregiver-demo@vitalguard.local` | `VitalGuardDemo!2026` | Multi-patient ward roster, caregiver link requests, live patient vitals |

---

## 12. Ports & Infrastructure Map

| Port             | Service                      | Protocol    | Key Command / Usage                             |
| :--------------- | :--------------------------- | :---------- | :---------------------------------------------- |
| **3000**         | Fastify REST & WebSocket API | HTTP / WS   | `pnpm api:dev` (`apps/api`)                     |
| **5173**         | React Web Portal             | HTTP        | `pnpm web:dev` (`apps/web`)                     |
| **5432**         | PostgreSQL 16                | TCP         | Database storage (Drizzle ORM)                  |
| **6379**         | Redis 7                      | TCP         | Telemetry cache & status polling                |
| **5672 / 15672** | RabbitMQ                     | AMQP / HTTP | Telemetry message queue / Management UI         |
| **1883**         | Eclipse Mosquitto            | MQTT        | IoT telemetry broker (`HMS/<device_id>/vitals`) |

---

## 13. Top 10 Viva Trick Questions — Instant Answers

1. **Q: Why was fall detection removed?**  
   _A:_ Accelerometer data produced excessive false positives without multi-sensor fusion; removed to focus on high-fidelity clinical telemetry (HR, $\text{SpO}_2$, Temp).
2. **Q: Why hit Postgres on every request if JWT is stateless?**  
   _A:_ Stateless tokens cannot detect instant administrative account suspension or doctor license revocation; DB lookup provides immediate security enforcement.
3. **Q: Why poll Redis every 500ms instead of using Redis Pub/Sub?**  
   _A:_ Polling cleanly decouples the API from worker ingestion bursts, simplifies connection teardown, and inherently deduplicates unchanged frames.
4. **Q: Why choose Argon2id over bcrypt?**  
   _A:_ Argon2id is memory-hard and time-hard, providing superior resistance against GPU and ASIC parallel cracking attacks (recommended by RFC 9106 and OWASP).
5. **Q: What happens if RabbitMQ crashes?**  
   _A:_ The MQTT bridge buffers packets locally or fails gracefully; incoming data pauses until RabbitMQ recovers, protecting PostgreSQL from cascading lock crashes.
6. **Q: Can a caregiver view patient vitals without permission?**  
   _A:_ Never. The caregiver link requires dual governance: operational approval from an Administrator **AND** explicit clinical consent (`granted`) from the Patient.
7. **Q: How does the system handle sensor clock drift?**  
   _A:_ The IoT packet contains a client timestamp, but our ingestion pipeline stamps an authoritative server `received_at` timestamp for all time-series sorting.
8. **Q: Why store vital readings in PostgreSQL instead of InfluxDB or MongoDB?**  
   _A:_ PostgreSQL gives us ACID transactions and strict relational integrity across users, alerts, and vitals in a unified academic schema without multi-database sprawl.
9. **Q: Why does the OpenAPI specification lag behind the code?**  
   _A:_ Fast iteration during sprints led to manual spec drift; in production, we would use Fastify schema auto-generation to compile `openapi.yml` directly from route schemas.
10. **Q: Is VitalGuard HIPAA-compliant today?**  
    _A:_ No. While we enforce RBAC, audit logging, and Argon2id hashing, full HIPAA compliance requires field-level encryption at rest, BAA-certified infrastructure, and mandatory 2FA.
