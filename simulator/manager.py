"""Multi-patient simulated device manager with dynamic API discovery and MQTT publishing."""

from __future__ import annotations

import hashlib
import json
import logging
import os
import signal
import socket
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import paho.mqtt.client as mqtt
from jsonschema import Draft202012Validator, FormatChecker

from processing import MotionProcessor, VitalNoiseFilter
from sensors.simulated import SimulatedSensorSource

LOGGER = logging.getLogger(__name__)


def derive_patient_baseline(patient_id: str) -> tuple[float, float, float]:
    """Deterministically derive resting (heart_rate, spo2, temperature) from patient UUID."""
    digest = hashlib.sha256(patient_id.encode("utf-8")).digest()
    base_hr = round(68.0 + float(digest[0] % 15), 1)
    base_spo2 = round(96.0 + float(digest[1] % 4), 1)
    base_temp = round(36.5 + float(digest[2] % 7) * 0.1, 2)
    return base_hr, base_spo2, base_temp


class DeviceWorker:
    """Stateful vitals simulator for one patient device."""

    def __init__(
        self,
        device_id: str,
        patient_id: str,
        scenario: str = "normal",
        filter_window_size: int = 5,
    ) -> None:
        self.device_id = device_id
        self.patient_id = patient_id
        self.scenario = scenario
        base_hr, base_spo2, base_temp = derive_patient_baseline(patient_id)

        digest = hashlib.sha256(f"{device_id}:{patient_id}".encode("utf-8")).digest()
        seed = int.from_bytes(digest[:4], "big")

        self.source = SimulatedSensorSource(
            base_heart_rate=base_hr,
            base_spo2=base_spo2,
            base_temperature=base_temp,
            scenario=scenario,
            seed=seed,
        )
        self.filter = VitalNoiseFilter(filter_window_size)
        self.motion_processor = MotionProcessor()
        self.latest_temperature = self.source.read_temperature()
        self.latest_motion = self.source.read_motion()

    def update_scenario(self, scenario: str) -> None:
        if self.scenario != scenario:
            LOGGER.info(
                "Device %s updating scenario: %s -> %s",
                self.device_id,
                self.scenario,
                scenario,
            )
            self.scenario = scenario
            self.source.set_scenario(scenario)

    def step_motion(self) -> None:
        self.latest_motion = self.source.read_motion()

    def step_temperature(self) -> None:
        self.latest_temperature = self.source.read_temperature()

    def build_sample(self, timestamp: str | None = None) -> dict[str, Any]:
        heart_rate = self.filter.process_heart_rate(self.source.read_heart_rate())
        spo2 = self.filter.process_spo2(self.source.read_spo2())
        motion = self.motion_processor.process(self.latest_motion)

        if not timestamp:
            timestamp = (
                datetime.now(timezone.utc)
                .isoformat(timespec="milliseconds")
                .replace("+00:00", "Z")
            )

        return {
            "device_id": self.device_id,
            "patient_id": self.patient_id,
            "timestamp": timestamp,
            "heart_rate": {
                "value": heart_rate.value,
                "unit": "bpm",
                "quality": heart_rate.quality,
            },
            "spo2": {
                "value": spo2.value,
                "unit": "percent",
                "quality": spo2.quality,
            },
            "temperature": {
                "value": self.latest_temperature,
                "unit": "celsius",
            },
            "motion": {
                "roll": motion.roll,
                "pitch": motion.pitch,
                "accel_magnitude": motion.accel_magnitude,
            },
            "gap": False,
        }


def _check_redis_lease(
    redis_url: str | None, key: str, value: str, ttl_ms: int = 30000
) -> bool:
    """Acquire or extend a Redis lease using raw socket RESP protocol."""
    if not redis_url:
        return True
    try:
        parsed = urlparse(redis_url)
        host = parsed.hostname or "localhost"
        port = parsed.port or 6379
        with socket.create_connection((host, port), timeout=2.0) as s:
            if parsed.password:
                auth_cmd = f"*2\r\n$4\r\nAUTH\r\n${len(parsed.password)}\r\n{parsed.password}\r\n"
                s.sendall(auth_cmd.encode("utf-8"))
                s.recv(512)

            # SET key value NX PX ttl_ms (or renew if we already own it)
            cmd = (
                f"*5\r\n$3\r\nSET\r\n${len(key)}\r\n{key}\r\n"
                f"${len(value)}\r\n{value}\r\n$2\r\nPX\r\n"
                f"${len(str(ttl_ms))}\r\n{ttl_ms}\r\n"
            )
            s.sendall(cmd.encode("utf-8"))
            res = s.recv(512)
            return b"+OK" in res
    except Exception as err:
        LOGGER.debug("Redis lease skipped for %s: %s", key, err)
        return True


