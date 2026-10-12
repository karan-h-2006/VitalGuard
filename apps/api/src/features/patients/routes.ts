import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  adminAuditLog,
  associationCaregivers,
  associations,
  doctorProfiles,
  institutions,
  patientProfiles,
  thresholds,
} from '../../db/schema.js';
import { requireAssociation, requireRoles } from '../../plugins/auth.js';
import { assessDoctorAssignment } from '../governance/admin-routes.js';

const uuid = z.string().uuid();
const relationInput = z
  .object({
    patientId: uuid,
    doctorId: uuid,
    isPrimary: z.boolean().default(false),
    override: z.boolean().default(false),
    reason: z.string().trim().min(3).max(2000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.override && !v.reason)
      ctx.addIssue({
        code: 'custom',
        message: 'reason is required for institution override',
        path: ['reason'],
      });
  });
const vitalType = z.enum(['heart_rate', 'spo2', 'temperature', 'motion']);
const bands: Record<z.infer<typeof vitalType>, [number, number]> = {
  heart_rate: [20, 250],
  spo2: [50, 100],
  temperature: [30, 45],
  motion: [0, 100000],
};

export async function registerPatientRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post(
    '/associations',
    { preHandler: [app.authenticate, requireRoles('administrator')] },
    async (request, reply) => {
      const input = relationInput.safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({
          code: 'INVALID_ASSIGNMENT',
          message: input.error.issues[0]?.message ?? 'invalid association',
        });
      const result = await app.database.transaction(async (tx) => {
        const [patient] = await tx
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.userId, input.data.patientId))
          .limit(1);
        const [doctor] = await tx
          .select({
            profile: doctorProfiles,
            institutionStatus: institutions.status,
          })
          .from(doctorProfiles)
          .innerJoin(
            institutions,
            eq(institutions.id, doctorProfiles.institutionId),
          )
          .where(eq(doctorProfiles.userId, input.data.doctorId))
          .limit(1);
        if (!patient || !doctor) return { error: 'NOT_FOUND' as const };
        const eligibility = assessDoctorAssignment(
          doctor.profile.status,
          doctor.institutionStatus,
          patient.preferredInstitutionId,
          doctor.profile.institutionId,
          input.data.override,
        );
        if (eligibility === 'doctor_ineligible')
          return { error: 'DOCTOR_INELIGIBLE' as const };
        if (eligibility === 'preference_mismatch')
          return { error: 'PREFERENCE_MISMATCH' as const };
        if (input.data.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: false })
            .where(eq(associations.patientId, patient.userId));
        const [link] = await tx
          .insert(associations)
          .values({
            patientId: patient.userId,
            doctorId: input.data.doctorId,
            isPrimary: input.data.isPrimary,
          })
          .onConflictDoNothing()
          .returning();
        if (!link && input.data.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: true })
            .where(
              and(
                eq(associations.patientId, patient.userId),
                eq(associations.doctorId, input.data.doctorId),
              ),
            );
        await tx
          .update(patientProfiles)
          .set({ assignmentStatus: 'assigned' })
          .where(eq(patientProfiles.userId, patient.userId));
        if (link || input.data.isPrimary)
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'patient.assign_doctor',
            targetType: 'patient',
            targetId: patient.userId,
            before: { assignmentStatus: patient.assignmentStatus },
            after: {
              doctorId: input.data.doctorId,
              isPrimary: input.data.isPrimary,
            },
            reason: input.data.reason,
            ip: request.ip,
          });
        return {
          error: null,
          patientId: patient.userId,
          doctorId: input.data.doctorId,
        };
      });
      if (result.error === 'NOT_FOUND')
        return reply.code(404).send({
          code: 'PATIENT_OR_DOCTOR_NOT_FOUND',
          message: 'patient or doctor not found',
        });
      if (result.error === 'DOCTOR_INELIGIBLE')
        return reply.code(409).send({
          code: 'DOCTOR_INELIGIBLE',
          message: 'doctor must be approved and at an active institution',
        });
      if (result.error === 'PREFERENCE_MISMATCH')
        return reply.code(409).send({
          code: 'INSTITUTION_PREFERENCE_MISMATCH',
          message:
            'provide override and reason to assign outside the preferred institution',
        });
      return reply.code(201).send(result);
    },
  );

  app.delete(
    '/associations/:patientId/:relationship/:userId',
    { preHandler: [app.authenticate, requireRoles('administrator')] },
    async (request, reply) => {
      const params = z
        .object({
          patientId: uuid,
          relationship: z.enum(['doctor', 'caregiver']),
          userId: uuid,
        })
        .safeParse(request.params);
      if (!params.success)
        return reply.code(400).send({
          code: 'INVALID_ASSOCIATION',
          message: 'invalid association path',
        });
      if (params.data.relationship === 'caregiver')
        return reply.code(400).send({
          code: 'USE_GOVERNED_CAREGIVER_ROUTE',
          message: 'use the admin caregiver link endpoints',
        });
      const removed = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(associations)
          .where(
            and(
              eq(associations.patientId, params.data.patientId),
              eq(associations.doctorId, params.data.userId),
            ),
          )
          .limit(1);
        if (!before) return false;
        await tx
          .delete(associations)
          .where(
            and(
              eq(associations.patientId, before.patientId),
              eq(associations.doctorId, before.doctorId),
            ),
          );
        const remaining = await tx
          .select({ doctorId: associations.doctorId })
          .from(associations)
          .where(eq(associations.patientId, before.patientId))
          .orderBy(associations.doctorId);
        if (!remaining.length)
          await tx
            .update(patientProfiles)
            .set({ assignmentStatus: 'unassigned' })
            .where(eq(patientProfiles.userId, before.patientId));
        else if (before.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: true })
            .where(
              and(
                eq(associations.patientId, before.patientId),
                eq(associations.doctorId, remaining[0]!.doctorId),
              ),
            );
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'patient.unassign_doctor',
          targetType: 'patient',
          targetId: before.patientId,
          before,
          after: { remainingDoctors: remaining.length },
          ip: request.ip,
        });
        return true;
      });
      return removed
        ? reply.code(204).send()
        : reply.code(404).send({
            code: 'ASSOCIATION_NOT_FOUND',
            message: 'association not found',
          });
    },
  );

  app.get(
    '/patients/:patientId/associations',
    { preHandler: [app.authenticate, requireAssociation()] },
    async (request, reply) => {
      const patientId = uuid.safeParse(
        (request.params as { patientId: string }).patientId,
      );
      if (!patientId.success)
        return reply.code(400).send({ message: 'invalid patient id' });
      const [doctors, caregivers] = await Promise.all([
        app.database
          .select({ doctorId: associations.doctorId })
          .from(associations)
          .where(eq(associations.patientId, patientId.data)),
        app.database
          .select({ caregiverId: associationCaregivers.caregiverId })
          .from(associationCaregivers)
          .where(eq(associationCaregivers.patientId, patientId.data)),
      ]);
      return {
        patientId: patientId.data,
        doctors: doctors.map((row) => row.doctorId),
        caregivers: caregivers.map((row) => row.caregiverId),
      };
    },
  );

  app.put(
    '/patients/:patientId/thresholds/:vitalType',
    {
      preHandler: [
        app.authenticate,
        requireRoles('doctor'),
        requireAssociation(),
      ],
    },
    async (request, reply) => {
      const params = z
        .object({ patientId: uuid, vitalType })
        .safeParse(request.params);
      const input = z
        .object({ minimum: z.number().finite(), maximum: z.number().finite() })
        .safeParse(request.body);
      if (!params.success || !input.success)
        return reply.code(400).send({ message: 'invalid threshold override' });
      const [lower, upper] = bands[params.data.vitalType];
      if (
        input.data.minimum >= input.data.maximum ||
        input.data.minimum < lower ||
        input.data.maximum > upper
      )
        return reply.code(400).send({
          message: `thresholds must satisfy ${lower} <= minimum < maximum <= ${upper}`,
        });
      const [threshold] = await app.database
        .insert(thresholds)
        .values({
          patientId: params.data.patientId,
          vitalType: params.data.vitalType,
          minimum: String(input.data.minimum),
          maximum: String(input.data.maximum),
          clinicianOverride: true,
        })
        .onConflictDoUpdate({
          target: [thresholds.patientId, thresholds.vitalType],
          set: {
            minimum: String(input.data.minimum),
            maximum: String(input.data.maximum),
            clinicianOverride: true,
          },
        })
        .returning();
      return threshold;
    },
  );
}
