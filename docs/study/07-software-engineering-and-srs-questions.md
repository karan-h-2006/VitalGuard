# 07 — Software Engineering and SRS Questions

Evaluation study material for **Rohan (241IT064, @rniszn, B.Tech IT NITK)** for the **VitalGuard** project evaluation today.

---

## 1. What is an SRS?

A **Software Requirements Specification (SRS)** is a formal, comprehensive document that defines the complete operational behavior, capabilities, constraints, and boundaries of a software system before and during its development. In academic and industrial software engineering, the SRS serves as:

1. **A Contractual Baseline**: It establishes a formal agreement between stakeholders (hospital administrators, clinical doctors, patients) and the engineering team regarding what will be built.
2. **The Source of Truth**: It bridges customer expectations and technical architecture, preventing scope creep and ambiguity.
3. **The Foundation for Verification**: It provides the concrete criteria against which quality assurance engineers write test cases and examiners evaluate system completeness.

An SRS typically adheres to international standards (such as **IEEE 830 / ISO/IEC/IEEE 29148**) and is structured into:

- **Functional Requirements (FRs)**: Statements of services the system must provide, reactions to specific inputs, and behavior under error conditions.
- **Non-Functional Requirements (NFRs)**: Quality attributes and constraints, including performance, security, reliability, availability, usability, and regulatory compliance.
- **System Constraints & Interfaces**: Hardware interfaces, communications protocols (MQTT, WebSockets, HTTPS), and software platform constraints.

---

## 2. VitalGuard SRS Overview & Functional Breakdown

