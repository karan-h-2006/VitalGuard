# 06 — Viva Q&A: Whole Project

Evaluation study material for **Rohan (241IT064, @rniszn, B.Tech IT NITK)** for the **VitalGuard** project evaluation today.

---

## 1. System Overview (10 Q&A)

**Q1: What is VitalGuard and what clinical problem does it solve?**  
A: VitalGuard is an end-to-end IoT patient health monitoring platform designed for hospital clinics and remote care. It captures continuous vital signs—Heart Rate, SpO2, Temperature, and Motion—from wearable sensors or a multi-patient simulator, streams them through an event-driven processing pipeline, detects physiological deterioration using anomaly algorithms, and surfaces prioritized triage data to clinicians and caregivers via real-time web dashboards. It bridges the critical monitoring gap between hospital ICU monitors and outpatient recovery at home.

**Q2: What is the high-level tech stack across the entire VitalGuard repository?**  
A: The stack consists of a Fastify HTTP and WebSocket API written in Node.js and TypeScript (`apps/api`), a React single-page application built with Vite and Tailwind CSS (`apps/web`), a background worker running Node.js with amqplib and node-cron (`apps/worker`), and a Python 3.10+ simulator using paho-mqtt (`simulator/manager.py`). The datastore tier combines PostgreSQL 17 for relational persistence and Redis 7 for sliding-window telemetry caching and status caching. Eclipse Mosquitto 2.0 acts as the MQTT IoT gateway, and RabbitMQ 4 manages decoupled message queue delivery.

**Q3: Who are the four user roles in VitalGuard, and what can each role do?**  
A: The four roles are Patient, Caregiver, Doctor, and Administrator. Patients view their real-time telemetry, historical charts, and manage caregiver consent; Caregivers monitor vitals and active alerts for linked patients who granted explicit consent; Doctors review a triage roster sorted by alert severity, inspect patient histories, adjust clinical threshold overrides, and export weekly PDF reports; Administrators oversee clinical governance across 8 console tabs, approving physician licenses, assigning patients to doctors, managing institutions, and injecting simulator scenarios.

**Q4: What happened to Fall Detection in VitalGuard?**  
A: Fall detection was evaluated during earlier iterations but was intentionally removed from the production telemetry schema and pipeline on the `chore/remove-fall-detection` branch. IMU accelerometer readings were generating excessive false-positive spikes during normal patient movement without high-frequency gyroscope sensor fusion. Telemetry was streamlined to four reliable, high-value signals: heart rate, blood oxygen saturation (SpO2), body temperature, and physical motion activity.

**Q5: What are the active ports and network configuration for the system?**  
A: In development, the Fastify API runs on port 3000, the React frontend Vite dev server runs on port 5173, PostgreSQL listens on 5432, Redis on 6379, RabbitMQ on 5672 (AMQP) and 15672 (management UI), and Mosquitto MQTT on 1883. In production, Docker Compose exposes only port 80 (HTTP redirect) and port 443 (HTTPS) to the host via a Caddy reverse proxy. All databases, brokers, and application workers communicate exclusively on the isolated internal Docker bridge network `vitalguard_prod_net`.

**Q6: What is the work division between the three team members?**  
A: Vikas (@feyman137035) owns Edge, Infrastructure, and DevOps (F.1–F.7), comprising the multi-patient Python simulator, MQTT broker, RabbitMQ bridge, Docker Compose configurations, and Caddy reverse proxy. Karan (@karan-h-2006) owns Processing, Analytics, and Alerting (F.8–F.17), implementing the RabbitMQ consumer, Redis rolling baselines, z-score anomaly detection, SLA escalation worker, and PDFKit reports. Rohan (@rniszn) owns Web Dashboards, Access Control, and Governance (F.18–F.26), authoring the React portals, admin governance suite, Fastify authentication, RBAC decorators, association consent models, and WebSocket status streaming.

**Q7: How does a vital sign measurement travel from a patient's body to a doctor's screen?**  
A: The sensor publishes a JSON payload to Mosquitto MQTT on `HMS/<device_id>/vitals`. The worker's MQTT bridge validates the JSON schema and forwards it to RabbitMQ's `vitals` exchange. The ingestion consumer consumes from `vitals.ingest`, upserts records into PostgreSQL `vital_readings`, updates sliding windows in Redis, runs z-score and correlation analytics, and writes the latest severity tier to `patient:<id>:status` in Redis. The Fastify API's WebSocket endpoint polls this Redis key every 500ms and pushes changed payloads to connected React dashboards in real time.

**Q8: What are the default clinical thresholds for vital signs in the system?**  
A: VitalGuard defines standard physiological thresholds configured in environment variables: Heart Rate is 60 to 100 beats per minute, SpO2 lower bound is 95% oxygen saturation, and Body Temperature is 36.1°C to 37.5°C. Any reading falling outside these static bands triggers a threshold breach evaluation in `apps/worker/src/analytics/severity.ts`. These global defaults can be overridden on a per-patient basis by clinicians via the `thresholds` database table.

