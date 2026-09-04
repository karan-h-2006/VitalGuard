"""Publish complete, schema-validated VitalGuard samples to MQTT at QoS 1."""

from __future__ import annotations

import json
import logging
import os
import signal
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
from jsonschema import Draft202012Validator, FormatChecker

from buffering import LocalBuffer
from processing import FallDetector, VitalNoiseFilter
from sensors import SensorSource, SimulatedSensorSource

LOGGER = logging.getLogger(__name__)
SIMULATED_MOTION_HZ = 10.0


def _environment_bool(name: str, default: bool) -> bool:
    value = os.getenv(name, str(default)).strip().lower()
    if value in {"1", "true", "yes", "on"}:
        return True
    if value in {"0", "false", "no", "off"}:
        return False
    raise ValueError(f"{name} must be a boolean, received {value!r}")


@dataclass(frozen=True)
class PublisherSettings:
    device_id: str
    patient_id: str
    mqtt_host: str
    mqtt_port: int
    mqtt_username: str | None
    mqtt_password: str | None
    mqtt_use_tls: bool
    buffer_file: Path
    filter_window_size: int
    inject_noise: bool
    trigger_fall: bool
    deterioration_samples: int
    vitals_interval_seconds: float
    temperature_interval_seconds: float
    heart_rate_minimum: float
    heart_rate_maximum: float
    heart_rate_noisy_deviation: float
    spo2_minimum: float
    spo2_maximum: float
    spo2_noisy_deviation: float
    fall_acceleration_high_threshold: float
    fall_acceleration_low_threshold: float
    fall_pitch_threshold: float
    fall_roll_threshold: float

    @classmethod
    def from_environment(cls) -> "PublisherSettings":
        settings = cls(
            device_id=os.getenv("VITALGUARD_DEVICE_ID", "device-demo-001"),
            patient_id=os.getenv("VITALGUARD_PATIENT_ID", "patient-demo-001"),
            mqtt_host=os.getenv("MQTT_HOST", "localhost"),
            mqtt_port=int(os.getenv("MQTT_PORT", "1883")),
            mqtt_username=os.getenv("MQTT_USERNAME") or None,
            mqtt_password=os.getenv("MQTT_PASSWORD") or None,
            mqtt_use_tls=_environment_bool("MQTT_USE_TLS", False),
            buffer_file=Path(os.getenv("VITALGUARD_BUFFER_FILE", "buffer.jsonl")),
            filter_window_size=int(os.getenv("VITAL_FILTER_WINDOW_SIZE", "5")),
            inject_noise=_environment_bool("VITALGUARD_INJECT_NOISE", False),
            trigger_fall=_environment_bool("VITALGUARD_TRIGGER_FALL", False),
            deterioration_samples=int(os.getenv("VITALGUARD_DETERIORATION_SAMPLES", "0")),
            vitals_interval_seconds=float(os.getenv("VITALS_INTERVAL_SECONDS", "5")),
            temperature_interval_seconds=float(
                os.getenv("TEMPERATURE_INTERVAL_SECONDS", "30"),
            ),
            heart_rate_minimum=float(os.getenv("HEART_RATE_PLAUSIBLE_MIN", "40")),
            heart_rate_maximum=float(os.getenv("HEART_RATE_PLAUSIBLE_MAX", "220")),
            heart_rate_noisy_deviation=float(
                os.getenv("HEART_RATE_NOISY_DEVIATION", "12"),
            ),
            spo2_minimum=float(os.getenv("SPO2_PLAUSIBLE_MIN", "70")),
            spo2_maximum=float(os.getenv("SPO2_PLAUSIBLE_MAX", "100")),
            spo2_noisy_deviation=float(os.getenv("SPO2_NOISY_DEVIATION", "2")),
            fall_acceleration_high_threshold=float(
                os.getenv("FALL_ACCELERATION_HIGH_THRESHOLD", "11"),
            ),
            fall_acceleration_low_threshold=float(
                os.getenv("FALL_ACCELERATION_LOW_THRESHOLD", "10"),
            ),
            fall_pitch_threshold=float(os.getenv("FALL_PITCH_THRESHOLD", "30")),
            fall_roll_threshold=float(os.getenv("FALL_ROLL_THRESHOLD", "30")),
        )
        if not settings.device_id or not settings.patient_id:
            raise ValueError("VITALGUARD_DEVICE_ID and VITALGUARD_PATIENT_ID are required")
        if settings.mqtt_port < 1 or settings.filter_window_size < 1:
            raise ValueError("MQTT_PORT and VITAL_FILTER_WINDOW_SIZE must be positive")
        if settings.vitals_interval_seconds <= 0 or settings.temperature_interval_seconds <= 0:
            raise ValueError("Sample intervals must be greater than zero")
        if settings.deterioration_samples < 0:
            raise ValueError("VITALGUARD_DETERIORATION_SAMPLES cannot be negative")
        if settings.heart_rate_minimum >= settings.heart_rate_maximum:
            raise ValueError("Heart-rate plausible bounds are invalid")
        if settings.spo2_minimum >= settings.spo2_maximum:
            raise ValueError("SpO2 plausible bounds are invalid")
        if settings.fall_acceleration_low_threshold >= settings.fall_acceleration_high_threshold:
            raise ValueError("Fall acceleration thresholds are invalid")
        return settings


