import { count, eq } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  adminAuditLog,
  associations,
  doctorProfiles,
  users,
} from '../../db/schema.js';
import { requireRoles } from '../../plugins/auth.js';
import { notifyAdmins } from './notifications.js';
import { formatAvailability } from './availability.js';

const availabilityBody = z.object({
  status: z.enum(['available', 'unavailable']).optional(),
  note: z.string().max(200).nullable().optional(),
  unavailableUntil: z.string().datetime().nullable().optional(),
});

export async function registerDoctorAvailabilityRoutes(
  app: FastifyInstance,
): Promise<void> {
  const approvedDoctorGuard = [
    app.authenticate,
    requireRoles('doctor' as const),
    async (request: FastifyRequest, reply: FastifyReply) => {
      const [profile] = await app.database
        .select({ status: doctorProfiles.status })
        .from(doctorProfiles)
        .where(eq(doctorProfiles.userId, request.authUser.userId))
        .limit(1);
      if (!profile || profile.status !== 'approved')
        return reply.code(403).send({
          code: 'DOCTOR_NOT_APPROVED',
          message: 'only approved doctors can manage availability',
        });
    },
  ];

  app.get(
    '/doctors/me/availability',
    { preHandler: approvedDoctorGuard },
    async (request, reply) => {
      const [profile] = await app.database
        .select()
        .from(doctorProfiles)
        .where(eq(doctorProfiles.userId, request.authUser.userId))
        .limit(1);
      if (!profile)
        return reply
          .code(404)
          .send({
            code: 'DOCTOR_NOT_FOUND',
            message: 'doctor profile not found',
          });
      return formatAvailability(profile);
    },
  );

  app.patch(
    '/doctors/me/availability',
    { preHandler: approvedDoctorGuard },
    async (request, reply) => {
      const body = availabilityBody.safeParse(request.body ?? {});
      if (!body.success)
        return reply.code(400).send({
          code: 'INVALID_AVAILABILITY',
          message:
            body.error.issues[0]?.message ?? 'invalid availability update',
        });

      const { status, note, unavailableUntil } = body.data;

      // Validate unavailableUntil is in the future when set
      if (unavailableUntil) {
        const until = new Date(unavailableUntil);
        if (until <= new Date())
          return reply.code(400).send({
            code: 'INVALID_UNTIL_DATE',
            message: 'unavailableUntil must be in the future',
          });
      }

      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, request.authUser.userId))
          .limit(1);
        if (!before) return { error: 'NOT_FOUND' as const };

        const nextStatus = status ?? before.availabilityStatus;
        const nextNote = note !== undefined ? note : before.availabilityNote;
        const nextUntil =
          unavailableUntil !== undefined
            ? unavailableUntil
              ? new Date(unavailableUntil)
              : null
            : before.unavailableUntil;

        // Idempotency check
        const noChange =
          nextStatus === before.availabilityStatus &&
          nextNote === before.availabilityNote &&
          String(nextUntil) === String(before.unavailableUntil);
        if (noChange) return { profile: before, changed: false };

        const [after] = await tx
          .update(doctorProfiles)
          .set({
            availabilityStatus: nextStatus,
            availabilityNote: nextNote,
            unavailableUntil: nextUntil,
            availabilityUpdatedAt: new Date(),
          })
          .where(eq(doctorProfiles.userId, before.userId))
          .returning();

        // Audit log
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'doctor.availability_changed',
          targetType: 'doctor',
          targetId: before.userId,
          before: {
            availabilityStatus: before.availabilityStatus,
            availabilityNote: before.availabilityNote,
            unavailableUntil: before.unavailableUntil?.toISOString() ?? null,
          },
          after: {
            availabilityStatus: nextStatus,
            availabilityNote: nextNote,
            unavailableUntil: nextUntil?.toISOString() ?? null,
          },
          ip: request.ip,
        });

        return { profile: after!, changed: true, before };
      });

      if (result.error === 'NOT_FOUND')
        return reply.code(404).send({
          code: 'DOCTOR_NOT_FOUND',
          message: 'doctor profile not found',
        });

      const profile = result.profile!;
      const changed = result.changed;
      const prevStatus = result.before?.availabilityStatus;

      // Notify admin if newly switching to unavailable and has patients
      if (
        changed &&
        profile.availabilityStatus === 'unavailable' &&
        prevStatus !== 'unavailable'
      ) {
        const [doctorUser] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, profile.userId))
          .limit(1);
        const [patientCountRow] = await app.database
          .select({ value: count() })
          .from(associations)
          .where(eq(associations.doctorId, profile.userId));
        const patientCount = Number(patientCountRow?.value ?? 0);
        if (patientCount > 0) {
          const doctorEmail = doctorUser?.email ?? 'Unknown doctor';
          await notifyAdmins(
            app,
            'doctor_unavailable',
            'Doctor marked unavailable',
            `Dr ${doctorEmail} is now unavailable and has ${patientCount} assigned patient${patientCount === 1 ? '' : 's'}. Consider transferring them.`,
            { doctorId: profile.userId, patientCount },
          );
        }
      }

      return formatAvailability(profile);
    },
  );
}
