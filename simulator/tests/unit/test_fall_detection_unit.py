"""Unit tests — FallDetector heuristic boundary conditions."""
import math
from processing.fall_detection import FallDetector
from sensors.base import MotionReading


def test_known_fall_sequence_detected() -> None:
    # The simulated fall reading: high magnitude + large orientation
    reading = MotionReading(8.0, 7.0, 5.0, 180.0, 160.0, 15.0)
    result = FallDetector().process(reading)
    magnitude = math.sqrt(8.0**2 + 7.0**2 + 5.0**2)
    assert magnitude >= 11.0
    assert abs(result.pitch) > 30.0 or abs(result.roll) > 30.0
    assert result.fall_detected is True


def test_brisk_upright_movement_does_not_false_positive() -> None:
    # High magnitude (shock from stepping) but orientation stays within normal range
    # Roll = atan2(0, sqrt(x^2 + z^2)): with accel_y=0, roll=0
    # Use mostly Z-axis with small X/Y so magnitude is high but orientation is small
    # accel_x=1, accel_y=0, accel_z=11 -> magnitude ~11.04, pitch=atan2(1,sqrt(0+121)) < 6 deg
    reading = MotionReading(1.0, 0.0, 11.0, 0.0, 0.0, 0.0)
    result = FallDetector().process(reading)
    assert result.accel_magnitude >= 11.0  # magnitude excursion
    assert abs(result.pitch) <= 30.0 and abs(result.roll) <= 30.0  # orientation within range
    assert result.fall_detected is False


def test_resting_upright_not_a_fall() -> None:
    # Resting on flat surface: gravity along Z, minimal X/Y
    reading = MotionReading(0.0, 0.0, 9.81, 0.0, 0.0, 0.0)
    result = FallDetector().process(reading)
    assert result.fall_detected is False


def test_large_orientation_but_normal_magnitude_not_a_fall() -> None:
    # Large pitch angle but magnitude in normal range (9.0 to 10.9)
    # Place device at steep angle: accel_x large, small z, magnitude ~10.5
    # accel_x=9.0, accel_y=0, accel_z=5.0 -> mag ~10.3, pitch=atan2(9,sqrt(0+25)) ~61deg
    reading = MotionReading(9.0, 0.0, 5.0, 0.0, 0.0, 0.0)
    result = FallDetector().process(reading)
    magnitude = math.sqrt(9.0**2 + 0.0**2 + 5.0**2)
    # Magnitude is ~10.3, which is >= 10.0 (low threshold) AND < 11.0 -> no magnitude excursion
    assert 10.0 <= magnitude < 11.0
    assert abs(result.pitch) > 30.0  # orientation excursion present
    assert result.fall_detected is False  # but no magnitude excursion -> not a fall


def test_low_magnitude_below_threshold_with_flat_orientation_not_a_fall() -> None:
    # Very low magnitude (free-fall-like: < 10.0) but device stays flat
    # accel_x=0, accel_y=0, accel_z=8.0 -> mag=8.0 < 10.0 -> magnitude_excursion=True
    # roll = 0, pitch = 0 -> no orientation excursion
    reading = MotionReading(0.0, 0.0, 8.0, 0.0, 0.0, 0.0)
    result = FallDetector().process(reading)
    assert result.accel_magnitude < 10.0  # low-g excursion
    assert abs(result.pitch) <= 30.0 and abs(result.roll) <= 30.0
    assert result.fall_detected is False