class MqttVitalPublisher:
    """Own the edge sampling loop, MQTT lifecycle, validation, and local buffering."""

    def __init__(
        self,
        settings: PublisherSettings,
        source: SensorSource | None = None,
    ) -> None:
        self._settings = settings
        self._source = source or SimulatedSensorSource(
            inject_noise=settings.inject_noise,
            trigger_fall=settings.trigger_fall,
            deterioration_samples=settings.deterioration_samples,
        )
        self._filter = VitalNoiseFilter(
            settings.filter_window_size,
            heart_rate_bounds=(settings.heart_rate_minimum, settings.heart_rate_maximum),
            heart_rate_noisy_deviation=settings.heart_rate_noisy_deviation,
            spo2_bounds=(settings.spo2_minimum, settings.spo2_maximum),
            spo2_noisy_deviation=settings.spo2_noisy_deviation,
        )
        self._fall_detector = FallDetector(
            acceleration_threshold=settings.fall_acceleration_high_threshold,
            low_acceleration_threshold=settings.fall_acceleration_low_threshold,
            pitch_threshold=settings.fall_pitch_threshold,
            roll_threshold=settings.fall_roll_threshold,
        )
        self._buffer = LocalBuffer(settings.buffer_file)
        self._validator = self._load_validator()
        self._client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"vitalguard-{settings.device_id}",
        )
        self._connected = False
        self._has_connected_once = False
        self._reconnect_requires_gap = False
        self._running = True
        self._latest_temperature = self._source.read_temperature()
        self._latest_motion = self._source.read_motion()

        self._client.on_connect = self._on_connect
        self._client.on_disconnect = self._on_disconnect
        if settings.mqtt_username is not None:
            self._client.username_pw_set(settings.mqtt_username, settings.mqtt_password)
        if settings.mqtt_use_tls:
            self._client.tls_set()

    @property
    def topic(self) -> str:
        return f"HMS/{self._settings.device_id}/vitals"

    def run_forever(self) -> None:
        """Sample motion at 10 Hz and publish a complete reading every five seconds.

        Real hardware targets 50 Hz IMU reads. The simulated 10 Hz loop keeps
        development output readable while preserving the independent cadence.
        """
        self._client.reconnect_delay_set(min_delay=1, max_delay=30)
        self._client.connect_async(self._settings.mqtt_host, self._settings.mqtt_port, 60)
        self._client.loop_start()
        self._install_shutdown_handlers()

        next_motion_at = time.monotonic()
        next_vitals_at = next_motion_at
        next_temperature_at = next_motion_at
        motion_interval = 1.0 / SIMULATED_MOTION_HZ
        try:
            while self._running:
                now = time.monotonic()
                if now >= next_motion_at:
                    self._latest_motion = self._source.read_motion()
                    next_motion_at = now + motion_interval
                if now >= next_temperature_at:
                    self._latest_temperature = self._source.read_temperature()
                    next_temperature_at = now + self._settings.temperature_interval_seconds
                if now >= next_vitals_at:
                    self._publish_current_sample()
                    next_vitals_at = now + self._settings.vitals_interval_seconds
                time.sleep(0.01)
        finally:
            self._client.loop_stop()
            self._client.disconnect()

    def _publish_current_sample(self) -> None:
        sample = self.build_sample()
        errors = list(self._validator.iter_errors(sample))
        if errors:
            LOGGER.error(
                "Refusing to publish a schema-invalid vital sample: %s",
                "; ".join(error.message for error in errors),
            )
            return

        if self._buffer.pending_count and self._connected:
            flushed = self._buffer.flush(
                self._publish_one,
                mark_gap=self._reconnect_requires_gap,
            )
            if flushed:
                LOGGER.info("Flushed %s buffered vital sample(s)", flushed)
                self._reconnect_requires_gap = False

        if self._buffer.pending_count or not self._connected:
            self._buffer.enqueue(sample)
            LOGGER.warning("Buffered vital sample because MQTT is unavailable")
            return

        if not self._publish_one(sample):
            self._buffer.enqueue(sample)
            LOGGER.warning("Buffered vital sample after MQTT publish failure")

    def build_sample(self) -> dict[str, Any]:
        """Assemble the only edge payload shape that is allowed onto MQTT."""
        heart_rate = self._filter.process_heart_rate(self._source.read_heart_rate())
        spo2 = self._filter.process_spo2(self._source.read_spo2())
        motion = self._fall_detector.process(self._latest_motion)
        timestamp = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace(
            "+00:00",
            "Z",
        )
        return {
            "device_id": self._settings.device_id,
            "patient_id": self._settings.patient_id,
            "timestamp": timestamp,
            "heart_rate": {
                "value": heart_rate.value,
                "unit": "bpm",
                "quality": heart_rate.quality,
            },
            "spo2": {"value": spo2.value, "unit": "percent", "quality": spo2.quality},
            "temperature": {"value": self._latest_temperature, "unit": "celsius"},
            "motion": {
                "roll": motion.roll,
                "pitch": motion.pitch,
                "accel_magnitude": motion.accel_magnitude,
                "fall_detected": motion.fall_detected,
            },
            "gap": False,
        }

    def _publish_one(self, sample: dict[str, Any]) -> bool:
        if not self._connected:
            return False
        result = self._client.publish(self.topic, json.dumps(sample), qos=1)
        if result.rc != mqtt.MQTT_ERR_SUCCESS:
            LOGGER.warning("MQTT rejected publish with code %s", result.rc)
            return False
        result.wait_for_publish(timeout=5)
        return result.is_published()

    def _on_connect(
        self,
        _client: mqtt.Client,
        _userdata: object,
        _connect_flags: mqtt.ConnectFlags,
        reason_code: mqtt.ReasonCode,
        _properties: mqtt.Properties | None,
    ) -> None:
        self._connected = reason_code == 0
        if self._connected:
            if self._has_connected_once:
                self._reconnect_requires_gap = True
            self._has_connected_once = True
            LOGGER.info("Connected to MQTT broker; publishing to %s", self.topic)
        else:
            LOGGER.error("MQTT connection refused: %s", reason_code)

    def _on_disconnect(
        self,
        _client: mqtt.Client,
        _userdata: object,
        _disconnect_flags: mqtt.DisconnectFlags,
        reason_code: mqtt.ReasonCode,
        _properties: mqtt.Properties | None,
    ) -> None:
        self._connected = False
        if self._running:
            if self._has_connected_once:
                self._reconnect_requires_gap = True
            LOGGER.warning("Disconnected from MQTT broker: %s", reason_code)

    @staticmethod
    def _load_validator() -> Draft202012Validator:
        schema_path = Path(__file__).resolve().parent.parent / "schemas" / "vital-sample.schema.json"
        with schema_path.open(encoding="utf-8") as schema_file:
            schema = json.load(schema_file)
        return Draft202012Validator(schema, format_checker=FormatChecker())

    def _install_shutdown_handlers(self) -> None:
        def stop(_signal_number: int, _frame: object) -> None:
            LOGGER.info("Stopping vital simulator")
            self._running = False

        signal.signal(signal.SIGINT, stop)
        signal.signal(signal.SIGTERM, stop)


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    try:
        publisher = MqttVitalPublisher(PublisherSettings.from_environment())
        publisher.run_forever()
    except (OSError, ValueError) as error:
        LOGGER.error("Vital simulator could not start: %s", error)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
