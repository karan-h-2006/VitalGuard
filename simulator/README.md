# VitalGuard edge simulator

This is deliberately a standalone Python program rather than a pnpm workspace:
it models the physical-device boundary. In Phase 0 it prints a mock structured
reading every few seconds; it does not connect to MQTT yet.

## Run

```bash
cd simulator
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python vital_simulator.py
```

Use `python vital_simulator.py --interval-seconds 1` to change the cadence.
Press Ctrl+C to stop it cleanly.

The reading shape includes a device ID, patient ID, UTC timestamp, heart rate,
SpO2, body temperature, and motion. Values are mock data only and must never
be interpreted as clinical measurements.

`requirements.txt` contains test/lint tooling only; the simulator runtime has
no third-party dependency.
