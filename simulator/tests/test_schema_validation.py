from pathlib import Path

from publisher import MqttVitalPublisher, PublisherSettings
from sensors import SimulatedSensorSource


def test_publisher_builds_a_schema_valid_sample(tmp_path: Path) -> None:
    settings = PublisherSettings(
        device_id="device-test-001",
        patient_id="patient-test-001",
        mqtt_host="localhost",
        mqtt_port=1883,
        mqtt_username=None,
        mqtt_password=None,
        mqtt_use_tls=False,
        buffer_file=tmp_path / "buffer.jsonl",
        filter_window_size=5,
        inject_noise=False,
        trigger_fall=False,
        deterioration_samples=0,
        vitals_interval_seconds=5.0,
        temperature_interval_seconds=30.0,
        heart_rate_minimum=40.0,
        heart_rate_maximum=220.0,
        heart_rate_noisy_deviation=12.0,
        spo2_minimum=70.0,
        spo2_maximum=100.0,
        spo2_noisy_deviation=2.0,
        fall_acceleration_high_threshold=11.0,
        fall_acceleration_low_threshold=10.0,
        fall_pitch_threshold=30.0,
        fall_roll_threshold=30.0,
    )
    publisher = MqttVitalPublisher(settings, SimulatedSensorSource(seed=11))

    sample = publisher.build_sample()

    assert list(publisher._validator.iter_errors(sample)) == []  # noqa: SLF001
