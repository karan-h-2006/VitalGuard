"""Motion derivation adapted from IMU readings."""

from __future__ import annotations

import math
from dataclasses import dataclass

from sensors.base import MotionReading


@dataclass(frozen=True)
class ProcessedMotion:
    roll: float
    pitch: float
    accel_magnitude: float


class MotionProcessor:
    """Evaluate a raw IMU reading to derive roll, pitch, and acceleration magnitude."""

    def process(self, reading: MotionReading) -> ProcessedMotion:
        roll = math.degrees(
            math.atan2(
                reading.accel_y,
                math.sqrt(reading.accel_x**2 + reading.accel_z**2),
            ),
        )
        pitch = math.degrees(
            math.atan2(
                reading.accel_x,
                math.sqrt(reading.accel_y**2 + reading.accel_z**2),
            ),
        )
        magnitude = math.sqrt(
            reading.accel_x**2 + reading.accel_y**2 + reading.accel_z**2,
        )
        return ProcessedMotion(
            roll=round(roll, 2),
            pitch=round(pitch, 2),
            accel_magnitude=round(magnitude, 2),
        )
