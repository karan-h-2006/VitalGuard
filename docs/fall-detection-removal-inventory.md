# Fall Detection Removal Inventory

This inventory records all occurrences of fall-related terms across the VitalGuard codebase prior to feature removal.

**Total hits found:** 100
Search terms: `fall`, `fall_detected`, `fallDetected`, `fall-detected`, `FALL`, `TRIGGER_FALL`, `falling`, `fell`, `accel_magnitude`, `impact`, `free-fall`, `freefall`

## simulator (17 hits)

### `simulator/publisher.py`

- **Line 47** [`trigger_fall`]: `trigger_fall: bool`
- **Line 75** [`trigger_fall`]: `trigger_fall=_environment_bool("VITALGUARD_TRIGGER_FALL", False),`
- **Line 111** [`Fall`]: `raise ValueError("Fall acceleration thresholds are invalid")`
- **Line 126** [`trigger_fall`]: `trigger_fall=settings.trigger_fall,`
- **Line 249** [`accel_magnitude`]: `"accel_magnitude": motion.accel_magnitude,`
- **Line 250** [`fall_detected`]: `"fall_detected": motion.fall_detected,`

### `simulator/README.md`

- **Line 52** [`TRIGGER_FALL`]: `export VITALGUARD_TRIGGER_FALL=true`
- **Line 57** [`fall`]: `marks them. The fall flag schedules one impact-like motion event. Deterioration`

### `simulator/processing/fall_detection.py`

- **Line 1** [`Fall`]: `"""Fall detection adapted from the audited MPU6050 publisher's heuristic."""`
- **Line 15** [`accel_magnitude`]: `accel_magnitude: float`
- **Line 16** [`fall_detected`]: `fall_detected: bool`
- **Line 65** [`accel_magnitude`]: `accel_magnitude=round(magnitude, 2),`
- **Line 66** [`fall_detected`]: `fall_detected=magnitude_excursion and orientation_excursion,`

### `simulator/sensors/simulated.py`

- **Line 20** [`trigger_fall`]: `trigger_fall: bool = False,`
- **Line 26** [`trigger_fall`]: `self._fall_pending = trigger_fall`
- **Line 35** [`trigger_fall`]: `def trigger_fall(self) -> None:`
- **Line 61** [`impact`]: `# This represents the impact phase: a high magnitude and a large`

## schemas (3 hits)

### `schemas/vital-sample.schema.json`

- **Line 73** [`accel_magnitude`]: `"required": ["roll", "pitch", "accel_magnitude", "fall_detected"],`
- **Line 77** [`accel_magnitude`]: `"accel_magnitude": { "type": "number", "minimum": 0 },`
- **Line 78** [`fall_detected`]: `"fall_detected": { "type": "boolean" }`

## worker (19 hits)

### `apps/worker/README.md`

- **Line 163** [`fallDetected`]: `| `patient:<patient_id>:status`              | Low-latency dashboard cache: latest severity tier, explanation, vitals snapshot,`previousSeverityTier`, and `fallDetected`.                          |`
- **Line 201** [`falling`]: `The seeded rule matches rising heart rate + falling SpO2 + rising temperature, all`
- **Line 208** [`fall_detected`]: `1. `fall_detected` on the motion reading → **Critical**`
- **Line 261** [`fall`]: `were anomalous, raised trend warnings, or reported a fall through `motion``

### `apps/worker/src/analytics/correlation-rules.ts`

- **Line 15** [`falling`]: `direction: 'falling',`

### `apps/worker/src/analytics/service.ts`

- **Line 109** [`falling`]: `return 'falling' as const;`
- **Line 197** [`falling`]: `direction: 'falling',`
- **Line 544** [`fall_detected`]: `if (sample.motion.fall_detected) {`
- **Line 566** [`fallDetected`]: `fallDetected: sample.motion.fall_detected,`
- **Line 623** [`fallDetected`]: `fallDetected: sample.motion.fall_detected,`

### `apps/worker/src/analytics/severity.ts`

- **Line 56** [`fallDetected`]: `matches: (context) => context.fallDetected,`
- **Line 58** [`fall`]: `'Motion indicates a detected fall, which is treated as critical immediately.',`