VitalGuard’s functional requirements are organized into three primary engineering modules spanning 26 specific requirements (**F.1 through F.26**), divided across the three team members:

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             VitalGuard Platform                                  │
├──────────────────────────┬──────────────────────────┬────────────────────────────┤
│ Vikas (@feyman137035)    │ Karan (@karan-h-2006)    │ Rohan (@rniszn)            │
│ Edge, Ingestion & DevOps │ Processing & Analytics   │ Portals, Access & Admin    │
│ Requirements: F.1 – F.7  │ Requirements: F.8 – F.17 │ Requirements: F.18 – F.26  │
└──────────────────────────┴──────────────────────────┴────────────────────────────┘
```

### Module 1: Data Acquisition, Edge Processing & Ingestion (F.1–F.7 — Vikas)

- **F.1 — Vital Sign Telemetry Capture**: Collects Heart Rate (bpm), Blood Oxygen Saturation (SpO2 %), Body Temperature (°C), and Physical Motion (activity level) from wearables or simulated sources. _(Note: Fall detection was removed due to excessive accelerometer noise)._
- **F.2 — Edge Signal Conditioning & Quality Flagging**: Applies a sliding median filter to attenuate sensor noise and assigns data quality flags (`clean`, `noisy`, or `implausible`).
- **F.3 — Telemetry Serialization & Schema Validation**: Serializes sensor frames into JSON packets adhering strictly to `schemas/vital-sample.schema.json`.
- **F.4 — Low-Overhead MQTT Telemetry Streaming**: Streams packets over MQTT topic `HMS/<device_id>/vitals` with QoS 1 guarantees to Eclipse Mosquitto.
- **F.5 — Protocol Bridging & Pre-Ingestion Routing**: Subscribes to MQTT topics, checks device registration, and routes valid packets into the message broker.
- **F.6 — Decoupled Message Buffering & Dead-Lettering**: Pushes validated telemetry into RabbitMQ exchange `vitals`, routing clean payloads to `vitals.ingest` and malformed payloads to `vitals.deadletter`.
- **F.7 — Multi-Device Autonomous Simulation & Auto-Discovery**: Manages multi-patient virtual wearables via `simulator/manager.py`, discovering new patient devices via internal REST APIs.

### Module 2: Analytics, Alerting, Escalation & Reporting (F.8–F.17 — Karan)

- **F.8 — Static Clinical Threshold Evaluation**: Compares readings against standard clinical boundaries (HR: 60–100 bpm, SpO2: ≥ 95%, Temp: 36.1–37.5°C) and custom clinician overrides.
- **F.9 — Rolling Personalized Baseline Tracking**: Maintains dynamic 7-day sliding-window distributions (mean and standard deviation) in Redis sorted sets and PostgreSQL.
- **F.10 — Statistical Z-Score Anomaly Detection**: Calculates deviation $z = \frac{x - \mu}{\sigma}$ to identify patient-specific anomalies regardless of population averages.
- **F.11 — Multi-Vital Correlation Engine**: Identifies complex physiological deterioration patterns (e.g., concurrent tachycardia, fever, and hypoxemia within 30 minutes).
- **F.12 — Predictive Linear Trend Detection**: Uses Ordinary Least Squares (OLS) regression over recent readings to forecast threshold crossings within 30 minutes.
- **F.13 — 5-Tier Clinical Severity Classification**: Synthesizes thresholds, z-scores, correlations, and trends into discrete tiers: Normal, Watch, Warning, and Critical.
- **F.14 — Edge-Triggered Alert Generation**: Persists clinical alert records in PostgreSQL `alerts` upon worsening severity transitions without duplicate spam.
- **F.15 — Multi-Channel Critical Notification Dispatch**: Dispatches urgent alerts via email (Resend) and SMS (Twilio), with fallback to a structured console sandbox.
- **F.16 — Critical Alert SLA Escalation**: Executes a 30-second escalation cron checking unacknowledged Critical alerts past their 5-minute deadline and bumping escalation levels.
- **F.17 — Automated Weekly Clinical PDF Summaries**: Uses node-cron and PDFKit to generate weekly patient summary reports every Sunday at midnight.

### Module 3: Access Control, Web Dashboards & Administration (F.18–F.26 — Rohan)

- **F.18 — Multi-Role Self-Registration & Argon2id Hashing**: Supports registration for patients, caregivers, and doctors, securing credentials with salted Argon2id password hashing.
- **F.19 — Stateless JWT Authentication & DB-Backed Revocation**: Issues signed HS256 tokens and performs database checks on every request for account suspension and required password resets.
- **F.20 — Role-Based Access Control & Physician Credentialing**: Enforces RBAC pre-handlers (`requireRoles`), restricting doctor operations until approved by an administrator.
- **F.21 — Patient Consent & Association Security**: Enforces clinical boundaries via `requireAssociation()`, allowing doctors access only to assigned patients and caregivers only to consenting patients.
- **F.22 — Patient Health Dashboard & Interactive Telemetry**: Delivers real-time vital cards, live severity badges, and interactive 24h/7d/30d Recharts historical charts.
- **F.23 — High-Throughput WebSocket Status Streaming**: Provides a Fastify WebSocket endpoint (`GET /ws?token=...`) that polls Redis patient status keys every 500ms and pushes live changes to browsers.
- **F.24 — Doctor Clinical Triage Workstation**: Presents doctors with a patient roster dynamically sorted by severity rank (Critical > Warning > Watch > Normal), with threshold override controls.
- **F.25 — Caregiver Monitoring & Patient Linking**: Enables caregivers to request access to patients, view consenting patient vitals, and track active alerts.
- **F.26 — 8-Tab Administrative Governance Console**: Provides administrators with complete oversight over doctor licensing, patient assignment, clinic transfer, scenario injection, and immutable audit logging.

---

## 3. SDLC Model Used in VitalGuard

### Model: Agile / Iterative & Incremental SDLC

VitalGuard was developed using an **Iterative and Incremental Software Development Life Cycle (SDLC)** model based on Agile principles:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Iterative Agile Lifecycle                       │
│                                                                        │
│   Sprint 1 (Mod 1-2): MQTT Ingestion & RabbitMQ Pipeline               │
│         │                                                              │
│         ▼                                                              │
│   Sprint 2 (Mod 3-4): Z-Score Analytics, Severity Engine & Alerts      │
│         │                                                              │
│         ▼                                                              │
│   Sprint 3 (Mod 5):   Argon2id Auth, RBAC & Association Model          │
│         │                                                              │
│         ▼                                                              │
│   Sprint 4 (Mod 6):   Web Portals, WebSocket Streaming & Admin Console │
│         │                                                              │
│         ▼                                                              │
│   Sprint 5:           System Hardening, Verification & Docs Pack       │
└────────────────────────────────────────────────────────────────────────┘
```

### Why this model fits VitalGuard:

1. **Vertical Slice Implementation**: Rather than building the entire backend before touching the frontend, the team delivered functional vertical slices across distinct sprints (e.g., streaming a single vital sign end-to-end from Python to RabbitMQ to Postgres before layering complex multi-vital analytics).
2. **Managing Changing Requirements**: Real-world prototyping revealed that fall detection via raw accelerometer data generated unacceptable false-alarm rates. The iterative model allowed the team to safely deprecate fall detection (`chore/remove-fall-detection`) and refine the telemetry schema without derailing project timelines.
3. **Branch-and-PR Integration**: Development progressed through Git feature branches (`feature/admin-governance`, `feature/module-3-analytics`, `feature/ui-redesign`), each submitted as a Pull Request, verified by automated GitHub Actions CI, and code-reviewed by peers before merging into `main`.
4. **Frequent Demonstratable Milestones**: Each iteration produced a runnable, testable build verifiable via Docker Compose, culminating in an end-to-end automated verification script (`scripts/test-e2e.ps1`).