def _load_dotenv_files() -> None:
    """Best-effort loader for .env files without requiring external packages."""
    sim_dir = Path(__file__).resolve().parent
    candidates = [
        sim_dir / ".env",
        sim_dir.parent / "infra" / ".env",
        sim_dir.parent / ".env",
    ]
    for p in candidates:
        if p.is_file():
            try:
                for line in p.read_text(encoding="utf-8").splitlines():
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k and k not in os.environ:
                        os.environ[k] = v
            except Exception as err:
                LOGGER.debug("Could not read %s: %s", p, err)


@dataclass
class ManagerConfig:
    api_base_url: str
    service_token: str
    discovery_interval_seconds: float
    vitals_interval_seconds: float
    mqtt_host: str
    mqtt_port: int
    mqtt_username: str | None
    mqtt_password: str | None
    mqtt_use_tls: bool
    redis_url: str | None
    health_port: int
    max_devices: int = 50

    @classmethod
    def from_environment(cls) -> "ManagerConfig":
        _load_dotenv_files()

        api_base_url = (os.getenv("API_BASE_URL") or "").rstrip("/")
        if not api_base_url:
            raise ValueError(
                "API_BASE_URL environment variable is required (e.g. http://localhost:3000)"
            )

        service_token = os.getenv("SIMULATOR_SERVICE_TOKEN")
        if not service_token:
            raise ValueError(
                "SIMULATOR_SERVICE_TOKEN environment variable is required. "
                "Set it to match the API's SIMULATOR_SERVICE_TOKEN."
            )

        mqtt_host = os.getenv("MQTT_HOST") or os.getenv("MQTT_BROKER_HOST") or "localhost"
        mqtt_port = int(os.getenv("MQTT_PORT") or os.getenv("MQTT_BROKER_PORT") or "1883")
        redis_url = os.getenv("REDIS_URL") or (
            f"redis://{os.getenv('REDIS_HOST', 'localhost')}:{os.getenv('REDIS_PORT', '6379')}"
            if os.getenv("REDIS_HOST")
            else None
        )

        return cls(
            api_base_url=api_base_url,
            service_token=service_token,
            discovery_interval_seconds=float(
                os.getenv("SIM_DISCOVERY_INTERVAL_SECONDS", "10")
            ),
            vitals_interval_seconds=float(os.getenv("VITALS_INTERVAL_SECONDS", "5")),
            mqtt_host=mqtt_host,
            mqtt_port=mqtt_port,
            mqtt_username=os.getenv("MQTT_USERNAME") or None,
            mqtt_password=os.getenv("MQTT_PASSWORD") or None,
            mqtt_use_tls=os.getenv("MQTT_USE_TLS", "").lower() in {"1", "true", "yes"},
            redis_url=redis_url,
            health_port=int(os.getenv("SIMULATOR_HEALTH_PORT", "8080")),
            max_devices=int(os.getenv("SIM_MAX_DEVICES", "50")),
        )


