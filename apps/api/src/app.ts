import Fastify from 'fastify';
import { db, type Database } from './db/client.js';
import { env } from './env.js';
import { registerAuthRoutes } from './features/auth/routes.js';
import { registerHealthRoutes } from './features/health/routes.js';
import { registerPatientRoutes } from './features/patients/routes.js';
import { authPlugin } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/error-handler.js';

export async function buildApp(database: Database = db) {
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

  app.decorate('database', database);
  registerErrorHandler(app);
  await app.register(authPlugin);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPatientRoutes(app);

  return app;
}
