# VitalGuard

VitalGuard is an IoT-based smart patient-health monitoring system. A wearable
or simulator emits heart rate, SpO2, body temperature, and motion data; the
platform ingests, evaluates, stores, and escalates concerning readings to the
right patient, caregiver, or clinician. Phase 0 establishes the production-
oriented foundation only — it contains no clinical rules, database schema, or
authentication logic.

## Architecture

VitalGuard is organized as six cooperating layers:

1. **Device / Edge** — wearable hardware and the standalone Python simulator.
2. **Ingestion** — MQTT receives device data and bridges it into a queue.
3. **Processing** — worker services apply future rules and baseline analytics.
4. **Storage** — relational persistence and cache services hold durable state.
5. **Alerting** — future tiered escalation to patients, caregivers, and doctors.
6. **Application** — HTTP API and role-specific real-time dashboards.

## Repository layout

```text
apps/          Deployable TypeScript services: API, worker, and web dashboard
infra/         Local Mosquitto, RabbitMQ, Postgres, and Redis composition
packages/      Shared TypeScript contracts and engineering configuration
schemas/       Transport contracts shared across language and service boundaries
simulator/     Standalone Python edge-device simulator
.github/       Pull-request validation workflow
```

## How to Run the Project

Follow this step-by-step guide to run the entire VitalGuard platform locally—including infrastructure containers, database migrations, backend services, frontend dashboard, and the IoT edge telemetry simulator.

---

### Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: `v22+` or `v24` (see `.nvmrc`)
- **pnpm**: `v9` (`pnpm -v`)
- **Docker Desktop**: Installed and running
- **Python**: `3.11+`

---

### Step 1: Install Dependencies

From the repository root, install all monorepo dependencies:

```bash
pnpm install
```

---

### Step 2: Configure Environment Variables

Create `.env` files for each component from their corresponding `.env.example` templates.

**On Windows (PowerShell):**

```powershell
Copy-Item -Force infra/.env.example infra/.env
Copy-Item -Force apps/api/.env.example apps/api/.env
Copy-Item -Force apps/worker/.env.example apps/worker/.env
Copy-Item -Force apps/web/.env.example apps/web/.env
Copy-Item -Force simulator/.env.example simulator/.env
```

**On macOS / Linux (Bash):**

```bash
cp infra/.env.example infra/.env
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
cp apps/web/.env.example apps/web/.env
cp simulator/.env.example simulator/.env
```

_(Optional verification: In PowerShell run `Test-Path infra/.env, apps/api/.env, apps/worker/.env, apps/web/.env, simulator/.env` to confirm all 5 return `True`)._

---

### Step 3: Start Docker Infrastructure

1. Launch **Docker Desktop** and wait until the engine indicates **running** (green icon).
2. Start the local infrastructure services (Mosquitto MQTT, RabbitMQ, PostgreSQL, and Redis):

```bash
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
```

3. Verify that all 4 containers are running and healthy:

```bash
docker compose -f infra/docker-compose.yml ps
```

| Service              | Port                        | Description                                          |
| :------------------- | :-------------------------- | :--------------------------------------------------- |
| **Mosquitto (MQTT)** | `1883`                      | Edge device ingestion broker                         |
| **RabbitMQ**         | `5672` (AMQP), `15672` (UI) | Queue broker (`vitalguard` / `vitalguard`)           |
| **PostgreSQL**       | `5432`                      | Relational persistence (`vitalguard` / `vitalguard`) |
| **Redis**            | `6379`                      | Status cache and live sliding-window store           |

> [!TIP]
> **Port 5432 Conflict on Windows**: If you have a local Windows PostgreSQL service installed, it may block Docker from binding to port 5432. Stop it by running `Stop-Service postgresql-x64-18` in an Administrator PowerShell terminal.

---

### Step 4: Run Database Migrations & Seed Demo Data

Once PostgreSQL is running, apply the database schema migrations and seed the initial users, device associations, and thresholds:

