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
        deterioration_samples: int = 0,
        seed: int | None = None,
        base_heart_rate: float = 72.0,
        base_spo2: float = 98.0,
        base_temperature: float = 36.8,
        scenario: str = "normal",
    ) -> None:
        self._random = random.Random(seed)
        self._base_heart_rate = base_heart_rate
        self._base_spo2 = base_spo2
        self._base_temperature = base_temperature
        self._scenario = scenario
        self._heart_rate = base_heart_rate
        self._spo2 = base_spo2
        self._temperature = base_temperature
        self._roll = 0.0
        self._pitch = 0.0

        if scenario == "deteriorating":
            self._inject_noise = False
            self._deterioration_samples = deterioration_samples or 12
            self._deterioration_step = 1
        elif scenario == "noisy":
            self._inject_noise = True
            self._deterioration_samples = 0
            self._deterioration_step = 0
        else:
            self._inject_noise = inject_noise
            self._deterioration_samples = deterioration_samples
            self._deterioration_step = 0

    @property
    def scenario(self) -> str:
        return self._scenario

    def set_scenario(self, scenario: str, deterioration_samples: int = 12) -> None:
        """Dynamically transition between simulation scenarios."""
        previous = self._scenario
        self._scenario = scenario
        if scenario == "deteriorating":
            self._inject_noise = False
            if previous != "deteriorating":
                self._deterioration_samples = deterioration_samples
                self._deterioration_step = 1
        elif scenario == "noisy":
            self._inject_noise = True
            self._deterioration_samples = 0
            self._deterioration_step = 0
            if previous == "deteriorating":
                self._heart_rate = self._base_heart_rate
                self._spo2 = self._base_spo2
                self._temperature = self._base_temperature
        else:
            self._inject_noise = False
            self._deterioration_samples = 0
            self._deterioration_step = 0
            if previous == "deteriorating":
                self._heart_rate = self._base_heart_rate
                self._spo2 = self._base_spo2
                self._temperature = self._base_temperature

    def read_heart_rate(self) -> float:
        self._advance_deterioration()
        self._heart_rate = self._walk(self._heart_rate, 55.0, 105.0, 1.2)
        if self._is_deteriorating:
            self._heart_rate = self._deteriorating_value(self._base_heart_rate, 135.0)
        return self._maybe_inject_noise(self._heart_rate, "heart_rate")

    def read_spo2(self) -> float:
        self._spo2 = self._walk(self._spo2, 94.0, 100.0, 0.18)
        if self._is_deteriorating:
            self._spo2 = self._deteriorating_value(self._base_spo2, 86.0)
        return self._maybe_inject_noise(self._spo2, "spo2")

    def read_temperature(self) -> float:
        self._temperature = self._walk(self._temperature, 36.0, 37.5, 0.05)
        if self._is_deteriorating:
            self._temperature = self._deteriorating_value(self._base_temperature, 39.2)
        return round(self._temperature, 2)

    def read_motion(self) -> MotionReading:
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

    def _walk(
        self, current: float, minimum: float, maximum: float, step: float
    ) -> float:
        return min(maximum, max(minimum, current + self._random.uniform(-step, step)))

    def _maybe_inject_noise(self, value: float, vital_name: str) -> float:
        if not self._inject_noise or self._random.random() > 0.08:
            return round(value, 2)

        if self._random.random() < 0.5:
            return round(value + self._random.choice((-1.0, 1.0)) * 22.0, 2)

        if vital_name == "heart_rate":
            return self._random.choice((28.0, 235.0))
        return self._random.choice((62.0, 103.0))
