# VitalGuard Production Deployment Guide

This guide describes how to deploy the entire VitalGuard real-time clinical monitoring platform (Infrastructure, API, Worker, Web Dashboard, and Multi-Patient IoT Simulator) onto a single Linux server (Ubuntu/Debian VPS) using Docker Compose and Caddy with automated HTTPS.

---

## 1. System Requirements & Prerequisites

### Hardware Requirements

- **CPU**: 2 cores minimum (4 cores recommended)
- **RAM**: 4 GB RAM minimum (at least 2 GB free memory with 2 GB swap)
- **Disk**: 20 GB SSD storage minimum
- **OS**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS, or Debian 12

### Software Prerequisites

- **Docker Engine** (version >= 24.0)
- **Docker Compose Plugin** (version >= 2.20)
- **Git**
- **OpenSSL** (for generating cryptographically secure secrets)

#### Installing Docker on Ubuntu/Debian:

```bash
# Remove outdated packages
sudo apt-get update && sudo apt-get install -y ca-certificates curl gnupg

# Add Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker packages
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

---

## 2. DNS & Networking Setup

1. **DNS A Record**:
   Point your domain name (e.g. `vitalguard.example.com`) to your server's public IPv4 address.
2. **Firewall / Security Groups**:
   Ensure inbound ports are allowed:
   - **Port 80 (HTTP)**: Required for ACME HTTP-01 challenge and automatic redirection to HTTPS.
   - **Port 443 (HTTPS)**: Encrypted web traffic and WebSocket connections.
   - _(Optional)_ **Port 1883 / 8883 (MQTT)**: Only needed if physical hardware microcontrollers connect directly across the public internet.

---

## 3. Configuration & Secrets

Clone the repository and prepare the production environment file:

```bash
git clone https://github.com/your-org/VitalGuard.git /opt/vitalguard
cd /opt/vitalguard

# Copy the production example configuration
cp infra/.env.prod.example infra/.env.prod
```

Edit `infra/.env.prod` to configure domain and secrets:

```bash
nano infra/.env.prod
```

### Key Variables to Configure:

| Variable                          | Description                                                                     | Recommended Generation        |
| :-------------------------------- | :------------------------------------------------------------------------------ | :---------------------------- |
| `DOMAIN`                          | Public domain name for automatic Let's Encrypt TLS (or `localhost` for testing) | e.g. `vitalguard.example.com` |
| `ACME_EMAIL`                      | Contact email for Let's Encrypt expiry and security notices                     | e.g. `admin@example.com`      |
| `POSTGRES_PASSWORD`               | Strong password for PostgreSQL database                                         | `openssl rand -hex 16`        |
| `RABBITMQ_DEFAULT_PASS`           | Strong password for RabbitMQ message broker                                     | `openssl rand -hex 16`        |
| `JWT_SECRET`                      | Cryptographic secret for signing patient/doctor/admin JWT tokens (min 32 chars) | `openssl rand -hex 32`        |
| `SIMULATOR_SERVICE_TOKEN`         | Bearer token for internal device discovery between simulator and API            | `openssl rand -hex 24`        |
| `AUTO_PROVISION_SIMULATED_DEVICE` | `true` to provision a simulated device on patient signup                        | `true`                        |

---

## 4. One-Command Start

Start all services with Docker Compose in detached mode:

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
```

### What Happens on Startup:

1. `postgres`, `redis`, `mosquitto`, and `rabbitmq` start and perform health checks.
2. The `migrate` container runs database migrations (`drizzle-orm`) against Postgres and terminates with code 0.
3. Once migrations succeed, `api` and `worker` start.
4. `simulator` queries `GET /internal/simulated-devices` on `api` and begins streaming MQTT telemetry.
5. `web` serves the pre-compiled React SPA via Nginx.
6. `caddy` acquires a valid TLS certificate and reverse-proxies `/api/*` & `/api/ws` to the API and `/` to the Web SPA.

---

