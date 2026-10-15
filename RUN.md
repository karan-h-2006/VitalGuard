# VitalGuard local demo runbook

This guide starts the API, web dashboard, database and message services, processing worker, and simulated IoT device on a Windows machine using PowerShell. All account details and service credentials below are local demo values; do not reuse them outside a local demo.

## Prerequisites

- **Node.js 24.x** (the repository `.nvmrc` specifies 24; root `package.json` requires Node `>=24`).
- **pnpm 9.15.4** (the root `package.json` pins this through `packageManager`). Use Corepack or install this exact pnpm version.
- **Docker Desktop** with its Linux container engine running and Docker Compose v2. Containers provide PostgreSQL 17, Redis 7, RabbitMQ 4 with management UI, and Mosquitto 2 (versions are pinned in `infra/docker-compose.yml`).
- **Python 3.11 or newer** and `pip` for the device simulator. The current machine reports Python 3.14.0; Python 3.11–3.13 are also suitable.
- PowerShell and a browser. No physical sensor is required.

Check the tools before starting:

```powershell
node --version
pnpm --version
docker --version
docker compose version
python --version
```

## 1. Install dependencies

Open PowerShell in the repository root (`C:\Users\rohan\repos\VitalGuard`):

```powershell
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version
pnpm install
```

The version check should print `9.15.4`. If Corepack cannot install pnpm, use `npm install --global pnpm@9.15.4`, open a new terminal, then run `pnpm --version` and `pnpm install`.

## 2. Configure local environment files

The repo already contains component-specific templates; there is no root `.env.example` because each service reads its own environment file. From the repository root, create local copies (skip a copy if you already have a configured `.env` you want to keep):

```powershell
if (-not (Test-Path infra/.env)) { Copy-Item infra/.env.example infra/.env }
if (-not (Test-Path apps/api/.env)) { Copy-Item apps/api/.env.example apps/api/.env }
if (-not (Test-Path apps/worker/.env)) { Copy-Item apps/worker/.env.example apps/worker/.env }
if (-not (Test-Path apps/web/.env)) { Copy-Item apps/web/.env.example apps/web/.env }
if (-not (Test-Path simulator/.env)) { Copy-Item simulator/.env.example simulator/.env }
```

The example files contain safe local values. Required settings are listed below; the checked-in files also include optional tuning values and defaults. Leave optional email/SMS provider credentials unset for a demo; the worker logs sandbox dispatches instead of contacting providers.

| Template                   | Required configuration                                                                                                                                                                                                  | Purpose                                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `infra/.env.example`       | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `RABBITMQ_DEFAULT_USER`, `RABBITMQ_DEFAULT_PASS`                                                                                                                   | Local container credentials. Examples use the local-only `vitalguard` values.                                                        |
| `apps/api/.env.example`    | `NODE_ENV`, `PORT`, `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`, `CORS_ORIGIN`, `JWT_SECRET`                                                                                                               | API runtime. `JWT_SECRET` must be at least 16 characters; the example has a safe placeholder suitable only for local development.    |
| `apps/worker/.env.example` | `NODE_ENV`, `LOG_LEVEL`, `DATABASE_URL`, `REDIS_URL`, `RABBITMQ_URL`                                                                                                                                                    | Worker connections to storage and messaging. Other analytics thresholds and MQTT settings have defaults in `apps/worker/src/env.ts`. |
| `apps/web/.env.example`    | `VITE_API_BASE_URL`                                                                                                                                                                                                     | Vite API proxy target (normally `http://localhost:3000`).                                                                            |
| `simulator/.env.example`   | No mandatory variables: its publisher supplies local defaults. For this seeded demo, keep `VITALGUARD_DEVICE_ID=00000000-0000-4000-8000-000000000002` and `VITALGUARD_PATIENT_ID=00000000-0000-4000-8000-000000000001`. | Simulator identity and MQTT settings. All simulator controls and defaults are in this template.                                      |

The API and worker templates must point to the same local services and database. For the provided Compose defaults, use:

```text
DATABASE_URL=postgresql://vitalguard:vitalguard@localhost:5432/vitalguard
REDIS_URL=redis://localhost:6379
RABBITMQ_URL=amqp://vitalguard:vitalguard@localhost:5672
```

For a new clone, the copies above use those values already. Do not put real secrets or production data in these files.

## 3. Start local infrastructure

Docker Desktop must be running. From the repo root:

```powershell
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
docker compose --env-file infra/.env -f infra/docker-compose.yml ps
```

Wait until Postgres, Redis, RabbitMQ, and Mosquitto are healthy before continuing. Their local endpoints are:

| Service             | URL / port                                                        |
| ------------------- | ----------------------------------------------------------------- |
| PostgreSQL 17       | `localhost:5432`                                                  |
| Redis 7             | `localhost:6379`                                                  |
| RabbitMQ AMQP       | `localhost:5672`                                                  |
| RabbitMQ management | `http://localhost:15672` (demo login `vitalguard` / `vitalguard`) |
| Mosquitto MQTT      | `localhost:1883`                                                  |

## 4. Apply database migrations and seed demo accounts

Run from the repo root after infrastructure is healthy:

```powershell
pnpm --filter @vitalguard/api db:migrate
pnpm --filter @vitalguard/api db:seed
```

The seed command creates or refreshes the demo clinic, patient, device, caregiver, approved doctor, pending doctor, unassigned patient, and their demo links. The seeded login password for the patient, caregiver, and doctor accounts below is `VitalGuardDemo!2026`.

Create the demo administrator once, using a local-only password of 12 or more characters:

```powershell
$env:INITIAL_ADMIN_EMAIL = 'admin-demo@vitalguard.local'
$env:INITIAL_ADMIN_PASSWORD = 'DemoAdmin!2026'
pnpm --filter @vitalguard/api db:bootstrap-admin
Remove-Item Env:INITIAL_ADMIN_EMAIL
Remove-Item Env:INITIAL_ADMIN_PASSWORD
```

The administrator is created with `mustChangePassword` enabled, so sign in once and follow the change-password screen before using the console. Bootstrap refuses to overwrite an existing email; on a database where that admin already exists, skip the bootstrap command and use the existing demo admin password.

## 5. Start the API

Open a new PowerShell terminal in the repository root:

```powershell
pnpm --filter @vitalguard/api dev
```

API base URL: `http://localhost:3000`. Confirm it is ready at `http://localhost:3000/health` (expected response: `{"status":"ok"}`). Keep this terminal running.

## 6. Start the processing worker

Open another terminal in the repo root:

```powershell
pnpm --filter @vitalguard/worker dev
```

This starts the MQTT bridge, RabbitMQ ingestion consumer, analytics/alert processing, and weekly report job in one process. It connects to the services from `apps/worker/.env`. Keep this terminal running.

## 7. Start the web dashboard

Open another terminal in the repo root:

```powershell
pnpm --filter @vitalguard/web dev
```

Open **`http://localhost:5173`**. The Vite server proxies `/api` requests to `http://localhost:3000`.

## 8. Sign in to each demo role

Use the login page at `http://localhost:5173/login`:

| Role          | Email                             | Password              | Notes                                                                 |
| ------------- | --------------------------------- | --------------------- | --------------------------------------------------------------------- |
| Patient       | `patient-demo@vitalguard.local`   | `VitalGuardDemo!2026` | Seeded patient with the demo device and assigned doctor.              |
| Caregiver     | `caregiver-demo@vitalguard.local` | `VitalGuardDemo!2026` | Seeded caregiver linked to the demo patient.                          |
| Doctor        | `doctor-demo@vitalguard.local`    | `VitalGuardDemo!2026` | Seeded approved doctor linked to the demo patient.                    |
| Administrator | `admin-demo@vitalguard.local`     | `DemoAdmin!2026`      | Created by the bootstrap step; must change password on first sign-in. |

The seed also creates `patient-unassigned@vitalguard.local` and a pending doctor `doctor-pending@vitalguard.local`, both with the seeded demo password. These are useful for showing the admin onboarding and assignment screens.

## 9. Start the simulated device and trigger a Critical reading

The simulator publishes samples every five seconds to the seeded device topic. Start it only after the worker is running. Open a fourth terminal:

```powershell
cd C:\Users\rohan\repos\VitalGuard\simulator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

Launch the simulator using the root convenience command (or direct Python):

```powershell
pnpm sim
# Or directly:
python simulator/manager.py
```

The simulator manager discovers all registered patient devices from the API (`GET /internal/simulated-devices`), derives patient-specific baselines, and streams vitals continuously over MQTT.

_(Optional: To run in legacy single-device mode pinned to the demo patient with a deterioration ramp:)_

```powershell
$env:VITALGUARD_DETERIORATION_SAMPLES = '12'
python simulator/vital_simulator.py --single
```

## URLs and ports

- Web dashboard: `http://localhost:5173`
- API: `http://localhost:3000`; health check: `http://localhost:3000/health`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`
- RabbitMQ AMQP: `localhost:5672`; management UI: `http://localhost:15672`
- Mosquitto MQTT: `localhost:1883`

## Stop the demo

Stop each foreground process with **Ctrl+C**. To stop the infrastructure containers but keep database/cache data:

```powershell
cd C:\Users\rohan\repos\VitalGuard
docker compose --env-file infra/.env -f infra/docker-compose.yml down
```

Only if you intentionally want to delete local Postgres and Redis demo data, add `-v` to the `down` command.
