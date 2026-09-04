/**
 * INGESTION CONSUMER — Module 2 / F.6
 *
 * Responsibility: persist validated vital samples from vitals.ingest into
 * Postgres. This is INTENTIONALLY a raw-storage consumer only.
 *
 * What this module does NOT do (Module 3 will add these):
 *   - Compute severity tiers (Normal/Watch/Warning/Critical)
 *   - Calculate baselines or Z-scores
 *   - Evaluate correlation rules or multi-vital conditions
 *   - Write to the alerts or audit_log tables
 *
 * Module 3 (Karan's analytics engine) should:
 *   a) Either extend this consumer to call analytics after the DB write, OR
 *   b) Run a second consumer on the same vitals.ingest queue (a separate
 *      binding or a fan-out exchange) for analytics — cleaner separation.
 *   The current consumer leaves severity_tier = NULL, which is the explicit
 *   signal that no classification has happened yet.
 */

import type { Channel, ConsumeMessage } from 'amqplib';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { vitalReadings } from '../schema.js';
import type { VitalSample } from '@vitalguard/shared-types';
import { logger } from '../logger.js';

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

function sampleToRows(sample: VitalSample): NewRow[] {
  const base = {
    deviceId: sample.device_id,
    // patient_id comes from the device registration lookup in Module 3.
    // Until then we leave it null — the FK is nullable for this exact reason.
    patientId: null,
    timestamp: new Date(sample.timestamp),
    gap: sample.gap,
    // severity_tier is intentionally null — Module 3 classifies readings.
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
      // Defaulting to 'clean' mirrors the table column default and avoids
      // a NOT NULL violation; Module 3 may refine this with sensor metadata.
      qualityFlag: 'clean',
    },
    {
      ...base,
      vitalType: 'motion',
      // accel_magnitude is the canonical scalar summary of the motion vector.
      // roll/pitch/fall_detected are not stored as separate vital_readings
      // rows at this stage; Module 3 or a dedicated motion table can do that.
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
    await database
      .insert(vitalReadings)
      .values(rows)
      .onConflictDoNothing({
        target: [
          vitalReadings.deviceId,
          vitalReadings.timestamp,
          vitalReadings.vitalType,
        ],
      });

    // Ack only after a confirmed, durable DB write.
    channel.ack(message);

    logger.info(
      { deviceId: sample.device_id, timestamp: sample.timestamp },
      'ingested vital sample (4 rows upserted)',
    );
  } catch (err) {
    // A genuine DB error (constraint violation beyond our unique key,
    // connection drop, etc.). Nack without requeue: the message already
    // passed schema validation so re-queuing won't fix a DB error, and
    // looping on a poison message would stall the consumer.
    logger.error(
      { err, deviceId: sample.device_id, timestamp: sample.timestamp },
      'DB write failed for vital sample — nacking without requeue',
    );
    channel.nack(message, false, false);
  }
}
