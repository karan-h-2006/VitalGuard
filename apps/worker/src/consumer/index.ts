/**
 * Ingestion consumer entry point.
 * Connects to Postgres and RabbitMQ, asserts the vitals topology,
 * then starts consuming from vitals.ingest.
 *
 * Run with:
 *   pnpm --filter @vitalguard/worker consumer
 */
import amqp from 'amqplib';
import { handleIngestMessage } from './ingest.js';
import { db, closeDb } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { assertVitalTopology } from '../topology.js';
import { closeRedis, connectRedis } from '../redis.js';

const rabbitConnection = await amqp.connect(env.RABBITMQ_URL);
const channel = await rabbitConnection.createChannel();
await connectRedis();
await assertVitalTopology(channel);

// prefetch(1) = at most one unacknowledged message in-flight per consumer.
// This prevents one slow DB write from starving the queue, and means
// RabbitMQ will redeliver to another consumer instance on crash rather
// than losing the message. Increase if throughput benchmarking shows
// the DB can handle batches safely.
channel.prefetch(1);

await channel.consume(env.RABBITMQ_VITALS_QUEUE, (message) => {
  if (message === null) {
    // null means the consumer was cancelled by the broker (e.g. queue deleted).
    logger.warn('vitals.ingest consumer was cancelled by RabbitMQ broker');
    return;
  }
  void handleIngestMessage(message, channel, db).catch((err: unknown) => {
    logger.error(
      { err },
      'unhandled error in handleIngestMessage — this is a bug',
    );
  });
});

logger.info({ queue: env.RABBITMQ_VITALS_QUEUE }, 'ingestion consumer started');

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'ingestion consumer shutting down');
  try {
    await channel.close();
    await rabbitConnection.close();
    await closeRedis();
    await closeDb();
  } finally {
    process.exit(0);
  }
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
