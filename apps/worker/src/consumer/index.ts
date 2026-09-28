/**
 * Ingestion consumer entry point.
 * Connects to Postgres and RabbitMQ, asserts the vitals topology,
 * then starts consuming from vitals.ingest.
 *
 * Run with:
 *   pnpm --filter @vitalguard/worker consumer
 */
import { startIngestConsumer } from './start.js';

const runtime = await startIngestConsumer();

async function shutdown(signal: string): Promise<void> {
  await runtime.shutdown(signal);
  process.exit(0);
}

process.once('SIGINT', () => {
  void shutdown('SIGINT');
});
process.once('SIGTERM', () => {
  void shutdown('SIGTERM');
});
