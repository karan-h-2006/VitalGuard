# 12 — Tricky Questions and How to Answer

**Candidate:** Rohan (241IT064, `@rniszn`, B.Tech IT NITK)  
**Project:** VitalGuard — Remote Patient Telemetry & Critical Care Monitoring  
**Target:** Final B.Tech Viva & Technical Evaluation Defense

---

## 1. Introduction: How Examiners Think and How to Win

Examiners in B.Tech viva sessions do not ask tricky questions to fail you; they ask them to separate students who merely memorized boilerplate code from software engineers who understand **system architecture, design trade-offs, failure modes, and security boundaries**.

When an examiner asks a challenging question:

1. **Never hesitate awkwardly or guess blindly.** If you don't know an obscure trivia fact, pivot immediately to the architectural principle.
2. **Be direct.** State the answer in the first sentence before providing the technical rationale.
3. **Reference your actual codebase.** Citing files, tables, algorithms, and design decisions demonstrates authentic ownership.
4. **Frame trade-offs positively.** Explain that an engineering choice was a conscious balance of simplicity, deadline, and system resilience.

Below are 40 rigorously coached answers covering all major examiner angles.

---

## 2. Category A: "Why Didn't You..." Questions (10 Questions)

### Q1: Why didn't you use Redis Pub/Sub instead of polling Redis every 500ms in your WebSocket endpoint?

- **Direct Answer**: We chose a 500ms polling loop on the cached hash `patient:<id>:status` to cleanly decouple the API from high-frequency worker ingestion spikes, simplify connection lifecycle teardown, and achieve built-in frame deduplication.
- **Code & Design Context**: In `apps/api/src/routes/websocket.ts`, when a client connects to `/ws`, Fastify sets up a process timer checking the latest status snapshot. Telemetry packets arrive at 1 Hz per sensor; by checking if the serialized string changed, we never send redundant frames down the socket.
- **Viva Defense Line**: _"While Redis Pub/Sub provides true event-driven push, it requires active channel subscriptions per socket and complex multiplexing. In this iteration, Redis hash polling decoupled the API server completely from worker message rate spikes. Our production roadmap migrates this to Redis Pub/Sub to eliminate polling overhead at higher scale."_

### Q2: Why didn't you use `httpOnly` cookies instead of storing JWTs in `localStorage`?

- **Direct Answer**: We selected `localStorage` to expedite rapid Single-Page Application (SPA) development, simplify multi-tab synchronization, and bypass complex cross-origin cookie domain configuration in our local Docker environment.
- **Code & Design Context**: In `apps/web/src/context/AuthContext.tsx`, token storage is centralized under `vg_token`. The token is attached via Axios request interceptors as an `Authorization: Bearer <token>` header.
- **Viva Defense Line**: _"We fully recognize that `localStorage` is vulnerable to Cross-Site Scripting (XSS). In our project limitations document, we explicitly defined the production upgrade path: migrating to `httpOnly`, `Secure`, `SameSite=Strict` cookies paired with a double-submit CSRF token."_

### Q3: Why did you choose Argon2id over the industry-standard bcrypt for password hashing?

- **Direct Answer**: Argon2id is the winner of the Password Hashing Competition (PHC) and is specifically recommended by RFC 9106 and OWASP because it is memory-hard, neutralizing GPU and ASIC parallel brute-force attacks that can crack bcrypt.
- **Code & Design Context**: In `apps/api/src/utils/security.ts`, we use `@node-rs/argon2` configured with memory cost ($64\,\text{MB}$), time cost ($3\text{ iterations}$), and parallelism ($1\text{ thread}$).
- **Viva Defense Line**: _"While bcrypt is classic, it is compute-bound. Modern GPUs can compute millions of bcrypt hashes per second. Argon2id forces the attacker to allocate substantial RAM for every single hash attempt, making hardware-accelerated dictionary attacks economically infeasible."_

### Q4: Why didn't you use MongoDB or a NoSQL database for vital sign telemetry?

- **Direct Answer**: VitalGuard requires strict relational integrity linking patients, attending doctors, clinical associations, and threshold overrides to time-series readings, which standard relational ACID transactions enforce without orphaned records.
- **Code & Design Context**: Using PostgreSQL with Drizzle ORM (`apps/api/src/db/schema.ts`) allows us to enforce foreign keys (`patient_id -> users.id`) and composite indexes `(patient_id, vital_type, timestamp)` in a single database engine.
- **Viva Defense Line**: _"A document store like MongoDB would have forced us to handle data consistency and relational joins in application code. PostgreSQL gives us rock-solid ACID guarantees for clinical audits. For time-series scale, the production upgrade is adding TimescaleDB hypertables directly inside PostgreSQL without changing the database."_

