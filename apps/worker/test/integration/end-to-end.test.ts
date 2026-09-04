/**
 * Integration test: End-to-end pipeline
 *
 * Verifies that a simulator-shaped VitalSample published to vitals.ingest
 * results in correctly-typed rows with the right values in vital_readings.
 *
 * This is the full plumbing test: real Postgres, real RabbitMQ topology,
 * real Drizzle upsert. No mocking.
 */
import { describe, it, beforeAll, afterAll, beforeEach, expect } from 'vitest';
import type { ConsumeMessage, Channel } from 'amqplib';
import {
  getTestDb,
  closeTestDb,
  truncateVitalReadings,
  getAllVitalReadings,
  getTestChannel,
  closeTestChannel,
  SEEDED_DEVICE_ID,
  makeValidSample,
} from './helpers.js';
import { handleIngestMessage } from '../../src/consumer/ingest.js';

const RUN = process.env.RUN_INTEGRATION_TESTS === 'true';

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

describe.skipIf(!RUN)('End-to-end ingestion pipeline (integration)', () => {
  beforeAll(async () => {
    getTestDb();
    await getTestChannel();
  });

  afterAll(async () => {
    await closeTestDb();
    await closeTestChannel();
  });

  beforeEach(async () => {
    await truncateVitalReadings();
  });

  it('persists a valid simulator sample with correct vital_type and value', async () => {
    const db = getTestDb();

    const sample = makeValidSample({
      device_id: SEEDED_DEVICE_ID,
      timestamp: '2024-03-01T12:00:00Z',
      heart_rate: { value: 85, unit: 'bpm', quality: 'clean' },
      spo2: { value: 97.2, unit: 'percent', quality: 'noisy' },
      temperature: { value: 37.1, unit: 'celsius' },
      motion: {
        roll: 0.0,
        pitch: 0.0,
        accel_magnitude: 10.2,
        fall_detected: false,
      },
    });

    const fakeChannel = {
      ack: () => {},
      nack: () => {
        throw new Error('unexpected nack');
      },
    } as unknown as Channel;

    await handleIngestMessage(makeMessage(sample), fakeChannel, db);

    const rows = await getAllVitalReadings(SEEDED_DEVICE_ID);
    expect(rows).toHaveLength(4);

    const byType = Object.fromEntries(rows.map((r) => [r.vitalType, r]));

    // Heart rate: value and quality preserved
    expect(byType['heart_rate']).toBeDefined();
    expect(Number(byType['heart_rate'].value)).toBeCloseTo(85, 2);
    expect(byType['heart_rate'].qualityFlag).toBe('clean');

    // SpO2: noisy quality preserved
    expect(byType['spo2']).toBeDefined();
    expect(Number(byType['spo2'].value)).toBeCloseTo(97.2, 2);
    expect(byType['spo2'].qualityFlag).toBe('noisy');

    // Temperature: no quality in schema → defaults to clean
    expect(byType['temperature']).toBeDefined();
    expect(Number(byType['temperature'].value)).toBeCloseTo(37.1, 2);
    expect(byType['temperature'].qualityFlag).toBe('clean');

    // Motion: accel_magnitude stored as value
    expect(byType['motion']).toBeDefined();
    expect(Number(byType['motion'].value)).toBeCloseTo(10.2, 2);

    // severity_tier is null — Module 3 will classify readings
    for (const row of rows) {
      expect(row.severityTier).toBeNull();
    }

    // device_id correctly stored
    for (const row of rows) {
      expect(row.deviceId).toBe(SEEDED_DEVICE_ID);
    }

    // timestamp matches the sample
    for (const row of rows) {
      expect(row.timestamp.toISOString()).toBe('2024-03-01T12:00:00.000Z');
    }

    // gap = false (matching the sample)
    for (const row of rows) {
      expect(row.gap).toBe(false);
    }
  });

  it('correctly stores gap=true for a gap-flush reading', async () => {
    const db = getTestDb();

    const gapSample = makeValidSample({
      timestamp: '2024-03-01T13:00:00Z',
      gap: true,
    });

    const fakeChannel = {
      ack: () => {},
      nack: () => {
        throw new Error('unexpected nack');
      },
    } as unknown as Channel;

    await handleIngestMessage(makeMessage(gapSample), fakeChannel, db);

    const rows = await getAllVitalReadings(SEEDED_DEVICE_ID);
    for (const row of rows) {
      expect(row.gap).toBe(true);
    }
  });
});
