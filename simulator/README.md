# VitalGuard Edge IoT Simulator

The VitalGuard Edge Simulator is an always-on Python service that models the physical IoT wearable device boundary. It publishes complete, schema-validated vital-sign telemetry to `HMS/<device_id>/vitals` over MQTT at QoS 1.

The MQTT payload contract is defined by [`schemas/vital-sample.schema.json`](../schemas/vital-sample.schema.json).

---

## Operating Modes

1. **Multi-Device Manager (`simulator/manager.py` / `pnpm sim`) [Default]**:
   - Queries `GET /internal/simulated-devices` on the API every 10 seconds (authenticated via `SIMULATOR_SERVICE_TOKEN`).
   - Dynamically provisions an independent streaming worker for every registered patient device with zero manual steps.
   - Calculates deterministic, distinct resting baselines (HR, SpO2, Temperature) per patient derived from their UUID.
   - Acquires an atomic distributed Redis lease (`simulator:manager:lease`) to ensure only one active manager publishes when multiple replicas run.
   - Serves an HTTP health check on port 8080 (`GET /healthz`).

2. **Legacy Single-Device Mode (`simulator/vital_simulator.py --single` / `pnpm sim:single`)**:
   - Runs a standalone publisher pinned to the static demo device ID (`00000000-0000-4000-8000-000000000002`).
   - Intended for local low-level protocol debugging and testing without running the backend API discovery endpoint.

---

## Running Locally

### 1. Setup Virtual Environment & Dependencies

**PowerShell (Windows):**

```powershell
# From repository root
cd simulator
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

**Bash (Linux / macOS):**

```bash
# From repository root
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

### 2. Start the Simulator

**From repository root:**

```powershell
pnpm sim
# Or directly inside simulator directory with venv activated:
python manager.py
```

### 3. Check Health

```powershell
curl http://localhost:8080/healthz
# Expected output: {"status":"ok","managed_devices":...}
```

---

## Simulation Scenarios & Clinical Controls

The manager dynamically respects per-device simulation scenarios configured in the database or injected via the administrator console:

- `normal`: Smooth resting vitals (HR 60–100 bpm, SpO2 95–100%, Temp 36.1–37.5 °C).
- `deteriorating`: Progressively degrades SpO2 (<90%) and elevates HR (>110 bpm) and temperature to trigger Warning and Critical alerts.
- `tachycardia`: Induces sustained elevated heart rate (>130 bpm).
- `bradycardia`: Drops heart rate below 50 bpm.
- `hypoxia`: Drops SpO2 below 88%.
- `fever`: Escalates body temperature above 38.5 °C.

---

## Hardware Integration Seam

`sensors/base.py` establishes the abstract `SensorSource` interface. In production environments with real hardware, the simulated generator is replaced by physical drivers (PPG, I2C temperature sensors, and 6-axis IMU) without modifying the publisher transport layer.

To disable simulated data generation in production when physical hardware is connected, set `AUTO_PROVISION_SIMULATED_DEVICE=false` in the API configuration.

---

## Quality & Tests

Run Python linting and unit tests:

```powershell
ruff check simulator/
pytest simulator/ -v
```
