"""Unit tests — VitalNoiseFilter moving-average and quality boundaries."""
from processing.filter import VitalNoiseFilter


def test_moving_average_correctness() -> None:
    # Feed exactly 5 known values through the window; smoothed = their arithmetic mean
    vital_filter = VitalNoiseFilter(window_size=5)
    values = [70.0, 72.0, 68.0, 71.0, 69.0]
    result = None
    for v in values:
        result = vital_filter.process_heart_rate(v)
    expected_avg = round(sum(values) / 5, 2)  # = 70.0
    assert result is not None
    assert result.value == expected_avg
    assert result.quality == "clean"


def test_clean_boundary_exactly_at_noisy_deviation() -> None:
    # Deviation exactly at heart_rate_noisy_deviation (12.0) is still 'clean'
    # because the check is strictly greater than: abs(raw - prev) > 12.0
    vital_filter = VitalNoiseFilter(window_size=3, heart_rate_noisy_deviation=12.0)
    vital_filter.process_heart_rate(70.0)  # seeds window, prev_avg = 70.0
    vital_filter.process_heart_rate(70.0)
    vital_filter.process_heart_rate(70.0)
    # Now prev_avg = 70.0; deviation exactly 12.0 should still be 'clean'
    result = vital_filter.process_heart_rate(82.0)  # abs(82-70) = 12.0
    assert result.quality == "clean"


def test_noisy_boundary_one_above_deviation() -> None:
    vital_filter = VitalNoiseFilter(window_size=3, heart_rate_noisy_deviation=12.0)
    for _ in range(3):
        vital_filter.process_heart_rate(70.0)
    # abs(82.01 - 70.0) = 12.01 > 12.0 -> noisy
    result = vital_filter.process_heart_rate(82.01)
    assert result.quality == "noisy"


def test_heart_rate_lower_implausible_boundary() -> None:
    vital_filter = VitalNoiseFilter()
    # 40.0 is within [40.0, 220.0] -> clean
    assert vital_filter.process_heart_rate(40.0).quality == "clean"
    # 39.9 is below lower bound -> implausible
    vital_filter2 = VitalNoiseFilter()
    assert vital_filter2.process_heart_rate(39.9).quality == "implausible"


def test_heart_rate_upper_implausible_boundary() -> None:
    vital_filter = VitalNoiseFilter()
    # 220.0 is within bounds -> clean (first call, prev = raw, deviation = 0)
    assert vital_filter.process_heart_rate(220.0).quality == "clean"
    # 220.1 is above upper bound -> implausible
    vital_filter2 = VitalNoiseFilter()
    assert vital_filter2.process_heart_rate(220.1).quality == "implausible"


def test_spo2_lower_implausible_boundary() -> None:
    # 70.0 is at lower bound, within -> clean
    vital_filter = VitalNoiseFilter()
    assert vital_filter.process_spo2(70.0).quality == "clean"
    vital_filter2 = VitalNoiseFilter()
    assert vital_filter2.process_spo2(69.9).quality == "implausible"


def test_spo2_upper_implausible_boundary() -> None:
    vital_filter = VitalNoiseFilter()
    assert vital_filter.process_spo2(100.0).quality == "clean"
    vital_filter2 = VitalNoiseFilter()
    assert vital_filter2.process_spo2(100.1).quality == "implausible"


def test_smoothed_value_includes_implausible_in_window() -> None:
    # Implausible raw values still get added to the window for smoothing
    vital_filter = VitalNoiseFilter(window_size=2)
    vital_filter.process_spo2(98.0)  # window: [98.0]
    result = vital_filter.process_spo2(60.0)  # implausible, window: [98.0, 60.0]
    assert result.quality == "implausible"
    assert result.value == round((98.0 + 60.0) / 2, 2)  # smoothing still happens
