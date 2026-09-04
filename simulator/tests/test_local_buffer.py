from pathlib import Path

from buffering.local_buffer import LocalBuffer


def sample(timestamp: str) -> dict[str, object]:
    return {"timestamp": timestamp, "gap": False}


def test_failed_publish_is_persisted_and_replayed_in_order(tmp_path: Path) -> None:
    buffer_path = tmp_path / "buffer.jsonl"
    local_buffer = LocalBuffer(buffer_path)
    local_buffer.enqueue(sample("2026-08-31T10:15:24.000Z"))
    local_buffer.enqueue(sample("2026-08-31T10:15:23.000Z"))

    assert local_buffer.flush(lambda _sample: False) == 0
    assert buffer_path.exists()
    assert local_buffer.pending_count == 2

    published: list[dict[str, object]] = []
    flushed = local_buffer.flush(lambda queued: published.append(queued) is None)

    assert flushed == 2
    assert [entry["timestamp"] for entry in published] == [
        "2026-08-31T10:15:23.000Z",
        "2026-08-31T10:15:24.000Z",
    ]
    assert all(entry["gap"] is True for entry in published)
    assert not buffer_path.exists()


def test_initial_connection_replay_does_not_invent_a_gap(tmp_path: Path) -> None:
    local_buffer = LocalBuffer(tmp_path / "buffer.jsonl")
    local_buffer.enqueue(sample("2026-08-31T10:15:23.000Z"))
    published: list[dict[str, object]] = []

    local_buffer.flush(lambda queued: published.append(queued) is None, mark_gap=False)

    assert published[0]["gap"] is False