---

## 4. Requirement Types Q&A (10 Q&A)

**Q1: What is the fundamental difference between a functional and a non-functional requirement?**  
A: A **Functional Requirement (FR)** defines _what_ specific behaviors, services, operations, and data transformations the software must execute (e.g., "The system shall calculate a z-score when a vital reading arrives"). A **Non-Functional Requirement (NFR)** defines _how well_ the system must perform those functions, establishing quality attributes, performance constraints, and architectural standards (e.g., "The ingestion consumer must process vitals within 200 milliseconds of arrival").

**Q2: What are the primary Non-Functional Requirements defined for VitalGuard?**  
A: VitalGuard specifies six primary NFR categories:

1. **Performance**: Telemetry ingestion latency < 2 seconds from edge to dashboard; API queries < 100ms.
2. **Security**: Passwords hashed with Argon2id; HS256 JWT tokens; role-based access control; immutable audit logging.
3. **Availability & Reliability**: Services restart automatically (`unless-stopped`); message queues are disk-backed to prevent data loss.
4. **Scalability**: Decoupled asynchronous message processing via RabbitMQ and Redis caching.
5. **Usability**: Responsive role-tailored dashboards with client-side error isolation via React Error Boundaries.
6. **Regulatory Compliance**: Adherence to medical data privacy principles (HIPAA/GDPR) through strict patient consent models.

**Q3: How is the Performance NFR specified and verified in VitalGuard?**  
A: The performance requirement states that the pipeline must ingest, classify, and persist telemetry within a 2-second time budget. This is achieved by offloading time-series writes to asynchronous RabbitMQ queues, performing rolling baseline math in Redis RAM rather than running heavy aggregate SQL queries over PostgreSQL, and caching active triage statuses in Redis. In testing, typical end-to-end latency from MQTT publish to Redis cache update is under 150 milliseconds.

**Q4: How does VitalGuard specify and fulfill the Availability NFR?**  
A: The availability requirement demands uninterrupted vital sign acquisition even during API restarts or worker maintenance. In `infra/docker-compose.yml`, Mosquitto and RabbitMQ run independently of the Fastify API. If the API or frontend goes down, the edge simulator and MQTT broker continue accepting telemetry. RabbitMQ persists messages in durable queues until consumers recover, guaranteeing zero telemetry loss during transient downtime.

**Q5: What is the Confidentiality and Security NFR in VitalGuard?**  
A: The security NFR requires that protected health information (PHI) must be accessible exclusively to verified, authorized healthcare stakeholders. VitalGuard implements this through defense-in-depth: Argon2id password hashing, JWT authorization headers, per-request database verification of account suspension status, and mandatory doctor licensing approval by an administrator before clinical triage access is granted.

**Q6: What is the Usability NFR and how does the frontend implement it?**  
A: The usability NFR mandates clear, cognitive-load-reducing clinical interfaces that prevent medical error. The React application uses role-specific views so clinicians see triage rosters prioritized by severity, while patients see simple color-coded badges and charts. To prevent UI frustration, React Error Boundaries isolate component failures, rendering inline retry controls instead of blank screens.

**Q7: How is the Scalability NFR addressed architecturally?**  
A: Scalability is achieved by decoupling components using message queues. Ingestion is separated from analytics: Mosquitto forwards messages to RabbitMQ, allowing multiple consumer worker instances to pull from `vitals.ingest` concurrently. High-volume read traffic for dashboards is served from Redis sorted sets and status keys, shielding PostgreSQL from repetitive polling queries.

**Q8: What is a Use Case and how does it relate to SRS requirements?**  
A: A **Use Case** is a structured behavioral scenario that describes an interaction between an external actor (e.g., Doctor, Patient) and the system to achieve a specific business goal. While an SRS functional requirement states a technical rule (e.g., "The system shall escalate unacknowledged alerts"), a Use Case captures the user's workflow, preconditions, main flow of events, alternative branches, and postconditions.

**Q9: Can you describe a core Use Case in VitalGuard?**  
A: **Use Case: Clinician Triages Deteriorating Patient.**

- _Actor_: Approved Doctor.
- _Precondition_: Doctor is authenticated and assigned to Patient via `associations`.
- _Trigger_: Analytics worker detects multi-vital correlation, sets severity to Critical, and raises an alert.
- _Main Flow_: Doctor opens `/doctor`, sees the patient at the top of the triage roster highlighted in red with an active SLA countdown, inspects historical charts, acknowledges the alert, and enters custom threshold overrides.
- _Postcondition_: Alert status changes to `acknowledged`, escalation timer halts, and an audit event is logged in `audit_log`.

