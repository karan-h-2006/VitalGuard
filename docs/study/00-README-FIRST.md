# 00 — Read This First

This study pack is your comprehensive evaluation prep kit for **VitalGuard**, specifically tailored for Rohan's (241IT064, `@rniszn`) viva and live project defense today. Read this document first to get your bearings, understand the current codebase reality, and know exactly how to handle weak points before the examiners ask.

---

## 1. Master Reading Order & Study Plan

Here is the complete roadmap of all 13 study files plus the master compiled guide. If you have only 30 minutes before your viva, prioritize **00**, **01**, **03**, and **10**.

| File                                               | What It Covers                                                                    | Time (mins) |   Priority    |
| :------------------------------------------------- | :-------------------------------------------------------------------------------- | :---------: | :-----------: |
| **`00-README-FIRST.md`**                           | Reading guide, project reality check, CODEOWNERS note, and examiner traps         |   5 mins    | **Must Read** |
| **`01-project-in-simple-words.md`**                | 30s/2m/5m spoken pitches, patient heart-rate story, and 4 roles                   |   7 mins    | **Must Read** |
| **`02-architecture-and-technology.md`**            | 6-layer architecture, Mermaid diagrams, tech selection rationale, SE concepts     |   12 mins   |     Core      |
| **`03-my-part-deep-dive.md`**                      | Rohan's modules (F.18–F.26): Auth, RBAC, Admin Console, WebSocket, Reports, React |   18 mins   | **Must Read** |
| **`04-demo-script.md`**                            | 8-minute step-by-step live demo script, click instructions, fallback plan         |   10 mins   | **Must Read** |
| **`05-viva-qa-my-part.md`**                        | 60+ spoken Q&A with deep-dive technical follow-ups on Rohan's code                |   20 mins   |     Core      |
| **`06-viva-qa-whole-project.md`**                  | 60+ spoken Q&A on MQTT, RabbitMQ, Worker analytics, simulator, DevOps             |   20 mins   |     Core      |
| **`07-software-engineering-and-srs-questions.md`** | Course mapping (DFDs, SDLC, testing, cohesion/coupling, F.18–F.26 matrix)         |   15 mins   |     Core      |
| **`08-database-and-api-cheat-sheet.md`**           | All DB tables/enums, ER diagram, route catalog, and onboarding flows              |   12 mins   |   Reference   |
| **`09-frontend-cheat-sheet.md`**                   | React component hierarchy, AuthContext, WebSocket client, design tokens           |   10 mins   |   Reference   |
| **`10-one-page-cheat-sheet.md`**                   | Single-page emergency cram sheet: ports, numbers, thresholds, 10 hardest Qs       |   5 mins    | **Must Read** |
| **`11-limitations-and-future-work.md`**            | Honest architectural trade-offs, 10k-patient scaling, production roadmap          |   8 mins    |   Reference   |
| **`12-tricky-questions-and-how-to-answer.md`**     | How to handle unknowns, teammate code, AI tooling defense, and regrets            |   8 mins    |     Core      |
| **`STUDY_GUIDE.md`**                               | Master single-document compilation of the entire study pack                       |   Lookup    |   Reference   |

---

## 2. Today's Project State (Confirmed Ground Truth)

Do not describe outdated design documents or past iterations. Speak only to what currently runs in the repository:

- **Fall Detection is REMOVED**: The file `simulator/processing/fall_detection.py` has been completely deleted. We monitor **Heart Rate (HR)**, **Blood Oxygen (SpO2)**, **Body Temperature**, and **Motion (accelerometer/steps)**. If asked about fall detection, state honestly: _"It was prototyped early on, but removed to prioritize clinical telemetry validation, vital correlation, and SLA alerting."_
- **Multi-Patient Auto-Simulator Exists**: Located at `simulator/manager.py` (run via `pnpm sim`). It polls `GET /internal/simulated-devices` using `SIMULATOR_SERVICE_TOKEN`, discovers active patients, provisions virtual vitals generators with distinct resting baselines within 15 seconds, and handles live scenario injection.
- **Modern UI Redesign Exists**: Fresh landing page at `apps/web/src/features/landing/` and standardized design tokens in `apps/web/src/components/ui/` with responsive layout for patient, caregiver, doctor, and admin portals.
- **OpenAPI Documentation Lags**: The REST definition `apps/api/openapi/openapi.yml` is slightly behind implementation. Specifically, `GET /ws`, `/vitals/history`, `/patients/:id/reports`, and `/patients/:id/thresholds` are functional in Fastify routes but omitted from the YAML specification.
- **Synthetic IoT Data**: Telemetry streams over Mosquitto MQTT on topic `HMS/<device_id>/vitals`, but packets are generated mathematically by the Python simulator, not physical hardware sensors.

---

## 3. CODEOWNERS vs. Evaluation Scope Note

