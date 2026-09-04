from sensors import SimulatedSensorSource


def test_simulated_source_generates_plausible_resting_values() -> None:
    source = SimulatedSensorSource(seed=8)

    assert 60.0 <= source.read_heart_rate() <= 100.0
    assert 95.0 <= source.read_spo2() <= 100.0
    assert 36.1 <= source.read_temperature() <= 37.5


def test_simulated_source_can_emit_a_deliberate_fall_motion() -> None:
    source = SimulatedSensorSource(trigger_fall=True)

    motion = source.read_motion()

    assert motion.accel_x == 8.0
    assert motion.accel_y == 7.0
