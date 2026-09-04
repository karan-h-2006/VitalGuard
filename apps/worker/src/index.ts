import { connectBroker } from './broker.js';
import { env } from './env.js';
import { logger } from './logger.js';

const connection = await connectBroker();

logger.info({ env: env.NODE_ENV }, 'worker started (no consumers yet)');

// TODO(phase-1): subscribe to RABBITMQ_VITALS_QUEUE with an idempotent
// handler (at-least-once delivery). Do not ack until the write is durable.

function shutdown(signal: string): void {
  logger.info({ signal }, 'worker shutting down');
  void connection.close().finally(() => {
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
