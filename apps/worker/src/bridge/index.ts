import { startMqttBridge } from './start.js';

const runtime = await startMqttBridge();

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