**Q10: What is the difference between UML modeling and code implementation, and why do both matter?**  
A: UML (Unified Modeling Language) models provide an abstract, high-level architectural blueprint of system structures and interactions (e.g., Class diagrams, Sequence diagrams, ER diagrams) before code is written, ensuring teams align on design. Code implementation represents the executable reality with syntax, frameworks, and edge-case handling. Software engineering requires both: UML ensures conceptual soundness and traceability, while code realizes the specification.

---

## 5. Design Patterns Used (with Code Evidence)

VitalGuard incorporates established object-oriented and architectural design patterns across its codebase:

### 1. Observer Pattern

- **Concept**: A subject maintains a list of dependents and notifies them automatically of any state changes.
- **Evidence in Code**: The WebSocket gateway in `apps/api/src/features/dashboard/routes.ts` observes the Redis status key (`patient:<id>:status`) via a periodic interval timer. When a new classification is detected, the server acts as an observer subject, broadcasting the updated status envelope (`wrapStatusPush`) to subscribed client sockets.

### 2. Publisher-Subscriber (Pub/Sub) Pattern

- **Concept**: Senders (publishers) categorize messages without knowing who the receivers (subscribers) are.
- **Evidence in Code**: Eclipse Mosquitto and RabbitMQ. Wearables publish telemetry to MQTT topic `HMS/<device_id>/vitals`. The worker bridge subscribes to `HMS/+/vitals`. The bridge then publishes to RabbitMQ's topic exchange `vitals`, which routes messages to bound queues (`vitals.ingest` and `vitals.deadletter`) based on routing keys.

### 3. Repository / Data Access Layer Pattern

- **Concept**: Encapsulates data storage and retrieval logic behind a clean programmatic API, decoupling domain logic from raw database drivers.
- **Evidence in Code**: Drizzle ORM client initialization in `apps/api/src/db/client.ts` and `apps/worker/src/db.ts`. Domain routes query the database using type-safe schema entities (`users`, `vitalReadings`, `alerts`) without hand-writing raw SQL string queries, allowing database operations to be swapped or refactored centrally.

### 4. Decorator Pattern

- **Concept**: Attaches additional responsibilities or behavior to an object or function dynamically without modifying its core structure.
- **Evidence in Code**: Fastify route decorators and pre-handlers in `apps/api/src/plugins/auth.ts`. Fastify decorates the server and request objects with `app.decorate('authenticate', ...)` and `app.decorateRequest('authUser', ...)`. Routes attach authorization behavior dynamically using pre-handler decorators:
  ```typescript
  {
    preHandler: [
      app.authenticate,
      requireRoles('doctor'),
      requireAssociation(),
    ];
  }
  ```

### 5. Strategy Pattern

- **Concept**: Defines a family of interchangeable algorithms, encapsulates each one, and selects an algorithm at runtime based on context.
- **Evidence in Code**: The severity decision table in `apps/worker/src/analytics/severity.ts`. Each `SeverityDecision` object defines its own evaluation strategy (`matches(context)`) and explanation generation strategy (`explain(context)`):
  ```typescript
  type SeverityDecision = {
    tier: ClassificationResult['tier'];
    matches: (context: ClassificationContext) => boolean;
    explain: (context: ClassificationContext) => string;
  };
  ```

### 6. Chain of Responsibility Pattern

- **Concept**: Passes a request along a chain of handlers; upon receiving a request, each handler decides either to process the request or pass it to the next handler.
- **Evidence in Code**: The sequential evaluation of severity tiers in `apps/worker/src/analytics/severity.ts`. The context passes through an ordered array of decisions:
  1. _Rule 1_: Check multi-vital correlation. If matched, terminate as **Critical**.
  2. _Rule 2_: Check threshold breach AND anomalous z-score. If matched, terminate as **Critical**.
  3. _Rule 3_: Check threshold breach OR anomalous z-score OR trend warning. If matched, terminate as **Warning**.
  4. _Rule 4_: Check watch-level anomaly. If matched, terminate as **Watch**.
  5. _Rule 5_: Catch-all default; terminate as **Normal**.

---

## 6. Testing Strategy Q&A (8 Q&A)

