# 01 — The Project in Simple Words

This guide is written in natural, spoken English so you can explain VitalGuard aloud with total confidence. Read these sections word-for-word or use them as talking points when an instructor or evaluator asks you to summarize the project.

---

## 1. The 30-Second Pitch

> "VitalGuard is an end-to-end hospital IoT health monitoring system that continuously tracks patient vitals like heart rate, oxygen levels, and temperature. Wearable sensors stream telemetry in real time, and our backend analytics pipeline automatically detects abnormal clinical patterns and alerts medical staff before a patient enters critical distress. It connects patients, caregivers, doctors, and hospital administrators through dedicated web portals so care teams can act immediately. In short, it turns raw sensor streams into early clinical intervention."

---

## 2. The 2-Minute Pitch

> In general hospital wards and home-care settings, patient vitals are often checked manually only every few hours. This means sudden clinical deterioration—such as sudden hypoxia or cardiac tachycardia—can go unnoticed until an acute emergency occurs.
>
> VitalGuard solves this by providing continuous, automated vital sign monitoring. Wearable IoT devices transmit continuous vitals—Heart Rate, SpO2, Temperature, and Motion—over MQTT. Our backend ingestion pipeline validates incoming telemetry through message queues and calculates personalized dynamic baselines using statistical z-scores and trend regression. If a reading breaches critical clinical thresholds or shows an abnormal multi-vital correlation, the system instantly escalates the alert and delivers live status changes to clinicians' dashboards via WebSockets.
>
> Four distinct user groups rely on the platform: **Patients** can track their own vitals and control who has access to their data; **Caregivers** monitor loved ones with patient consent; **Doctors** triage assigned patients and override clinical thresholds; and **Administrators** govern medical licensing, hospital staff assignments, and audit logs. The entire pipeline—from sensor ingestion to alert dispatch—is fully automated and runs in milliseconds.

---

## 3. The 5-Minute Pitch & The Hospital Dispatcher Analogy

> To understand VitalGuard, imagine an ultra-diligent medical intern and hospital dispatcher paired together at every patient's bedside 24 hours a day, 7 days a week:
>
> 1. **The Sensor & Ingestion Layer**: A wearable device on the patient's wrist continuously gathers physiological measurements and sends lightweight packets over MQTT. A broker receives the messages and passes them to our RabbitMQ queue, ensuring no data packet is lost even during high traffic surges.
> 2. **The Intelligence Layer**: A specialized background worker consumes messages from the queue. Instead of just checking naive static thresholds, it builds a personalized 7-day sliding-window baseline for that specific patient. It checks if heart rate is spiking unusually compared to the patient's normal resting rate using z-score anomaly analysis, calculates rate-of-change velocity, and checks multi-vital correlation (such as elevated heart rate combined with plummeting oxygen saturation).
> 3. **The Severity Decision Engine**: The worker evaluates 5 clinical priority rules to classify telemetry into one of four tiers: **Normal**, **Watch**, **Warning**, or **Critical**. If the status is Warning or Critical, a database alert is raised and an SLA escalation timer begins. For Critical events, simulated email and SMS dispatches are instantly dispatched to on-duty staff.
> 4. **The Live Presentation Layer**: The latest reading and severity tier are immediately cached in Redis and permanently stored in PostgreSQL. A Fastify WebSocket gateway streams these updates in real time to our React web dashboard. The attending physician's clinical triage workstation flashes from green to red without refreshing the browser, displaying the exact telemetry history and abnormal indicators.

---

## 4. What Happens When a Patient's Heart Rate Spikes?

Here is the exact step-by-step story of an emergency event, tracing through every layer of the system:

```
[1. Wearable / Simulator]  Heart rate spikes from 75 to 142 bpm
           ↓  MQTT Publish (HMS/device_id/vitals)
[2. Mosquitto Broker]      Port 1883 forwards packet
           ↓  Worker MQTT Bridge
[3. RabbitMQ Exchange]     Routes to topic exchange 'vitals' -> 'vitals.ingest' queue
           ↓  Idempotent Consumer
[4. Processing Worker]     Validates JSON schema; checks device registration in Postgres
           ↓  Analytics Engine
[5. Analytics & Severity]  Rule 2 triggers: HR > 100 bpm AND z-score > 2.0σ → CRITICAL
           ↓  Dual Write
[6. Persistence & Cache]   Writes to PostgreSQL 'vital_readings' & 'alerts'; caches to Redis 'patient:<id>:status'
           ↓  WebSocket Polling
[7. Fastify API Gateway]   GET /ws detects Redis hash change (within 500ms); pushes JSON payload
           ↓  Browser Push
[8. Doctor's React Web]    Dashboard updates instantly: Patient card turns RED; audible alert sounds
           ↓  Background Dispatcher
[9. SLA Escalation]        Dispatches simulated SMS/Email; SLA escalation timer begins for doctor ack
```

### Detailed Story Walkthrough:

