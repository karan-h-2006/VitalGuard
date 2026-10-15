import { describe, expect, it } from 'vitest';
import { loadVitalSampleValidator } from '../../src/bridge/schema-validator.js';

describe('VitalSampleValidator — backward compatibility', () => {
  it('strips legacy motion.fall_detected and accepts in-flight payloads', async () => {
    const validator = await loadVitalSampleValidator();

    const legacyPayload = {
      device_id: '00000000-0000-4000-8000-000000000002',
      patient_id: '00000000-0000-4000-8000-000000000001',
      timestamp: '2026-01-01T00:00:00.000Z',
      heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
      spo2: { value: 98, unit: 'percent', quality: 'clean' },
      temperature: { value: 36.8, unit: 'celsius' },
      motion: {
        roll: 1.5,
        pitch: -0.8,
        accel_magnitude: 9.81,
        fall_detected: true, // Legacy field in in-flight message
      },
      gap: false,
    };

    const result = validator.validate(legacyPayload);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(
        (result.sample.motion as Record<string, unknown>).fall_detected,
      ).toBeUndefined();
      expect(result.sample.motion.accel_magnitude).toBe(9.81);
    }
  });

  it('accepts modern payloads without motion.fall_detected', async () => {
    const validator = await loadVitalSampleValidator();

    const modernPayload = {
      device_id: '00000000-0000-4000-8000-000000000002',
      patient_id: '00000000-0000-4000-8000-000000000001',
      timestamp: '2026-01-01T00:00:00.000Z',
      heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
      spo2: { value: 98, unit: 'percent', quality: 'clean' },
      temperature: { value: 36.8, unit: 'celsius' },
      motion: {
        roll: 1.5,
        pitch: -0.8,
        accel_magnitude: 9.81,
      },
      gap: false,
    };

    const result = validator.validate(modernPayload);
    expect(result.valid).toBe(true);
  });
});