**Q9: What are the known architectural weak points or technical debt in the current implementation?**  
A: Six architectural limitations are transparently documented: JWT tokens are stored in browser `localStorage` rather than `httpOnly` secure cookies; login rate limiting is stored in an in-process memory `Map` rather than shared Redis; runtime dashboard and WebSocket routes have outpaced the static OpenAPI 3.1 YAML document; weekly PDF reports are saved to a local filesystem directory instead of cloud object storage (S3); the WebSocket gateway polls Redis every 500ms instead of subscribing to Redis Pub/Sub; and sensor telemetry is simulated rather than ingested from physical BLE hardware.

**Q10: Why simulate data instead of using real IoT hardware?**  
A: Simulating data kept the project focused on software engineering rigor, distributed systems architecture, and statistical stream analytics without dependency on hardware procurement or flaky Bluetooth connections. The simulator emits the exact JSON schema and MQTT QoS 1 packets that real ESP32 or Raspberry Pi medical wearables would emit. This allowed us to deterministically test edge cases like severe bradycardia, septic shock correlation, and device connection drops under controlled conditions.

---

## 2. Data Acquisition and Simulator (10 Q&A — Vikas's Part)

**Q11: Why use MQTT instead of REST for IoT vital sign transmission?**  
A: MQTT is a lightweight, low-overhead binary publish-subscribe protocol designed specifically for constrained edge hardware and unreliable wireless networks. A persistent MQTT connection avoids the repetitive TLS handshake and HTTP header overhead (often 500+ bytes per request) of REST, reducing battery consumption and bandwidth on wearable devices. Furthermore, MQTT's broker decouples sensor nodes from backend servers, allowing thousands of devices to publish asynchronously without knowing backend IP addresses or scaling bottlenecks.

**Q12: How does the Python simulator discover which devices to simulate?**  
A: The simulator manager in `simulator/manager.py` executes a discovery loop every 10 seconds against the internal API endpoint `GET /internal/simulated-devices`. The request passes a shared secret `SIMULATOR_SERVICE_TOKEN` in the Authorization header. The API queries PostgreSQL for registered devices marked `is_simulated = true`, and returns their `deviceId`, `patientId`, and assigned `sim_scenario`. The simulator then dynamically provisions or tears down in-memory `DeviceWorker` instances to match the fleet.

**Q13: How does the simulator establish unique, realistic baselines for each patient?**  
A: In `simulator/manager.py`, the function `derive_patient_baseline` calculates resting vital baselines deterministically using the SHA-256 hash of the patient's UUID. The first three bytes of the hash digest seed baseline heart rate (68–82 bpm), SpO2 (96–99%), and temperature (36.5–37.1°C). This ensures every simulated patient exhibits distinct, medically plausible personal physiology that remains consistent across simulator restarts.

**Q14: What mathematical model generates the continuous vital sign telemetry?**  
A: The sensor engine in `simulator/sensors/simulated.py` uses a bounded Gaussian random-walk model combined with sinusoidal circadian rhythm variation. Each sensor tick adds a small normal random step ($\mu = 0, \sigma = 0.5$) to the prior value, bounded by biological minimums and maximums, with an elastic regression term pulling the value back toward the patient's resting baseline. Injected scenarios like `tachycardia` or `deteriorating` apply drift offsets to simulate clinical emergencies.

**Q15: How does the simulator handle edge-level noise and invalid readings?**  
A: Each `DeviceWorker` runs sensor readings through an internal `VitalNoiseFilter` using a 5-sample sliding median filter to eliminate instantaneous sensor noise spikes. Motion artifacts are processed by `MotionProcessor`, which calculates accelerometer magnitude and flags telemetry as `noisy` if vigorous movement is detected. Readings outside physical human limits (e.g., HR > 250 bpm or SpO2 < 50%) are tagged with a `quality_flag` of `implausible` rather than corrupting clinical analytics.

**Q16: How does the simulator prevent duplicate publishing if multiple simulator instances run?**  
A: The simulator uses an atomic Redis lease locking mechanism defined in `simulator/manager.py`. Before publishing each telemetry frame, the worker attempts to acquire or renew a Redis key `device:sim:lease:<deviceId>` using a Lua script with a 15-second time-to-live. If another simulator instance holds an active lease, the current instance skips publishing for that device, providing high-availability active-passive redundancy without message duplication.

**Q17: What MQTT topic and Quality of Service (QoS) does the simulator publish on?**  
A: The simulator publishes JSON-encoded telemetry packets to the topic `HMS/<device_id>/vitals` using **QoS 1 (At least once delivery)**. QoS 1 guarantees that the Mosquitto broker acknowledges receipt via a PUBACK packet, ensuring vital physiological samples are not silently dropped over unstable wireless links.

