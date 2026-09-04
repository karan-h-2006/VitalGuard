import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().int().positive(),
  LOG_LEVEL: z.enum([
    'fatal',
    'error',
    'warn',
    'info',
    'debug',
    'trace',
    'silent',
  ]),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  RABBITMQ_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  SENTRY_DSN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

/**
 * Fail the process immediately if configuration is incomplete.
 * Importing this module is the gate: missing vars never become mysterious
 * runtime failures three hops into a request.
 */
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    process.stderr.write(
      `Invalid environment for @vitalguard/api:\n${formatIssues(parsed.error)}\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
