import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '../env.js';
import * as schema from './schema.js';

export type Database = ReturnType<typeof createDatabase>;

export function createDatabase() {
  const client = postgres(env.DATABASE_URL, { max: 10 });
  return drizzle(client, { schema });
}

export const db = createDatabase();
