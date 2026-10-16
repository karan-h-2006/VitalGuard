# VitalGuard Evaluation Study Guide

**Rohan | 241IT064 | B.Tech IT NITK | Evaluation: 2026-10-16**

This master study guide serves as the definitive roadmap and index for the 13-document VitalGuard project evaluation pack. Designed specifically for Rohan's viva defense and live demonstration under course IT303, it consolidates core architectural choices, spoken explanations, code ownership details, and rapid-cram summaries.

---

## Complete File Index Table

| File                                                                                                                                            | What It Covers                                                                              | Estimated Read Time |       Priority       |
| :---------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------ | :-----------------: | :------------------: |
| [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md)                                                     | Reading guide, project reality check, CODEOWNERS note, examiner traps, seed credentials     |       5 mins        |  **P1 (Must read)**  |
| [01-project-in-simple-words.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/01-project-in-simple-words.md)                               | 30s/2m/5m spoken pitches, patient heart-rate spike story, and 4 stakeholder roles           |       7 mins        |  **P1 (Must read)**  |
| [02-architecture-and-technology.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/02-architecture-and-technology.md)                       | 6-layer architecture, Mermaid diagrams, tech selection rationale, 5-tier severity table     |       12 mins       | **P2 (Should read)** |
| [03-my-part-deep-dive.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/03-my-part-deep-dive.md)                                           | Deep dive on Rohan's ownership (F.18–F.26): Auth, RBAC, WebSocket, Admin, Reports, Web      |       18 mins       |  **P1 (Must read)**  |
| [04-demo-script.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/04-demo-script.md)                                                       | 7-8 min step-by-step live demo script, click instructions, fallback & recovery tips         |       10 mins       |  **P1 (Must read)**  |
| [05-viva-qa-my-part.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/05-viva-qa-my-part.md)                                               | 77 Q&A on Rohan's ownership (auth, RBAC, WebSocket, reports, governance, frontend)          |       20 mins       | **P2 (Should read)** |
| [06-viva-qa-whole-project.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/06-viva-qa-whole-project.md)                                   | 76 Q&A on full system across all 3 teammates (MQTT, RabbitMQ, Worker analytics, DevOps)     |       20 mins       | **P2 (Should read)** |
| [07-software-engineering-and-srs-questions.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/07-software-engineering-and-srs-questions.md) | SE/SRS mapping, IEEE standards, DFDs, Agile SDLC, testing metrics, and design patterns      |       15 mins       | **P2 (Should read)** |
| [08-database-and-api-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/08-database-and-api-cheat-sheet.md)                     | All DB tables/enums, ER diagram, Fastify route catalog, Redis keys, and MQTT schema         |       12 mins       |   **P3 (If time)**   |
| [09-frontend-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/09-frontend-cheat-sheet.md)                                     | React component hierarchy, AuthContext, WebSocket client, design tokens, frontend Q&A       |       10 mins       |   **P3 (If time)**   |
| [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md)                                     | Ultra-compact cheat sheet for last-minute review: ports, numbers, thresholds, 10 hardest Qs |       5 mins        |  **P1 (Must read)**  |
| [11-limitations-and-future-work.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/11-limitations-and-future-work.md)                       | Known system limitations, 10k-patient scaling bottlenecks, positive academic reframing      |       8 mins        |   **P3 (If time)**   |
| [12-tricky-questions-and-how-to-answer.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/12-tricky-questions-and-how-to-answer.md)         | 40+ coached answers for hardest instructor traps, unknown questions, and AI tool defense    |       8 mins        | **P2 (Should read)** |

---

## Recommended Reading Order by Scenario

- **"I have 10 minutes"**: Read [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md), then skim [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md) (focus on credentials & weak points).
- **"I have 30 minutes"**: Read [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md), [01-project-in-simple-words.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/01-project-in-simple-words.md), [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md), then [03-my-part-deep-dive.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/03-my-part-deep-dive.md) (skip directly to My Part section).
- **"I have 1 hour"**: Read [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md), [01-project-in-simple-words.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/01-project-in-simple-words.md), [02-architecture-and-technology.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/02-architecture-and-technology.md), [03-my-part-deep-dive.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/03-my-part-deep-dive.md), [04-demo-script.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/04-demo-script.md), [05-viva-qa-my-part.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/05-viva-qa-my-part.md), and [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md).
- **"I have 2+ hours"**: Read everything in sequential order from [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md) through [12-tricky-questions-and-how-to-answer.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/12-tricky-questions-and-how-to-answer.md).
- **"Just before entering the room"**: Read [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md) (compact numbers & facts) + [12-tricky-questions-and-how-to-answer.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/12-tricky-questions-and-how-to-answer.md) (defense strategies & tricky traps).

---

## Quick Project Snapshot

- **What it does**: Continuous, automated IoT hospital vital-sign monitoring platform that transforms raw physiological telemetry into predictive clinical alerts and real-time intervention.
- **Who uses it**: Four distinct roles: **Patients** (telemetry & consent), **Caregivers** (consented monitoring), **Doctors** (clinical triage & overrides), and **Administrators** (governance & audit).
- **What's built (NOT fall detection)**: Monitors Heart Rate, SpO2, Temperature, and Motion using dynamic z-scores and trend forecasting; fall detection was completely removed to focus on telemetry validity.
- **How data flows**: Python Simulator $\rightarrow$ Mosquitto (MQTT QoS 1) $\rightarrow$ RabbitMQ (`vitals.ingest`) $\rightarrow$ Node.js Worker $\rightarrow$ PostgreSQL 17 + Redis 7 $\rightarrow$ Fastify WebSocket (`/ws`) $\rightarrow$ React 18 SPA.
- **Rohan's specific contribution**: Full ownership of SRS F.18–F.26: React 18 frontend dashboards, Fastify API authentication/RBAC, 8-tab admin governance console, WebSocket streaming gateway, and PDF reports.

