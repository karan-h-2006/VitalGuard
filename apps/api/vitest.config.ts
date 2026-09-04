import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      PORT: '3000',
      LOG_LEVEL: 'silent',
      DATABASE_URL:
        'postgresql://vitalguard:vitalguard@localhost:5432/vitalguard',
      REDIS_URL: 'redis://localhost:6379',
      RABBITMQ_URL: 'amqp://vitalguard:vitalguard@localhost:5672',
      CORS_ORIGIN: 'http://localhost:5173',
      JWT_SECRET: 'test-only-placeholder-not-a-real-secret',
    },
  },
});