```bash
# 1. Apply Drizzle database migrations
pnpm --filter @vitalguard/api db:migrate

# 2. Seed demo accounts (Patient, Doctor, Caregiver, IoT device)
pnpm --filter @vitalguard/api db:seed
```

_(Optional) To bootstrap an administrator account:_

```bash
INITIAL_ADMIN_EMAIL="admin@vitalguard.local" INITIAL_ADMIN_PASSWORD="AdminPassword!2026" \
  pnpm --filter @vitalguard/api db:bootstrap-admin
```

_(On Windows PowerShell: `$env:INITIAL_ADMIN_EMAIL="admin@vitalguard.local"; $env:INITIAL_ADMIN_PASSWORD="AdminPassword!2026"; pnpm --filter @vitalguard/api db:bootstrap-admin`)_

---

### Step 5: Start the Core Services

Open **three separate terminal windows or tabs** (e.g. using split terminals in VS Code):

#### Terminal 1 — Backend API

```bash
pnpm --filter @vitalguard/api dev
```

- **URL**: `http://localhost:3000`
- **Health Check**: `http://localhost:3000/health` (returns `{"status":"ok"}`)

#### Terminal 2 — Processing Worker

```bash
pnpm --filter @vitalguard/worker dev
```

- Connects to MQTT (`HMS/+/vitals`), RabbitMQ (`vitals.ingest`), and Redis.
- Evaluates sliding baselines, correlation rules, trend projections, and alerts.

#### Terminal 3 — Web Dashboard

```bash
pnpm --filter @vitalguard/web dev
```

- **URL**: `http://localhost:5173`

---

### Step 6: Start the Edge IoT Simulator (Live Telemetry)

In a **fourth terminal**, launch the Python simulator to emit continuous biometric readings (Heart Rate, SpO2, Skin Temperature, and Motion):

**On Windows (PowerShell):**

```powershell
cd simulator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python vital_simulator.py
```

**On macOS / Linux (Bash):**

```bash
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python vital_simulator.py
```

You will see:

```text
INFO publisher: Connected to MQTT broker; publishing to HMS/00000000-0000-4000-8000-000000000002/vitals
```

The simulator will now stream samples every 5 seconds. The worker automatically bridges, classifies, stores, and caches this data.

---

### Step 7: Explore Dashboards & Multi-Role Authentication

Open **`http://localhost:5173`** in your browser. You can test each perspective using the seeded demo credentials:

| Role          | Email                             | Password              | Features & Views                                                                                                              |
| :------------ | :-------------------------------- | :-------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| **Patient**   | `patient-demo@vitalguard.local`   | `VitalGuardDemo!2026` | Real-time vitals cards, severity badges, and interactive live Recharts time-series history graph.                             |
| **Doctor**    | `doctor-demo@vitalguard.local`    | `VitalGuardDemo!2026` | Triage dashboard with prioritized patient list, vital trend alerts, threshold configuration, and deep-dive patient telemetry. |
| **Caregiver** | `caregiver-demo@vitalguard.local` | `VitalGuardDemo!2026` | Assigned patient monitoring, urgent escalation notifications, and live status overview.                                       |

---

### Useful Management & Cleanup Commands

- **Web App**: `http://localhost:5173`
- **API Health**: `http://localhost:3000/health`
- **RabbitMQ Dashboard**: `http://localhost:15672` (Username: `vitalguard`, Password: `vitalguard`)
- **Query live database entries**:
  ```bash
  docker exec -it infra-postgres-1 psql -U vitalguard -d vitalguard -c "SELECT vital_type, value, quality_flag, timestamp FROM vital_readings ORDER BY timestamp DESC LIMIT 10;"
  ```
- **Stop infrastructure containers**:
  ```bash
  docker compose -f infra/docker-compose.yml down
  ```

## Quality checks

Run the same JavaScript checks used by CI from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

See each app/package README for isolated commands and ownership boundaries.
