/**
 * Unit tests — Module 2 Consumer ack/nack decision & Device Verification
 * Database, analytics, and Redis are all mocked. No live services needed.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// vi.mock calls are hoisted automatically — env vars from setup-env.ts are in place.
vi.mock('../../src/analytics/service.js', () => ({
  analyzeAndPersistSample: vi.fn(),
}));

const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
  },
}));

vi.mock('../../src/redis.js', () => ({
  redis: mockRedis,
  connectRedis: vi.fn(),
  closeRedis: vi.fn(),
}));

import {
  handleIngestMessage,
  verifyDeviceOwnership,
} from '../../src/consumer/ingest.js';
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
function sampleBody(
  overrides: Partial<ReturnType<typeof sampleBodyDefault>> = {},
) {
  return {
    ...sampleBodyDefault(),
    ...overrides,
  };
}

function sampleBodyDefault() {
  return {
    device_id: 'dev-001',
    patient_id: 'pat-001',
    timestamp: '2026-01-01T00:00:00.000Z',
    heart_rate: { value: 72, unit: 'bpm', quality: 'clean' },
    spo2: { value: 98, unit: 'percent', quality: 'clean' },
    temperature: { value: 36.8, unit: 'celsius' },
    motion: { roll: 0, pitch: 0, accel_magnitude: 9.81 },
    gap: false,
  };
}

/** Create a mock database where device is registered and insert succeeds. */
function makeSuccessDatabase(
  deviceRow: { patientId: string | null; registrationStatus: string } | null = {
    patientId: 'pat-001',
    registrationStatus: 'registered',
  },
) {
  const limit = vi.fn().mockResolvedValue(deviceRow ? [deviceRow] : []);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const returning = vi.fn().mockResolvedValue([{ id: 'row-1' }]);
  const onConflict = vi.fn().mockReturnValue({ returning });
  const values = vi.fn().mockReturnValue({ onConflictDoNothing: onConflict });
  const insert = vi.fn().mockReturnValue({ values });
  return { select, insert } as never;
}

/** Create a mock database where insert throws. */
function makeErrorDatabase(error: Error) {
  const selectResult = [
    { patientId: 'pat-001', registrationStatus: 'registered' },
  ];
  const limit = vi.fn().mockResolvedValue(selectResult);
  const where = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where });
  const select = vi.fn().mockReturnValue({ from });

  const insert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(error),
      }),
    }),
  });
  return { select, insert } as never;
}

function makeChannel() {
  return { ack: vi.fn(), nack: vi.fn(), publish: vi.fn() };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRedis.get.mockResolvedValue(null);
  mockRedis.set.mockResolvedValue('OK');
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
    expect(channel.publish).not.toHaveBeenCalled();
  });
});

describe('handleIngestMessage — device verification & deadlettering', () => {
  it('routes to deadletter and acks when device is not found or unregistered', async () => {
    const channel = makeChannel();
    const db = makeSuccessDatabase(null); // device not found

    await handleIngestMessage(makeMessage(sampleBody()), channel as never, db);

    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledOnce();
    const [, routingKey, content, options] = channel.publish.mock.calls[0]!;
    expect(routingKey).toBe('deadletter.vitals');
    expect(options.headers['x-rejection-reason']).toBe('DEVICE_UNREGISTERED');
    const parsed = JSON.parse(content.toString('utf8'));
    expect(parsed.rejection_reason).toBe('DEVICE_UNREGISTERED');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).insert).not.toHaveBeenCalled();
  });

  it('routes to deadletter and acks when sample patient_id mismatches device patient_id', async () => {
    const channel = makeChannel();
    const db = makeSuccessDatabase({
      patientId: 'other-patient',
      registrationStatus: 'registered',
    });

    await handleIngestMessage(
      makeMessage(sampleBody({ patient_id: 'pat-001' })),
      channel as never,
      db,
    );

    expect(channel.ack).toHaveBeenCalledOnce();
    expect(channel.nack).not.toHaveBeenCalled();
    expect(channel.publish).toHaveBeenCalledOnce();
    const [, routingKey, , options] = channel.publish.mock.calls[0]!;
    expect(routingKey).toBe('deadletter.vitals');
    expect(options.headers['x-rejection-reason']).toBe(
      'DEVICE_PATIENT_MISMATCH',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).insert).not.toHaveBeenCalled();
  });

  it('uses redis cache when present and avoids querying db', async () => {
    mockRedis.get.mockResolvedValue(
      JSON.stringify({ patientId: 'pat-001', status: 'registered' }),
    );
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((db as any).select).not.toHaveBeenCalled();
  });

  it('verifyDeviceOwnership returns valid when device and patient match', async () => {
    const db = makeSuccessDatabase({
      patientId: 'pat-123',
      registrationStatus: 'registered',
    });
    const res = await verifyDeviceOwnership(
      'dev-123',
      'pat-123',
      db,
      mockRedis as never,
    );
    expect(res).toEqual({ valid: true, patientId: 'pat-123' });
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
