import Fastify from 'fastify';
import { env } from './env.js';
import { registerHealthRoutes } from './features/health/routes.js';
import { registerErrorHandler } from './plugins/error-handler.js';

export async function buildApp() {
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
      ...(env.NODE_ENV === 'development'
        ? {
            transport: {
              target: 'pino-pretty',
              options: { colorize: true },
            },
          }
        : {}),
    },
  });

  // TODO(phase-1): register auth from ./plugins/auth.ts here so every
  // non-public route is authenticated by default.

  registerErrorHandler(app);
  await registerHealthRoutes(app);

  return app;
}