**Q18: What schema validation occurs at the edge before publishing?**  
A: In `simulator/manager.py`, the manager loads `schemas/vital-sample.schema.json` using `jsonschema.Draft202012Validator` with `FormatChecker`. Every generated telemetry dictionary is validated against the JSON Schema before calling MQTT publish. If required fields like `device_id`, `patient_id`, `timestamp`, or `readings` are missing or fail type checks, the sample is rejected locally and an error is logged.

**Q19: What simulation scenarios can be dynamically injected via the Admin console?**  
A: The simulator supports several clinical scenarios: `normal` (healthy resting vitals with circadian drift), `deteriorating` (concurrent rising heart rate, dropping SpO2, and rising fever to test the correlation engine), `tachycardia` (elevated heart rate > 120 bpm), `bradycardia` (depressed heart rate < 50 bpm), `hypoxemia` (SpO2 falling below 90%), and `fever` (temperature exceeding 38.5°C). The admin patches `PATCH /admin/devices/:deviceId` to update PostgreSQL, and the simulator adopts the new scenario within 10 seconds.

**Q20: How does the simulator manager expose its own health?**  
A: `SimulatorManager` starts an embedded HTTP health server on port 8080 (`SIMULATOR_HEALTH_PORT`). Endpoint `GET /healthz` or `GET /health` returns HTTP 200 with a JSON payload reporting operational status, the total count of currently simulated devices, and their active device UUIDs. Docker Compose uses this endpoint for container health probes.

---

## 3. Analytics, Alerting, Escalation (15 Q&A — Karan's Part)

**Q21: Why place RabbitMQ between the MQTT bridge and the ingest consumer?**  
A: RabbitMQ provides architectural decoupling, rate leveling, and fault tolerance. In medical IoT, hundreds of devices stream high-frequency data; if the database or analytics engine experiences latency or restarts, the MQTT bridge would crash or drop data under backpressure. RabbitMQ absorbs burst traffic, buffers messages on a durable disk-backed queue (`vitals.ingest`), and allows workers to consume messages at a steady, controlled rate without losing a single vital reading.

**Q22: What happens to vitals if the Fastify API server crashes?**  
A: Absolutely nothing is lost. Ingestion and telemetry persistence do not depend on the Fastify API. Mosquitto MQTT receives the packets, the MQTT bridge forwards them to RabbitMQ, and the worker consumer writes them directly into PostgreSQL and Redis. When the API comes back online, it reads the latest state from Redis and PostgreSQL as if no interruption occurred.

**Q23: How does the worker pipeline enforce idempotency during ingestion?**  
A: In `apps/worker/src/consumer/ingest.ts`, idempotency is guaranteed at the database level by PostgreSQL's unique constraint on `(device_id, timestamp, vital_type)`. If RabbitMQ delivers a duplicate message following a network timeout or worker crash before ACK, the consumer executes `ON CONFLICT (device_id, timestamp, vital_type) DO NOTHING`. The database skips insertion of duplicate rows, and the consumer skips recalculating Redis baselines to avoid double-counting statistics.

**Q24: What is the Dead Letter Queue (DLQ) topology and when is it triggered?**  
A: The RabbitMQ topic exchange `vitals` declares a durable dead-letter routing key `DEADLETTER_ROUTING_KEY` (`vitals.deadletter`). When the MQTT bridge receives a packet that cannot be parsed as JSON, or that fails schema validation in `VitalSampleValidator`, or when the consumer encounters an unregistered device ID, the bridge wraps the raw payload and an explicit rejection reason into a dead-letter envelope and publishes it to `vitals.deadletter`. This isolates toxic payloads without stalling the main pipeline.

**Q25: Why use z-score for patient anomaly detection instead of static thresholds alone?**  
A: Static clinical thresholds (e.g., HR 60–100 bpm) only detect absolute extremes and miss personalized physiological distress. An athlete with a resting heart rate of 48 bpm who suddenly jumps to 95 bpm is in severe distress, yet static thresholds consider 95 bpm "Normal". The z-score measures how many standard deviations ($z = \frac{x - \mu}{\sigma}$) a reading deviates from the patient's own 7-day sliding baseline. This makes anomaly detection adaptive and personalized to each individual's baseline physiology.

**Q26: What is the difference between a threshold breach and an anomaly?**  
A: A threshold breach is an **absolute** clinical violation: a vital sign crosses predefined clinical boundaries (e.g., SpO2 dropping below 95% or temperature exceeding 37.5°C). An anomaly is a **relative, statistical** violation: a vital sign deviates significantly from that specific patient's personal baseline ($|z| \ge 2.0$), even if the raw number remains inside conventional population limits. A reading can be normal clinically but anomalous individually, or vice versa.

**Q27: How does VitalGuard calculate and update dynamic patient baselines?**  
A: In `apps/worker/src/analytics/service.ts`, the worker maintains a Redis sorted set for each patient and vital type (`baseline:window:<patientId>:<vitalType>`), keyed by timestamp. Each valid incoming reading is added, and entries older than 7 days (`BASELINE_WINDOW_DAYS`) are trimmed. The worker computes the population mean and standard deviation across this window. Once at least 20 samples (`BASELINE_MIN_SAMPLES`) accumulate, the baseline is considered statistically valid and synced to the PostgreSQL `baselines` table.

