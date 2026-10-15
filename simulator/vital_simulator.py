"""Script entry point for the VitalGuard simulator.

Runs the multi-device manager by default, or single-device legacy publisher with --single.
"""

import sys
from pathlib import Path

_SIM_DIR = Path(__file__).resolve().parent
if str(_SIM_DIR) not in sys.path:
    sys.path.insert(0, str(_SIM_DIR))

from manager import main as manager_main  # noqa: E402
from publisher import main as publisher_main  # noqa: E402


def main() -> None:
    if "--single" in sys.argv:
        print("[VitalGuard Simulator] Starting legacy single-device mode (--single)...", flush=True)
        publisher_main()
    else:
        print("[VitalGuard Simulator] Starting multi-device manager (dynamic discovery mode)...", flush=True)
        manager_main()


if __name__ == "__main__":
    main()
