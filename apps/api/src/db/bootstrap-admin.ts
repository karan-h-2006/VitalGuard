import { eq } from 'drizzle-orm';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { hashPassword } from '../auth/passwords.js';
import { env } from '../env.js';
import { users } from './schema.js';

const email = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase();
const password = process.env.INITIAL_ADMIN_PASSWORD;
if (!email || !password) throw new Error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD are required to bootstrap an administrator');
const client = postgres(env.DATABASE_URL, { max: 1 });
try {
  const database = drizzle(client);
  const existing = await database.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length) throw new Error('an account with INITIAL_ADMIN_EMAIL already exists');
  await database.insert(users).values({ email, role: 'administrator', passwordHash: await hashPassword(password) });
  console.log(`created administrator ${email}; remove INITIAL_ADMIN_PASSWORD from the environment now`);
} finally { await client.end(); }