### Q5: Why didn't you use HTTP/REST for IoT device data ingestion instead of MQTT?

- **Direct Answer**: HTTP has high transport overhead—requiring TCP handshakes, TLS negotiation, and verbose headers (500+ bytes) per reading—which drains wearable battery life and saturates mobile bandwidth, whereas MQTT packets require only a 2-byte header.
- **Code & Design Context**: The simulator streams over Eclipse Mosquitto on port `1883` using QoS 1 (`HMS/<device_id>/vitals`). A bridge translates MQTT packets into RabbitMQ messages.
- **Viva Defense Line**: _"Medical wearables operate on low-power microcontrollers with intermittent connectivity. MQTT's lightweight publish/subscribe model, persistent sessions, and QoS levels make it the gold standard for telemetry transmission compared to heavy HTTP POST requests."_

### Q6: Why didn't you use GraphQL instead of REST for the client API?

- **Direct Answer**: REST paired with Fastify JSON schemas provides deterministic performance, simpler route-level Role-Based Access Control (RBAC), and native HTTP caching, avoiding the arbitrary query complexity and N+1 query risks of GraphQL.
- **Code & Design Context**: Our endpoints (`/patients/:id/vitals`, `/admin/users`, `/alerts`) map directly to our 4 discrete user roles, allowing clean pre-handler middleware execution (`authenticate`, `requireRoles`, `requireAssociation`).
- **Viva Defense Line**: _"In a clinical monitoring platform, predictability and security are paramount. REST endpoints allow strict request validation via JSON Schema and precise per-endpoint authorization checks without needing complex query depth analysis."_

### Q7: Why didn't you use Apache Kafka instead of RabbitMQ?

- **Direct Answer**: RabbitMQ is an AMQP-compliant message broker designed for low-latency, flexible topic routing, and transient task queues, which perfectly matched our need to route vitals to processing workers without the operational overhead of a Kafka cluster.
- **Code & Design Context**: Our MQTT bridge publishes to RabbitMQ topic exchange `vitals`, routing clean data to queue `vitals.ingest` and malformed data to `vitals.deadletter`.
- **Viva Defense Line**: _"Kafka is a distributed append-only commit log designed for high-throughput event replaying over long retention periods. VitalGuard needed immediate, low-latency queuing and dead-letter routing for live alerts. RabbitMQ provided this out of the box with minimal DevOps footprint."_

### Q8: Why didn't you connect real IoT hardware like an Arduino or ESP32?

- **Direct Answer**: For the academic scope of this Software Engineering course (NITK IT303), building a multi-patient Python simulator (`simulator/manager.py`) allowed us to reliably stress-test edge conditions—such as sudden ventricular tachycardia, severe hypoxia, and noisy sensor disconnections—without endangering human participants.
- **Code & Design Context**: The Python simulator adheres strictly to `schemas/vital-sample.schema.json`.
- **Viva Defense Line**: _"Our ingestion pipeline does not care whether the MQTT publisher is Python or an ESP32 microcontroller. The topic structure, payload schema, and QoS guarantees are 100% hardware-compatible. Building the simulator enabled us to simulate multi-patient ward dynamics that would have required dozens of physical sensor kits."_

### Q9: Why didn't you enforce HTTPS and TLS certificates across your development environment?

- **Direct Answer**: Enforcing strict TLS across internal Docker container-to-container bridges (Mosquitto, RabbitMQ, PostgreSQL, Fastify) introduces self-signed certificate trust issues and browser security warnings during local evaluation.
- **Code & Design Context**: Services communicate within a closed Docker network. In production, TLS termination is handled at the NGINX or Traefik reverse proxy layer.
- **Viva Defense Line**: _"In local development and demonstration environments, running plaintext or self-signed certs avoids browser trust errors. In a production cloud topology, we terminate TLS 1.3 at the API gateway and encrypt inter-service traffic using mutual TLS (mTLS)."_

### Q10: Why didn't you implement complete TOTP 2-Factor Authentication?

