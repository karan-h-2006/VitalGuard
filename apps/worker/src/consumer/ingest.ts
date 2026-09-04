/**
 * INGESTION + ANALYTICS CONSUMER — Module 2 / F.6 + Module 3 / F.8–F.13
 *
 * Responsibility: persist validated vital samples from vitals.ingest into
 * Postgres, then classify each sample (severity tier + explanation).
 *
 * What this module does NOT do (Module 4+):
 *   - Create alert records or dispatch notifications
 *   - Write to audit_log
 *   - Expose severity over HTTP/WebSocket
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import { and, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { vitalReadings } from '../schema.js';
import type { VitalSample } from '@vitalguard/shared-types';
import { logger } from '../logger.js';
import { analyzeAndPersistSample } from '../analytics/service.js';
import { redis } from '../redis.js';

// ─── Fan-out: one VitalSample → up to four vital_readings rows ────────────
//
// The MQTT sample is a single JSON object containing heart_rate, spo2,
// temperature, and motion readings from one device at one instant.
// The vital_readings table normalises these into one row per vital_type.
// The unique constraint (device_id, timestamp, vital_type) is the
// idempotency key: RabbitMQ's at-least-once delivery guarantee means this
// handler may be called twice for the same message (e.g. after a consumer
// crash before the ack). ON CONFLICT DO NOTHING ensures a redelivery
// inserts 0 new rows rather than duplicating the reading.
//
// We choose ON CONFLICT DO NOTHING over DO UPDATE because a redelivered
// message carries identical data — there is nothing to update, and a
// spurious UPDATE would touch the row's storage page unnecessarily.

type NewRow = typeof vitalReadings.$inferInsert;

async function hasUnclassifiedRows(
  sample: VitalSample,
  database: PostgresJsDatabase,
): Promise<boolean> {
  const rows = await database
    .select({ severityTier: vitalReadings.severityTier })
    .from(vitalReadings)
    .where(
      and(
        eq(vitalReadings.deviceId, sample.device_id),
        eq(vitalReadings.timestamp, new Date(sample.timestamp)),
      ),
    );

  return rows.some((row) => row.severityTier === null);
}

function sampleToRows(sample: VitalSample): NewRow[] {
  const base = {
    deviceId: sample.device_id,
    patientId: null,
    timestamp: new Date(sample.timestamp),
    gap: sample.gap,
    severityTier: null,
  } as const;

  return [
    {
      ...base,
      vitalType: 'heart_rate',
      value: String(sample.heart_rate.value),
      qualityFlag: sample.heart_rate.quality,
    },
    {
      ...base,
      vitalType: 'spo2',
      value: String(sample.spo2.value),
      qualityFlag: sample.spo2.quality,
    },
    {
      ...base,
      vitalType: 'temperature',
      value: String(sample.temperature.value),
      // The JSON schema does not include a quality field on temperature.
      // Defaulting to 'clean' mirrors the table column default.
      qualityFlag: 'clean',
    },
    {
      ...base,
      vitalType: 'motion',
      // accel_magnitude is the canonical scalar summary of the motion vector.
      value: String(sample.motion.accel_magnitude),
      qualityFlag: 'clean',
    },
  ] satisfies NewRow[];
}

export async function handleIngestMessage(
  message: ConsumeMessage,
  channel: Channel,
  database: PostgresJsDatabase,
): Promise<void> {
  let sample: VitalSample;

  try {
    sample = JSON.parse(message.content.toString('utf8')) as VitalSample;
  } catch (err) {
    // Should never happen — the bridge already validated the JSON.
    // Nack without requeue so the message doesn't poison the queue forever.
    logger.error(
      { err },
      'consumer received unparseable JSON from vitals.ingest — nacking without requeue',
    );
    channel.nack(message, false, false);
    return;
  }

  const rows = sampleToRows(sample);

  try {
    // Insert all four rows in one statement. ON CONFLICT DO NOTHING means
    // a redelivery of the same sample is a safe no-op (idempotent).
    const inserted = await database
      .insert(vitalReadings)
      .values(rows)
      .onConflictDoNothing({
        target: [
          vitalReadings.deviceId,
          vitalReadings.timestamp,
          vitalReadings.vitalType,
        ],
      })
      .returning({ id: vitalReadings.id });

    if (
      inserted.length === 0 &&
      !(await hasUnclassifiedRows(sample, database))
    ) {
      channel.ack(message);
      logger.info(
        {
          deviceId: sample.device_id,
          timestamp: sample.timestamp,
        },
        'duplicate sample redelivery — skipped analytics',
      );
      return;
    }

    try {
      const analytics = await analyzeAndPersistSample(sample, database, redis);

      // Ack only after the DB write and analytics persistence are both durable.
      channel.ack(message);

      logger.info(
        {
          deviceId: sample.device_id,
          patientId: analytics.patientId,
          timestamp: sample.timestamp,
          severityTier: analytics.tier,
        },
        'ingested and classified vital sample',
      );
    } catch (err) {
      // The raw rows already exist, but their severity is still NULL. Requeue
      // to retry transient Redis/analytics failures; the baseline ZSET member
      // is deterministic, so retrying does not double-count this sample.
      logger.error(
        { err, deviceId: sample.device_id, timestamp: sample.timestamp },
        'analytics failed for an unclassified sample — requeueing for retry',
      );
      channel.nack(message, false, true);
    }
  } catch (err) {
    // A genuine DB error (constraint violation beyond our unique key,
    // connection drop, etc.). Nack without requeue: the message already
    // passed schema validation so re-queuing won't fix a DB error, and
    // looping on a poison message would stall the consumer.
    logger.error(
      { err, deviceId: sample.device_id, timestamp: sample.timestamp },
      'sample persistence or analytics failed — nacking without requeue',
    );
    channel.nack(message, false, false);
  }
}
