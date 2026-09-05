/**
 * Shared test helpers for integration tests.
 *
 * These tests run against the real local Docker services defined in
 * infra/docker-compose.yml. They are NOT mocked. The whole point of
 * Module 2 is proving the real plumbing works.
 *
 * Prerequisites:
 *   docker compose -f infra/docker-compose.yml up -d postgres rabbitmq
 *   pnpm --filter @vitalguard/api db:migrate
 *   pnpm --filter @vitalguard/api db:seed
 */
import 'dotenv/config';
import amqp from 'amqplib';
import type { ConfirmChannel, Connection } from 'amqplib';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq } from 'drizzle-orm';
import {
  alerts,
  auditLog,
  baselines,
  thresholds,
  vitalReadings,
} from '../../src/schema.js';
import { assertVitalTopology } from '../../src/topology.js';
import type { VitalSample } from '@vitalguard/shared-types';
import { closeRedis, connectRedis, redis } from '../../src/redis.js';

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ?? 'amqp://vitalguard:vitalguard@localhost:5672';
const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://vitalguard:vitalguard@localhost:5432/vitalguard';
const VITALS_EXCHANGE = process.env.VITALS_EXCHANGE ?? 'vitals';
const VITALS_INGEST_QUEUE =
  process.env.RABBITMQ_VITALS_QUEUE ?? 'vitals.ingest';
const VITALS_DEADLETTER_QUEUE =
  process.env.VITALS_DEADLETTER_QUEUE ?? 'vitals.deadletter';

export { VITALS_EXCHANGE, VITALS_INGEST_QUEUE, VITALS_DEADLETTER_QUEUE };

// ─── DB ──────────────────────────────────────────────────────────────────────

let pgClient: ReturnType<typeof postgres> | null = null;
export let testDb: ReturnType<typeof drizzle>;

export function getTestDb() {
  if (!pgClient) {
    pgClient = postgres(DATABASE_URL, { max: 1 });
    testDb = drizzle(pgClient);
  }
  return testDb;
}

export async function closeTestDb(): Promise<void> {
  if (pgClient) {
    await pgClient.end();
    pgClient = null;
  }
}

export async function truncateVitalReadings(): Promise<void> {
  const db = getTestDb();
  // Delete all rows so each test starts clean.
  await db.delete(vitalReadings);
}

export async function resetAnalyticsState(): Promise<void> {
  const db = getTestDb();
  await db.delete(auditLog);
  await db.delete(alerts);
  await db.delete(thresholds);
  await db.delete(baselines);
  await db.delete(vitalReadings);

  await connectRedis();
  const keys = [
    ...(await redis.keys('baseline:window:*')),
    ...(await redis.keys('patient:*')),
  ];
  await redis.del(keys);
}

export async function countVitalReadings(deviceId: string): Promise<number> {
  const db = getTestDb();
  const rows = await db
    .select()
    .from(vitalReadings)
    .where(eq(vitalReadings.deviceId, deviceId));
  return rows.length;
}

export async function getAllVitalReadings(deviceId: string) {
  const db = getTestDb();
  return db
    .select()
    .from(vitalReadings)
    .where(eq(vitalReadings.deviceId, deviceId));
}

export async function getBaselines(patientId: string) {
  const db = getTestDb();
  return db.select().from(baselines).where(eq(baselines.patientId, patientId));
}

export async function getStatusCache(patientId: string) {
  await connectRedis();
  const raw = await redis.get(`patient:${patientId}:status`);
  return raw ? JSON.parse(raw) : null;
}

export async function getBaselineWindowMembers(
  patientId: string,
  vitalType: 'heart_rate' | 'spo2' | 'temperature',
) {
  await connectRedis();
  return redis.zRangeWithScores(
    `baseline:window:${patientId}:${vitalType}`,
    0,
    -1,
  );
}

// ─── AMQP ────────────────────────────────────────────────────────────────────

let rabbitConnection: Connection | null = null;
let testChannel: ConfirmChannel | null = null;

export async function getTestChannel(): Promise<ConfirmChannel> {
  if (!rabbitConnection) {
    rabbitConnection = await amqp.connect(RABBITMQ_URL);
    testChannel = await rabbitConnection.createConfirmChannel();
    await assertVitalTopology(testChannel);
  }
  return testChannel!;
}

export async function closeTestChannel(): Promise<void> {
  if (testChannel) {
    await testChannel.close();
    testChannel = null;
  }
  if (rabbitConnection) {
    await rabbitConnection.close();
    rabbitConnection = null;
  }
}

export async function connectTestRedis(): Promise<void> {
  await connectRedis();
}

export async function closeTestRedis(): Promise<void> {
  await closeRedis();
}

/**
 * Drain all messages currently in a queue (purge), returning count cleared.
 * Used to reset queue state between tests.
 */
export async function purgeQueue(queueName: string): Promise<number> {
  const ch = await getTestChannel();
  const result = await ch.purgeQueue(queueName);
  return result.messageCount;
}

/**
 * Get the next message from a queue with a timeout.
 * Returns null if no message arrives within timeoutMs.
 */
export async function getNextMessage(
  queueName: string,
  timeoutMs = 5000,
): Promise<amqp.GetMessage | null> {
  const ch = await getTestChannel();
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const msg = await ch.get(queueName, { noAck: true });
    if (msg) return msg;
    await new Promise((r) => setTimeout(r, 200));
  }
  return null;
}

// ─── Fixtures ────────────────────────────────────────────────────────────────

export const SEEDED_DEVICE_ID = '00000000-0000-4000-8000-000000000002';
export const SEEDED_PATIENT_ID = '00000000-0000-4000-8000-000000000001';
export const SEEDED_CAREGIVER_ID = '00000000-0000-4000-8000-000000000003';
export const SEEDED_DOCTOR_ID = '00000000-0000-4000-8000-000000000004';

export function makeValidSample(
  overrides: Partial<VitalSample> = {},
): VitalSample {
  return {
    device_id: SEEDED_DEVICE_ID,
    patient_id: SEEDED_PATIENT_ID,
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
    ...overrides,
  };
}