**Q1: What is the difference between Unit, Integration, and End-to-End (E2E) testing?**  
A: **Unit testing** tests individual functions or classes in complete isolation from external services, using mocks for I/O (e.g., testing that `computeAnomalyFlag` returns `'anomalous'` when $|z| \ge 2.0$). **Integration testing** verifies that multiple modules or services cooperate correctly, running against real backing datastores (e.g., verifying that the consumer inserts 4 rows into PostgreSQL and updates Redis). **End-to-End (E2E) testing** tests the entire software system from the user interface down through all brokers and databases (e.g., running `scripts/test-e2e.ps1` to register a patient, publish MQTT vitals, and verify that the dashboard renders the reading).

**Q2: How are Unit Tests structured in VitalGuard?**  
A: Unit tests are written using **Vitest** for TypeScript packages and **pytest** for Python. They focus on deterministic mathematical algorithms and business logic without spinning up Docker. For example, `apps/worker/src/analytics/severity.test.ts` executes test vectors covering every branch of the 5-tier decision table, and `apps/api/src/plugins/auth.test.ts` tests `decideRbacAccess` as a pure function across all role combinations.

**Q3: How are Integration Tests run in VitalGuard and what infrastructure do they require?**  
A: Integration tests reside in `apps/worker` and `apps/api` and require running Docker infrastructure (PostgreSQL, Redis, RabbitMQ). They are invoked using `RUN_INTEGRATION_TESTS=true pnpm test:integration`. These tests connect to the real databases, publish actual messages into RabbitMQ queues, verify consumer idempotency, and test real database transactions without mocking.

**Q4: What external dependencies are mocked in VitalGuard tests?**  
A: External third-party networks and hardware are mocked:

- **Email/SMS Dispatches**: Resend and Twilio API clients are mocked using sandbox dispatchers that record payloads in memory or stdout.
- **Hardware Sensors**: Physical PPG and temperature probes are replaced by the mathematical Python simulator.
- **Time/Timers**: Test suites use Vitest's `vi.useFakeTimers()` to fast-forward SLA acknowledgment windows and test escalation cron triggers deterministically.

**Q5: What components are NOT covered by automated tests (Technical Debt)?**  
A: Three areas lack automated test coverage:

1. **Multi-Instance Rate Limiter**: The login rate limiter uses an in-memory `Map` within a single process; its behavior across clustered API replicas is not tested.
2. **WebSocket High-Concurrency Load**: While WebSocket functional connection is tested, high-concurrency client subscription load has not been stress-tested.
3. **PDF Visual Layout**: PDFKit reports verify metadata insertion into the database, but pixel-level layout and PDF rendering are not asserted automatically.

**Q6: How does VitalGuard test database idempotency?**  
A: In `apps/worker/src/consumer/idempotency.test.ts`, an identical valid vital telemetry sample is published to RabbitMQ twice. The test asserts that exactly 4 rows are inserted into `vital_readings` (one per vital type), that the database's `ON CONFLICT DO NOTHING` clause catches the redelivery, and that Redis baseline calculations are executed only once.

**Q7: How are the Python simulator components tested?**  
A: In `simulator/tests/`, `pytest` executes unit tests covering the `SimulatedSensorSource`, `VitalNoiseFilter`, and `MotionProcessor`. Tests verify that random walks remain bounded within physiological human maximums, that median filtering successfully suppresses noise spikes, and that JSON telemetry packets validate against `schemas/vital-sample.schema.json`.

**Q8: What is a Regression Test and how does CI prevent regressions?**  
A: A **Regression Test** confirms that recent code modifications have not broken existing functionality or re-introduced resolved bugs. VitalGuard uses GitHub Actions (`.github/workflows/ci.yml`) as an automated quality gate: every commit and pull request automatically triggers linting, TypeScript compilation, Vitest test suites, and Python unit tests. A PR cannot merge if any existing test fails.

---

## 7. Version Control and Branching Q&A (5 Q&A)

**Q1: What branching strategy was used in VitalGuard?**  
A: VitalGuard uses a **Feature Branch Workflow** (similar to GitHub Flow). The `main` branch represents stable, deployable code protected by CI checks. Developers never commit directly to `main`; all new work is developed in isolated branches branched from `main` and merged exclusively via reviewed Pull Requests.

**Q2: What branch prefixes are used in this repository and what does each signify?**  
A: The repository adheres to standard semantic branch naming:

- `feature/<name>` (e.g., `feature/admin-governance`, `feature/module-3-analytics`): New end-user capabilities or modules.
- `fix/<name>` (e.g., `fix/ci-failures`): Bug fixes and defect resolution.
- `chore/<name>` (e.g., `chore/remove-fall-detection`): Maintenance, cleanup, dependency updates, or code removals.
- `docs/<name>` (e.g., `docs/evaluation-study-pack`, `docs/readme-update`): Documentation additions and updates.

