"""Unit tests — SimulatedSensorSource physiological bounds and demo modes."""
from sensors.simulated import SimulatedSensorSource

HR_MIN, HR_MAX = 40.0, 220.0  # VitalNoiseFilter plausible bounds (not walk bounds)
SPO2_MIN, SPO2_MAX = 70.0, 100.0
TEMP_MIN, TEMP_MAX = 36.0, 38.5  # slightly wider to accommodate drift


def test_200_samples_within_physiological_bounds() -> None:
    source = SimulatedSensorSource(seed=42)
    for _ in range(200):
        hr = source.read_heart_rate()
        spo2 = source.read_spo2()
        temp = source.read_temperature()
        assert HR_MIN <= hr <= HR_MAX, f"heart_rate={hr} out of bounds"
        assert SPO2_MIN <= spo2 <= SPO2_MAX, f"spo2={spo2} out of bounds"
        assert TEMP_MIN <= temp <= TEMP_MAX, f"temperature={temp} out of bounds"


def test_noise_injection_produces_out_of_band_values_at_expected_rate() -> None:
    # inject_noise=True; source injects noise at ~8% rate (random() > 0.08 skips)
    # The injected noise is either ±22.0 (may still be in band for some vitals)
    # or definitively implausible out-of-range values (e.g. HR=28 or 235)
    # We test that at least some out-of-band values appear across 500 calls
    HR_WALK_MIN, HR_WALK_MAX = 60.0, 100.0  # normal walk range
    SPO2_WALK_MIN, SPO2_WALK_MAX = 95.0, 100.0
    source = SimulatedSensorSource(inject_noise=True, seed=7)
    out_of_walk_range = 0
    n = 500
    for _ in range(n):
        hr = source.read_heart_rate()
        spo2 = source.read_spo2()
        if not (HR_WALK_MIN <= hr <= HR_WALK_MAX):
            out_of_walk_range += 1
        if not (SPO2_WALK_MIN <= spo2 <= SPO2_WALK_MAX):
            out_of_walk_range += 1
    # Expect out-of-walk-range across 1000 calls (500 HR + 500 SPO2) to be 2%–25%
    rate = out_of_walk_range / (n * 2)
    assert 0.02 <= rate <= 0.25, f"noise injection rate {rate:.2%} outside expected 2-25% band"


def test_deterioration_trends_heart_rate_toward_target() -> None:
    # After deterioration_samples steps, heart_rate should be close to target (132.0)
    n = 10
    source = SimulatedSensorSource(deterioration_samples=n, seed=0)
    values = [source.read_heart_rate() for _ in range(n)]
    # Last value should be trending toward 132; at step n, progress=1.0
    # _deteriorating_value(72, 132) at step n = 72 + (132-72)*1.0 = 132.0
    assert values[-1] > 100.0, f"Expected HR to trend up toward 132, got {values[-1]}"


def test_deterioration_trends_spo2_toward_target() -> None:
    n = 10
    source = SimulatedSensorSource(deterioration_samples=n, seed=0)
    spo2_values = []
    for _ in range(n):
        source.read_heart_rate()  # _advance_deterioration is only called in read_heart_rate
        spo2_values.append(source.read_spo2())
    # At step n, spo2 should be trending toward 88.0
    assert spo2_values[-1] < 92.0, f"Expected SpO2 to trend down toward 88, got {spo2_values[-1]}"


def test_deterioration_not_active_before_first_heart_rate_read() -> None:
    # _is_deteriorating = deterioration_samples > 0 AND deterioration_step > 0
    # So the very first read_spo2() before any read_heart_rate() should NOT be deteriorated
    source = SimulatedSensorSource(deterioration_samples=10, seed=0)
    spo2 = source.read_spo2()  # no advance_deterioration yet
    assert spo2 >= 95.0, "SpO2 should be in normal range before deterioration advances"
