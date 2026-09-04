# VitalGuard edge simulator

This standalone Python component models the physical-device boundary. It
publishes one complete, schema-validated sample to `HMS/<device_id>/vitals` at
MQTT QoS 1. It replaces the reference project's four-topic messages and unsafe
subscriber reassembly: one message is now one complete reading, including
identity and a UTC timestamp.

The payload source of truth is
[`schemas/vital-sample.schema.json`](../schemas/vital-sample.schema.json).

## Run against local Mosquitto

```bash
# repository root
docker compose --env-file infra/.env -f infra/docker-compose.yml up -d mosquitto
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
set -a; source .env; set +a
python vital_simulator.py
```

In a second terminal with the same environment, run the temporary verifier:

```bash
cd simulator
source .venv/bin/activate
set -a; source .env; set +a
python dev_tools/local_verifier.py
```

It subscribes to `HMS/+/vitals`, validates every message, and writes valid
samples to `received_samples.jsonl`. Delete it when Module 2 provides the
durable ingestion bridge.

## Sensor boundary and demo scenarios

`sensors/base.py` defines `SensorSource`; the simulated implementation creates
smooth random-walk resting values: HR 60-100 bpm, SpO2 95-100%, and temperature
36.1-37.5 C. The publisher only depends on this interface. The documented,
unimplemented `RealSensorSource` seam must later initialize PPG/SpO2,
skin-temperature, and IMU drivers, convert units, and raise I/O failures
without requiring publisher changes.

Enable demo behavior before starting the publisher:

```bash
export VITALGUARD_INJECT_NOISE=true
export VITALGUARD_TRIGGER_FALL=true
export VITALGUARD_DETERIORATION_SAMPLES=12
```

Noise injection creates occasional noisy or implausible PPG values; filtering
marks them. The fall flag schedules one impact-like motion event. Deterioration
ramps HR, SpO2, and temperature toward critical values over sample cycles.

## Cadence and durability

Motion is sampled at 10 Hz for readable local development output; real hardware
is expected to target 50 Hz. HR and SpO2 publish every five seconds, while
temperature refreshes every 30 seconds. MQTT failures append full samples to
`buffer.jsonl`; reconnection replays them chronologically with `gap: true` and
clears the file only after the full replay succeeds. Module 2 must consume this
at-least-once stream idempotently.