**Q28: How does the system prevent division-by-zero when computing z-scores for highly stable vitals?**  
A: If a patient has near-perfectly stable vitals (e.g., constant body temperature), the standard deviation $\sigma$ approaches zero, which would cause an IEEE 754 division-by-zero or `Infinity` z-score. To prevent this, `computeAnomalyFlag` in `service.ts` enforces `analyticsConfig.zScoreStddevFloor` (`0.01`). The denominator is clamped to $\max(\sigma, 0.01)$, guaranteeing mathematical stability while still catching genuine drift.

**Q29: Why use Ordinary Least Squares (OLS) Linear Regression for vital sign trend detection?**  
A: Linear regression over the last 10 samples (`TREND_SAMPLE_COUNT`) is computationally lightweight, deterministic, and highly interpretable. More complex models like ARIMA or LSTM require high memory footprints, training state, and arbitrary hyperparameter tuning. Linear regression yields a straightforward rate-of-change slope ($\frac{\Delta \text{vital}}{\Delta t}$), allowing the worker to project whether a deteriorating vital will cross a critical threshold within the next 30 minutes (`TREND_LOOKAHEAD_MINUTES`).

**Q30: What are the 5 severity classification rules, and what is their priority order?**  
A: Implemented in `apps/worker/src/analytics/severity.ts`, rules are evaluated sequentially where the first match wins:

1. **Critical**: Multi-vital correlation rule fired (e.g., simultaneous rising HR, falling SpO2, and rising temperature).
2. **Critical**: Any vital breaches a static threshold **AND** is statistically anomalous ($|z| \ge 2.0$).
3. **Warning**: Any vital breaches a static threshold, **OR** is anomalous ($|z| \ge 2.0$), **OR** triggers a 30-minute predictive trend warning.
4. **Watch**: Any vital exhibits a watch-level anomaly ($1.5 \le |z| < 2.0$).
5. **Normal**: All vitals fall within expected clinical and personal baselines.

**Q31: How does the multi-vital correlation engine work?**  
A: In `apps/worker/src/analytics/correlation-rules.ts`, rules specify multi-vital clinical patterns that must occur concurrently within a 30-minute window (`CORRELATION_CONCURRENCY_MINUTES`). The worker reads the patient's recent vital states from Redis (`patient:<id>:recent-readings`). If heart rate is rising and anomalous, SpO2 is falling and anomalous, and temperature is rising and anomalous within 30 minutes, the sepsis/shock correlation matches and immediately escalates the patient to **Critical**.

**Q32: How are alerts generated, and what makes alert creation edge-triggered?**  
A: Alert creation in `apps/worker/src/alerting/service.ts` is edge-triggered, meaning an alert record is created only upon a **transition** from a lower tier to Warning or Critical. If a patient remains continuously in Warning for 20 samples, the worker does not flood the database with 20 identical alert rows. If an existing open Warning alert subsequently deteriorates to Critical, the existing alert row is upgraded in place with an updated severity, explanation, and an SLA acknowledgment deadline.

**Q33: What is the VitalGuard alert escalation policy and SLA deadline?**  
A: When a Critical alert is created, the system sets an acknowledgment deadline (`ack_deadline`) equal to the alert opening time plus 5 minutes (`ALERT_ACK_SLA_MINUTES`). A background escalation cron in `apps/worker/src/alerting/escalation.ts` runs every 30 seconds (`ALERT_ESCALATION_POLL_INTERVAL_SECONDS`), querying PostgreSQL for alerts where `severity_tier = 'Critical'`, `status IN ('open', 'escalated')`, `acknowledged_at IS NULL`, and `ack_deadline <= NOW()`. Overdue alerts have their `escalation_level` incremented by 1, status updated to `escalated`, an audit log event written, and urgent notifications re-dispatched.

**Q34: How are notifications dispatched for Critical alerts?**  
A: `dispatchCriticalNotifications` in `apps/worker/src/alerting/notifications.ts` identifies all doctors associated with the patient via the `associations` table. If production API keys are provided (`RESEND_API_KEY` for email or `TWILIO_*` for SMS), messages are dispatched over those external gateways. If keys are omitted (as in development and evaluation), the dispatcher operates in sandbox mode, formatting the clinical alert and logging structured notifications to stdout.

**Q35: How does the weekly clinical PDF report generation work?**  
A: Weekly reports are scheduled by a cron job in `apps/worker/src/reports.ts` that triggers every Sunday at midnight (`0 0 * * 0`). It queries all registered patients and invokes `generateWeeklyReport` using **PDFKit**. The report aggregates 7-day average vitals, total alert counts broken down by severity, and trend warning frequencies, writes the generated PDF file to `generated-reports/`, and records metadata into the PostgreSQL `reports` table for clinicians to download.

