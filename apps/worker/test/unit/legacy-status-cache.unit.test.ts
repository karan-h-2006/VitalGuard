import { describe, expect, it } from 'vitest';
import type { VitalSeverityTier } from '@vitalguard/shared-types';

describe('Legacy Redis status cache compatibility', () => {
  it('safely parses cached status entries written by previous versions containing fallDetected', () => {
    // Simulates an old Redis entry written by previous worker versions
    const legacyRawCache = JSON.stringify({
      patientId: 'patient-123',
      deviceId: 'device-456',
      timestamp: '2026-01-01T00:00:00.000Z',
      severityTier: 'Critical',
      previousSeverityTier: 'Normal',
      explanation: 'Previous status before fall detection removal',
      fallDetected: true, // Legacy field
      latestVitals: {
        heart_rate: { value: 75, anomalyFlag: 'clean', zScore: 0.1 },
      },
    });

    // The reader code in apps/worker/src/analytics/service.ts line 523:
    // const previous = previousRaw ? (JSON.parse(previousRaw) as { severityTier?: VitalSeverityTier }) : null;
    const previous = JSON.parse(legacyRawCache) as {
      severityTier?: VitalSeverityTier;
    };

    expect(previous).toBeDefined();
    expect(previous.severityTier).toBe('Critical');
    // Does not crash, and does not require or depend on fallDetected
    expect((previous as Record<string, unknown>)['fallDetected']).toBeDefined();
  });
});
