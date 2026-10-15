import amqp from 'amqplib';
import { handleIngestMessage } from './ingest.js';
import { db, closeDb } from '../db.js';
import { env } from '../env.js';
import { logger } from '../logger.js';
import { assertVitalTopology } from '../topology.js';
import { closeRedis, connectRedis } from '../redis.js';
import { startEscalationChecker } from '../alerting/escalation.js';

export type PipelineHandle = {
  shutdown(signal: string): Promise<void>;
  isHealthy(): boolean;
};

type AmqpConnection = Awaited<ReturnType<typeof amqp.connect>>;

export async function startIngestConsumer(): Promise<PipelineHandle> {
  let rabbitConnection: AmqpConnection | null = null;
  let channel: amqp.Channel | null = null;
  let isShuttingDown = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  await connectRedis();
  const stopEscalationChecker = startEscalationChecker(db);

  async function connectAndConsume(): Promise<void> {
    if (isShuttingDown) return;
    try {
      const conn = await amqp.connect(env.RABBITMQ_URL);
      conn.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ consumer connection error');
      });
      conn.on('close', () => {
        channel = null;
        rabbitConnection = null;
        if (!isShuttingDown) {
          logger.warn(
            'RabbitMQ consumer connection closed; scheduling reconnect in 2s',
          );
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            void connectAndConsume();
          }, 2000);
        }
      });

      const ch = await conn.createChannel();
      ch.on('error', (err) => {
        logger.error({ err }, 'RabbitMQ consumer channel error');
      });
      ch.on('close', () => {
        channel = null;
      });

      await assertVitalTopology(ch);
      ch.prefetch(1);

      await ch.consume(env.RABBITMQ_VITALS_QUEUE, (message) => {
        if (message === null) {
          logger.warn(
            'vitals.ingest consumer was cancelled by RabbitMQ broker',
          );
          return;
        }
        void handleIngestMessage(message, ch, db).catch((err: unknown) => {
          logger.error(
            { err },
            'unhandled error in handleIngestMessage — this is a bug',
          );
        });
      });

      rabbitConnection = conn;
      channel = ch;
      logger.info(
        { queue: env.RABBITMQ_VITALS_QUEUE },
        'ingestion consumer connected and consuming',
      );
    } catch (err) {
      channel = null;
      rabbitConnection = null;
      if (!isShuttingDown) {
        logger.warn(
          { err },
          'Failed to connect consumer to RabbitMQ; retrying in 2s',
        );
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          void connectAndConsume();
        }, 2000);
      }
    }
  }

  await connectAndConsume();

  return {
    isHealthy(): boolean {
      return !isShuttingDown && channel !== null;
    },
    async shutdown(signal: string): Promise<void> {
      isShuttingDown = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      logger.info({ signal }, 'ingestion consumer shutting down');
      stopEscalationChecker();
      if (channel) {
        try {
          await channel.close();
        } catch (err) {
          logger.debug({ err }, 'error closing channel on shutdown');
        }
      }
      if (rabbitConnection) {
        try {
          await rabbitConnection.close();
        } catch (err) {
          logger.debug({ err }, 'error closing rabbit connection on shutdown');
        }
      }
      await closeRedis();
      await closeDb();
    },
  };
}