1. **Edge Generation (`simulator/manager.py`)**: The simulator switches to a `tachycardia` or `deteriorating` scenario, generating a heart rate of 142 bpm (normal resting baseline: 75 bpm).
2. **MQTT Broker (`infra/mosquitto.conf`)**: The virtual device publishes a JSON packet to MQTT topic `HMS/<device_id>/vitals` on port 1883 with QoS 1.
3. **Queue Bridge (`apps/worker/src/bridge.ts`)**: The worker MQTT bridge receives the message, verifies schema compatibility, and publishes it into RabbitMQ's topic exchange `vitals`, routing it into queue `vitals.ingest`.
4. **Idempotent Ingestion (`apps/worker/src/consumer/`)**: A background consumer picks up the packet. It validates that the device belongs to an active registered patient and prevents duplicate ingestion via unique database index.
5. **Analytics Engine (`apps/worker/src/analytics/`)**: The engine checks the patient's 7-day sliding window. A heart rate of 142 bpm exceeds the standard upper threshold (100 bpm) and represents a z-score of $+3.5\sigma$ above their baseline. Severity Rule 2 fires: **Critical**.
6. **Dual Write (PostgreSQL & Redis)**: The raw reading and the Critical alert are saved to Postgres (`vital_readings` and `alerts`). The latest status summary is atomically cached in Redis under `patient:<id>:status`.
7. **Fastify WebSocket Gateway (`apps/api/src/features/vitals/`)**: The API's active WebSocket connection polls the Redis key (default every 500ms). It detects a new timestamp and changed status, serializing an update message.
8. **Doctor's Triage Workstation (`apps/web/src/features/doctor/`)**: The doctor's browser receives the WebSocket message. The patient's row dynamically sorts to the top of the clinical triage list, glowing red with a "Critical - Tachycardia" badge.
9. **Alerting & SLA Escalation (`apps/worker/src/alerts/`)**: An alert notification is dispatched via Resend/Twilio sandbox. If the doctor does not acknowledge the alert within the SLA deadline, an automated escalation checker increases the urgency level.

---

## 5. The Four User Roles

| Role              | Who They Are                                        | What They Can Do in VitalGuard                                                                                                                                                                                                                                                                                                                                                |
| :---------------- | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Patient**       | The individual wearing the health monitoring sensor | • View their own live vitals stream and color-coded status<br>• Inspect historical vital trend graphs (24-hour, 7-day, 30-day views)<br>• Manage caregiver consent ("Who can view my medical vitals")<br>• View assigned doctor information                                                                                                                                   |
| **Caregiver**     | Family member, relative, or home nurse              | • Request access to monitor a specific patient<br>• View a multi-patient roster of consenting patients<br>• View real-time vitals and open emergency alerts for authorized patients<br>• Receive prompt notifications if loved ones show signs of distress                                                                                                                    |
| **Doctor**        | Attending physician or hospital clinician           | • Register with medical license and clinic affiliation (requires admin review)<br>• Review prioritized clinical triage workstation sorted by patient severity<br>• Inspect in-depth patient vital histories and anomaly indicators<br>• Customize per-patient vital thresholds (e.g., allow athletic HR 50–90)<br>• Generate and download clinical weekly PDF summary reports |
| **Administrator** | Hospital IT / clinical governance officer           | • Review, approve, reject, or suspend doctor licensing applications<br>• Assign patients to primary doctors and handle cross-hospital transfers<br>• Supervise patient-caregiver link requests and consent states<br>• Enforce emergency account suspensions and review immutable audit logs<br>• Inject live simulation scenarios (`normal`, `deteriorating`, `tachycardia`) |

---

## 6. Real vs. Simulated: Honest System Boundary

When the examiner asks about physical sensors, answer with this direct, professional statement:

> "In this academic release, the telemetry is **synthetically simulated** by an autonomous multi-patient Python service (`simulator/manager.py`). The simulator acts as virtual hardware: it discovers registered patients via REST, assigns distinct biometric baselines, and publishes genuine MQTT packets on port 1883 that conform exactly to physical wearable JSON schemas.
>
> All backend ingestion, message queues, analytical processing, Redis caching, database storage, and WebSocket streaming treat these packets as real edge telemetry. Transitioning to physical hardware requires only flashing embedded C/C++ firmware (e.g., on ESP32 or Raspberry Pi with PPG and IMU sensors) to publish the same JSON payload format to our Mosquitto broker."

---

## 7. Rapid-Fire One-Line Answers

Memorize these exact one-liners for quick-fire oral questions:

- **What database are you using?**  
  _PostgreSQL 17 for relational storage (users, readings, alerts, audit log) managed via Drizzle ORM, with Redis 7 for high-speed status caching and sliding windows._
- **What programming languages did you write this in?**  
  _TypeScript for the Fastify API and React 18 web application, and Python 3.10+ for the background analytics worker and multi-device simulator._
- **Who stores the data and where?**  
  _All long-term vital readings, clinical alerts, and governance logs are stored in PostgreSQL tables; short-term baselines and live statuses are cached in Redis._
- **How does the doctor see vitals live on screen?**  
  _Through a Fastify WebSocket connection (`GET /ws`) that polls the patient's Redis status hash every 500ms and pushes deltas to the React client._
- **How does the system decide an event is an emergency?**  
  _Through a deterministic 5-tier clinical severity engine combining static threshold breaches, statistical z-score anomalies ($>2.0\sigma$), and multi-vital correlation rules._
- **What network ports does the system run on?**  
  _Fastify API on port 3000, Vite React Web on port 5173, PostgreSQL on 5432, Redis on 6379, RabbitMQ on 5672 (management on 15672), and Mosquitto MQTT on 1883._
- **What is the MQTT topic format?**  
  _`HMS/<device_id>/vitals` published with MQTT QoS 1 (at least once delivery)._
- **How are passwords stored?**  
  _Hashed using Argon2id with unique cryptographic salts, requiring a minimum of 10 characters._
