import { and, eq } from 'drizzle-orm';
import type { FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import type { Database } from '../db/client.js';
import { associationCaregivers, associations } from '../db/schema.js';
import type { AuthUser } from '../auth/tokens.js';
import { verifyToken } from '../auth/tokens.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: AuthUser;
  }
  interface FastifyInstance {
    database: Database;
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('authUser', null as unknown as AuthUser);
  app.decorate('authenticate', async (request, reply) => {
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      await reply.code(401).send({ message: 'authentication required' });
      return;
    }
    try {
      request.authUser = await verifyToken(
        authorization.slice('Bearer '.length),
      );
    } catch {
      await reply.code(401).send({ message: 'invalid or expired token' });
    }
  });
});

/**
 * Pure decision function extracted from requireAssociation for unit testing.
 * Determines access given the DB look-up result. No I/O; behavior is identical
 * to the inline logic it replaced.
 */
export function decideRbacAccess(
  role: AuthUser['role'],
  requestingUserId: string,
  targetPatientId: string,
  associationExists: boolean,
): boolean {
  if (role === 'administrator') return true;
  if (role === 'patient') return requestingUserId === targetPatientId;
  if (role === 'doctor' || role === 'caregiver') return associationExists;
  return false;
}

export function requireAssociation(patientIdParam = 'patientId') {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const patientId = (request.params as Record<string, string>)[
      patientIdParam
    ] as string;
    const { authUser } = request;
    if (
      authUser.role === 'administrator' ||
      (authUser.role === 'patient' && authUser.userId === patientId)
    )
      return;
    const relation =
      authUser.role === 'doctor'
        ? await request.server.database
            .select({ patientId: associations.patientId })
            .from(associations)
            .where(
              and(
                eq(associations.patientId, patientId),
                eq(associations.doctorId, authUser.userId),
              ),
            )
            .limit(1)
        : authUser.role === 'caregiver'
          ? await request.server.database
              .select({ patientId: associationCaregivers.patientId })
              .from(associationCaregivers)
              .where(
                and(
                  eq(associationCaregivers.patientId, patientId),
                  eq(associationCaregivers.caregiverId, authUser.userId),
                ),
              )
              .limit(1)
          : [];
    if (
      !decideRbacAccess(
        authUser.role,
        authUser.userId,
        patientId,
        relation.length > 0,
      )
    ) {
      await reply
        .code(403)
        .send({ message: 'not authorized for this patient' });
    }
  };
}

export function requireRoles(...roles: AuthUser['role'][]) {
  return async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    if (!roles.includes(request.authUser.role))
      await reply.code(403).send({ message: 'insufficient role' });
  };
}