---

## 4. Infrastructure and DevOps (8 Q&A)

**Q36: What is the purpose of Docker Compose in VitalGuard development versus production?**  
A: In development, `infra/docker-compose.yml` launches only the backing stateful infrastructure services—PostgreSQL 17, Redis 7, RabbitMQ 4, and Mosquitto 2.0—with their standard debugging ports bound to the host so developers can run Node.js and Vite processes locally with Hot Module Replacement (HMR). In production, `infra/docker-compose.prod.yml` spins up the entire hermetic application stack (Postgres, Redis, Mosquitto, RabbitMQ, API, Worker, Simulator, Web, and Caddy) inside an isolated Docker network where only Caddy binds external host ports (80/443).

**Q37: How does Caddy manage TLS and routing in production?**  
A: Caddy acts as a zero-trust production reverse proxy. It terminates HTTPS on port 443 with automated Let's Encrypt certificates when supplied with a public domain, or self-signed certificates on `localhost`. Inside `infra/Caddyfile`, Caddy routes requests starting with `/api/`, `/auth/`, `/patients/`, `/admin/`, and WebSocket `/ws` directly to the Fastify API container on port 3000, while serving static pre-rendered React production assets for all root and frontend routes.

**Q38: Why does the system enforce strict checks against `CHANGE_ME_IN_PROD_*` environment variables?**  
A: To prevent hardcoded secrets and security regressions in production. In both `apps/api/src/env.ts` and `simulator/manager.py`, the configuration loaders check if critical secrets like `JWT_SECRET`, `POSTGRES_PASSWORD`, or `SIMULATOR_SERVICE_TOKEN` contain the substring `CHANGE_ME`. If detected when `NODE_ENV=production`, the application crashes immediately with a `FATAL` error, preventing insecure deployments from booting.

**Q39: How does the database migration container operate during production deployment?**  
A: In `infra/docker-compose.prod.yml`, a transient `migrate` container is defined using the API Docker image. When `docker compose up` starts, the `migrate` container runs `node dist/db/migrate.js`, connects to PostgreSQL, and executes pending Drizzle SQL migrations. The API and Worker containers specify `depends_on: migrate: condition: service_completed_successfully`, guaranteeing that the database schema is fully updated before application services accept connections.

**Q40: How is Redis persistence configured in production?**  
A: In `infra/docker-compose.prod.yml`, Redis is executed with the command `redis-server --appendonly yes` and mounted to a named Docker volume `redis_data:/data`. Append-Only File (AOF) logging logs every write operation received by the server, ensuring that rolling 7-day baseline windows and patient triage statuses survive unexpected container restarts without data loss.

**Q41: What Docker healthchecks are implemented for the backing services?**  
A: Each container specifies healthcheck instructions: PostgreSQL runs `pg_isready -U vitalguard -d vitalguard`, Redis runs `redis-cli ping`, RabbitMQ runs `rabbitmq-diagnostics -q ping`, Mosquitto executes a test subscription `mosquitto_sub -t '$SYS/broker/version' -C 1 -W 3`, and the Python simulator responds to `urllib` on `/healthz`. These probes prevent dependent services from launching prematurely.

**Q42: What continuous integration (CI) pipeline exists in GitHub Actions?**  
A: The workflow defined in `.github/workflows/ci.yml` triggers on pushes and pull requests across all branches. It provisions Node.js 24 and Python 3.11, installs pnpm dependencies, runs ESLint and TypeScript typechecking (`pnpm typecheck`), executes API and Worker unit tests via Vitest, and runs Python simulator test suites and Ruff linting, ensuring no broken code merges into `main`.

**Q43: How are database backups and disaster recovery handled?**  
A: Documented in `docs/DEPLOY.md` and automated via `scripts/backup-db.sh`, database backups execute `docker compose exec -T postgres pg_dump -U vitalguard -F c vitalguard`. The resulting custom-format compressed binary archive is timestamped and stored in a secure backup directory. Restoration is achieved via `pg_restore --clean --if-exists`, ensuring rapid disaster recovery.

---

## 5. Database Design (10 Q&A)

**Q44: Why use PostgreSQL instead of a NoSQL document database like MongoDB?**  
A: Vital signs, clinical alerts, patient-doctor associations, audit events, and institutional licenses are deeply relational entities that require strict referential integrity. Relational foreign keys prevent orphaned records (e.g., an alert pointing to a deleted patient). Furthermore, clinical governance requires ACID transactional guarantees—such as simultaneously creating an alert and writing an immutable audit log row in a single atomic transaction—which relational databases provide out of the box.

**Q45: How many vitals per second can VitalGuard store?**  
A: On standard commodity hardware with PostgreSQL 17 and connection pooling, our current schema comfortably handles between 100 and 200 writes per second. For hospital-wide scaling to tens of thousands of vitals per second, PostgreSQL would be paired with the TimescaleDB extension for automatic time-series chunking/hypertables, or high-volume raw telemetry would be routed to a column-oriented engine like ClickHouse while keeping PostgreSQL for relational metadata.

