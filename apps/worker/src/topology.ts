import type { Channel } from 'amqplib';
import { env } from './env.js';

/**
 * Topic `vitals.*` matches a single word after `vitals.`, including a device
 * UUID. Dead-letter traffic must use a different first token so it cannot
 * also land on the ingest queue.
 */
export const SAMPLE_ROUTING_KEY_PREFIX = 'vitals.';
export const DEADLETTER_ROUTING_KEY = 'deadletter.vitals';

/**
 * MVP topology routes all device keys through one durable ingest queue.
 * Horizontal sharding by patient_id across queues/consumer groups is a later
 * scaling concern; it would not improve correctness at the current volume.
 */
export async function assertVitalTopology(channel: Channel): Promise<void> {
  await channel.assertExchange(env.VITALS_EXCHANGE, 'topic', { durable: true });
  await channel.assertQueue(env.RABBITMQ_VITALS_QUEUE, { durable: true });
  await channel.assertQueue(env.VITALS_DEADLETTER_QUEUE, { durable: true });
  await channel.bindQueue(
    env.RABBITMQ_VITALS_QUEUE,
    env.VITALS_EXCHANGE,
    'vitals.*',
  );
  await channel.bindQueue(
    env.VITALS_DEADLETTER_QUEUE,
    env.VITALS_EXCHANGE,
    DEADLETTER_ROUTING_KEY,
  );
}
