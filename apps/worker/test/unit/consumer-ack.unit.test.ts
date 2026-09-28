/**
 * Unit tests — Module 2 Consumer ack/nack decision
 * Database, analytics, and Redis are all mocked. No live services needed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// vi.mock calls are hoisted automatically — env vars from setup-env.ts are in place.
vi.mock('../../src/analytics/service.js', () => ({
  analyzeAndPersistSample: vi.fn(),
}));
vi.mock('../../src/redis.js', () => ({
  redis: {},
  connectRedis: vi.fn(),
  closeRedis: vi.fn(),
}));

import { handleIngestMessage } from '../../src/consumer/ingest.js';
import { analyzeAndPersistSample } from '../../src/analytics/service.js';

/** Build a minimal ConsumeMessage from a VitalSample-shaped object. */
function makeMessage(body: object) {
  return {
    content: Buffer.from(JSON.stringify(body)),
    fields: {
      routingKey: 'vitals.dev-001',
      deliveryTag: 1,
      exchange: 'vitals',
      redelivered: false,
      consumerTag: 'ct',
    },
    properties: {},
  } as never;
}

/** A complete-enough VitalSample body to pass sampleToRows without error. */
function sampleBody() {
  return {
    device_id: 'dev-001',
    patient_id: 'pat-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
    spo2: { value: 98, unit: 'percent', quality: 'clean' },
    temperature: { value: 36.8, unit: 'celsius' },
    motion: { roll: 0, pitch: 0, accel_magnitude: 9.81, fall_detected: false },
    gap: false,
  };
}

/** Create a mock database where insert succeeds and returns one row id. */
function makeSuccessDatabase() {
  const returning = vi.fn().mockResolvedValue([{ id: 'row-1' }]);
  const onConflict = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing: onConflict });
  const insert = vi.fn().mockReturnValue({ values });
  return { insert } as never;
}

/** Create a mock database where insert throws. */
function makeErrorDatabase(error: Error) {
  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(error),
      }),
    }),
  });
  return { insert } as never;
}

function makeChannel() {
  return { ack: vi.fn(), nack: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('handleIngestMessage — successful DB write', () => {
  it('acks the message after successful insert and analytics', async () => {
    vi.mocked(analyzeAndPersistSample).mockResolvedValue({
      patientId: 'pat-001',
      tier: 'Normal',
      explanation: 'All good',
      assessments: [],
    });

    const channel = makeChannel();
    const db = makeSuccessDatabase();
    await handleIngestMessage(makeMessage(sampleBody()), channel as never, db);

    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
  });
});

describe('handleIngestMessage — DB error on insert', () => {
  it('nacks without requeue when the database throws', async () => {
    const channel = makeChannel();
    const db = makeErrorDatabase(new Error('connection pool exhausted'));

    await handleIngestMessage(makeMessage(sampleBody()), channel as never, db);

    expect(channel.nack).toHaveBeenCalledOnce();
    const [, , requeue] = channel.nack.mock.calls[0]!;
    expect(requeue).toBe(false); // no infinite retry
    expect(channel.ack).not.toHaveBeenCalled();
  });
});

describe('handleIngestMessage — unparseable JSON content', () => {
  it('nacks without requeue immediately, without touching the database', async () => {
    const channel = makeChannel();
    const badMessage = {
      content: Buffer.from('{broken json'),
      fields: {
        routingKey: 'vitals.dev-001',
        deliveryTag: 1,
        exchange: 'vitals',
        redelivered: false,
        consumerTag: 'ct',
      },
      properties: {},
    } as never;
    const db = makeSuccessDatabase();

    await handleIngestMessage(badMessage, channel as never, db);

    expect(channel.nack).toHaveBeenCalledOnce();
    const [, , requeue] = channel.nack.mock.calls[0]!;
    expect(requeue).toBe(false);
    expect(channel.ack).not.toHaveBeenCalled();
    // Database insert should never have been called for unparseable content
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).insert).not.toHaveBeenCalled();
  });
});