## 5. Initial Database Seeding

To seed the initial demo accounts, doctor profiles, institutions, and demo devices:

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec api node dist/db/seed.js
```

### Default Demo Credentials:

- **Administrator**: `admin@vitalguard.local` / `AdminDemo2026!`
- **Primary Doctor**: `doctor-demo@vitalguard.local` / `DoctorDemo2026!`
- **Demo Patient**: `patient-demo@vitalguard.local` / `PatientDemo2026!`
- **Secondary Patient**: `patient2-demo@vitalguard.local` / `PatientDemo2026!`

_(Note: Change passwords immediately upon initial sign-in)._

---

## 6. Verification & Health Checks

### Check Container Status:

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml ps
```

All containers should display `Up (healthy)` (except `migrate` which shows `Exited (0)`).

### Verify HTTP & API Endpoints:

```bash
# Check Caddy / Web health
curl -Ik https://<YOUR_DOMAIN>/

# Check API health
curl -sk https://<YOUR_DOMAIN>/api/health
# Expected response: {"status":"ok","uptimeSeconds":...}

# Check Simulator internal health (from host)
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec simulator python -c "import urllib.request; print(urllib.request.urlopen('http://localhost:8080/healthz').read().decode())"
# Expected response: {"status":"ok","managed_devices":...}
```

---

## 7. Operational Management

### View Logs

```bash
# Follow logs for all services
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f

# Follow logs for a specific service
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f api
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f worker
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f simulator
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml logs -f caddy
```

### Restart a Service

```bash
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml restart <service_name>
```

### Deploying Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart containers with zero/minimal downtime
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
```

---

## 8. Backup and Restore Procedures

### Database Backup

Create a compressed SQL dump:

```bash
mkdir -p /opt/vitalguard/backups
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec -T postgres \
  pg_dump -U vitalguard -d vitalguard -F c -b -v > /opt/vitalguard/backups/vitalguard_$(date +%Y%m%d_%H%M%S).dump
```

### Database Restore

Restore from a dump file:

```bash
# Stop application services to prevent schema conflicts
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml stop api worker simulator

# Restore dump into PostgreSQL
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml exec -T postgres \
  pg_restore -U vitalguard -d vitalguard --clean --if-exists -v < /opt/vitalguard/backups/vitalguard_YYYYMMDD_HHMMSS.dump

# Restart application services
docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml start api worker simulator
```

---

## 9. Rollback Procedure

If a deployed update contains an unexpected defect:

1. **Revert Git Commit**:
   ```bash
   git checkout <PREVIOUS_STABLE_COMMIT_OR_TAG>
   ```
2. **Re-run Docker Compose**:
   ```bash
   docker compose --env-file infra/.env.prod -f infra/docker-compose.prod.yml up -d --build
   ```
3. If database schema rollback is required, restore the corresponding PostgreSQL backup dump taken prior to upgrade as described in Section 8.

---

## 10. Switching from Simulated to Hardware IoT Device

VitalGuard transparently supports both virtual simulated devices and real ESP32/ARM IoT wearable hardware:

1. **Admin Console**:
   - Log into `/administrator` with an administrator account.
   - Navigate to the **Patients** tab.
   - Locate the patient row.
   - The **Device & Simulation** column displays whether the device is `Simulated` or `Hardware`.
2. **API Switch**:
   - To convert a simulated device to physical hardware, update the device registration via the API:
     ```bash
     curl -X PATCH https://<YOUR_DOMAIN>/api/admin/devices/<DEVICE_UUID> \
       -H "Authorization: Bearer <ADMIN_TOKEN>" \
       -H "Content-Type: application/json" \
       -d '{"isSimulated": false}'
     ```
   - The simulator will immediately drop telemetry simulation for that device ID upon the next polling interval (within 10 seconds).
   - Configure the physical hardware device with the patient's device UUID to publish schema-validated JSON samples to topic `HMS/<DEVICE_UUID>/vitals`.
