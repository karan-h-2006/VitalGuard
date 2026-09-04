import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env.js';

/**
 * Single shared Drizzle/postgres connection for the worker process.
 * The consumer uses this to upsert vital_readings rows.
 * The API has its own connection in apps/api/src/db/ — they share the
 * same schema definitions but run in separate processes.
 */
const client = postgres(env.DATABASE_URL, {
  // One connection is enough for a single-threaded consumer.
  // Scale up if we ever run multiple concurrent consumer coroutines.
  max: 1,
});

export const db = drizzle(client);

export async function closeDb(): Promise<void> {
  await client.end();
}
