"""Unit tests — LocalBuffer persistence, ordering, gap marking, and restart survival."""
from pathlib import Path
import json

from buffering.local_buffer import LocalBuffer


def _sample(ts: str) -> dict:
    return {"timestamp": ts, "gap": False, "device_id": "dev-1", "patient_id": "p-1"}


def test_enqueue_on_failed_publish_increments_pending(tmp_path: Path) -> None:
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    assert buf.pending_count == 1
    assert buf_path.exists()


def test_flush_failure_returns_zero_and_does_not_clear(tmp_path: Path) -> None:
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    result = buf.flush(lambda _s: False)  # publish always fails
    assert result == 0
    assert buf.pending_count == 1
    assert buf_path.exists()


def test_flush_returns_chronological_order(tmp_path: Path) -> None:
    """Out-of-order enqueue must be replayed oldest-first."""
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:05.000Z"))
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    buf.enqueue(_sample("2026-01-01T00:00:03.000Z"))
    published: list[dict] = []
    flushed = buf.flush(lambda s: published.append(s) is None)
    assert flushed == 3
    timestamps = [e["timestamp"] for e in published]
    assert timestamps == sorted(timestamps)


def test_flushed_entries_carry_gap_true(tmp_path: Path) -> None:
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    published: list[dict] = []
    buf.flush(lambda s: published.append(s) is None, mark_gap=True)
    assert all(e["gap"] is True for e in published)


def test_flush_with_mark_gap_false_preserves_original_gap(tmp_path: Path) -> None:
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))  # gap=False
    published: list[dict] = []
    buf.flush(lambda s: published.append(s) is None, mark_gap=False)
    assert all(e["gap"] is False for e in published)


def test_buffer_survives_process_restart(tmp_path: Path) -> None:
    """Persisted file re-loaded by a fresh LocalBuffer instance."""
    buf_path = tmp_path / "buf.jsonl"
    # First 'process': enqueue two samples
    buf1 = LocalBuffer(buf_path)
    buf1.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    buf1.enqueue(_sample("2026-01-01T00:00:02.000Z"))
    assert buf_path.exists()
    # Second 'process': new instance, same path
    buf2 = LocalBuffer(buf_path)
    assert buf2.pending_count == 2
    published: list[dict] = []
    flushed = buf2.flush(lambda s: published.append(s) is None)
    assert flushed == 2
    assert not buf_path.exists()


def test_flush_clears_file_on_success(tmp_path: Path) -> None:
    buf_path = tmp_path / "buf.jsonl"
    buf = LocalBuffer(buf_path)
    buf.enqueue(_sample("2026-01-01T00:00:01.000Z"))
    buf.flush(lambda _s: True)
    assert not buf_path.exists()
    assert buf.pending_count == 0