### `apps/worker/src/analytics/types.ts`

- **Line 30** [`falling`]: `direction: 'rising' | 'falling';`
- **Line 43** [`falling`]: `direction: 'rising' | 'falling' | 'stable' | 'unknown';`
- **Line 50** [`falling`]: `direction: 'rising' | 'falling' | 'stable' | 'unknown';`
- **Line 57** [`falling`]: `direction: 'rising' | 'falling';`
- **Line 74** [`fallDetected`]: `fallDetected: boolean;`

### `apps/worker/src/consumer/ingest.ts`

- **Line 89** [`accel_magnitude`]: `// accel_magnitude is the canonical scalar summary of the motion vector.`
- **Line 90** [`accel_magnitude`]: `value: String(sample.motion.accel_magnitude),`

## api (2 hits)

### `apps/api/openapi/openapi.yml`

- **Line 188** [`impact`]: `{ description: Updated institution and deactivation impact counts }`

### `apps/api/src/features/dashboard/status.ts`

- **Line 9** [`fallDetected`]: `previousSeverityTier?: string | null; explanation?: string; fallDetected?: boolean;`

## web (4 hits)

### `apps/web/src/features/landing/landing-page.tsx`

- **Line 56** [`Fall`]: `label: 'Fall Detection Telemetry',`
- **Line 488** [`fall`]: `anomalies, and emergency fall signatures.`
- **Line 645** [`fall`]: `No fall signatures`
- **Line 1008** [`fall`]: `degrees Celsius, and 3-axis accelerometer movement for fall and`

## shared-types (2 hits)

### `packages/shared-types/src/vital-sample.ts`

- **Line 29** [`accel_magnitude`]: `accel_magnitude: number;`
- **Line 30** [`fall_detected`]: `fall_detected: boolean;`

## tests (47 hits)

### `apps/worker/test/analytics/decision-table.test.ts`

- **Line 41** [`fallDetected`]: `fallDetected: false,`
- **Line 61** [`fall`]: `it('marks a detected fall as Critical above all else', () => {`
- **Line 64** [`fallDetected`]: `fallDetected: true,`
- **Line 74** [`fall`]: `expect(result.explanation).toContain('detected fall');`
- **Line 263** [`falling`]: `direction: 'falling',`

### `apps/worker/test/integration/alerting.test.ts`

- **Line 133** [`accel_magnitude`]: `accel_magnitude: 18,`
- **Line 134** [`fall_detected`]: `fall_detected: true,`
- **Line 146** [`fall`]: `expect(rows[0]?.explanation).toContain('fall');`
- **Line 191** [`fall`]: `explanation: 'detected fall',`
- **Line 288** [`fall`]: `explanation: 'detected fall',`
- **Line 334** [`fall`]: `explanation: 'detected fall',`

### `apps/worker/test/integration/analytics-pipeline.test.ts`

- **Line 208** [`accel_magnitude`]: `accel_magnitude: 18,`
- **Line 209** [`fall_detected`]: `fall_detected: true,`

### `apps/worker/test/integration/end-to-end.test.ts`

- **Line 87** [`accel_magnitude`]: `accel_magnitude: 10.2,`
- **Line 88** [`fall_detected`]: `fall_detected: false,`
- **Line 121** [`accel_magnitude`]: `// Motion: accel_magnitude stored as value`

### `apps/worker/test/integration/helpers.ts`

- **Line 206** [`accel_magnitude`]: `accel_magnitude: 9.8,`
- **Line 207** [`fall_detected`]: `fall_detected: false,`

### `apps/worker/test/integration/schema-validation.test.ts`

- **Line 98** [`accel_magnitude`]: `accel_magnitude: 9.8,`
- **Line 99** [`fall_detected`]: `fall_detected: false,`

### `apps/worker/test/unit/analytics.unit.test.ts`