**Q3: What is a Pull Request (PR) and how does it serve as a quality gate?**  
A: A **Pull Request** is a collaborative mechanism in Git platforms where a developer announces that a feature branch is ready for review. In VitalGuard, a PR serves as an automated and peer-reviewed quality gate:

1. Automated CI must pass (zero TypeScript errors, zero lint warnings, 100% passing test suites).
2. Code review must be approved by designated module owners as mapped in `.github/CODEOWNERS`.
3. Branch merges are recorded as clean, traceable merge commits preserving project history.

**Q4: What are Conventional Commits and why did the team use them?**  
A: **Conventional Commits** is a standardized specification for formatting Git commit messages using structured prefixes: `feat:` (new feature), `fix:` (bug fix), `chore:` (tooling/cleanup), `docs:` (documentation), and `refactor:` (code restructuring). VitalGuard enforces this to maintain an immaculate, human-readable commit history, facilitate automated changelog generation, and provide explicit context during peer review.

**Q5: What is the purpose of the `.github/CODEOWNERS` file?**  
A: The `CODEOWNERS` file defines which team member is responsible for specific files or directories in the repository. When a Pull Request is opened, GitHub automatically requests a review from the designated owner:

- `apps/web/` → `@rniszn` (Rohan: frontend web, dashboards, admin UI)
- `apps/api/`, `apps/worker/` → `@karan-h-2006` (Karan: backend API, analytics, alerting)
- `simulator/`, `infra/`, `.github/` → `@feyman137035` (Vikas: edge simulator, Docker infrastructure, CI)

---

## 8. Security in Software Engineering (5 Q&A)

**Q1: How does VitalGuard address the OWASP Top 10 vulnerabilities?**  
A: VitalGuard mitigates key web application security risks:

- **A01: Broken Access Control**: Enforced through Fastify decorators (`requireRoles`, `requireAssociation`), database-backed doctor licensing checks, and patient consent verification.
- **A02: Cryptographic Failures**: Passwords hashed with memory-hard Argon2id; JWTs signed with HS256; production TLS enforced by Caddy; strict detection of default `CHANGE_ME` secrets.
- **A03: Injection (SQL/NoSQL)**: Drizzle ORM uses parameterized SQL queries exclusively; user input is never concatenated into raw SQL strings. Input validation is handled strictly via Zod schemas.
- **A07: Identification & Authentication Failures**: Returns uniform `INVALID_CREDENTIALS` to prevent user enumeration; enforces in-memory rate limiting against brute-force attacks; enforces password resets on first-time admin login.

**Q2: What is HIPAA and why does a health monitoring system care about it?**  
A: The **Health Insurance Portability and Accountability Act (HIPAA)** is a US federal law establishing data privacy and security standards for safeguarding Protected Health Information (PHI). VitalGuard aligns with HIPAA principles through:

1. **Access Control**: Users can only access patient data required for their clinical role.
2. **Patient Consent**: Telemetry cannot be shared with caregivers without explicit patient authorization.
3. **Audit Controls**: Immutable audit logs (`admin_audit_log`, `audit_log`) record who viewed or altered clinical records.
4. **Transmission Security**: MQTT and HTTP traffic are encrypted in transit via TLS and HTTPS.

**Q3: What is a Threat Model and what threats were identified for VitalGuard?**  
A: A **Threat Model** is a structured engineering process for identifying, evaluating, and mitigating potential security risks and threat vectors. For VitalGuard, three primary threats were analyzed:

1. _Threat_: An attacker spoofs vital telemetry from an unassigned wearable.  
   _Mitigation_: The consumer verifies device registration and patient ownership against PostgreSQL and Redis before persisting readings; unverified devices are rejected to the dead-letter queue.
2. _Threat_: A malicious user attempts brute-force password guessing on doctor accounts.  
   _Mitigation_: Rate limiting blocks IPs after 5 failed attempts, and generic error messages prevent username enumeration.
3. _Threat_: An unapproved or suspended physician attempts to view patient vitals.  
   _Mitigation_: Fastify pre-handlers query `doctor_profiles` and `users.is_suspended` in the database on every authenticated request.

**Q4: How does VitalGuard protect against SQL Injection?**  
A: All database operations use **Drizzle ORM**, an object-relational mapping tool that uses parameterized queries under the hood. When querying or inserting data, user parameters are passed separately from the SQL statement template as bound parameters to the underlying PostgreSQL connection driver (`postgres.js`). This makes SQL injection mathematically impossible because user input can never alter the query's structural execution tree.

