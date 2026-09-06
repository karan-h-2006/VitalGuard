import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
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
    BASELINE_WINDOW_DAYS: z.coerce.number().int().positive().default(7),
    BASELINE_MIN_SAMPLES: z.coerce.number().int().positive().default(20),
    ANOMALY_MILD_Z_THRESHOLD: z.coerce.number().positive().default(1.5),
    ANOMALY_MODERATE_Z_THRESHOLD: z.coerce.number().positive().default(2),
    Z_SCORE_STDDEV_FLOOR: z.coerce.number().positive().default(0.01),
    HEART_RATE_THRESHOLD_MIN: z.coerce.number().default(60),
    HEART_RATE_THRESHOLD_MAX: z.coerce.number().default(100),
    SPO2_THRESHOLD_MIN: z.coerce.number().default(95),
    TEMPERATURE_THRESHOLD_MIN: z.coerce.number().default(36.1),
    TEMPERATURE_THRESHOLD_MAX: z.coerce.number().default(37.5),
    TREND_SAMPLE_COUNT: z.coerce.number().int().positive().default(10),
    TREND_LOOKAHEAD_MINUTES: z.coerce.number().positive().default(30),
    CORRELATION_CONCURRENCY_MINUTES: z.coerce.number().positive().default(30),
    ALERT_ACK_SLA_MINUTES: z.coerce.number().positive().default(5),
    ALERT_ESCALATION_POLL_INTERVAL_SECONDS: z.coerce
      .number()
      .positive()
      .default(30),
    RESEND_API_KEY: z.string().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().email().default('alerts@vitalguard.local'),
    TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
    TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
    TWILIO_FROM_PHONE: z.string().min(1).optional(),
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
  })
  .superRefine((value, context) => {
    if (value.ANOMALY_MODERATE_Z_THRESHOLD <= value.ANOMALY_MILD_Z_THRESHOLD) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ANOMALY_MODERATE_Z_THRESHOLD'],
        message: 'must be greater than ANOMALY_MILD_Z_THRESHOLD',
      });
    }
    if (value.HEART_RATE_THRESHOLD_MAX <= value.HEART_RATE_THRESHOLD_MIN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['HEART_RATE_THRESHOLD_MAX'],
        message: 'must be greater than HEART_RATE_THRESHOLD_MIN',
      });
    }
    if (value.TEMPERATURE_THRESHOLD_MAX <= value.TEMPERATURE_THRESHOLD_MIN) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['TEMPERATURE_THRESHOLD_MAX'],
        message: 'must be greater than TEMPERATURE_THRESHOLD_MIN',
      });
    }
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