> [!IMPORTANT]
> **The Code Ownership Contradiction Explained:**
> In `.github/CODEOWNERS`, the repository divides ownership as:
>
> - `apps/api/` & `apps/worker/`: Karan (`@karan-h-2006`)
> - `apps/web/`: Rohan (`@rniszn`)
> - `simulator/` & `infra/`: Vikas (`@feyman137035`)
>
> **However, for Rohan's viva evaluation:**
> Rohan owns **SRS Functional Requirements F.18 through F.26** (User Management, Access Control, Clinical Governance, Visualization, Live Push, and System Administration). In practice, this means **Rohan must defend both the API business logic (`apps/api`) and the Web Frontend (`apps/web`)** that realize these features. If the examiner points out CODEOWNERS, answer:
> _"In our GitHub repo, Karan managed the API repository merge reviews while I managed web frontend reviews. However, the architectural design, security controls, and endpoint implementations for Auth, RBAC, Admin Governance, Reports, and WebSockets were built and owned by me as part of requirements F.18–F.26."_

---

## 4. "Be Careful" Weak Points (Examiner Traps)

Examiners love probing architectural shortcuts. Never bluff; acknowledge the trade-off and explain the production mitigation immediately:

1. **JWT Stored in `localStorage`**:
   - _Trap_: "Isn't storing JWTs in localStorage vulnerable to Cross-Site Scripting (XSS)?"
   - _Defense_: "Yes. In this academic prototype, we chose `localStorage` for rapid SPA state synchronization across browser tabs. In a certified production hospital deployment, we would migrate to secure, `httpOnly`, `SameSite=Strict` cookies paired with short-lived tokens and a Redis-backed refresh token rotation scheme."
2. **In-Memory Rate Limiter**:
   - _Trap_: "How does your login rate limiter scale if you run 5 instances of the API?"
   - _Defense_: "Currently, the rate limiter uses an in-memory `Map` per Node.js process (3 attempts/300s for admins, 5 attempts/60s for standard users). If scaled horizontally across multiple instances behind a load balancer, rate limits wouldn't be shared. The production solution is a distributed Redis token-bucket limiter using `ioredis`."
3. **OpenAPI Specification Lag**:
   - _Trap_: "Why are `/ws`, history, reports, and threshold routes missing from `openapi.yml`?"
   - _Defense_: "Our team prioritized rapid feature implementation and automated test coverage for sprint delivery. Keeping the OpenAPI spec manually synced lagged behind. In our next sprint, we would integrate fastify-swagger to generate OpenAPI specs directly from our route schemas."
4. **Local Disk Storage for Reports**:
   - _Trap_: "Where do generated PDF reports live? What happens in a cloud cluster?"
   - _Defense_: "Reports generated via PDFKit are currently saved to a local filesystem mount (`generated-reports/`). In a production multi-tenant cloud environment, this would be an S3 or Azure Blob storage bucket with pre-signed ephemeral URLs."
5. **WebSocket Server Uses Redis Polling**:
   - _Trap_: "Why does your WebSocket route poll Redis every 500ms instead of using Redis Pub/Sub?"
   - _Defense_: "The Fastify WebSocket endpoint (`/ws`) polls the cached hash `patient:<id>:status` every `WEBSOCKET_POLL_INTERVAL_MS` (500ms default) and only sends an envelope when the payload changes. This decoupled the API completely from worker ingestion spikes and was simpler to debug. The production upgrade is subscribing directly to a Redis Pub/Sub channel or RabbitMQ topic."
6. **Simulated Telemetry vs Real Medical Sensors**:
   - _Trap_: "Are you actually reading pulses from real patients?"
   - _Defense_: "No, this is an educational software engineering project under course IT303. Telemetry is synthetically modeled by our Python multi-device simulator to safely simulate emergencies like ventricular tachycardia and hypoxia without human risk."
7. **Database Hit on Every Authenticated Request**:
   - _Trap_: "Why does your auth decorator query Postgres on every single request if you're using JWTs?"
   - _Defense_: "Stateless JWTs cannot instantly detect if an administrator just suspended an account or revoked a doctor's license. Our `authenticate` pre-handler checks `mustChangePassword` and `isSuspended` (and doctor approval) in the database so administrative security revocations take effect immediately rather than waiting for the JWT to expire."

---

## 5. Seed Demo Credentials Cheat Sheet

Use these exact credentials for live viva demonstrations (seeded via `pnpm db:seed` or `node dist/db/seed.js`):

| Role              | Email Address                     | Password              | Purpose / What to Show                                                                      |
| :---------------- | :-------------------------------- | :-------------------- | :------------------------------------------------------------------------------------------ |
| **Administrator** | `admin-demo@vitalguard.local`     | `DemoAdmin!2026`      | 8-tab governance console, doctor licensing approval, patient assignment, scenario injection |
| **Doctor**        | `doctor-demo@vitalguard.local`    | `VitalGuardDemo!2026` | Clinical triage workstation, live vital graphs, custom threshold overrides, PDF downloads   |
| **Patient**       | `patient-demo@vitalguard.local`   | `VitalGuardDemo!2026` | Personal live vitals stream, 24h/7d/30d history charts, caregiver access consent grants     |
| **Caregiver**     | `caregiver-demo@vitalguard.local` | `VitalGuardDemo!2026` | Multi-patient ward roster, caregiver link requests, consenting patient live telemetry       |

> [!TIP]
> Keep this document open during your evaluation as your anchor. Now move to **`01-project-in-simple-words.md`** to practice your spoken pitches!