**Q46: Why is `association_caregivers` a separate join table instead of an array of UUIDs on the patient table?**  
A: Storing foreign keys inside a PostgreSQL `uuid[]` array violates First Normal Form (1NF) and breaks relational integrity. A separate join table `association_caregivers` allows defining real database foreign key constraints (`REFERENCES users(id) ON DELETE CASCADE`), enforces a composite primary key `(patient_id, caregiver_id)`, supports fast bidirectional indexing, and enables granular row-level joins without expensive unnesting operations.

**Q47: What primary keys and indexes are configured on the high-volume `vital_readings` table?**  
A: In `apps/api/src/db/schema.ts`, `vital_readings` uses a UUID `id` primary key. It defines a composite unique index on `(device_id, timestamp, vital_type)` to enforce idempotency during message consumption, and a B-tree index on `(patient_id, timestamp)` to ensure that historical chart queries filtering by patient and time range (24h, 7d, 30d) execute in sub-millisecond index scans instead of full table scans.

**Q48: What is the purpose of the `thresholds` table?**  
A: The `thresholds` table stores customized clinical safety boundaries per patient and vital type. While environment variables define global baseline ranges (HR 60–100 bpm), individual patients may have specific clinical conditions (e.g., an athlete with bradycardia or a cardiac patient whose heart rate must not exceed 85 bpm). When a doctor updates thresholds via the workstation UI, a row is inserted with `clinician_override = true`, which takes precedence over system defaults during analytics.

**Q49: How does the `associations` table enforce that a patient has only one primary doctor?**  
A: In `apps/api/src/db/schema.ts`, the `associations` table defines a partial unique index: `uniqueIndex('associations_one_primary_per_patient').on(table.patientId).where(sql`${table.isPrimary} = true`)`. This allows a patient to have multiple secondary consulting physicians, but the database strictly forbids more than one row where `is_primary = true` for the same `patient_id`.

**Q50: What is the structure and purpose of the `admin_audit_log` table?**  
A: The `admin_audit_log` table provides an immutable, tamper-evident audit trail for clinical governance. It records `id`, `actor_id` (the admin user), `action` (e.g., `APPROVE_DOCTOR`, `ASSIGN_PATIENT`, `SUSPEND_USER`), `target_type`, `target_id`, JSON snapshots of `before` and `after` database states, an optional `reason` text string, the client `ip` address, and a UTC `created_at` timestamp. It satisfies medical software traceability standards.

**Q51: How does the `devices` table prevent multiple simulated devices for one patient?**  
A: In `apps/api/src/db/schema.ts`, the `devices` table defines a partial unique index: `uniqueIndex('devices_one_simulated_per_patient').on(table.patientId).where(sql`${table.isSimulated} = true and ${table.registrationStatus} = 'registered'`)`. This ensures that auto-provisioning cannot accidentally spin up duplicate active virtual wearables for a single patient account.

**Q52: How are clinical alerts tracked across their lifecycle in the `alerts` table?**  
A: Alerts transition through explicit enum states: `open` (newly raised by the analytics engine), `acknowledged` (seen and accepted by a clinician with `acknowledged_at` and `acknowledged_by` recorded), `escalated` (overdue past `ack_deadline` with incremented `escalation_level`), and `resolved` (`resolved_at` recorded). This state machine prevents alert fatigue and ensures accountability.

**Q53: How does Drizzle ORM manage migrations and type safety?**  
A: Drizzle ORM defines tables directly in TypeScript (`apps/api/src/db/schema.ts`), providing full compile-time type safety without code generation steps. Running `pnpm db:generate` compares the TypeScript schema against previous JSON snapshots and generates pure, auditable SQL migration files in `apps/api/src/db/migrations/`. Running `pnpm db:migrate` executes these SQL scripts sequentially using an internal migration tracker table.

---

## 6. Security and Compliance (8 Q&A)

**Q54: How are user passwords hashed and stored?**  
A: Passwords are encrypted using **Argon2id**, the winner of the Password Hashing Competition and the current gold standard recommended by OWASP. Implemented in `apps/api/src/auth/passwords.ts`, Argon2id provides hybrid defense against both GPU cracking and side-channel attacks by enforcing memory hardness, time cost, and parallelism with unique, cryptographically random per-user salts. Plaintext passwords and MD5/SHA hashes are strictly forbidden.

**Q55: What token algorithm is used for JWT authentication and how is it validated?**  
A: Tokens are signed using symmetric **HMAC-SHA256 (HS256)** via the modern `jose` library in `apps/api/src/auth/tokens.ts`. The payload contains the user's `sub` (user UUID) and `role`. Tokens expire in 1 hour for standard users, or 15 minutes for administrators. Every authenticated request verifies the cryptographic signature against `JWT_SECRET` and decodes the claims before routing.

