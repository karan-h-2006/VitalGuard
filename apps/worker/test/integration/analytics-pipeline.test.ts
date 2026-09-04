import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Channel, ConsumeMessage } from 'amqplib';
import { eq } from 'drizzle-orm';
import { thresholds, vitalReadings } from '../../src/schema.js';
import { handleIngestMessage } from '../../src/consumer/ingest.js';
import {
  closeTestDb,
  closeTestRedis,
  connectTestRedis,
  getBaselineWindowMembers,
  getBaselines,
  getStatusCache,
  getTestDb,
  makeValidSample,
  resetAnalyticsState,
  SEEDED_DEVICE_ID,
  SEEDED_PATIENT_ID,
} from './helpers.js';

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

async function ingestSample(sample: ReturnType<typeof makeValidSample>) {
  const db = getTestDb();
  const fakeChannel = {
    ack: () => {},
    nack: () => {
      throw new Error('unexpected nack');
    },
  } as unknown as Channel;

  await handleIngestMessage(makeMessage(sample), fakeChannel, db);
}

describe.skipIf(!RUN)('Analytics pipeline (integration)', () => {
  beforeAll(async () => {
    getTestDb();
    await connectTestRedis();
  });

  afterAll(async () => {
    await closeTestRedis();
    await closeTestDb();
  });

  beforeEach(async () => {
    await resetAnalyticsState();
  });

  it('uses default thresholds until a patient-specific override is present', async () => {
    await ingestSample(
      makeValidSample({
        timestamp: '2024-03-01T10:00:00Z',
        heart_rate: { value: 85, unit: 'bpm', quality: 'clean' },
      }),
    );

    let rows = await getTestDb()
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.deviceId, SEEDED_DEVICE_ID));
    expect(rows[0]?.severityTier).toBe('Normal');

    await resetAnalyticsState();
    await getTestDb().insert(thresholds).values({
      patientId: SEEDED_PATIENT_ID,
      vitalType: 'heart_rate',
      minimum: '60',
      maximum: '70',
      clinicianOverride: true,
    });

    await ingestSample(
      makeValidSample({
        timestamp: '2024-03-01T10:05:00Z',
        heart_rate: { value: 85, unit: 'bpm', quality: 'clean' },
      }),
    );

    rows = await getTestDb()
      .select()
      .from(vitalReadings)
      .where(eq(vitalReadings.deviceId, SEEDED_DEVICE_ID));
    expect(rows[0]?.severityTier).toBe('Warning');

    const status = await getStatusCache(SEEDED_PATIENT_ID);
    expect(status?.explanation).toContain('above the 70 bpm threshold');
  });

  it('trims the Redis baseline window and records a cold-start summary', async () => {
    await ingestSample(
      makeValidSample({
        timestamp: '2024-01-01T10:00:00Z',
        heart_rate: { value: 70, unit: 'bpm', quality: 'clean' },
      }),
    );
    await ingestSample(
      makeValidSample({
        timestamp: '2024-01-05T10:00:00Z',
        heart_rate: { value: 74, unit: 'bpm', quality: 'clean' },
      }),
    );
    await ingestSample(
      makeValidSample({
        timestamp: '2024-01-10T10:00:00Z',
        heart_rate: { value: 78, unit: 'bpm', quality: 'clean' },
      }),
    );

    const windowMembers = await getBaselineWindowMembers(
      SEEDED_PATIENT_ID,
      'heart_rate',
    );
    expect(windowMembers).toHaveLength(2);

    const baselineRows = await getBaselines(SEEDED_PATIENT_ID);
    const heartRateBaseline = baselineRows.find(
      (row) => row.vitalType === 'heart_rate',
    );
    expect(heartRateBaseline?.sampleCount).toBe(2);
    expect(Number(heartRateBaseline?.mean)).toBeCloseTo(76, 2);

    const status = await getStatusCache(SEEDED_PATIENT_ID);
    expect(status?.severityTier).toBe('Normal');
  });

  it('walks one patient through Normal, Watch, Warning, then Critical', async () => {
    const baselineStart = Date.parse('2024-02-01T00:00:00Z');
    for (let index = 0; index < 20; index += 1) {
      await ingestSample(
        makeValidSample({
          timestamp: new Date(baselineStart + index * 60_000).toISOString(),
          heart_rate: {
            value: index % 2 === 0 ? 70 : 71,
            unit: 'bpm',
            quality: 'clean',
          },
          spo2: { value: 98, unit: 'percent', quality: 'clean' },
          temperature: { value: 36.8, unit: 'celsius' },
        }),
      );
    }

    const stages = [
      {
        sample: makeValidSample({
          timestamp: '2024-02-01T00:20:00Z',
          heart_rate: { value: 70.8, unit: 'bpm', quality: 'clean' },
          spo2: { value: 98, unit: 'percent', quality: 'clean' },
          temperature: { value: 36.8, unit: 'celsius' },
        }),
        expected: 'Normal',
      },
      {
        sample: makeValidSample({
          timestamp: '2024-02-01T00:21:00Z',
          // z ≈ 1.6 with the warm baseline (above watch threshold of 1.5, below moderate 2.0)
          heart_rate: { value: 71.3, unit: 'bpm', quality: 'clean' },
          spo2: { value: 98, unit: 'percent', quality: 'clean' },
          temperature: { value: 36.8, unit: 'celsius' },
        }),
        expected: 'Watch',
      },
      {
        sample: makeValidSample({
          timestamp: '2024-02-01T00:22:00Z',
          // z ≥ 2.0 (anomalous) but still inside the static 60–100 bpm band
          heart_rate: { value: 72.0, unit: 'bpm', quality: 'clean' },
          spo2: { value: 98, unit: 'percent', quality: 'clean' },
          temperature: { value: 36.8, unit: 'celsius' },
        }),
        expected: 'Warning',
      },
      {
        sample: makeValidSample({
          timestamp: '2024-02-01T00:23:00Z',
          motion: {
            roll: 20,
            pitch: 30,
            accel_magnitude: 18,
            fall_detected: true,
          },
        }),
        expected: 'Critical',
      },
    ] as const;

    const actual: string[] = [];
    for (const stage of stages) {
      await ingestSample(stage.sample);
      const status = await getStatusCache(SEEDED_PATIENT_ID);
      actual.push(status?.severityTier ?? 'missing');
    }

    expect(actual).toEqual(stages.map((stage) => stage.expected));
  });
});
