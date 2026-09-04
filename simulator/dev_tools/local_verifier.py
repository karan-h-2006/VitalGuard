"""TEMPORARY: delete once Module 2's durable ingestion bridge is available."""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

import paho.mqtt.client as mqtt
from jsonschema import Draft202012Validator, FormatChecker

LOGGER = logging.getLogger(__name__)


def load_validator() -> Draft202012Validator:
    schema_path = Path(__file__).resolve().parents[2] / "schemas" / "vital-sample.schema.json"
    with schema_path.open(encoding="utf-8") as schema_file:
        return Draft202012Validator(json.load(schema_file), format_checker=FormatChecker())


def main() -> None:
    logging.basicConfig(level="INFO", format="%(asctime)s %(levelname)s: %(message)s")
    validator = load_validator()
    output_path = Path(os.getenv("VERIFIER_OUTPUT_FILE", "received_samples.jsonl"))
    host = os.getenv("MQTT_HOST", "localhost")
    port = int(os.getenv("MQTT_PORT", "1883"))
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id="vitalguard-local-verifier")
    username = os.getenv("MQTT_USERNAME")
    if username:
        client.username_pw_set(username, os.getenv("MQTT_PASSWORD"))
    if os.getenv("MQTT_USE_TLS", "false").lower() in {"1", "true", "yes", "on"}:
        client.tls_set()

    def on_connect(
        connected_client: mqtt.Client,
        _userdata: object,
        _flags: mqtt.ConnectFlags,
        reason_code: mqtt.ReasonCode,
        _properties: mqtt.Properties | None,
    ) -> None:
        if reason_code != 0:
            LOGGER.error("Verifier MQTT connection refused: %s", reason_code)
            return
        connected_client.subscribe("HMS/+/vitals", qos=1)
        LOGGER.info("Temporary verifier subscribed to HMS/+/vitals")

    def on_message(_client: mqtt.Client, _userdata: object, message: mqtt.MQTTMessage) -> None:
        try:
            sample: Any = json.loads(message.payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            LOGGER.error("Discarded non-JSON MQTT payload on %s: %s", message.topic, error)
            return
        errors = list(validator.iter_errors(sample))
        if errors:
            LOGGER.error(
                "Discarded schema-invalid sample on %s: %s",
                message.topic,
                "; ".join(error.message for error in errors),
            )
            return
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with output_path.open("a", encoding="utf-8") as output_file:
            output_file.write(json.dumps(sample, separators=(",", ":")) + "\n")
        LOGGER.info("Validated sample from %s: %s", message.topic, sample)

    client.on_connect = on_connect
    client.on_message = on_message
    # The temporary tool starts independently of the broker/container. Retry
    # its initial connection so a normal local-compose startup race is not a
    # false pipeline failure.
    client.connect_async(host, port, 60)
    client.loop_forever(retry_first_connection=True)


if __name__ == "__main__":
    main()
