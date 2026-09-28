import amqp from 'amqplib';
import { handleIngestMessage } from './ingest.js';
import { db, closeDb } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { assertVitalTopology } from '../topology.js';
import { closeRedis, connectRedis } from '../redis.js';
import { startEscalationChecker } from '../alerting/escalation.js';

type PipelineHandle = {
  shutdown(signal: string): Promise<void>;
};

export async function startIngestConsumer(): Promise<PipelineHandle> {
  const rabbitConnection = await amqp.connect(env.RABBITMQ_URL);
  const channel = await rabbitConnection.createChannel();
  await connectRedis();
  await assertVitalTopology(channel);
  const stopEscalationChecker = startEscalationChecker(db);

  channel.prefetch(1);

  await channel.consume(env.RABBITMQ_VITALS_QUEUE, (message) => {
    if (message === null) {
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

  logger.info(
    { queue: env.RABBITMQ_VITALS_QUEUE },
    'ingestion consumer started',
  );

  return {
    async shutdown(signal: string): Promise<void> {
      logger.info({ signal }, 'ingestion consumer shutting down');
      stopEscalationChecker();
      await channel.close();
      await rabbitConnection.close();
      await closeRedis();
      await closeDb();
    },
  };
}