- **Direct Answer**: We prioritized end-to-end telemetry flow, real-time clinical triage, SLA alert escalation, and comprehensive administrative governance within our sprint boundaries.
- **Code & Design Context**: The database schema and user management models support security extensibility, but the active login route issues JWTs directly upon successful Argon2id password verification.
- **Viva Defense Line**: _"We focused our security budget on core authentication primitives: memory-hard Argon2id hashing, stateless JWT with immediate DB revocation, constant-time credential checks, and role pre-handlers. TOTP is documented as our highest-priority Phase 2 security upgrade."_

---

## 3. Category B: "What Would Happen If..." Questions (10 Questions)

### Q11: What would happen if a patient's JWT token is stolen?

- **Direct Answer**: The attacker could access that patient's live vitals and historical charts until the 15-minute expiration period lapses, or until an administrator suspends the patient account.
- **Code & Design Context**: Because Fastify's `authenticate` decorator queries PostgreSQL on every request (`SELECT is_suspended, must_change_password FROM users WHERE id = :sub`), an admin can click "Suspend" in the Admin Console, immediately blocking the stolen token on its very next HTTP request regardless of its `exp` claim.
- **Viva Defense Line**: _"Unlike purely stateless JWT architectures where stolen tokens remain valid until expiration, our hybrid DB verification revokes access instantly upon administrative suspension."_

### Q12: What would happen if the Python processing worker crashes during a telemetry spike?

- **Direct Answer**: Incoming vital readings safely accumulate in RabbitMQ queue `vitals.ingest`. No telemetry packets are lost, and when the worker restarts, it resumes consuming messages from where it left off.
- **Code & Design Context**: RabbitMQ queues are durable (`durable: true`), and the worker uses manual message acknowledgments (`basic_ack`). Messages remain on the queue until successfully processed and persisted.
- **Viva Defense Line**: _"This is the exact reason we placed RabbitMQ between the MQTT bridge and the Python worker. The message queue acts as an elastic shock absorber, isolating the database and worker from traffic surges."_

### Q13: What would happen if you deploy 2 or more instances of your Fastify API behind a load balancer?

- **Direct Answer**: Normal REST endpoints would function correctly because the API is stateless; however, the in-memory login rate limiter would allow extra attempts, and local PDF reports would not be shared across instances.
- **Code & Design Context**: `rate-limiter.ts` uses an in-memory `Map`. Reports are saved to `apps/api/generated-reports/`.
- **Viva Defense Line**: _"To achieve full horizontal scalability, we would migrate two components: moving the rate limiter state into Redis, and saving PDF reports to an S3 object store with pre-signed download URLs."_

### Q14: What would happen if Redis goes down completely?

- **Direct Answer**: The API would fail to push live WebSocket status updates, and the worker would fall back to computing baselines directly against PostgreSQL, resulting in degraded real-time latency but zero data loss.
- **Code & Design Context**: PostgreSQL is the durable system of record for all `vital_readings`, `alerts`, and `users`. Redis acts purely as a low-latency read cache (`patient:<id>:status`) and rolling baseline cache.
- **Viva Defense Line**: _"Redis is strictly a volatile acceleration layer in VitalGuard. All vital readings, user accounts, and clinical alerts are committed to PostgreSQL with ACID transactions."_

### Q15: What would happen if RabbitMQ goes down?

- **Direct Answer**: The MQTT bridge would be unable to publish messages and would buffer incoming packets in memory or drop connections; new readings would not reach the processing worker until RabbitMQ recovers.
- **Code & Design Context**: The Mosquitto broker would continue accepting QoS 1 packets from edge devices until its local buffer fills up. The Fastify API and web portals would remain accessible for historical queries.
- **Viva Defense Line**: _"In a production topology, RabbitMQ would run as a mirrored quorum cluster across multiple availability zones, ensuring automated leader election and zero queue downtime."_

### Q16: What would happen if PostgreSQL becomes slow or locks up?

- **Direct Answer**: Worker write transactions would slow down, creating backpressure in RabbitMQ queues, and API REST endpoints would experience increased latency; however, Redis would continue serving the latest cached vitals to connected WebSockets.
- **Code & Design Context**: RabbitMQ buffers incoming telemetry without crashing. Connection pool limits (`max: 20` in Drizzle) prevent the API from exhausting database connections.
- **Viva Defense Line**: _"Because our message bus absorbs ingestion spikes, slow database queries cause queues to back up rather than dropping telemetry packets or crashing the API process."_

