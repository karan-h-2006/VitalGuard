from processing.filter import VitalNoiseFilter


def test_heart_rate_spike_is_noisy_and_smoothed() -> None:
    vital_filter = VitalNoiseFilter(window_size=5)
    for _ in range(5):
        assert vital_filter.process_heart_rate(70.0).quality == "clean"

    result = vital_filter.process_heart_rate(95.0)

    assert result.quality == "noisy"
    assert result.value == 75.0


def test_spo2_outside_physiological_bounds_is_implausible() -> None:
    vital_filter = VitalNoiseFilter()

    result = vital_filter.process_spo2(62.0)

    assert result.quality == "implausible"
