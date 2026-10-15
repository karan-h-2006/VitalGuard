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
  JWT_EXPIRES_IN: z.string().default('1h'),
  ADMIN_JWT_EXPIRES_IN: z.string().default('30m'),
  ALLOW_ADDITIONAL_ADMINS: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  ADMIN_TOTP_ENABLED: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  REQUIRE_PATIENT_CONSENT: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().default('alerts@vitalguard.local'),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60),
  ADMIN_LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(3),
  ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(300),
  WEBSOCKET_POLL_INTERVAL_MS: z.coerce.number().int().min(100).default(500),
  SENTRY_DSN: z.string().min(1).optional(),
  AUTO_PROVISION_SIMULATED_DEVICE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  SIMULATOR_SERVICE_TOKEN: z.string().optional(),
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