---

## Critical Facts to Memorize

1. **Service Ports**: Fastify API (`3000`), React Web Vite (`5173`), Mosquitto MQTT (`1883`), RabbitMQ AMQP (`5672`) / Management UI (`15672`), PostgreSQL (`5432`), Redis (`6379`).
2. **Default Clinical Thresholds**: Heart Rate: `60–100 bpm`, Blood Oxygen ($SpO_2$): $\ge 95\%$, Temperature: `36.1–37.5 °C` ($97.0–99.5 \text{ }^\circ\text{F}$); evaluated against custom doctor overrides per patient.
3. **Statistical Baseline Modeling**: Personalized 7-day rolling baseline in Redis sorted sets; Z-score formula $z = \frac{x - \mu}{\sigma}$; Watch-level alert at $1.5 \le |z| < 2.0$, and Anomalous flag at $|z| \ge 2.0$.
4. **Severity Decision Cascade (5 Rules)**: Rule 1: Multi-vital correlation fired $\rightarrow$ **Critical**; Rule 2: Static threshold breach AND $|z| \ge 2.0$ $\rightarrow$ **Critical**; Rule 3: Threshold breach OR $|z| \ge 2.0$ OR Trend warning $\rightarrow$ **Warning**; Rule 4: Watch-level $1.5 \le |z| < 2.0$ $\rightarrow$ **Watch**; Rule 5: Fallback $\rightarrow$ **Normal**.
5. **Predictive Trend Forecasting**: Ordinary Least Squares (OLS) linear regression on the last 10 readings ($N=10$) forecasting biometric trajectory over a 30-minute lookahead window ($t_{\text{lookahead}} = 30\text{ min}$).
6. **Password Security & Auth**: Passwords hashed with **Argon2id** (memory-hard, resistant to GPU/ASIC attacks); stateless HS256 JWT tokens with database re-validation of `mustChangePassword` and `isSuspended` on every authenticated request.
7. **Rate Limiting Windows**: In-memory sliding window rate limiter: Standard users get 5 attempts / 60 seconds; Administrator routes get 3 attempts / 300 seconds.
8. **WebSocket Gateway Push**: Fastify WebSocket at `/ws?token=...` polls Redis key `patient:<id>:status` every 500ms (`WEBSOCKET_POLL_INTERVAL_MS`) and broadcasts JSON payloads only on state/hash change.
9. **SLA Escalation Policy**: Critical alerts unacknowledged by a doctor after 5 minutes trigger a 30-second cron escalation cycle (`apps/worker`), escalating severity tiers and re-dispatching multi-channel notifications.
10. **Database Idempotency**: Edge ingestion into PostgreSQL `vital_readings` uses a composite unique index on `(device_id, timestamp, vital_type)` with `ON CONFLICT DO NOTHING` to guarantee deduplication from RabbitMQ at-least-once delivery.

---

## File Links

- [00-README-FIRST.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/00-README-FIRST.md) — Reading guide, weak points, examiner traps, seed credentials.
- [01-project-in-simple-words.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/01-project-in-simple-words.md) — 30s/2m/5m pitches, heart-rate spike story, role breakdowns.
- [02-architecture-and-technology.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/02-architecture-and-technology.md) — System architecture diagram, tech stack rationale, severity table.
- [03-my-part-deep-dive.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/03-my-part-deep-dive.md) — Comprehensive technical deep dive into Rohan's F.18–F.26 modules.
- [04-demo-script.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/04-demo-script.md) — 7–8 minute step-by-step live demo script with fallback contingencies.
- [05-viva-qa-my-part.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/05-viva-qa-my-part.md) — 77 Q&A covering Auth, RBAC, WebSocket, Admin Governance, Frontend.
- [06-viva-qa-whole-project.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/06-viva-qa-whole-project.md) — 76 Q&A covering IoT edge, RabbitMQ, Worker analytics, and DevOps.
- [07-software-engineering-and-srs-questions.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/07-software-engineering-and-srs-questions.md) — SE course concepts, SRS requirements matrix, Agile SDLC, DFDs.
- [08-database-and-api-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/08-database-and-api-cheat-sheet.md) — Schema tables, enums, ER diagram, Redis keys, Fastify API routes.
- [09-frontend-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/09-frontend-cheat-sheet.md) — React routing, AuthContext, WebSocket state, UI tokens, frontend viva Q&A.
- [10-one-page-cheat-sheet.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/10-one-page-cheat-sheet.md) — Emergency single-page cram sheet: numbers, ports, thresholds, 10 traps.
- [11-limitations-and-future-work.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/11-limitations-and-future-work.md) — Architectural limitations, 10k scaling bottlenecks, positive defenses.
- [12-tricky-questions-and-how-to-answer.md](file:///c:/Users/rohan/repos/VitalGuard/docs/study/12-tricky-questions-and-how-to-answer.md) — 40+ coached answers for aggressive questions, AI tools, and unknowns.

---

Generated: 2026-10-16 | Branch: docs/evaluation-study-pack | Do not share outside the team.
