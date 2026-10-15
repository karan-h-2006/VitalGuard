import http from 'node:http';
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

const healthServer = http.createServer((req, res) => {
  if (req.url === '/healthz' || req.url === '/health') {
    const bridgeOk = bridge.isHealthy();
    const consumerOk = consumer.isHealthy();
    if (bridgeOk && consumerOk) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', bridge: true, consumer: true }));
    } else {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'degraded',
          bridge: bridgeOk,
          consumer: consumerOk,
        }),
      );
    }
  } else {
    res.writeHead(404);
    res.end();
  }
});

healthServer.listen(8081, '0.0.0.0');

logger.info(
  { env: env.NODE_ENV },
  'worker started (MQTT bridge, ingest consumer, weekly reports)',
);

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, 'worker shutting down');
  healthServer.close();
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