### Q17: What would happen if two doctors are assigned to the same patient?

- **Direct Answer**: Both doctors can view the patient's live vitals and triage cards, but only one doctor can hold the `is_primary = true` flag.
- **Code & Design Context**: In table `associations`, the primary key is composite `(patient_id, doctor_id)`. A partial unique index on `(patient_id) WHERE is_primary = true` guarantees at the database schema level that a patient cannot have two primary physicians.
- **Viva Defense Line**: _"Our database schema explicitly supports multi-disciplinary care teams while enforcing mathematical uniqueness on primary clinical ownership."_

### Q18: What would happen if an administrator suspends a doctor while that doctor is actively logged in?

- **Direct Answer**: The doctor's very next API action or navigation request will be rejected with HTTP 403 Forbidden, immediately terminating their clinical session.
- **Code & Design Context**: Fastify's `authenticate` pre-handler runs `SELECT is_suspended FROM users WHERE id = :sub` on every incoming authenticated request. If `is_suspended` is true, it halts execution immediately.
- **Viva Defense Line**: _"We explicitly chose not to trust the JWT blindly. Checking account status on every request provides immediate administrative revocation for suspended clinicians."_

### Q19: What would happen if a patient deregisters or deletes their account?

- **Direct Answer**: Associated devices are marked as `de-registered`, active caregiver link requests are cancelled, but historical `vital_readings` and `audit_log` records are preserved for medical-legal compliance.
- **Code & Design Context**: In `schema.ts`, foreign keys to `users.id` utilize `ON DELETE RESTRICT` or soft-deletion flags (`is_suspended = true`) to prevent accidental destruction of historical clinical records.
- **Viva Defense Line**: _"In healthcare systems, medical records cannot be hard-deleted due to clinical audit regulations. We enforce soft de-registration to ensure full historical trace integrity."_

### Q20: What would happen if an attacker launches a distributed brute-force attack from 1,000 IP addresses?

- **Direct Answer**: Because our in-memory rate limiter tracks failed attempts by both IP address and targeted account email, the targeted user account would lock after 3 to 5 failed attempts regardless of how many distinct IPs the attacker rotates through.
- **Code & Design Context**: In `apps/api/src/plugins/rate-limiter.ts`, the lock key combines `rate:user:<email>` and `rate:ip:<ip>`.
- **Viva Defense Line**: _"Tracking failures by target email in addition to client IP mitigates distributed proxy attacks. In production, we would back this with Cloudflare bot management and Redis-based IP reputation scoring."_

---

## 4. Category C: "Explain Like I'm 5" Questions (5 Questions)

### Q21: Explain JWT (JSON Web Token) like I'm 5 years old.

- **Direct Answer**: _"Imagine going to an amusement park. Instead of the guard checking your birth certificate at every single ride, the ticket booth gives you a special stamped wristband. The roller coaster operator looks at your wristband, sees the official park stamp, and lets you on instantly without calling the ticket booth."_
- **Technical Context**: A JWT contains a signed payload (`sub`, `role`, `exp`) that proves user identity without requiring a database session table.

### Q22: Explain Publish/Subscribe (Pub/Sub) messaging like I'm 5 years old.

- **Direct Answer**: _"Imagine a school loudspeaker. The principal speaks into the microphone once, and every classroom that turned its speaker on hears the announcement at the exact same moment. The principal doesn't have to walk to 30 different rooms and repeat the message 30 times."_
- **Technical Context**: Telemetry publishers push messages to a topic (`HMS/<id>/vitals`), and any interested subscriber (bridge, logger) receives the broadcast independently.

### Q23: Explain z-score anomaly detection like I'm 5 years old.

- **Direct Answer**: _"If everyone in your kindergarten class is around 3 feet tall, and a new student walks in who is 6 feet tall, you immediately notice they are unusually tall because they are far away from what is normal for your class. A z-score is just a math ruler that measures how many steps away someone is from their normal size."_
- **Technical Context**: $z = (x - \mu) / \sigma$ measures how many standard deviations a vital sign measurement deviates from that specific patient's rolling personal mean.

### Q24: Explain why the doctor sees the patient's heart rate change live on the screen without clicking refresh.