- **Line 96** [`falling`]: `it("returns 'falling' when value is below the mean", () => {`
- **Line 97** [`falling`]: `expect(computeDirection(65, 70, minSamples)).toBe('falling');`
- **Line 105** [`falling`]: `// ── Trend projection — falling case ──────────────────────────────────────────`
- **Line 107** [`falling`]: `describe('evaluateTrend — falling sequence', () => {`
- **Line 108** [`falling`]: `it('detects a falling trend heading toward a minimum threshold', () => {`
- **Line 109** [`falling`]: `// 10 values falling from 100 toward min=95 — they are still above 95 but`
- **Line 114** [`falling`]: `// 100.0, 99.5, 99.0 ... 95.5 — all above 95 but clearly falling`
- **Line 121** [`falling`]: `expect(result!.direction).toBe('falling');`

### `apps/worker/test/unit/bridge.unit.test.ts`

- **Line 19** [`accel_magnitude`]: `motion: { roll: 0, pitch: 0, accel_magnitude: 9.81, fall_detected: false },`

### `apps/worker/test/unit/consumer-ack.unit.test.ts`

- **Line 44** [`accel_magnitude`]: `motion: { roll: 0, pitch: 0, accel_magnitude: 9.81, fall_detected: false },`

### `simulator/tests/test_fall_detection.py`

- **Line 10** [`fall_detected`]: `assert result.fall_detected is False`
- **Line 18** [`accel_magnitude`]: `assert result.accel_magnitude >= 11.0`
- **Line 20** [`fall_detected`]: `assert result.fall_detected is True`

### `simulator/tests/test_schema_validation.py`

- **Line 19** [`trigger_fall`]: `trigger_fall=False,`

### `simulator/tests/test_vital_simulator.py`

- **Line 13** [`trigger_fall`]: `source = SimulatedSensorSource(trigger_fall=True)`

### `simulator/tests/unit/test_fall_detection_unit.py`

- **Line 8** [`fall`]: `# The simulated fall reading: high magnitude + large orientation`
- **Line 14** [`fall_detected`]: `assert result.fall_detected is True`
- **Line 24** [`accel_magnitude`]: `assert result.accel_magnitude >= 11.0  # magnitude excursion`
- **Line 26** [`fall_detected`]: `assert result.fall_detected is False`
- **Line 33** [`fall_detected`]: `assert result.fall_detected is False`
- **Line 46** [`fall_detected`]: `assert result.fall_detected is False  # but no magnitude excursion -> not a fall`
- **Line 50** [`free-fall`]: `# Very low magnitude (free-fall-like: < 10.0) but device stays flat`
- **Line 55** [`accel_magnitude`]: `assert result.accel_magnitude < 10.0  # low-g excursion`
- **Line 57** [`fall_detected`]: `assert result.fall_detected is False`

### `simulator/tests/unit/test_schema_validation_unit.py`

- **Line 27** [`accel_magnitude`]: `"motion": {"roll": 0.0, "pitch": 0.0, "accel_magnitude": 9.81, "fall_detected": False},`
- **Line 124** [`fall_detected`]: `def test_motion_fall_detected_wrong_type() -> None:`
- **Line 126** [`fall_detected`]: `s["motion"]["fall_detected"] = "true"  # string instead of boolean`

## docs/README/SRS (2 hits)

### `RUN.md`

- **Line 175** [`fall`]: `The 12-sample deterioration ramp takes about one minute at the default five-second interval. The simulated heart rate, SpO2, and temperature move into abnormal ranges; the worker classifies the sample and creates a Critical alert. Check the patient dashboard for Critical status and the doctor/caregiver dashboards for their alert views. The simulator keeps running; press **Ctrl+C** to stop it. To enable the simulator's one-shot fall event as an alternative Critical trigger, set `$env:VITALGUARD_TRIGGER_FALL = 'true'` before running it.`

### `docs/ui-reference-notes.md`

- **Line 18** [`impact`]: `- **Headlines / Display:** `Unbounded` (geometric modern display sans, weights 300, 400, 500). Very wide, confident character tracking, high impact.`

## env files (4 hits)

### `simulator/.env`

- **Line 27** [`fall`]: `# Retained reference fall heuristic thresholds (m/s² and degrees).`
- **Line 35** [`TRIGGER_FALL`]: `VITALGUARD_TRIGGER_FALL=false`

### `simulator/.env.example`

- **Line 27** [`fall`]: `# Retained reference fall heuristic thresholds (m/s² and degrees).`
- **Line 35** [`TRIGGER_FALL`]: `VITALGUARD_TRIGGER_FALL=false`
