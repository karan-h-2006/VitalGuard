import amqp from 'amqplib';
import { env } from './env.js';
import { logger } from './logger.js';

export type BrokerConnection = Awaited<ReturnType<typeof amqp.connect>>;

/**
 * Opens a connection and a channel, then stops.
 *
 * The broker is at-least-once: when Phase 1 adds consumers, every handler
 * must be idempotent (same delivery processed twice must not double-alert).
 * We do not consume yet — connectivity is the only Phase 0 concern.
 */
export async function connectBroker(): Promise<BrokerConnection> {
  const connection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await connection.createChannel();
  await channel.close();

  logger.info(
    { queue: env.RABBITMQ_VITALS_QUEUE },
    'RabbitMQ connection healthy',
  );

  return connection;
}