- **Direct Answer**: _"Instead of the doctor having to press a refresh button every second, the hospital computer and the doctor's screen keep a private telephone line open between them. Whenever the patient's heart beats faster, the computer immediately whispers the new number through the phone line so the screen updates in a blink."_
- **Technical Context**: A persistent WebSocket connection (`ws://`) pushes updated telemetry frames over a long-lived TCP socket the moment the server detects a change.

### Q25: Explain Role-Based Access Control (RBAC) like I'm 5 years old.

- **Direct Answer**: _"Think of a hospital as a building with color-coded keycards. Patients get blue cards that only open their own room. Doctors get green cards that open patient medicine cabinets. Hospital directors get gold master keys that open every administrative office in the building."_
- **Technical Context**: Users are assigned roles (`patient`, `caregiver`, `doctor`, `administrator`), and pre-handler guards (`requireRoles`) restrict API endpoints based on that assigned role.

---

## 5. Category D: "Compare" Questions (5 Questions)

### Q26: Compare MQTT vs. HTTP/REST for IoT telemetry.

- **Direct Answer**: MQTT is a lightweight, stateful binary publish/subscribe protocol optimized for constrained devices with low bandwidth; HTTP/REST is a stateless request/response protocol carrying heavy header overhead.
- **Comparison Table**:

| Feature                 | MQTT                              | HTTP / REST                            |
| :---------------------- | :-------------------------------- | :------------------------------------- |
| **Header Overhead**     | Extremely low (2 bytes minimum)   | High (500–1000+ bytes per request)     |
| **Communication Model** | Asynchronous Publish / Subscribe  | Synchronous Request / Response         |
| **Connection State**    | Persistent long-lived TCP session | Short-lived request/response cycle     |
| **Quality of Service**  | 3 QoS levels (0, 1, 2)            | No built-in QoS (must be built in app) |
| **Battery Consumption** | Low (ideal for wearables)         | High (frequent TCP/TLS handshakes)     |

### Q27: Compare Argon2id vs. bcrypt for credential storage.

- **Direct Answer**: Argon2id is memory-hard and time-hard, resisting both GPU and ASIC parallel cracking; bcrypt is only compute-hard and is vulnerable to modern GPU cluster dictionary attacks.
- **Comparison Table**:

| Feature                   | Argon2id                                    | bcrypt                                       |
| :------------------------ | :------------------------------------------ | :------------------------------------------- |
| **Hardness Dimensions**   | Memory ($m$), Time ($t$), Parallelism ($p$) | Compute work factor ($2^{\text{cost}}$) only |
| **GPU / ASIC Resistance** | **Superior** (forces memory bus saturation) | Weak against massive parallel GPU RAM        |
| **Standard Endorsement**  | Winner of PHC; RFC 9106; OWASP #1           | Legacy standard (1999)                       |
| **Side-Channel Safety**   | Hybrid against timing & cache attacks       | Vulnerable to certain cache-timing leaks     |

### Q28: Compare Redis vs. PostgreSQL for real-time telemetry caching.

- **Direct Answer**: Redis is an in-memory key-value store optimized for sub-millisecond reads/writes and volatile caching; PostgreSQL is a disk-backed ACID relational database optimized for long-term consistency and complex joins.
- **Comparison Table**:

| Feature                | Redis                                       | PostgreSQL                                       |
| :--------------------- | :------------------------------------------ | :----------------------------------------------- |
| **Storage Medium**     | RAM (In-Memory)                             | Disk (SSD/NVMe with buffer pool)                 |
| **Read Latency**       | $< 1\,\text{ms}$                            | $5\text{–}50\,\text{ms}$ (depends on index/load) |
| **Data Relationships** | Key-Value, Hashes, Sorted Sets              | Relational tables, Foreign Keys, SQL             |
| **VitalGuard Usage**   | Latest status cache (`patient:<id>:status`) | Immutable store (`vital_readings`, `users`)      |

### Q29: Compare RabbitMQ message broker vs. direct synchronous API HTTP calls.

- **Direct Answer**: RabbitMQ provides asynchronous decoupling, backpressure buffering, and guaranteed retry delivery; direct HTTP calls couple services synchronously, meaning if the receiver is down or slow, the caller fails or times out.
- **Comparison Table**:

| Feature                 | RabbitMQ Message Bus                  | Direct HTTP API Call                           |
| :---------------------- | :------------------------------------ | :--------------------------------------------- |
| **Coupling**            | Loosely coupled (asynchronous)        | Tightly coupled (synchronous)                  |
| **Traffic Surges**      | Absorbed via persistent queue buffers | Overwhelms receiver; causes 504 errors         |
| **Consumer Failure**    | Messages wait safely in queue         | Immediate failure; caller must implement retry |
| **Routing Flexibility** | Topic exchange routing patterns       | Point-to-point URL mapping                     |

### Q30: Compare Stateless JWT tokens vs. Stateful server-side session cookies.

- **Direct Answer**: Stateless JWTs contain their own claims and require no database lookup to verify signature; session cookies require the server to query a database or Redis store on every request to retrieve session state.
- **Comparison Table**:

| Feature                  | Stateless JWT                           | Stateful Session Cookie                         |
| :----------------------- | :-------------------------------------- | :---------------------------------------------- |
| **Server Storage**       | Zero (stateless validation)             | Requires DB or Redis session table              |
| **Immediate Revocation** | Difficult without token blocklist       | Trivial (delete session key from store)         |
| **Payload Size**         | Larger (encoded claims in header)       | Tiny (32-byte session ID string)                |
| **VitalGuard Hybrid**    | JWT signature + Fastify DB status check | Evaluated; hybrid model chosen for instant bans |

---

## 6. Category E: "Criticize Your Own Project" Questions (5 Questions)

### Q31: What is the single weakest architectural part of your design?

- **Direct Answer**: The WebSocket server's reliance on a 500ms Redis polling loop rather than a true event-driven pub/sub mechanism.
- **Technical Context**: Polling creates an unnecessary baseline of $2\text{ queries/sec}$ per connected socket. With 500 clinicians connected, the Fastify API executes 1,000 Redis commands every second even if all patients have stable, unchanged vitals.
- **Viva Defense Line**: _"While polling enabled rapid development, decoupled ingestion spikes, and provided built-in deduplication, it represents architectural debt. In our documented production roadmap, replacing this with Redis Pub/Sub is our first scalability priority."_

### Q32: If you had to rebuild VitalGuard from scratch today, what would you do differently?

- **Direct Answer**: I would adopt an event-driven pub/sub architecture from Day 1, use TimescaleDB hypertables for telemetry persistence, and store session tokens in `httpOnly` cookies rather than `localStorage`.
- **Technical Context**: Retrofitting pub/sub and cookie authentication after building client SPAs requires coordinating changes across both frontend interceptors and backend route decorators.
- **Viva Defense Line**: _"Starting with `httpOnly` cookies and TimescaleDB from Day 1 would have eliminated our two largest documented limitations without adding significant architectural complexity."_

### Q33: What component in your system would break first under a 100x increase in patient telemetry load?

- **Direct Answer**: The PostgreSQL `vital_readings` table write throughput and the Fastify in-memory rate limiter.
- **Technical Context**: At 100x load (e.g., 10,000 active patients streaming 4 vitals at 1 Hz), PostgreSQL would experience 40,000 inserts per second, quickly exhausting disk write I/O and locking table indexes.
- **Viva Defense Line**: _"Under 100x load, RabbitMQ would buffer the surge, but PostgreSQL write operations would bottleneck. Upgrading `vital_readings` to a TimescaleDB hypertable with batched inserts and moving rate limiting to Redis would resolve this bottleneck."_

### Q34: What is the most critical security risk in the current implementation?

