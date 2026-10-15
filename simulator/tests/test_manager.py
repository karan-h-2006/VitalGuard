"""Unit tests for multi-device simulator manager, baseline derivation, and reconciliation."""

from __future__ import annotations

import sys
from unittest.mock import patch

from manager import (
    DeviceWorker,
    ManagerConfig,
    SimulatorManager,
    derive_patient_baseline,
)


def test_derive_patient_baseline_is_deterministic() -> None:
    patient_id = "00000000-0000-4000-8000-000000000001"
    hr1, spo2_1, temp1 = derive_patient_baseline(patient_id)
    hr2, spo2_2, temp2 = derive_patient_baseline(patient_id)

    assert hr1 == hr2
    assert spo2_1 == spo2_2
    assert temp1 == temp2

    # Physiologically plausible resting vitals
    assert 60.0 <= hr1 <= 95.0
    assert 95.0 <= spo2_1 <= 100.0
    assert 36.0 <= temp1 <= 37.5


def test_derive_patient_baseline_differs_across_patients() -> None:
    p1 = "00000000-0000-4000-8000-000000000001"
    p2 = "00000000-0000-4000-8000-000000000006"

    b1 = derive_patient_baseline(p1)
    b2 = derive_patient_baseline(p2)

    # Different UUIDs should not yield identical tuples
    assert b1 != b2


def test_device_worker_builds_valid_sample() -> None:
    worker = DeviceWorker(
        device_id="dev-100",
        patient_id="pat-100",
        scenario="normal",
    )
    worker.step_motion()
    worker.step_temperature()
    sample = worker.build_sample()

    assert sample["device_id"] == "dev-100"
    assert sample["patient_id"] == "pat-100"
    assert "heart_rate" in sample
    assert "spo2" in sample
    assert "temperature" in sample
    assert "motion" in sample
    assert "gap" in sample
    # Verify no fall detection fields
    assert "fall_detected" not in sample.get("motion", {})


def test_device_worker_scenario_transition() -> None:
    worker = DeviceWorker(
        device_id="dev-101",
        patient_id="pat-101",
        scenario="normal",
    )
    assert worker.scenario == "normal"

    worker.update_scenario("deteriorating")
    assert worker.scenario == "deteriorating"
    assert worker.source.scenario == "deteriorating"

    # Advance deterioration samples and check heart rate increases
    readings = [worker.source.read_heart_rate() for _ in range(12)]
    assert readings[-1] > readings[0]

    worker.update_scenario("normal")
    assert worker.scenario == "normal"
    assert worker.source.scenario == "normal"


def test_simulator_manager_reconciliation() -> None:
    config = ManagerConfig(
        api_base_url="http://mock-api:3000",
        service_token="test-token",
        discovery_interval_seconds=10.0,
        vitals_interval_seconds=5.0,
        mqtt_host="localhost",
        mqtt_port=1883,
        mqtt_username=None,
        mqtt_password=None,
        mqtt_use_tls=False,
        redis_url=None,
        health_port=8999,
    )
    manager = SimulatorManager(config)

    # 1. Initial discovery with 2 devices
    discovered = [
        {"deviceId": "dev-1", "patientId": "pat-1", "scenario": "normal"},
        {"deviceId": "dev-2", "patientId": "pat-2", "scenario": "normal"},
    ]
    manager.reconcile_devices(discovered)
    assert manager.active_devices_count == 2
    assert set(manager.device_ids) == {"dev-1", "dev-2"}

    # 2. Update scenario of dev-1 to deteriorating, and drop dev-2, add dev-3
    discovered_next = [
        {"deviceId": "dev-1", "patientId": "pat-1", "scenario": "deteriorating"},
        {"deviceId": "dev-3", "patientId": "pat-3", "scenario": "noisy"},
    ]
    manager.reconcile_devices(discovered_next)
    assert manager.active_devices_count == 2
    assert set(manager.device_ids) == {"dev-1", "dev-3"}
    assert manager._devices["dev-1"].scenario == "deteriorating"
    assert manager._devices["dev-3"].scenario == "noisy"


def test_vital_simulator_cli_delegation() -> None:
    from vital_simulator import main as entrypoint_main

    with (
        patch("vital_simulator.publisher_main") as mock_pub,
        patch("vital_simulator.manager_main") as mock_mgr,
    ):
        # Without --single
        with patch.object(sys, "argv", ["vital_simulator.py"]):
            entrypoint_main()
            mock_mgr.assert_called_once()
            mock_pub.assert_not_called()

        mock_mgr.reset_mock()
        mock_pub.reset_mock()

        # With --single
        with patch.object(sys, "argv", ["vital_simulator.py", "--single"]):
            entrypoint_main()
            mock_pub.assert_called_once()
            mock_mgr.assert_not_called()
