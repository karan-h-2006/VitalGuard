"""Script entry point for the VitalGuard simulator.

Runs the multi-device manager by default, or single-device legacy publisher with --single.
"""

import sys

from manager import main as manager_main
from publisher import main as publisher_main


def main() -> None:
    if "--single" in sys.argv:
        publisher_main()
    else:
        manager_main()


if __name__ == "__main__":
    main()