- **Direct Answer**: The storage of JWT authentication tokens in browser `localStorage`.
- **Technical Context**: Any unescaped user input (such as a doctor's clinical note or patient address) that permits Cross-Site Scripting (XSS) could be leveraged by an attacker to execute `localStorage.getItem('vg_token')` and steal an active physician session.
- **Viva Defense Line**: _"We explicitly documented this XSS risk in our limitations audit. In production, tokens belong in `httpOnly`, `Secure` cookies inaccessible to JavaScript."_

### Q35: What is missing before this system could legally claim HIPAA compliance?

- **Direct Answer**: VitalGuard lacks field-level encryption for Protected Health Information (PHI) at rest, Business Associate Agreements (BAAs) for cloud hosting, automated audit trail archiving, and mandatory two-factor authentication (2FA).
- **Technical Context**: While VitalGuard enforces RBAC, Argon2id password hashing, and administrative audit logging, HIPAA Security Rule (§ 164.312) mandates strict technical safeguards including end-to-end encryption at rest, automatic logoff timers, and emergency access procedures.
- **Viva Defense Line**: _"VitalGuard implements foundational security controls—role separation, audit logging, and cryptographic hashing—but achieving legal HIPAA certification requires field-level PHI encryption, certified infrastructure, and mandatory multi-factor authentication."_

---

## 7. Category F: "SRS and Software Engineering Process" Questions (5 Questions)

### Q36: How did your team handle changing requirements during your sprints?

- **Direct Answer**: We used an Agile Scrum approach with 1-week sprints; when requirements changed—such as removing noisy fall detection—we logged the change, updated the SRS traceability matrix, and re-allocated sprint velocity.
- **Technical Context**: Fall detection was originally planned under Module 1. When testing proved accelerometer data generated excessive false alarms, the team documented the architectural decision and re-focused efforts on multi-vital correlation rules.
- **Viva Defense Line**: _"Our iterative Agile lifecycle allowed us to pivot based on empirical testing. We deprecated fall detection early, updated our functional requirements, and prioritized clinical telemetry accuracy."_

### Q37: What was your testing strategy across the stack?

- **Direct Answer**: We implemented a testing pyramid focusing on automated unit testing for cryptographic and mathematical logic, schema validation for edge payloads, and manual end-to-end integration walkthroughs for multi-role user journeys.
- **Technical Context**: In `apps/api`, Vitest executes unit tests for password hashing, rate limiting, and token creation. Telemetry schemas are validated against `schemas/vital-sample.schema.json`.
- **Viva Defense Line**: _"We verified critical business logic—such as password strength, Argon2id verification, and z-score mathematics—with automated unit test suites, while validating complex UI workflows using our standardized 8-minute demo script."_

### Q38: What is an Agile sprint and how did your team apply it?

- **Direct Answer**: A sprint is a time-boxed iteration (typically 1 to 2 weeks) during which a development team delivers a functional, tested increment of software; our team executed 5 focused sprints across edge, analytics, auth, web portals, and system hardening.
- **Technical Context**:
  - Sprint 1: MQTT ingestion and RabbitMQ buffering (F.1–F.7)
  - Sprint 2: Z-score analytics, severity classification, and alert triggers (F.8–F.17)
  - Sprint 3: Argon2id auth, JWT, RBAC, and clinical associations (F.18–F.21)
  - Sprint 4: Web portals, WebSocket telemetry, and Admin Console (F.22–F.26)
  - Sprint 5: System hardening, integration verification, and documentation.
- **Viva Defense Line**: _"Sprints ensured continuous integration and early defect detection. By Sprint 3, our auth and association rules were verified before the React frontend was assembled."_

### Q39: What is the difference between a Functional Requirement (FR) and a Non-Functional Requirement (NFR) in VitalGuard?

- **Direct Answer**: A Functional Requirement defines **what** specific behavior or service the system must perform (e.g., _“Doctors can override patient thresholds”_); a Non-Functional Requirement defines **how** the system performs under constraints like performance, security, and reliability (e.g., _“Passwords must be hashed using Argon2id”_).
- **Project Examples**:
  - **FR (F.24)**: The doctor dashboard must sort patients dynamically by clinical severity (Critical $>$ Warning $>$ Watch $>$ Normal).
  - **NFR (NFR.1)**: Telemetry processing latency from MQTT publication to Redis status cache must not exceed 250 milliseconds.
  - **NFR (NFR.4)**: All administrative account mutations must generate an immutable audit log entry in `admin_audit_log`.

### Q40: What does requirement F.18 cover and how is it implemented in your code?

- **Direct Answer**: Requirement F.18 specifies Multi-Role Self-Registration and Argon2id Password Hashing, allowing patients, caregivers, and doctors to create accounts while ensuring credentials are cryptographically protected against hardware-accelerated attacks.
- **Code & Design Context**: Implemented in `apps/api/src/routes/auth.ts` (`POST /auth/register`) and `apps/api/src/utils/security.ts`. When a user registers, the system validates the email format, enforces password complexity (minimum 8 characters with numbers and symbols), hashes the password via Argon2id with a unique 16-byte cryptographic salt, and inserts the user into PostgreSQL table `users`.
- **Viva Defense Line**: _"F.18 establishes the identity root for the entire platform. By enforcing Argon2id hashing at registration and issuing standardized error codes (`INVALID_CREDENTIALS`), it prevents both credential exposure and username enumeration attacks from the first touchpoint."_
