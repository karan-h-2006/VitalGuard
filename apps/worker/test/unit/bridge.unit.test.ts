/**
 * Unit tests — Module 2 Bridge routing
 * All broker I/O is mocked. No live MQTT or RabbitMQ needed.
 */
import { describe, expect, it, vi } from 'vitest';
import { routeMqttPayload } from '../../src/bridge/bridge.js';
import type { VitalSampleValidator } from '../../src/bridge/schema-validator.js';
import type { VitalSample } from '@vitalguard/shared-types';

/** Minimal valid VitalSample shape for the mock validator to accept. */
function makeValidSample(): VitalSample {
  return {
    device_id: 'dev-001',
    patient_id: 'pat-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
    spo2: { value: 98, unit: 'percent', quality: 'clean' },
    temperature: { value: 36.8, unit: 'celsius' },
    motion: { roll: 0, pitch: 0, accel_magnitude: 9.81, fall_detected: false },
    gap: false,
  } as unknown as VitalSample;
}

function makeChannel() {
  return {
    publish: vi.fn(),
    waitForConfirms: vi.fn().mockResolvedValue(undefined),
  };
}

function makeValidator(valid: boolean): VitalSampleValidator {
  return {
    validate: vi.fn((payload: unknown) =>
      valid
        ? { valid: true, sample: payload as VitalSample }
        : { valid: false, reason: 'schema error: missing required field' },
    ),
  };
}

describe('routeMqttPayload — valid payload', () => {
  it('publishes to the ingest routing key and does not hit dead-letter', async () => {
    const channel = makeChannel();
    const sample = makeValidSample();
    const payload = Buffer.from(JSON.stringify(sample));
    const validator = makeValidator(true);

    await routeMqttPayload(payload, channel as never, validator);

    expect(channel.publish).toHaveBeenCalledOnce();
    const [, routingKey] = channel.publish.mock.calls[0]!;
    expect(routingKey).toBe(`vitals.${sample.device_id}`);
    expect(channel.waitForConfirms).toHaveBeenCalledOnce();
  });
});

describe('routeMqttPayload — invalid JSON', () => {
  it('routes to the dead-letter key and skips the ingest path', async () => {
    const channel = makeChannel();
    const validator = makeValidator(true); // validator never reached

    await routeMqttPayload(
      Buffer.from('{not json}'),
      channel as never,
      validator,
    );

    expect(channel.publish).toHaveBeenCalledOnce();
    const [, routingKey] = channel.publish.mock.calls[0]!;
    expect(routingKey).toBe('deadletter.vitals');
    expect(validator.validate).not.toHaveBeenCalled();
  });
});

describe('routeMqttPayload — valid JSON but schema-invalid', () => {
  it('routes to the dead-letter key and skips the ingest path', async () => {
    const channel = makeChannel();
    const validator = makeValidator(false); // schema check fails
    const payload = Buffer.from(
      JSON.stringify({ device_id: 'missing-everything-else' }),
    );

    await routeMqttPayload(payload, channel as never, validator);

    expect(channel.publish).toHaveBeenCalledOnce();
    const [, routingKey] = channel.publish.mock.calls[0]!;
    expect(routingKey).toBe('deadletter.vitals');
  });
});
