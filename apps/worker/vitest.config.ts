import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Integration tests require live Docker services and are gated by the
    // RUN_INTEGRATION_TESTS env flag so they never run accidentally in CI
    // without the right infra.
    include: ['test/**/*.test.ts'],
    globals: false,
    setupFiles: ['test/setup-env.ts'],
    // Increase timeout for real DB + AMQP round trips.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Run tests in this file sequentially to avoid queue/DB race conditions.
    sequence: { concurrent: false },
  },
});
