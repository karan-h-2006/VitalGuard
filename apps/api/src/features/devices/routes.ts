import crypto from 'node:crypto';
import { and, eq, isNotNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { devices } from '../../db/schema.js';
import { env } from '../../env.js';
import { requireAssociation } from '../../plugins/auth.js';

const uuid = z.string().uuid();

export async function registerDeviceRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get('/internal/simulated-devices', async (request, reply) => {
    const configuredToken = env.SIMULATOR_SERVICE_TOKEN;
    if (!configuredToken) {
      app.log.error('SIMULATOR_SERVICE_TOKEN is not configured');
      return reply.code(503).send({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Simulator service token not configured',
      });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing simulator service token',
      });
    }

    const providedToken = authHeader.slice(7).trim();

    const tokenBuffer = Buffer.from(providedToken, 'utf8');
    const configuredBuffer = Buffer.from(configuredToken, 'utf8');

    let matches = false;
    if (tokenBuffer.length === configuredBuffer.length) {
      matches = crypto.timingSafeEqual(tokenBuffer, configuredBuffer);
    } else {
      crypto.timingSafeEqual(tokenBuffer, tokenBuffer);
    }

    if (!matches) {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing simulator service token',
      });
    }

    const rows = await app.database
      .select({
        deviceId: devices.id,
        patientId: devices.patientId,
        scenario: devices.simScenario,
      })
      .from(devices)
      .where(
        and(
          eq(devices.isSimulated, true),
          eq(devices.registrationStatus, 'registered'),
          isNotNull(devices.patientId),
        ),
      );

    return reply.code(200).send(
      rows.map((row) => ({
        deviceId: row.deviceId,
        patientId: row.patientId!,
        scenario: row.scenario ?? 'normal',
      })),
    );
  });

  app.get(
    '/patients/:patientId/device',
    { preHandler: [app.authenticate, requireAssociation()] },
    async (request, reply) => {
      const params = z.object({ patientId: uuid }).safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({
          code: 'INVALID_ID',
          message: 'invalid patient id',
        });
      }

      const [device] = await app.database
        .select({
          id: devices.id,
          patientId: devices.patientId,
          registrationStatus: devices.registrationStatus,
          isSimulated: devices.isSimulated,
          simScenario: devices.simScenario,
          createdAt: devices.createdAt,
        })
        .from(devices)
        .where(
          and(
            eq(devices.patientId, params.data.patientId),
            eq(devices.registrationStatus, 'registered'),
          ),
        )
        .limit(1);

      if (!device) {
        return reply.code(404).send({
          code: 'DEVICE_NOT_FOUND',
          message: 'device not found for patient',
        });
      }

      return reply.code(200).send(device);
    },
  );
}
