import type { FastifyError, FastifyInstance } from 'fastify';

function statusFrom(error: FastifyError): number {
  return error.statusCode ?? 500;
}

/**
 * Last-resort handler so uncaught route errors become structured logs and a
 * consistent JSON body instead of Fastify's default HTML-ish dump.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = statusFrom(error);
    request.log.error({ err: error, statusCode }, 'request failed');

    const message =
      statusCode >= 500 && envIsProduction()
        ? 'Internal Server Error'
        : error.message;

    void reply.status(statusCode).send({ message });
  });
}

function envIsProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
