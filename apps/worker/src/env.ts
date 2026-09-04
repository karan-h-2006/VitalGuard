import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
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
  RABBITMQ_VITALS_QUEUE: z.string().min(1).default('vitals.ingest'),
  VITALS_EXCHANGE: z.string().min(1).default('vitals'),
  VITALS_DEADLETTER_QUEUE: z.string().min(1).default('vitals.deadletter'),
  MQTT_HOST: z.string().min(1).default('localhost'),
  MQTT_PORT: z.coerce.number().int().positive().default(1883),
  MQTT_USERNAME: z.string().min(1).optional(),
  MQTT_PASSWORD: z.string().min(1).optional(),
  MQTT_USE_TLS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  MQTT_VITALS_TOPIC: z.string().min(1).default('HMS/+/vitals'),
  SENTRY_DSN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
}

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    process.stderr.write(
      `Invalid environment for @vitalguard/worker:\n${formatIssues(parsed.error)}\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
