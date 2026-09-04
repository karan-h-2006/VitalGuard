"""Append-only, in-memory-backed local buffering for interrupted MQTT delivery."""

from __future__ import annotations

import json
import os
from collections.abc import Callable
from copy import deepcopy
from pathlib import Path
from typing import Any

VitalSamplePayload = dict[str, Any]
PublishFunction = Callable[[VitalSamplePayload], bool]


class LocalBuffer:
    """Persist unsent readings and replay them in chronological order.

    We deliberately retain the complete batch after a partial replay failure.
    MQTT QoS 1 is at-least-once, so duplication is safer than silently losing a
    potentially critical reading. Module 2 must make the consumer idempotent.
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._pending = self._load()

    @property
    def pending_count(self) -> int:
        return len(self._pending)

    def enqueue(self, sample: VitalSamplePayload) -> None:
        self._pending.append(deepcopy(sample))
        self._path.parent.mkdir(parents=True, exist_ok=True)
        with self._path.open("a", encoding="utf-8") as buffer_file:
            buffer_file.write(json.dumps(sample, separators=(",", ":")) + "\n")
            buffer_file.flush()
            os.fsync(buffer_file.fileno())

    def flush(self, publish: PublishFunction, *, mark_gap: bool = True) -> int:
        """Replay all pending samples, clearing only after every publish succeeds.

        `mark_gap` is false for samples accumulated during initial startup. It
        is true only after a real connection interruption, matching the edge
        contract's meaning of a discontinuity.
        """
        ordered_samples = sorted(self._pending, key=lambda sample: sample["timestamp"])
        for sample in ordered_samples:
            replay_sample = deepcopy(sample)
            replay_sample["gap"] = mark_gap
            if not publish(replay_sample):
                return 0

        if ordered_samples:
            self._pending.clear()
            self._path.unlink(missing_ok=True)
        return len(ordered_samples)

    def _load(self) -> list[VitalSamplePayload]:
        if not self._path.exists():
            return []

        samples: list[VitalSamplePayload] = []
        with self._path.open(encoding="utf-8") as buffer_file:
            for line_number, line in enumerate(buffer_file, start=1):
                if not line.strip():
                    continue
                try:
                    sample = json.loads(line)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"Invalid JSON in local buffer at line {line_number}",
                    ) from error
                if not isinstance(sample, dict):
                    raise ValueError(
                        f"Expected object in local buffer at line {line_number}",
                    )
                samples.append(sample)
        return samples
