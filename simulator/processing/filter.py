"""Small, deterministic smoothing and quality classification for PPG estimates."""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from typing import Literal

SignalQuality = Literal["clean", "noisy", "implausible"]


@dataclass(frozen=True)
class FilteredVital:
    """A smoothed value and the quality classification of its raw input."""

    value: float
    quality: SignalQuality


class VitalNoiseFilter:
    """Maintain independent rolling windows so one vital cannot affect another."""

    def __init__(
        self,
        window_size: int = 5,
        *,
        heart_rate_bounds: tuple[float, float] = (40.0, 220.0),
        heart_rate_noisy_deviation: float = 12.0,
        spo2_bounds: tuple[float, float] = (70.0, 100.0),
        spo2_noisy_deviation: float = 2.0,
    ) -> None:
        if window_size < 1:
            raise ValueError("window_size must be at least one")
        if heart_rate_bounds[0] >= heart_rate_bounds[1]:
            raise ValueError("heart_rate_bounds must have a lower value than upper value")
        if spo2_bounds[0] >= spo2_bounds[1]:
            raise ValueError("spo2_bounds must have a lower value than upper value")
        self._heart_rates: deque[float] = deque(maxlen=window_size)
        self._spo2_values: deque[float] = deque(maxlen=window_size)
        self._heart_rate_bounds = heart_rate_bounds
        self._heart_rate_noisy_deviation = heart_rate_noisy_deviation
        self._spo2_bounds = spo2_bounds
        self._spo2_noisy_deviation = spo2_noisy_deviation

    def process_heart_rate(self, raw_value: float) -> FilteredVital:
        return self._process(
            raw_value,
            self._heart_rates,
            plausible_bounds=self._heart_rate_bounds,
            noisy_deviation=self._heart_rate_noisy_deviation,
        )

    def process_spo2(self, raw_value: float) -> FilteredVital:
        return self._process(
            raw_value,
            self._spo2_values,
            plausible_bounds=self._spo2_bounds,
            noisy_deviation=self._spo2_noisy_deviation,
        )

    @staticmethod
    def _process(
        raw_value: float,
        history: deque[float],
        *,
        plausible_bounds: tuple[float, float],
        noisy_deviation: float,
    ) -> FilteredVital:
        lower_bound, upper_bound = plausible_bounds
        previous_average = sum(history) / len(history) if history else raw_value
        history.append(raw_value)
        smoothed_value = round(sum(history) / len(history), 2)

        if raw_value < lower_bound or raw_value > upper_bound:
            quality: SignalQuality = "implausible"
        elif abs(raw_value - previous_average) > noisy_deviation:
            quality = "noisy"
        else:
            quality = "clean"

        return FilteredVital(value=smoothed_value, quality=quality)