**Q56: Why does the login endpoint return `INVALID_CREDENTIALS` for both wrong email and wrong password?**  
A: Returning specific messages like "User not found" versus "Incorrect password" introduces a **User Enumeration Vulnerability**, allowing attackers to probe which email addresses exist in the hospital database. Returning an identical HTTP 401 with code `INVALID_CREDENTIALS` and a generic message for both conditions prevents attackers from discovering registered physician or patient accounts.

**Q57: Why does the Fastify `authenticate` decorator query the database on every request?**  
A: Pure stateless JWT validation has a critical security flaw: a compromised, suspended, or deleted user account remains valid until token expiration. In `apps/api/src/plugins/auth.ts`, after validating the JWT signature, `authenticate` queries PostgreSQL to verify that `is_suspended` is false and checks if `must_change_password` is flagged. This enables administrators to execute immediate, emergency revocation of compromised accounts in real time.

**Q58: How does the system enforce Role-Based Access Control (RBAC)?**  
A: Fastify pre-handlers enforce authorization boundaries declaratively. Route configurations specify `preHandler: [app.authenticate, requireRoles('doctor', 'administrator')]`. In addition, doctors must pass an `isDoctorApproved` check against `doctor_profiles` verifying their medical license has been approved by an administrator, preventing unvetted accounts from accessing patient telemetry.

**Q59: How does the association model enforce patient privacy under HIPAA and GDPR?**  
A: Under medical privacy regulations, health data can only be shared with authorized healthcare providers and consenting individuals. In `apps/api/src/plugins/auth.ts`, `requireAssociation()` intercepts patient data routes. Doctors can only view vitals if an active record exists in the `associations` table; caregivers can only view vitals if the patient has granted explicit consent in `association_caregivers`. Patients can revoke caregiver access at any time via `/patient/access`.

**Q60: How does the login rate limiter protect against brute-force attacks?**  
A: In `apps/api/src/features/auth/routes.ts`, an in-memory rate limiter tracks failed login attempts keyed by client IP and email. Standard users are restricted to 5 attempts per 60 seconds (`LOGIN_RATE_LIMIT_MAX`). Administrator accounts are restricted to 3 attempts per 300 seconds (`ADMIN_LOGIN_RATE_LIMIT_MAX`). Exceeding the threshold returns HTTP 429 `LOGIN_RATE_LIMITED`.

**Q61: What is the security mechanism protecting internal simulator discovery?**  
A: The endpoint `GET /internal/simulated-devices` exposes the full list of simulated patient devices and could be abused to hijack simulation scenarios. It is guarded by a bearer token check against `SIMULATOR_SERVICE_TOKEN`. If the Authorization header is missing or does not match the shared secret, the API immediately rejects the request with HTTP 401 Unauthorized.

---

## 7. Non-Functional Requirements (5 Q&A)

**Q62: How does the system address Scalability across high-volume sensor streams?**  
A: Scalability is achieved through architectural decoupling and stateless services. Sensor ingestion is decoupled via RabbitMQ topic exchanges, allowing workers to scale horizontally by running multiple consumer processes. Redis serves as an in-memory buffer for high-frequency sliding-window baselines and status lookups, keeping read traffic off PostgreSQL. For future scale, RabbitMQ queues can be partitioned per patient using consistent-hash exchange bindings.

**Q63: How does VitalGuard ensure High Availability and Fault Tolerance?**  
A: Backing containers configure Docker restart policies (`restart: unless-stopped`) and automated health checks. If an analytics worker crashes, RabbitMQ retains unacknowledged messages in its durable queue until a restarted worker consumes them. The Python simulator utilizes Redis lease locks to support active-passive redundancy without message duplication, and the API falls back to PostgreSQL vital history if Redis is temporarily unreachable.

**Q64: What is the End-to-End Latency budget for real-time alerting?**  
A: The performance target from sensor sample to clinical alert dispatch is under 2 seconds: MQTT publication takes < 20ms, RabbitMQ queuing and worker consumption take < 50ms, in-memory Redis baseline calculations take < 10ms, and PostgreSQL alert insertion takes < 20ms. In total, the pipeline processes telemetry and issues alerts in well under 200ms under normal load.

**Q65: How does the frontend ensure Usability and Fault Isolation?**  
A: The React web app implements isolated React `ErrorBoundary` wrappers. If an unexpected rendering exception occurs within a complex administrative tab or Recharts data visualizer, the error boundary catches the exception locally, retains the user's authenticated session, and displays an inline recovery button rather than crashing the entire portal into a blank white screen.

**Q66: How is Data Integrity and Compliance maintained in the datastore?**  
A: Data integrity is enforced through strict relational database constraints: primary keys, foreign keys with referential actions, unique constraints on device timestamps, and database-level enums (`vital_type`, `severity_tier`, `alert_status`). Medical compliance is upheld by writing immutable events to `admin_audit_log` and `audit_log` whenever sensitive clinical triage actions or doctor approvals occur.

---

## 8. Integration Between Components (5 Q&A)

