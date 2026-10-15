from processing.motion import MotionProcessor
from sensors.base import MotionReading


def test_resting_motion_derivation() -> None:
    reading = MotionReading(0.0, 0.0, 9.81, 0.0, 0.0, 0.0)

    result = MotionProcessor().process(reading)

    assert result.accel_magnitude == 9.81
    assert result.roll == 0.0
    assert result.pitch == 0.0
    assert not hasattr(result, "fall_detected")


def test_tilted_motion_derivation() -> None:
    reading = MotionReading(8.0, 7.0, 5.0, 0.0, 0.0, 0.0)

    result = MotionProcessor().process(reading)

    assert result.accel_magnitude > 11.0
    assert abs(result.pitch) > 30.0
    assert abs(result.roll) > 30.0
    assert not hasattr(result, "fall_detected")
