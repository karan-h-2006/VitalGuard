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
simulator/     Standalone Python edge-device simulator
.github/       Pull-request validation workflow
```

## Local setup

1. Install Node 24 (the version in `.nvmrc`), pnpm 9, Docker Desktop, and
   Python 3.11+.
2. Clone the repository and install JavaScript dependencies:

   ```bash
   pnpm install
   ```

3. Copy local environment templates. They are deliberately separate so a
   service can switch from Docker to cloud endpoints through configuration:

   ```bash
   cp apps/api/.env.example apps/api/.env
   cp apps/worker/.env.example apps/worker/.env
   cp apps/web/.env.example apps/web/.env
   cp infra/.env.example infra/.env
   ```

4. Start local infrastructure:

   ```bash
   docker compose --env-file infra/.env -f infra/docker-compose.yml up -d
   ```

5. Use separate terminals to run the services:

   ```bash
   pnpm --filter @vitalguard/api dev
   pnpm --filter @vitalguard/worker dev
   pnpm --filter @vitalguard/web dev
   ```

6. Optionally run the edge simulator in a fourth terminal:

   ```bash
   cd simulator
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   python vital_simulator.py
   ```

The API health endpoint is `http://localhost:3000/health`; RabbitMQ Management
is `http://localhost:15672` (local credentials are in `infra/.env`).

## Quality checks

Run the same JavaScript checks used by CI from the repository root:

```bash
pnpm lint
pnpm typecheck
pnpm build
pnpm test
```

See each app/package README for isolated commands and ownership boundaries.