**Q67: How do the components owned by Vikas, Karan, and Rohan interact at runtime?**  
A: Vikas's simulator discovers active patient devices from Karan's API (`/internal/simulated-devices`) and streams MQTT telemetry to Mosquitto. Karan's worker bridges MQTT packets into RabbitMQ, runs z-score analytics, writes readings to PostgreSQL, and updates the patient status cache in Redis. Rohan's React application consumes Karan's Fastify REST API for historical data and receives real-time updates via WebSockets, allowing clinicians to inspect vitals and inject simulation scenarios back into Vikas's simulator fleet.

**Q68: How does the WebSocket server bridge Redis updates to the browser?**  
A: In `apps/api/src/features/dashboard/routes.ts`, when a client connects to `GET /ws?token=<JWT>`, the server verifies the token and listens for a `{"type":"subscribe","patientId":"<UUID>"}` message. It verifies patient association, and starts a timer polling `patient:<id>:status` in Redis every 500ms (`WEBSOCKET_POLL_INTERVAL_MS`). When the cached status JSON changes, it pushes the updated payload to the browser over the WebSocket connection.

**Q69: How does the Doctor Triage Workstation sort and prioritize patients?**  
A: In `apps/api/src/features/dashboard/routes.ts`, the function `sortPatientsByTriage` assigns numeric ranks to severity tiers: Critical = 4, Warning = 3, Watch = 2, Normal = 1. When a clinician requests `GET /patients`, the API gathers all associated patients, retrieves their latest cached severity from Redis, sorts them in descending order of urgency, and returns a prioritized triage roster.

**Q70: How does auto-provisioning connect patient registration to telemetry streaming?**  
A: When a new patient registers via `POST /auth/register` and `AUTO_PROVISION_SIMULATED_DEVICE=true`, the API database transaction simultaneously creates the user record, a `patient_profiles` row, and a `devices` row with `is_simulated = true`. Within 10 seconds, the Python simulator's discovery loop detects the new device and immediately begins publishing telemetry, achieving live data streaming in under 15 seconds without manual admin intervention.

**Q71: What is the contract synchronization mechanism between backend routes and API documentation?**  
A: The project maintains an OpenAPI 3.1 contract at `apps/api/openapi/openapi.yml`. CI validates this contract using `@redocly/cli lint`. Shared data models and TypeScript types are exported from `packages/shared-types` and consumed by both API and frontend packages, ensuring contract consistency across frontend forms, backend route validators, and worker payloads.

---

## 9. Web Dashboards, Governance & Auth (5 Q&A — Rohan's Part)

**Q72: What is the architecture of the React frontend application?**  
A: The frontend is a single-page application built with React 19, TypeScript, and Vite. Routing is managed by React Router with role-based route guards that inspect the user's decoded JWT role before rendering. The UI utilizes Tailwind CSS for styling, Lucide React for medical iconography, and Recharts for responsive, hardware-accelerated time-series vital charts. Portals are modularized into feature folders: `patient`, `caregiver`, `doctor`, and `administrator`.

**Q73: How does the 8-tab Administrator Governance Console work?**  
A: Located in `apps/web/src/features/administrator/`, the console provides comprehensive institutional oversight across 8 dedicated tabs:

1. **Overview**: Live metrics for institutions, approved doctors, assigned patients, and active alerts.
2. **Doctor Requests**: Review pending medical licenses with Approve and Reject actions.
3. **Institutions**: Register hospital partners and manage clinic status.
4. **Doctors**: Active roster management with emergency suspension and reinstatement.
5. **Patients**: Primary physician assignment, clinic transfers, and simulator scenario injection.
6. **Caregiver Links**: Clinical review and oversight of caregiver link requests.
7. **Users**: System-wide user directory with emergency account suspension.
8. **Audit Log**: Searchable, timestamped audit stream showing all governance actions.

**Q74: How does patient consent management function in the Patient Portal?**  
A: Located at `/patient/access`, the consent portal gives patients complete autonomy over their medical data. Caregiver access requests appear in a pending state until the patient explicitly clicks "Grant Consent" or "Deny Access". If consent is granted, the backend updates `association_caregivers`. If revoked, the association is removed, immediately blocking the caregiver's access to the patient's vitals and alerts.

**Q75: How does the Doctor Pending screen handle licensing workflow?**  
A: When a doctor registers, their status in `doctor_profiles` is initialized to `pending`. Upon logging in, the frontend route guard detects that the doctor's account is not yet approved and redirects them to `/doctor/pending`. The doctor cannot view clinical triage data or patient records until an administrator inspects their medical license and approves the application.

**Q76: How does the UI distinguish between real hardware and simulated devices?**  
A: The API returns device metadata along with patient status. When `device.isSimulated` is true, the React dashboard displays a distinct, stylized **"Simulated Device"** indicator badge alongside the active simulation scenario (e.g., `normal`, `deteriorating`). This ensures clinicians and evaluators always know whether live telemetry is driven by virtual test harnesses or physical hardware.
