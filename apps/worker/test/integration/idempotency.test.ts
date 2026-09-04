/**
 * Integration test: Idempotency guarantee
 *
 * Verifies that publishing the same (device_id, timestamp, vital_type) twice
 * results in exactly one row per vital_type in vital_readings — not two.
 *
 * This is the core correctness guarantee of Module 2: RabbitMQ's at-least-once
 * delivery means the consumer can receive the same message twice (e.g. after
 * a consumer crash before acking). The ON CONFLICT DO NOTHING upsert must
 * make the second delivery a safe no-op.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import {
  getTestDb,
  closeTestDb,
  closeTestRedis,
  connectTestRedis,
  countVitalReadings,
  getBaselineWindowMembers,
  resetAnalyticsState,
  SEEDED_DEVICE_ID,
  SEEDED_PATIENT_ID,
  makeValidSample,
} from './helpers.js';
import { handleIngestMessage } from '../../src/consumer/ingest.js';
import { getTestChannel, closeTestChannel } from './helpers.js';
import type { ConsumeMessage, Channel } from 'amqplib';

const RUN = process.env.RUN_INTEGRATION_TESTS === 'true';

/**
 * Builds a fake amqplib ConsumeMessage wrapping a JSON-serialised VitalSample.
 * We use the real DB and real channel but simulate the message delivery.
 */
function makeMessage(payload: unknown): ConsumeMessage {
  return {
    content: Buffer.from(JSON.stringify(payload)),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: 'vitals',
      routingKey: `vitals.${SEEDED_DEVICE_ID}`,
      consumerTag: 'test',
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: null,
      headers: {},
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  } as unknown as ConsumeMessage;
}

describe.skipIf(!RUN)('Idempotency (integration)', () => {
  beforeAll(async () => {
    getTestDb();
    await getTestChannel();
    await connectTestRedis();
  });

  afterAll(async () => {
    await closeTestRedis();
    await closeTestDb();
    await closeTestChannel();
  });

  beforeEach(async () => {
    await resetAnalyticsState();
  });

  it('inserts exactly 4 rows for one valid sample', async () => {
    const db = getTestDb();

    const sample = makeValidSample();
    const msg = makeMessage(sample);

    // Spy on ack — channel.ack is a no-op in tests since we're not consuming
    // from a live queue delivery in this test.
    let ackCalled = 0;
    const fakeChannel = {
      ack: () => {
        ackCalled++;
      },
      nack: () => {
        throw new Error('nack called unexpectedly');
      },
    } as unknown as Channel;

    await handleIngestMessage(msg, fakeChannel, db);

    const count = await countVitalReadings(SEEDED_DEVICE_ID);
    expect(count).toBe(4); // heart_rate, spo2, temperature, motion
    expect(ackCalled).toBe(1);
  });

  it('delivers the same sample twice and still has exactly 4 rows (idempotency)', async () => {
    const db = getTestDb();

    const sample = makeValidSample();

    let ackCalled = 0;
    const fakeChannel = {
      ack: () => {
        ackCalled++;
      },
      nack: () => {
        throw new Error('nack called unexpectedly on redelivery');
      },
    } as unknown as Channel;

    // First delivery
    await handleIngestMessage(makeMessage(sample), fakeChannel, db);
    // Second delivery — simulates RabbitMQ redelivering after a crash-before-ack
    await handleIngestMessage(makeMessage(sample), fakeChannel, db);

    const count = await countVitalReadings(SEEDED_DEVICE_ID);
    // ON CONFLICT DO NOTHING: second delivery must produce 0 new rows.
    expect(count).toBe(4);
    expect(ackCalled).toBe(2); // Both deliveries acked (safe on second: 0 rows inserted)

    const heartRateWindow = await getBaselineWindowMembers(
      SEEDED_PATIENT_ID,
      'heart_rate',
    );
    // Analytics runs once; the redelivery must not double-count the baseline window.
    expect(heartRateWindow).toHaveLength(1);
  });

  it('stores rows with correct vital_type values', async () => {
    const db = getTestDb();

    const sample = makeValidSample();

    const fakeChannel = {
      ack: () => {},
      nack: () => {
        throw new Error('unexpected nack');
      },
    } as unknown as Channel;

    await handleIngestMessage(makeMessage(sample), fakeChannel, db);

    const { getAllVitalReadings } = await import('./helpers.js');
    const rows = await getAllVitalReadings(SEEDED_DEVICE_ID);
    const types = rows.map((r) => r.vitalType).sort();
    expect(types).toEqual(['heart_rate', 'motion', 'spo2', 'temperature']);
  });
});
