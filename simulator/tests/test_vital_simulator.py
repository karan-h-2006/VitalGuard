from datetime import datetime

from vital_simulator import create_reading


def test_create_reading_has_expected_phase_zero_shape() -> None:
    reading = create_reading()

    assert reading["deviceId"] == "device-demo-001"
    assert reading["patientId"] == "patient-demo-001"
    assert isinstance(reading["timestamp"], str)
    datetime.fromisoformat(reading["timestamp"])

    vitals = reading["vitals"]
    assert isinstance(vitals, dict)
    assert set(vitals) == {"heartRate", "spo2", "bodyTemperature", "motion"}
