"""Unit tests — exhaustive negative schema validation for the vital-sample contract."""
import json
from pathlib import Path
from jsonschema import Draft202012Validator, FormatChecker

SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent / "schemas" / "vital-sample.schema.json"
)


def _load_validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=FormatChecker())


VALIDATOR = _load_validator()


def _valid_sample() -> dict:
    return {
        "device_id": "dev-001",
        "patient_id": "pat-001",
        "timestamp": "2026-01-01T00:00:00.000Z",
        "heart_rate": {"value": 72.0, "unit": "bpm", "quality": "clean"},
        "spo2": {"value": 98.0, "unit": "percent", "quality": "clean"},
        "temperature": {"value": 36.8, "unit": "celsius"},
        "motion": {"roll": 0.0, "pitch": 0.0, "accel_magnitude": 9.81, "fall_detected": False},
        "gap": False,
    }


def _errors(sample: dict) -> list:
    return list(VALIDATOR.iter_errors(sample))


def test_valid_sample_has_no_errors() -> None:
    assert _errors(_valid_sample()) == []


def test_missing_device_id() -> None:
    s = _valid_sample()
    del s["device_id"]
    assert _errors(s)


def test_missing_patient_id() -> None:
    s = _valid_sample()
    del s["patient_id"]
    assert _errors(s)


def test_missing_timestamp() -> None:
    s = _valid_sample()
    del s["timestamp"]
    assert _errors(s)


def test_timestamp_wrong_format_no_z() -> None:
    s = _valid_sample()
    s["timestamp"] = "2026-01-01T00:00:00.000+05:30"  # no trailing Z
    assert _errors(s)


def test_timestamp_not_datetime() -> None:
    s = _valid_sample()
    s["timestamp"] = "not-a-date"
    assert _errors(s)


def test_missing_heart_rate() -> None:
    s = _valid_sample()
    del s["heart_rate"]
    assert _errors(s)


def test_heart_rate_value_wrong_type() -> None:
    s = _valid_sample()
    s["heart_rate"]["value"] = "72"  # string instead of number
    assert _errors(s)


def test_heart_rate_unit_wrong_value() -> None:
    s = _valid_sample()
    s["heart_rate"]["unit"] = "hz"  # not 'bpm'
    assert _errors(s)


def test_heart_rate_quality_invalid_enum() -> None:
    s = _valid_sample()
    s["heart_rate"]["quality"] = "excellent"  # not in enum
    assert _errors(s)


def test_missing_spo2() -> None:
    s = _valid_sample()
    del s["spo2"]
    assert _errors(s)


def test_spo2_unit_wrong_value() -> None:
    s = _valid_sample()
    s["spo2"]["unit"] = "%"  # not 'percent'
    assert _errors(s)


def test_missing_temperature() -> None:
    s = _valid_sample()
    del s["temperature"]
    assert _errors(s)


def test_temperature_unit_wrong_value() -> None:
    s = _valid_sample()
    s["temperature"]["unit"] = "fahrenheit"  # not 'celsius'
    assert _errors(s)


def test_missing_motion() -> None:
    s = _valid_sample()
    del s["motion"]
    assert _errors(s)


def test_motion_fall_detected_wrong_type() -> None:
    s = _valid_sample()
    s["motion"]["fall_detected"] = "true"  # string instead of boolean
    assert _errors(s)


def test_missing_gap() -> None:
    s = _valid_sample()
    del s["gap"]
    assert _errors(s)


def test_gap_wrong_type() -> None:
    s = _valid_sample()
    s["gap"] = 0  # int instead of boolean
    assert _errors(s)


def test_additional_property_rejected() -> None:
    s = _valid_sample()
    s["extra_field"] = "not-in-schema"
    assert _errors(s)
