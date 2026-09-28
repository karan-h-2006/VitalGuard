import { startMqttBridge } from './bridge/start.js';
import { startIngestConsumer } from './consumer/start.js';
import { env } from './env.js';
import { logger } from './logger.js';
import { startWeeklyReportsJob } from './reports.js';

const [bridge, consumer] = await Promise.all([
  startMqttBridge(),
  startIngestConsumer(),
]);

startWeeklyReportsJob();

logger.info(
  { env: env.NODE_ENV },
  'worker started (MQTT bridge, ingest consumer, weekly reports)',
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  await Promise.allSettled([
    bridge.shutdown(signal),
    consumer.shutdown(signal),
  ]);
  process.exit(0);
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});
process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});
