"""Stable boundary between edge publishing and sensor hardware."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass(frozen=True)
class MotionReading:
    """Raw IMU values in SI units; orientation is derived by processing."""

    accel_x: float
    accel_y: float
    accel_z: float
    gyro_x: float
    gyro_y: float
    gyro_z: float


class SensorSource(ABC):
    """Minimal interface a simulated or physical VitalGuard device provides."""

    @abstractmethod
    def read_heart_rate(self) -> float:
        """Return the current raw heart-rate estimate in beats per minute."""

    @abstractmethod
    def read_spo2(self) -> float:
        """Return the current raw oxygen-saturation estimate as a percentage."""

    @abstractmethod
    def read_temperature(self) -> float:
        """Return the current skin-temperature estimate in degrees Celsius."""

    @abstractmethod
    def read_motion(self) -> MotionReading:
        """Return the latest accelerometer and gyroscope axes."""


class RealSensorSource(SensorSource):
    """Future hardware seam; intentionally not implemented in Module 1.

    A real source must initialize the selected PPG/SpO2, skin-temperature,
    and IMU drivers; convert their readings into the units above; surface
    hardware failures as explicit exceptions; and avoid blocking longer than
    the publisher cadence. It must not change the publisher or contract.
    """

    def _not_implemented(self) -> None:
        raise NotImplementedError("RealSensorSource is planned for hardware integration")

    def read_heart_rate(self) -> float:
        self._not_implemented()

    def read_spo2(self) -> float:
        self._not_implemented()

    def read_temperature(self) -> float:
        self._not_implemented()

    def read_motion(self) -> MotionReading:
        self._not_implemented()
