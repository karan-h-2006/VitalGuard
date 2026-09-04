"""Phase 0 edge simulator: print one structured vital-reading batch on a cadence."""

from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime, timezone
from typing import Final

DEFAULT_INTERVAL_SECONDS: Final[float] = 3.0
SIMULATED_PATIENT_ID: Final[str] = "patient-demo-001"
SIMULATED_DEVICE_ID: Final[str] = "device-demo-001"


def create_reading() -> dict[str, object]:
    """Return the Phase 1 pipeline shape without claiming clinical accuracy."""
    return {
        "deviceId": SIMULATED_DEVICE_ID,
        "patientId": SIMULATED_PATIENT_ID,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "vitals": {
            "heartRate": random.randint(62, 82),
            "spo2": round(random.uniform(96.0, 99.0), 1),
            "bodyTemperature": round(random.uniform(36.4, 37.2), 1),
            "motion": round(random.uniform(0.0, 0.4), 2),
        },
    }


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Print mock VitalGuard readings at a fixed cadence.",
    )
    parser.add_argument(
        "--interval-seconds",
        type=float,
        default=DEFAULT_INTERVAL_SECONDS,
        help="Seconds between readings (default: %(default)s).",
    )
    arguments = parser.parse_args()
    if arguments.interval_seconds <= 0:
        parser.error("--interval-seconds must be greater than zero")
    return arguments


def main() -> None:
    arguments = parse_arguments()
    try:
        while True:
            print(json.dumps(create_reading()), flush=True)
            time.sleep(arguments.interval_seconds)
    except KeyboardInterrupt:
        # A clean Ctrl+C matters when this eventually becomes a Docker process.
        return


if __name__ == "__main__":
    main()
