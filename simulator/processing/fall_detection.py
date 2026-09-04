"""Fall detection adapted from the audited MPU6050 publisher's heuristic."""

from __future__ import annotations

import math
from dataclasses import dataclass

from sensors.base import MotionReading


@dataclass(frozen=True)
class ProcessedMotion:
    roll: float
    pitch: float
    accel_magnitude: float
    fall_detected: bool


class FallDetector:
    """Evaluate a raw IMU reading with the reference project's retained math.

    The original heuristic combines a magnitude excursion (>= 11 or < 10
    m/s²) with a pitch/roll excursion (> 30°). It is intentionally not a
    clinical diagnosis; later analytics may corroborate it before escalation.
    """

    def __init__(
        self,
        acceleration_threshold: float = 11.0,
        low_acceleration_threshold: float = 10.0,
        pitch_threshold: float = 30.0,
        roll_threshold: float = 30.0,
    ) -> None:
        self._acceleration_threshold = acceleration_threshold
        self._low_acceleration_threshold = low_acceleration_threshold
        self._pitch_threshold = pitch_threshold
        self._roll_threshold = roll_threshold

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
        magnitude_excursion = (
            magnitude >= self._acceleration_threshold
            or magnitude < self._low_acceleration_threshold
        )
        orientation_excursion = (
            abs(pitch) > self._pitch_threshold or abs(roll) > self._roll_threshold
        )
        return ProcessedMotion(
            roll=round(roll, 2),
            pitch=round(pitch, 2),
            accel_magnitude=round(magnitude, 2),
            fall_detected=magnitude_excursion and orientation_excursion,
        )