**Q5: What is the Principle of Least Privilege and how is it implemented?**  
A: The **Principle of Least Privilege (PoLP)** dictates that every user, service, and module must possess only the minimum access privileges necessary to fulfill its designated task:

- Patients can query only their own vitals (`patientId === authUser.userId`).
- Doctors can only view telemetry for patients explicitly assigned to them in `associations`.
- Caregivers can only monitor patients who granted affirmative consent.
- The Python simulator communicates only with Mosquitto on port 1883 and an internal discovery API guarded by a service token, with zero access to PostgreSQL.

---

## 9. 5 Whiteboard Diagrams Rohan Can Draw in the Viva

During your viva and practical evaluation, evaluators often ask: _"Can you draw the architecture / flow on the whiteboard?"_ Here are the 5 essential diagrams to sketch, along with what to explain:

### Diagram 1: Entity-Relationship (ER) Diagram

_Sketch the core PostgreSQL tables, primary/foreign keys, and cardinalities:_

```
 ┌───────────────┐          1:N           ┌───────────────────┐
 │     users     │───────────────────────<│  vital_readings   │
 └───────┬───────┘                        └───────────────────┘
         │ 1:1                                      │ N:1
         ├──────────────────┐                       ▼
         │ 1:1              │ 1:N             ┌───────────┐
         ▼                  ▼                 │  devices  │
 ┌─────────────────┐ ┌──────────────┐         └───────────┘
 │ doctor_profiles │ │    alerts    │
 └─────────────────┘ └──────────────┘
         │ 1:N              │ 1:N
         ▼                  ▼
 ┌───────────────┐   ┌──────────────┐
 │ associations  │   │  audit_log   │
 └───────────────┘   └──────────────┘
         │ N:1
         ▼
 ┌───────────────┐
 │ institutions  │
 └───────────────┘
```

- **Key Relationships to highlight**:
  - `users` (id PK, role, email, password_hash, is_suspended) is the root authentication table.
  - `associations` is a composite join table `(patient_id, doctor_id)` with a partial unique index ensuring only one primary doctor per patient.
  - `association_caregivers` links patients and consenting caregivers.
  - `vital_readings` has foreign keys to `devices` and `users`, indexed on `(device_id, timestamp, vital_type)`.

---

### Diagram 2: Sequence Diagram — Patient Login Flow

_Sketch the chronological interaction between User, Browser, Fastify API, and Database:_

```
User (Browser)               Fastify API (/auth/login)               PostgreSQL (users)
     │                                   │                                    │
     │ 1. POST {email, password}         │                                    │
     │──────────────────────────────────>│                                    │
     │                                   │ 2. Check rate limit (in-memory)    │
     │                                   │    Query user by email             │
     │                                   │───────────────────────────────────>│
     │                                   │<───────────────────────────────────│
     │                                   │    Returns user row + passwordHash │
     │                                   │                                    │
     │                                   │ 3. Argon2id.verify(hash, pass)     │
     │                                   │    (Matches? Yes)                  │
     │                                   │                                    │
     │                                   │ 4. jose.SignJWT({sub, role})       │
     │                                   │    Signed with HS256 secret        │
     │                                   │                                    │
     │ 5. Returns HTTP 200 {token}       │                                    │
     │<──────────────────────────────────│                                    │
     │                                   │                                    │
     │ 6. Browser saves JWT in           │                                    │
     │    localStorage & redirects       │                                    │
```

- **Key details to explain**: Rate limiter checked first; generic `INVALID_CREDENTIALS` if email or password fails; Argon2id memory-hard verification; HS256 token issuance.

---

### Diagram 3: Data Flow Diagram (DFD) — Vital Reading Ingestion

_Sketch how telemetry moves across processes, queues, and datastores:_

```
┌──────────────────┐
│ Wearable Sensor  │
│  (or Simulator)  │
└────────┬─────────┘
         │ MQTT QoS 1 (HMS/<device_id>/vitals)
         ▼
┌──────────────────┐
│ Mosquitto Broker │
└────────┬─────────┘
         │ TCP
         ▼
┌──────────────────┐
│Worker MQTT Bridge│──[Fails Schema]──> (vitals.deadletter Queue)
└────────┬─────────┘
         │ Valid JSON Sample
         ▼
┌─────────────────────────────────┐
│ RabbitMQ Exchange (vitals)      │
└────────┬────────────────────────┘
         │ Queue: vitals.ingest
         ▼
┌─────────────────────────────────┐
│ Ingestion Consumer (Worker)     │
├────────────────┬────────────────┤
│ 1. Idempotent  │ 2. Redis       │
│    Upsert      │    Baseline    │
│    Postgres    │    Window (7d) │
├────────────────┴────────────────┤
│ 3. Z-Score Anomaly & Trend Calc │
├─────────────────────────────────┤
│ 4. Severity Decision (1 of 5)   │
└────────┬────────────────────────┘
         │ Severity >= Warning
         ▼
┌─────────────────────────────────┐
│ Open Alert in DB & Notify Doctor│
└─────────────────────────────────┘
```

