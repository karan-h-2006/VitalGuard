from processing.fall_detection import FallDetector
from sensors.base import MotionReading


def test_resting_motion_is_not_a_fall() -> None:
    reading = MotionReading(0.0, 0.0, 9.81, 0.0, 0.0, 0.0)

    result = FallDetector().process(reading)

    assert result.fall_detected is False


def test_high_impact_with_orientation_change_is_a_fall() -> None:
    reading = MotionReading(8.0, 7.0, 5.0, 0.0, 0.0, 0.0)

    result = FallDetector().process(reading)

    assert result.accel_magnitude >= 11.0
    assert abs(result.pitch) > 30.0
    assert result.fall_detected is True
