import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../../env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import { scriptLogger } from './script-logger.js';

const client = postgres(env.DATABASE_URL, { max: 1 });
const database = drizzle(client);

try {
  await migrate(database, { migrationsFolder: 'src/db/migrations' });
  scriptLogger.info('database migrations applied');
} finally {
  await client.end();
}