- **Key details to explain**: Ingestion decoupled via RabbitMQ; idempotency via unique constraints; dead-lettering of invalid schemas; in-memory Redis sliding windows.

---

### Diagram 4: Component Diagram — The 6 Main Services

_Sketch the system boundaries and communication protocols between subsystems:_

```
                 ┌───────────────────────────────────────┐
                 │          Caddy Reverse Proxy          │
                 │   (Port 80 HTTP -> Port 443 HTTPS)    │
                 └───────────┬───────────────┬───────────┘
                             │               │
                 Static /    │               │ REST / WebSocket
                 Assets      ▼               ▼
           ┌───────────────────┐       ┌────────────────────┐
           │ React Web SPA     │       │ Fastify API        │
           │ (apps/web)        │       │ (Port 3000)        │
           └───────────────────┘       └───────┬────────────┘
                                               │
                                 ┌─────────────┴─────────────┐
                                 │                           │
                                 ▼                           ▼
                       ┌───────────────────┐       ┌───────────────────┐
                       │ PostgreSQL 17     │       │ Redis 7           │
                       │ (Durable DB)      │       │ (Sliding Cache)   │
                       └─────────▲─────────┘       └─────────▲─────────┘
                                 │                           │
                                 └─────────────┬─────────────┘
                                               │
                                 ┌─────────────┴─────────────┐
                                 │                           │
                                 ▼                           ▼
                       ┌───────────────────┐       ┌───────────────────┐
                       │ Background Worker │       │ RabbitMQ 4        │
                       │ (Analytics/Bridge)│◄──────┤ (AMQP Queue)      │
                       └─────────▲─────────┘       └─────────▲─────────┘
                                 │                           │
                                 │ Subscribes                │ Routes
                                 │                           │
                       ┌─────────┴─────────┐                 │
                       │ Mosquitto MQTT    │─────────────────┘
                       │ (Port 1883)       │
                       └─────────▲─────────┘
                                 │ MQTT QoS 1
                       ┌─────────┴─────────┐
                       │ Python Simulator  │
                       │ (manager.py)      │
                       └───────────────────┘
```

- **Key details to explain**: Clear distinction between edge ingestion (Mosquitto/RabbitMQ/Worker) and presentation (Fastify API/React/Caddy), tied together via PostgreSQL and Redis.

---

### Diagram 5: Severity Decision Engine Flowchart

_Sketch the 5-rule decision tree evaluated by the analytics worker:_

```
                       [ Incoming Vital Sample ]
                                  │
                                  ▼
                   ┌──────────────────────────────┐
                   │ Rule 1: Multi-vital          │
                   │ correlation fired in 30 min? │
                   └──────────────┬───────────────┘
                           YES ───┴─── NO
                            │           │
                            │           ▼
                            │  ┌──────────────────────────────┐
                            │  │ Rule 2: Static threshold     │
                            │  │ breached AND |z| >= 2.0?     │
                            │  └──────────────┬───────────────┘
                            │          YES ───┴─── NO
                            │           │           │
                            ▼           ▼           ▼
                      ┌───────────────────┐ ┌──────────────────────────────┐
                      │     CRITICAL      │ │ Rule 3: Static threshold OR  │
                      │ (Alert + 5m SLA)  │ │ |z| >= 2.0 OR trend warning? │
                      └───────────────────┘ └──────────────┬───────────────┘
                                                    YES ───┴─── NO
                                                     │           │
                                                     ▼           ▼
                                               ┌───────────┐ ┌──────────────────────────────┐
                                               │  WARNING  │ │ Rule 4: Watch-level anomaly  │
                                               │  (Alert)  │ │ (1.5 <= |z| < 2.0)?          │
                                               └───────────┘ └──────────────┬───────────────┘
                                                                     YES ───┴─── NO
                                                                      │           │
                                                                      ▼           ▼
                                                                ┌───────────┐ ┌───────────┐
                                                                │   WATCH   │ │  NORMAL   │
                                                                └───────────┘ └───────────┘
```

- **Key details to explain**: Priority-ordered chain; first match wins; Critical triggers 5-minute acknowledgment deadline; Warning creates alerts; Watch and Normal update status caches without raising clinical alarms.
