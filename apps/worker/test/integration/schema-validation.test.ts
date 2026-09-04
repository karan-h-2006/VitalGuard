/**
 * Integration test: Schema validation routing
 *
 * Verifies that the bridge correctly routes malformed MQTT payloads to
 * vitals.deadletter and NOT to vitals.ingest.
 *
 * This test drives the bridge logic directly (routeMqttPayload) rather than
 * going through a real MQTT connection — the MQTT transport is covered by
 * the bridge's own unit tests. We care here about the RabbitMQ routing
 * outcome with real queue infrastructure.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  getTestChannel,
  closeTestChannel,
  purgeQueue,
  getNextMessage,
  VITALS_INGEST_QUEUE,
  VITALS_DEADLETTER_QUEUE,
} from './helpers.js';
import { loadVitalSampleValidator } from '../../src/bridge/schema-validator.js';
import { routeMqttPayload } from '../../src/bridge/bridge.js';

const RUN = process.env.RUN_INTEGRATION_TESTS === 'true';

describe.skipIf(!RUN)('Schema validation routing (integration)', () => {
  beforeAll(async () => {
    await getTestChannel();
  });

  afterAll(async () => {
    await closeTestChannel();
  });

  beforeEach(async () => {
    // Start each test with empty queues.
    await purgeQueue(VITALS_INGEST_QUEUE);
    await purgeQueue(VITALS_DEADLETTER_QUEUE);
  });

  it('routes a malformed payload to vitals.deadletter, not vitals.ingest', async () => {
    const channel = await getTestChannel();
    const validator = await loadVitalSampleValidator();

    // Deliberately malformed: missing required fields.
    const malformed = Buffer.from(
      JSON.stringify({ device_id: 'test-device', this_is: 'invalid' }),
    );

    await routeMqttPayload(malformed, channel, validator);

    // Dead-letter queue should have exactly one message.
    const deadLetterMsg = await getNextMessage(VITALS_DEADLETTER_QUEUE, 5000);
    expect(deadLetterMsg).not.toBeNull();

    const body = JSON.parse(deadLetterMsg!.content.toString('utf8')) as {
      rejection_reason: string;
      original_payload: unknown;
      received_at: string;
    };
    expect(body.rejection_reason).toBeTruthy();
    expect(body.original_payload).toMatchObject({ device_id: 'test-device' });

    // Ingest queue must be empty.
    const ingestMsg = await getNextMessage(VITALS_INGEST_QUEUE, 1000);
    expect(ingestMsg).toBeNull();
  });

  it('routes invalid JSON to vitals.deadletter', async () => {
    const channel = await getTestChannel();
    const validator = await loadVitalSampleValidator();

    const notJson = Buffer.from('this is not json {{{');
    await routeMqttPayload(notJson, channel, validator);

    const deadLetterMsg = await getNextMessage(VITALS_DEADLETTER_QUEUE, 5000);
    expect(deadLetterMsg).not.toBeNull();

    const ingestMsg = await getNextMessage(VITALS_INGEST_QUEUE, 1000);
    expect(ingestMsg).toBeNull();
  });

  it('routes a valid payload to vitals exchange (not deadletter)', async () => {
    const channel = await getTestChannel();
    const validator = await loadVitalSampleValidator();

    const valid = Buffer.from(
      JSON.stringify({
        device_id: 'test-device-valid',
        patient_id: 'patient-001',
        timestamp: '2024-01-15T10:00:00Z',
        heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
        spo2: { value: 98.5, unit: 'percent', quality: 'clean' },
        temperature: { value: 36.7, unit: 'celsius' },
        motion: {
          roll: 1.2,
          pitch: 0.5,
          accel_magnitude: 9.8,
          fall_detected: false,
        },
        gap: false,
      }),
    );

    await routeMqttPayload(valid, channel, validator);

    // Dead-letter queue must stay empty.
    const deadLetterMsg = await getNextMessage(VITALS_DEADLETTER_QUEUE, 1000);
    expect(deadLetterMsg).toBeNull();
  });
});
