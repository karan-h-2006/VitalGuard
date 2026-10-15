import Fastify from 'fastify';
import { db, type Database } from './db/client.js';
import { env } from './env.js';
import { registerAuthRoutes } from './features/auth/routes.js';
import { registerDashboardRoutes } from './features/dashboard/routes.js';
import { registerHealthRoutes } from './features/health/routes.js';
import { registerPatientRoutes } from './features/patients/routes.js';
import { registerAdminGovernanceRoutes } from './features/governance/admin-routes.js';
import { registerDeviceRoutes } from './features/devices/routes.js';
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

  app.removeContentTypeParser('application/json');
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_request, body, done) => {
      const rawBody = typeof body === 'string' ? body : body.toString('utf8');
      if (rawBody.trim() === '') {
        done(null, undefined);
        return;
      }
      try {
        done(null, JSON.parse(rawBody));
      } catch (error) {
        const parseError = error as Error & {
          statusCode: number;
          code: string;
        };
        parseError.statusCode = 400;
        parseError.code = 'FST_ERR_CTP_INVALID_JSON_BODY';
        done(parseError);
      }
    },
  );

  app.decorate('database', database);
  registerErrorHandler(app);
  await app.register(authPlugin);
  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerPatientRoutes(app);
  await registerAdminGovernanceRoutes(app);
  await registerDeviceRoutes(app);
  await registerDashboardRoutes(app);

  return app;
}
