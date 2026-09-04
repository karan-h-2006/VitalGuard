"""Physiologically plausible, stateful sensor simulation for local development."""

from __future__ import annotations

import math
import random

from .base import MotionReading, SensorSource

GRAVITY_METERS_PER_SECOND_SQUARED = 9.81


class SimulatedSensorSource(SensorSource):
    """Generate smooth readings with optional deterministic demo disruptions."""

    def __init__(
        self,
        *,
        inject_noise: bool = False,
        trigger_fall: bool = False,
        deterioration_samples: int = 0,
        seed: int | None = None,
    ) -> None:
        self._random = random.Random(seed)
        self._inject_noise = inject_noise
        self._fall_pending = trigger_fall
        self._deterioration_samples = deterioration_samples
        self._deterioration_step = 0
        self._heart_rate = 72.0
        self._spo2 = 98.0
        self._temperature = 36.8
        self._roll = 0.0
        self._pitch = 0.0

    def trigger_fall(self) -> None:
        """Schedule a one-shot motion event for demos or an operator command."""
        self._fall_pending = True

    def read_heart_rate(self) -> float:
        self._advance_deterioration()
        self._heart_rate = self._walk(self._heart_rate, 60.0, 100.0, 1.2)
        if self._is_deteriorating:
            self._heart_rate = self._deteriorating_value(72.0, 132.0)
        return self._maybe_inject_noise(self._heart_rate, "heart_rate")

    def read_spo2(self) -> float:
        self._spo2 = self._walk(self._spo2, 95.0, 100.0, 0.18)
        if self._is_deteriorating:
            self._spo2 = self._deteriorating_value(98.0, 88.0)
        return self._maybe_inject_noise(self._spo2, "spo2")

    def read_temperature(self) -> float:
        self._temperature = self._walk(self._temperature, 36.1, 37.5, 0.05)
        if self._is_deteriorating:
            self._temperature = self._deteriorating_value(36.8, 39.0)
        return round(self._temperature, 2)

    def read_motion(self) -> MotionReading:
        if self._fall_pending:
            self._fall_pending = False
            # This represents the impact phase: a high magnitude and a large
            # orientation change satisfy the retained MPU6050 heuristic.
            return MotionReading(8.0, 7.0, 5.0, 180.0, 160.0, 15.0)

        self._roll = self._walk(self._roll, -8.0, 8.0, 0.45)
        self._pitch = self._walk(self._pitch, -8.0, 8.0, 0.45)
        roll_radians = math.radians(self._roll)
        pitch_radians = math.radians(self._pitch)
        accel_x = GRAVITY_METERS_PER_SECOND_SQUARED * math.sin(pitch_radians)
        accel_y = GRAVITY_METERS_PER_SECOND_SQUARED * math.sin(roll_radians)
        accel_z = math.sqrt(
            max(
                0.0,
                GRAVITY_METERS_PER_SECOND_SQUARED**2 - accel_x**2 - accel_y**2,
            ),
        )
        return MotionReading(
            accel_x,
            accel_y,
            accel_z,
            self._random.uniform(-2.0, 2.0),
            self._random.uniform(-2.0, 2.0),
            self._random.uniform(-2.0, 2.0),
        )

    @property
    def _is_deteriorating(self) -> bool:
        return self._deterioration_samples > 0 and self._deterioration_step > 0

    def _advance_deterioration(self) -> None:
        if self._deterioration_step < self._deterioration_samples:
            self._deterioration_step += 1

    def _deteriorating_value(self, baseline: float, target: float) -> float:
        progress = self._deterioration_step / self._deterioration_samples
        return baseline + ((target - baseline) * progress)

    def _walk(self, current: float, minimum: float, maximum: float, step: float) -> float:
        return min(maximum, max(minimum, current + self._random.uniform(-step, step)))

    def _maybe_inject_noise(self, value: float, vital_name: str) -> float:
        if not self._inject_noise or self._random.random() > 0.08:
            return round(value, 2)

        if self._random.random() < 0.5:
            return round(value + self._random.choice((-1.0, 1.0)) * 22.0, 2)

        if vital_name == "heart_rate":
            return self._random.choice((28.0, 235.0))
        return self._random.choice((62.0, 103.0))