class SimulatorManager:
    """Manages concurrent simulated devices with dynamic discovery and MQTT publishing."""

    def __init__(self, config: ManagerConfig) -> None:
        self.config = config
        self.manager_id = f"manager-{os.getpid()}-{int(time.time())}"
        self._devices: dict[str, DeviceWorker] = {}
        self._lock = threading.Lock()
        self._running = False
        self._validator = self._load_validator()

        self._mqtt_client = mqtt.Client(
            mqtt.CallbackAPIVersion.VERSION2,
            client_id=f"vitalguard-sim-manager-{os.getpid()}",
        )
        self._mqtt_connected = False
        self._mqtt_client.on_connect = self._on_mqtt_connect
        self._mqtt_client.on_disconnect = self._on_mqtt_disconnect
        if config.mqtt_username:
            self._mqtt_client.username_pw_set(
                config.mqtt_username, config.mqtt_password
            )
        if config.mqtt_use_tls:
            self._mqtt_client.tls_set()

        self._health_server: HTTPServer | None = None

    @property
    def active_devices_count(self) -> int:
        with self._lock:
            return len(self._devices)

    @property
    def device_ids(self) -> list[str]:
        with self._lock:
            return list(self._devices.keys())

    def _on_mqtt_connect(
        self,
        _client: mqtt.Client,
        _userdata: object,
        _flags: mqtt.ConnectFlags,
        reason_code: mqtt.ReasonCode,
        _properties: mqtt.Properties | None,
    ) -> None:
        self._mqtt_connected = reason_code == 0
        if self._mqtt_connected:
            LOGGER.info("Simulator manager connected to MQTT broker")
        else:
            LOGGER.error("Simulator manager MQTT connection refused: %s", reason_code)

    def _on_mqtt_disconnect(
        self,
        _client: mqtt.Client,
        _userdata: object,
        _flags: mqtt.DisconnectFlags,
        reason_code: mqtt.ReasonCode,
        _properties: mqtt.Properties | None,
    ) -> None:
        self._mqtt_connected = False
        if self._running:
            LOGGER.warning(
                "Simulator manager disconnected from MQTT broker: %s", reason_code
            )

    def poll_discovery(self) -> list[dict[str, Any]]:
        """Fetch registered simulated devices from the API internal discovery endpoint."""
        url = f"{self.config.api_base_url}/internal/simulated-devices"
        headers = {
            "Authorization": f"Bearer {self.config.service_token}",
            "Accept": "application/json",
        }
        req = urllib.request.Request(url, headers=headers, method="GET")
        try:
            with urllib.request.urlopen(req, timeout=5.0) as resp:
                if resp.status == 200:
                    data = json.loads(resp.read().decode("utf-8"))
                    if isinstance(data, list):
                        return data
        except (
            urllib.error.URLError,
            TimeoutError,
            json.JSONDecodeError,
            OSError,
        ) as err:
            LOGGER.warning("Discovery poll failed (%s): %s", url, err)
        return []

    def reconcile_devices(self, discovered: list[dict[str, Any]]) -> None:
        """Update active workers: add new, stop removed, and apply scenario updates."""
        discovered_by_id = {
            item["deviceId"]: item
            for item in discovered
            if "deviceId" in item and "patientId" in item
        }

        if len(discovered_by_id) > self.config.max_devices:
            LOGGER.warning(
                "Discovered %d devices, exceeding SIM_MAX_DEVICES cap (%d). Capping active simulation.",
                len(discovered_by_id),
                self.config.max_devices,
            )
            capped_keys = list(discovered_by_id.keys())[: self.config.max_devices]
            discovered_by_id = {k: discovered_by_id[k] for k in capped_keys}

        with self._lock:
            # 1. Stop and remove devices no longer discovered
            for device_id in list(self._devices.keys()):
                if device_id not in discovered_by_id:
                    LOGGER.info(
                        "Device %s deregistered or removed, stopping simulation",
                        device_id,
                    )
                    del self._devices[device_id]

            # 2. Add new or update existing
            for device_id, item in discovered_by_id.items():
                patient_id = item["patientId"]
                scenario = item.get("scenario", "normal")
                if device_id not in self._devices:
                    LOGGER.info(
                        "Discovered new device %s (patient %s, scenario %s)",
                        device_id,
                        patient_id,
                        scenario,
                    )
                    self._devices[device_id] = DeviceWorker(
                        device_id=device_id,
                        patient_id=patient_id,
                        scenario=scenario,
                    )
                else:
                    self._devices[device_id].update_scenario(scenario)

    def publish_devices(self) -> None:
        """Publish one telemetry sample for all currently registered devices."""
        with self._lock:
            workers = list(self._devices.values())

        for worker in workers:
            try:
                # Optional multi-instance lease check
                lease_key = f"device:sim:lease:{worker.device_id}"
                if not _check_redis_lease(
                    self.config.redis_url, lease_key, self.manager_id
                ):
                    continue

                worker.step_motion()
                worker.step_temperature()
                sample = worker.build_sample()

                errors = list(self._validator.iter_errors(sample))
                if errors:
                    LOGGER.error(
                        "Invalid sample for device %s: %s",
                        worker.device_id,
                        "; ".join(e.message for e in errors),
                    )
                    continue

                if self._mqtt_connected:
                    topic = f"HMS/{worker.device_id}/vitals"
                    self._mqtt_client.publish(topic, json.dumps(sample), qos=1)
            except Exception as err:
                LOGGER.error(
                    "Error publishing for device %s: %s", worker.device_id, err
                )

    def _start_health_server(self) -> None:
        manager = self

        class HealthHandler(BaseHTTPRequestHandler):
            def do_GET(self) -> None:
                if self.path == "/healthz" or self.path == "/health":
                    body = json.dumps(
                        {
                            "status": "ok",
                            "active_devices": manager.active_devices_count,
                            "devices": manager.device_ids,
                        }
                    ).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(body)))
                    self.end_headers()
                    self.wfile.write(body)
                else:
                    self.send_response(404)
                    self.end_headers()

            def log_message(self, format: str, *args: Any) -> None:
                # Suppress noisy healthcheck logs
                pass

        try:
            self._health_server = HTTPServer(
                ("0.0.0.0", self.config.health_port), HealthHandler
            )
            thread = threading.Thread(
                target=self._health_server.serve_forever, daemon=True
            )
            thread.start()
            LOGGER.info(
                "Health server listening on port %d (/healthz)", self.config.health_port
            )
        except OSError as err:
            LOGGER.warning(
                "Could not start health server on port %d: %s",
                self.config.health_port,
                err,
            )

    def run_forever(self) -> None:
        """Run the main simulator loops: MQTT, discovery, and publishing."""
        self._running = True
        self._install_signals()

        self._start_health_server()

        LOGGER.info(
            "Connecting to MQTT %s:%d, discovery API %s",
            self.config.mqtt_host,
            self.config.mqtt_port,
            self.config.api_base_url,
        )
        self._mqtt_client.reconnect_delay_set(min_delay=1, max_delay=30)
        self._mqtt_client.connect_async(
            self.config.mqtt_host, self.config.mqtt_port, 60
        )
        self._mqtt_client.loop_start()

        # Immediate first discovery poll
        discovered = self.poll_discovery()
        if discovered:
            self.reconcile_devices(discovered)
            LOGGER.info("Initial discovery found %d device(s)", len(discovered))
        else:
            LOGGER.info("Initial discovery found no devices; polling will continue")

        last_discovery_at = time.monotonic()
        last_publish_at = time.monotonic()

        try:
            while self._running:
                now = time.monotonic()

                # Poll discovery interval
                if now - last_discovery_at >= self.config.discovery_interval_seconds:
                    items = self.poll_discovery()
                    self.reconcile_devices(items)
                    last_discovery_at = now

                # Publish interval
                if now - last_publish_at >= self.config.vitals_interval_seconds:
                    self.publish_devices()
                    last_publish_at = now

                time.sleep(0.1)
        finally:
            self.stop()

    def stop(self) -> None:
        """Clean shutdown of MQTT client and health server."""
        self._running = False
        if self._mqtt_client:
            self._mqtt_client.loop_stop()
            self._mqtt_client.disconnect()
        if self._health_server:
            self._health_server.shutdown()
            self._health_server.server_close()
        LOGGER.info("Simulator manager stopped cleanly")

    def _install_signals(self) -> None:
        def handler(_sig: int, _frame: object) -> None:
            LOGGER.info(
                "Received termination signal, shutting down simulator manager..."
            )
            self._running = False

        signal.signal(signal.SIGINT, handler)
        signal.signal(signal.SIGTERM, handler)

    @staticmethod
    def _load_validator() -> Draft202012Validator:
        schema_path = (
            Path(__file__).resolve().parent.parent
            / "schemas"
            / "vital-sample.schema.json"
        )
        with schema_path.open(encoding="utf-8") as schema_file:
            schema = json.load(schema_file)
        return Draft202012Validator(schema, format_checker=FormatChecker())


def main() -> None:
    logging.basicConfig(
        level=os.getenv("LOG_LEVEL", "INFO").upper(),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    config = ManagerConfig.from_environment()
    manager = SimulatorManager(config)
    try:
        manager.run_forever()
    except (KeyboardInterrupt, SystemExit):
        manager.stop()


if __name__ == "__main__":
    main()
