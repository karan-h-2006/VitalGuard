import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  gte,
  lte,
} from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  adminAuditLog,
  associationCaregivers,
  associations,
  caregiverLinkRequests,
  devices,
  doctorProfiles,
  institutions,
  notifications,
  patientProfiles,
  users,
} from '../../db/schema.js';
import { env } from '../../env.js';
import { requireRoles } from '../../plugins/auth.js';
import { emailUser, notifyAdmins } from './notifications.js';
import {
  formatAvailability,
  getEffectiveAvailability,
} from './availability.js';

const uuid = z.string().uuid();
const adminOptions = (app: FastifyInstance) => ({
  preHandler: [app.authenticate, requireRoles('administrator' as const)],
});
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  q: z.string().trim().max(200).optional(),
});
export const patientAdminQuery = z.object({
  ...pageQuery.shape,
  assignment: z.enum(['unassigned', 'assigned']).optional(),
  institutionId: uuid.optional(),
});
const institutionInput = z.object({
  name: z.string().trim().min(2).max(255),
  type: z.enum(['hospital', 'clinic', 'institute']),
  address: z.string().max(2000).optional(),
  city: z.string().max(128).optional(),
  contactEmail: z.string().email().max(320).optional(),
  contactPhone: z.string().max(32).optional(),
});

export function canActivateCaregiverLink(
  consentRequired: boolean,
  consent: 'pending' | 'granted' | 'denied' | 'not_required',
): boolean {
  return (
    !consentRequired || consent === 'granted' || consent === 'not_required'
  );
}

export function assessDoctorAssignment(
  doctorStatus: 'pending' | 'approved' | 'rejected' | 'suspended',
  institutionStatus: 'active' | 'inactive',
  preferredInstitutionId: string | null,
  doctorInstitutionId: string,
  override: boolean,
  availabilityStatus: 'available' | 'unavailable' = 'available',
  unavailableUntil: Date | null = null,
):
  | 'eligible'
  | 'doctor_ineligible'
  | 'preference_mismatch'
  | 'doctor_unavailable' {
  if (doctorStatus !== 'approved' || institutionStatus !== 'active')
    return 'doctor_ineligible';
  // Check effective availability
  const effectiveAvail = getEffectiveAvailability(
    { status: doctorStatus, availabilityStatus, unavailableUntil },
    new Date(),
  );
  if (effectiveAvail === 'unavailable') return 'doctor_unavailable';
  if (
    preferredInstitutionId &&
    preferredInstitutionId !== doctorInstitutionId &&
    !override
  )
    return 'preference_mismatch';
  return 'eligible';
}

export function resolveAuditLogLabels<
  T extends {
    actorId: string | null;
    targetId: string | null;
    targetType: string;
  },
>(
  rows: T[],
  accountById: Map<string, { email: string; role: string }>,
  institutionById: Map<string, string>,
) {
  return rows.map((row) => {
    const actor = row.actorId ? accountById.get(row.actorId) : undefined;
    const targetAccount = row.targetId
      ? accountById.get(row.targetId)
      : undefined;
    const institution = row.targetId
      ? institutionById.get(row.targetId)
      : undefined;
    const targetName =
      row.targetType === 'institution'
        ? institution
        : ['user', 'doctor', 'patient'].includes(row.targetType)
          ? targetAccount?.email
          : undefined;
    return {
      ...row,
      actorEmail: actor?.email ?? null,
      actorRole: actor?.role ?? null,
      targetLabel: targetName
        ? `${row.targetType}: ${targetName}`
        : row.targetId,
    };
  });
}

export async function registerAdminGovernanceRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.post('/admin/totp/enroll', adminOptions(app), async (_request, reply) =>
    reply.code(env.ADMIN_TOTP_ENABLED ? 501 : 409).send({
      code: env.ADMIN_TOTP_ENABLED ? 'TOTP_NOT_IMPLEMENTED' : 'TOTP_DISABLED',
      message: env.ADMIN_TOTP_ENABLED
        ? 'TOTP enrollment is not implemented.'
        : 'TOTP is disabled.',
    }),
  );
  app.post('/admin/totp/verify', adminOptions(app), async (_request, reply) =>
    reply.code(env.ADMIN_TOTP_ENABLED ? 501 : 409).send({
      code: env.ADMIN_TOTP_ENABLED ? 'TOTP_NOT_IMPLEMENTED' : 'TOTP_DISABLED',
      message: env.ADMIN_TOTP_ENABLED
        ? 'TOTP verification is not implemented.'
        : 'TOTP is disabled.',
    }),
  );
  app.get('/institutions', async (request, reply) => {
    const now = Date.now();
    const key = `institutions:${request.ip}`;
    const prior = publicInstitutionLimits.get(key);
    if (prior && prior.until > now && prior.count >= 30)
      return reply
        .code(429)
        .send({ code: 'RATE_LIMITED', message: 'try again later' });
    publicInstitutionLimits.set(
      key,
      !prior || prior.until <= now
        ? { count: 1, until: now + 60_000 }
        : { count: prior.count + 1, until: prior.until },
    );
    return app.database
      .select({
        id: institutions.id,
        name: institutions.name,
        type: institutions.type,
        city: institutions.city,
      })
      .from(institutions)
      .where(eq(institutions.status, 'active'))
      .orderBy(institutions.name);
  });

  app.get('/admin/institutions', adminOptions(app), async (request, reply) => {
    const query = pageQuery.safeParse(request.query);
    if (!query.success)
      return reply.code(400).send({
        code: 'INVALID_QUERY',
        message: 'invalid pagination or search query',
      });
    const offset = (query.data.page - 1) * query.data.limit;
    const where = query.data.q
      ? ilike(institutions.name, `%${query.data.q}%`)
      : undefined;
    const rows = await app.database
      .select()
      .from(institutions)
      .where(where)
      .orderBy(institutions.name)
      .limit(query.data.limit)
      .offset(offset);
    const [total] = await app.database
      .select({ value: count() })
      .from(institutions)
      .where(where);
    return {
      items: rows,
      page: query.data.page,
      limit: query.data.limit,
      total: Number(total?.value ?? 0),
    };
  });
  app.post('/admin/institutions', adminOptions(app), async (request, reply) => {
    const input = institutionInput.safeParse(request.body);
    if (!input.success)
      return reply.code(400).send({
        code: 'INVALID_INSTITUTION',
        message: input.error.issues[0]?.message ?? 'invalid institution',
      });
    try {
      const [created] = await app.database.transaction(async (tx) => {
        const [row] = await tx
          .insert(institutions)
          .values({ ...input.data, createdBy: request.authUser.userId })
          .returning();
        if (row)
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'institution.create',
            targetType: 'institution',
            targetId: row.id,
            before: null,
            after: row,
            ip: request.ip,
          });
        return [row] as const;
      });
      return reply.code(201).send(created);
    } catch (error) {
      if (isUnique(error))
        return reply.code(409).send({
          code: 'INSTITUTION_NAME_EXISTS',
          message: 'an institution with this name already exists',
        });
      throw error;
    }
  });
  app.get('/admin/overview', adminOptions(app), async () => {
    const [pendingDoctors] = await app.database
      .select({ value: count() })
      .from(doctorProfiles)
      .where(eq(doctorProfiles.status, 'pending'));
    const [unassignedPatients] = await app.database
      .select({ value: count() })
      .from(patientProfiles)
      .where(eq(patientProfiles.assignmentStatus, 'unassigned'));
    const [pendingCaregivers] = await app.database
      .select({ value: count() })
      .from(caregiverLinkRequests)
      .where(eq(caregiverLinkRequests.status, 'pending'));
    const [activeInstitutions] = await app.database
      .select({ value: count() })
      .from(institutions)
      .where(eq(institutions.status, 'active'));
    const [availableDoctors] = await app.database
      .select({ value: count() })
      .from(doctorProfiles)
      .where(
        and(
          eq(doctorProfiles.status, 'approved'),
          or(
            eq(doctorProfiles.availabilityStatus, 'available'),
            sql`${doctorProfiles.unavailableUntil} IS NOT NULL AND ${doctorProfiles.unavailableUntil} <= now()`,
          ),
        ),
      );
    const [unavailableDoctors] = await app.database
      .select({ value: count() })
      .from(doctorProfiles)
      .where(
        and(
          eq(doctorProfiles.status, 'approved'),
          eq(doctorProfiles.availabilityStatus, 'unavailable'),
          or(
            sql`${doctorProfiles.unavailableUntil} IS NULL`,
            sql`${doctorProfiles.unavailableUntil} > now()`,
          ),
        ),
      );
    const recentActivity = await app.database
      .select()
      .from(adminAuditLog)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(10);
    return {
      pendingDoctors: Number(pendingDoctors?.value ?? 0),
      unassignedPatients: Number(unassignedPatients?.value ?? 0),
      pendingCaregiverRequests: Number(pendingCaregivers?.value ?? 0),
      activeInstitutions: Number(activeInstitutions?.value ?? 0),
      availableDoctors: Number(availableDoctors?.value ?? 0),
      unavailableDoctors: Number(unavailableDoctors?.value ?? 0),
      recentActivity,
    };
  });
  app.get('/admin/users', adminOptions(app), async (request, reply) => {
    const q = z.object({ ...pageQuery.shape }).safeParse(request.query);
    if (!q.success)
      return reply
        .code(400)
        .send({ code: 'INVALID_QUERY', message: 'invalid user search' });
    const where = q.data.q
      ? or(
          ilike(users.email, `%${q.data.q}%`),
          sql`${users.id}::text = ${q.data.q}`,
        )
      : undefined;
    const items = await app.database
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        createdAt: users.createdAt,
        isSuspended: users.isSuspended,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(q.data.limit)
      .offset((q.data.page - 1) * q.data.limit);
    const [total] = await app.database
      .select({ value: count() })
      .from(users)
      .where(where);
    return {
      items,
      page: q.data.page,
      limit: q.data.limit,
      total: Number(total?.value ?? 0),
    };
  });
  app.post(
    '/admin/users/:userId/suspend',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ userId: uuid }).safeParse(request.params);
      const body = z
        .object({ reason: z.string().trim().min(3).max(2000) })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'REASON_REQUIRED',
          message: 'valid user id and suspension reason are required',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(users)
          .where(eq(users.id, params.data.userId))
          .limit(1);
        if (!before) return { error: 'NOT_FOUND' as const };
        if (
          before.role === 'administrator' ||
          before.id === request.authUser.userId
        )
          return { error: 'ADMIN_SUSPENSION_FORBIDDEN' as const };
        if (before.role === 'doctor')
          return { error: 'USE_DOCTOR_SUSPENSION' as const };
        if (before.isSuspended) return { user: before, changed: false };
        const [after] = await tx
          .update(users)
          .set({ isSuspended: true, suspensionReason: body.data.reason })
          .where(eq(users.id, before.id))
          .returning();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'user.suspend',
          targetType: 'user',
          targetId: before.id,
          before: {
            id: before.id,
            role: before.role,
            isSuspended: before.isSuspended,
          },
          after: {
            id: after!.id,
            role: after!.role,
            isSuspended: after!.isSuspended,
          },
          reason: body.data.reason,
          ip: request.ip,
        });
        return { user: after!, changed: true };
      });
      if (result.error === 'NOT_FOUND')
        return reply
          .code(404)
          .send({ code: 'USER_NOT_FOUND', message: 'user not found' });
      if (result.error === 'ADMIN_SUSPENSION_FORBIDDEN')
        return reply.code(409).send({
          code: 'ADMIN_SUSPENSION_FORBIDDEN',
          message: 'administrator accounts cannot be suspended here',
        });
      if (result.error === 'USE_DOCTOR_SUSPENSION')
        return reply.code(409).send({
          code: 'USE_DOCTOR_SUSPENSION',
          message:
            'use the doctor suspension workflow to return patients to the queue',
        });
      return result.user;
    },
  );
  app.post(
    '/admin/users/:userId/reinstate',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ userId: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid user id' });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(users)
          .where(eq(users.id, params.data.userId))
          .limit(1);
        if (!before) return null;
        if (!before.isSuspended) return before;
        const [after] = await tx
          .update(users)
          .set({ isSuspended: false, suspensionReason: null })
          .where(eq(users.id, before.id))
          .returning();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'user.reinstate',
          targetType: 'user',
          targetId: before.id,
          before: {
            id: before.id,
            role: before.role,
            isSuspended: before.isSuspended,
          },
          after: {
            id: after!.id,
            role: after!.role,
            isSuspended: after!.isSuspended,
          },
          ip: request.ip,
        });
        return after;
      });
      if (!result)
        return reply
          .code(404)
          .send({ code: 'USER_NOT_FOUND', message: 'user not found' });
      return result;
    },
  );
  app.get('/admin/audit-log', adminOptions(app), async (request, reply) => {
    const q = z
      .object({
        ...pageQuery.shape,
        actor: z.string().trim().max(320).optional(),
        action: z.string().trim().max(128).optional(),
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
      })
      .safeParse(request.query);
    if (!q.success)
      return reply
        .code(400)
        .send({ code: 'INVALID_QUERY', message: 'invalid audit log filters' });
    let actorId: string | undefined;
    if (q.data.actor) {
      if (uuid.safeParse(q.data.actor).success) actorId = q.data.actor;
      else {
        const [actor] = await app.database
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, q.data.actor))
          .limit(1);
        actorId = actor?.id ?? '00000000-0000-4000-8000-000000000000';
      }
    }
    const toDate = q.data.to;
    if (
      toDate &&
      typeof (request.query as { to?: unknown }).to === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test((request.query as { to: string }).to)
    )
      toDate.setUTCHours(23, 59, 59, 999);
    const where = and(
      actorId ? eq(adminAuditLog.actorId, actorId) : undefined,
      q.data.action
        ? ilike(adminAuditLog.action, `%${q.data.action}%`)
        : undefined,
      q.data.q
        ? or(
            ilike(adminAuditLog.action, `%${q.data.q}%`),
            ilike(adminAuditLog.targetType, `%${q.data.q}%`),
            sql`${adminAuditLog.targetId}::text ILIKE ${`%${q.data.q}%`}`,
            ilike(adminAuditLog.reason, `%${q.data.q}%`),
          )
        : undefined,
      q.data.from ? gte(adminAuditLog.createdAt, q.data.from) : undefined,
      toDate ? lte(adminAuditLog.createdAt, toDate) : undefined,
    );
    const items = await app.database
      .select()
      .from(adminAuditLog)
      .where(where)
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(q.data.limit)
      .offset((q.data.page - 1) * q.data.limit);
    const actorIds = [...new Set(items.flatMap((item) => item.actorId ?? []))];
    const targetUserIds = [
      ...new Set(
        items.flatMap((item) =>
          item.targetId &&
          ['user', 'doctor', 'patient'].includes(item.targetType)
            ? [item.targetId]
            : [],
        ),
      ),
    ];
    const institutionIds = [
      ...new Set(
        items.flatMap((item) =>
          item.targetId && item.targetType === 'institution'
            ? [item.targetId]
            : [],
        ),
      ),
    ];
    const userIds = [...new Set([...actorIds, ...targetUserIds])];
    const accountRows = userIds.length
      ? await app.database
          .select({ id: users.id, email: users.email, role: users.role })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const institutionRows = institutionIds.length
      ? await app.database
          .select({ id: institutions.id, name: institutions.name })
          .from(institutions)
          .where(inArray(institutions.id, institutionIds))
      : [];
    const [total] = await app.database
      .select({ value: count() })
      .from(adminAuditLog)
      .where(where);
    return {
      items: resolveAuditLogLabels(
        items,
        new Map(accountRows.map((row) => [row.id, row])),
        new Map(institutionRows.map((row) => [row.id, row.name])),
      ),
      page: q.data.page,
      limit: q.data.limit,
      total: Number(total?.value ?? 0),
    };
  });
  app.get(
    '/notifications',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const query = z
        .object({ unread: z.enum(['true', 'false']).optional() })
        .safeParse(request.query);
      if (!query.success)
        return reply.code(400).send({
          code: 'INVALID_QUERY',
          message: 'unread must be true or false',
        });
      const where = and(
        eq(notifications.recipientId, request.authUser.userId),
        query.data.unread === 'true'
          ? sql`${notifications.readAt} IS NULL`
          : undefined,
      );
      return app.database
        .select()
        .from(notifications)
        .where(where)
        .orderBy(desc(notifications.createdAt))
        .limit(100);
    },
  );
  app.post(
    '/notifications/read-all',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      await app.database
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.recipientId, request.authUser.userId),
            sql`${notifications.readAt} IS NULL`,
          ),
        );
      return reply.code(204).send();
    },
  );
  app.post(
    '/notifications/:id/read',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const params = z.object({ id: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid notification id' });
      const [row] = await app.database
        .update(notifications)
        .set({ readAt: new Date() })
        .where(
          and(
            eq(notifications.id, params.data.id),
            eq(notifications.recipientId, request.authUser.userId),
          ),
        )
        .returning();
      if (!row)
        return reply.code(404).send({
          code: 'NOTIFICATION_NOT_FOUND',
          message: 'notification not found',
        });
      return row;
    },
  );
  app.patch(
    '/admin/institutions/:id',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ id: uuid }).safeParse(request.params);
      const input = institutionInput
        .partial()
        .extend({ status: z.enum(['active', 'inactive']).optional() })
        .refine((v) => Object.keys(v).length > 0)
        .safeParse(request.body);
      if (!params.success || !input.success)
        return reply.code(400).send({
          code: 'INVALID_INSTITUTION',
          message: 'invalid institution update',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(institutions)
          .where(eq(institutions.id, params.data.id))
          .limit(1);
        if (!before) return null;
        const [after] = await tx
          .update(institutions)
          .set(input.data)
          .where(eq(institutions.id, before.id))
          .returning();
        if (JSON.stringify(before) !== JSON.stringify(after))
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'institution.update',
            targetType: 'institution',
            targetId: before.id,
            before,
            after,
            ip: request.ip,
          });
        let affectedDoctors = 0;
        let affectedPatients = 0;
        if (input.data.status === 'inactive' && before.status !== 'inactive') {
          const doctors = await tx
            .select({ id: doctorProfiles.userId })
            .from(doctorProfiles)
            .where(eq(doctorProfiles.institutionId, before.id));
          affectedDoctors = doctors.length;
          const patients = await tx
            .select({ id: patientProfiles.userId })
            .from(patientProfiles)
            .leftJoin(
              associations,
              eq(associations.patientId, patientProfiles.userId),
            )
            .leftJoin(
              doctorProfiles,
              eq(doctorProfiles.userId, associations.doctorId),
            )
            .where(
              or(
                eq(patientProfiles.preferredInstitutionId, before.id),
                eq(doctorProfiles.institutionId, before.id),
              ),
            )
            .groupBy(patientProfiles.userId);
          affectedPatients = patients.length;
        }
        return { institution: after, affectedDoctors, affectedPatients };
      });
      if (!result)
        return reply.code(404).send({
          code: 'INSTITUTION_NOT_FOUND',
          message: 'institution not found',
        });
      return {
        ...result,
        warning:
          result.affectedDoctors || result.affectedPatients
            ? 'Deactivation blocks new signups; existing doctors and patient preferences remain.'
            : null,
      };
    },
  );

  app.get(
    '/admin/doctor-requests',
    adminOptions(app),
    async (request, reply) => {
      const q = z
        .object({
          ...pageQuery.shape,
          status: z
            .enum(['pending', 'approved', 'rejected', 'suspended'])
            .default('pending'),
          institutionId: uuid.optional(),
        })
        .safeParse(request.query);
      if (!q.success)
        return reply.code(400).send({
          code: 'INVALID_QUERY',
          message: 'invalid doctor request filters',
        });
      const where = and(
        eq(doctorProfiles.status, q.data.status),
        q.data.institutionId
          ? eq(doctorProfiles.institutionId, q.data.institutionId)
          : undefined,
        q.data.q
          ? or(
              ilike(users.email, `%${q.data.q}%`),
              ilike(doctorProfiles.specialization, `%${q.data.q}%`),
              ilike(doctorProfiles.medicalLicenseNo, `%${q.data.q}%`),
            )
          : undefined,
      );
      const items = await app.database
        .select({
          profile: doctorProfiles,
          email: users.email,
          institutionName: institutions.name,
        })
        .from(doctorProfiles)
        .innerJoin(users, eq(users.id, doctorProfiles.userId))
        .innerJoin(
          institutions,
          eq(institutions.id, doctorProfiles.institutionId),
        )
        .where(where)
        .orderBy(desc(doctorProfiles.submittedAt))
        .limit(q.data.limit)
        .offset((q.data.page - 1) * q.data.limit);
      const [total] = await app.database
        .select({ value: count() })
        .from(doctorProfiles)
        .innerJoin(users, eq(users.id, doctorProfiles.userId))
        .where(where);
      return {
        items,
        page: q.data.page,
        limit: q.data.limit,
        total: Number(total?.value ?? 0),
      };
    },
  );
  app.post(
    '/admin/doctor-requests/:userId/approve',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ userId: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid doctor id' });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, params.data.userId))
          .limit(1);
        if (!before) return null;
        if (before.status === 'approved')
          return { profile: before, changed: false };
        const [after] = await tx
          .update(doctorProfiles)
          .set({
            status: 'approved',
            reviewedBy: request.authUser.userId,
            reviewedAt: new Date(),
            rejectionReason: null,
          })
          .where(eq(doctorProfiles.userId, before.userId))
          .returning();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'doctor.approve',
          targetType: 'doctor',
          targetId: before.userId,
          before: safeDoctorProfile(before),
          after: safeDoctorProfile(after!),
          ip: request.ip,
        });
        return { profile: after!, changed: true };
      });
      if (!result)
        return reply.code(404).send({
          code: 'DOCTOR_NOT_FOUND',
          message: 'doctor request not found',
        });
      if (result.changed) {
        const [doctor] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, params.data.userId))
          .limit(1);
        if (doctor)
          await emailUser(
            app,
            doctor.email,
            'VitalGuard doctor application approved',
            'Your doctor account has been approved. You can now access assigned patient care tools.',
          );
      }
      return result.profile;
    },
  );
  app.post(
    '/admin/doctor-requests/:userId/reject',
    adminOptions(app),
    async (request, reply) => reviewDoctor(app, request, reply, 'rejected'),
  );
  app.post(
    '/admin/doctors/:userId/suspend',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ userId: uuid }).safeParse(request.params);
      const body = z
        .object({ reason: z.string().trim().min(3).max(2000) })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'REASON_REQUIRED',
          message: 'valid doctor id and reason are required',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, params.data.userId))
          .limit(1);
        if (!before) return null;
        if (before.status === 'suspended')
          return { changed: false, returnedPatients: 0 };
        await tx
          .update(doctorProfiles)
          .set({
            status: 'suspended',
            reviewedBy: request.authUser.userId,
            reviewedAt: new Date(),
            rejectionReason: body.data.reason,
          })
          .where(eq(doctorProfiles.userId, before.userId));
        const links = await tx
          .select({ patientId: associations.patientId })
          .from(associations)
          .where(eq(associations.doctorId, before.userId));
        let returnedPatients = 0;
        for (const link of links) {
          await tx
            .delete(associations)
            .where(
              and(
                eq(associations.patientId, link.patientId),
                eq(associations.doctorId, before.userId),
              ),
            );
          const remaining = await tx
            .select({ doctorId: associations.doctorId })
            .from(associations)
            .where(eq(associations.patientId, link.patientId))
            .orderBy(associations.doctorId);
          if (!remaining.length) {
            await tx
              .update(patientProfiles)
              .set({ assignmentStatus: 'unassigned' })
              .where(eq(patientProfiles.userId, link.patientId));
            returnedPatients += 1;
          } else {
            await tx
              .update(associations)
              .set({ isPrimary: false })
              .where(eq(associations.patientId, link.patientId));
            await tx
              .update(associations)
              .set({ isPrimary: true })
              .where(
                and(
                  eq(associations.patientId, link.patientId),
                  eq(associations.doctorId, remaining[0]!.doctorId),
                ),
              );
          }
        }
        const [after] = await tx
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, before.userId))
          .limit(1);
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'doctor.suspend',
          targetType: 'doctor',
          targetId: before.userId,
          before: safeDoctorProfile(before),
          after: safeDoctorProfile(after!),
          reason: body.data.reason,
          ip: request.ip,
        });
        await tx.insert(notifications).values({
          recipientId: request.authUser.userId,
          type: 'doctor_suspended',
          title: 'Doctor suspended',
          body: `${returnedPatients} patient${returnedPatients === 1 ? '' : 's'} returned to the unassigned queue.`,
          payload: { doctorId: before.userId, returnedPatients },
        });
        return { changed: true, returnedPatients };
      });
      if (!result)
        return reply
          .code(404)
          .send({ code: 'DOCTOR_NOT_FOUND', message: 'doctor not found' });
      if (result.changed) {
        const [doctor] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, params.data.userId))
          .limit(1);
        if (doctor)
          await emailUser(
            app,
            doctor.email,
            'VitalGuard doctor account suspended',
            `Your account was suspended. Reason: ${body.data.reason}`,
          );
      }
      return { ...result };
    },
  );
  app.post(
    '/admin/doctors/:userId/reinstate',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ userId: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid doctor id' });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(doctorProfiles)
          .where(eq(doctorProfiles.userId, params.data.userId))
          .limit(1);
        if (!before) return null;
        if (before.status === 'approved') return before;
        const [after] = await tx
          .update(doctorProfiles)
          .set({
            status: 'approved',
            reviewedBy: request.authUser.userId,
            reviewedAt: new Date(),
            rejectionReason: null,
          })
          .where(eq(doctorProfiles.userId, before.userId))
          .returning();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'doctor.reinstate',
          targetType: 'doctor',
          targetId: before.userId,
          before: safeDoctorProfile(before),
          after: safeDoctorProfile(after!),
          ip: request.ip,
        });
        return after;
      });
      if (!result)
        return reply
          .code(404)
          .send({ code: 'DOCTOR_NOT_FOUND', message: 'doctor not found' });
      return result;
    },
  );

  await registerPatientAdminRoutes(app);
  await registerCaregiverAdminRoutes(app);
}

async function reviewDoctor(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
  status: 'rejected',
) {
  const params = z.object({ userId: uuid }).safeParse(request.params);
  const body = z
    .object({ reason: z.string().trim().min(3).max(2000) })
    .safeParse(request.body);
  if (!params.success || !body.success)
    return reply.code(400).send({
      code: 'REASON_REQUIRED',
      message: 'valid doctor id and reason are required',
    });
  const result = await app.database.transaction(async (tx) => {
    const [before] = await tx
      .select()
      .from(doctorProfiles)
      .where(eq(doctorProfiles.userId, params.data.userId))
      .limit(1);
    if (!before) return null;
    if (before.status === status) return { profile: before, changed: false };
    const [after] = await tx
      .update(doctorProfiles)
      .set({
        status,
        reviewedBy: request.authUser.userId,
        reviewedAt: new Date(),
        rejectionReason: body.data.reason,
      })
      .where(eq(doctorProfiles.userId, before.userId))
      .returning();
    await tx.insert(adminAuditLog).values({
      actorId: request.authUser.userId,
      action: 'doctor.reject',
      targetType: 'doctor',
      targetId: before.userId,
      before: safeDoctorProfile(before),
      after: safeDoctorProfile(after!),
      reason: body.data.reason,
      ip: request.ip,
    });
    return { profile: after!, changed: true };
  });
  if (!result)
    return reply
      .code(404)
      .send({ code: 'DOCTOR_NOT_FOUND', message: 'doctor request not found' });
  if (result.changed) {
    const [doctor] = await app.database
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, params.data.userId))
      .limit(1);
    if (doctor)
      await emailUser(
        app,
        doctor.email,
        'VitalGuard doctor application update',
        `Your application was rejected. Reason: ${body.data.reason}`,
      );
  }
  return result.profile;
}

async function registerPatientAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/admin/patients', adminOptions(app), async (request, reply) => {
    const q = patientAdminQuery.safeParse(request.query);
    if (!q.success)
      return reply
        .code(400)
        .send({ code: 'INVALID_QUERY', message: 'invalid patient filters' });
    const where = and(
      q.data.assignment
        ? eq(patientProfiles.assignmentStatus, q.data.assignment)
        : undefined,
      q.data.institutionId
        ? eq(patientProfiles.preferredInstitutionId, q.data.institutionId)
        : undefined,
      q.data.q
        ? or(
            ilike(users.email, `%${q.data.q}%`),
            sql`${users.id}::text ILIKE ${`%${q.data.q}%`}`,
          )
        : undefined,
    );
    const items = await app.database
      .select({ profile: patientProfiles, email: users.email })
      .from(patientProfiles)
      .innerJoin(users, eq(users.id, patientProfiles.userId))
      .where(where)
      .orderBy(
        patientProfiles.assignmentStatus,
        desc(patientProfiles.registeredAt),
      )
      .limit(q.data.limit)
      .offset((q.data.page - 1) * q.data.limit);
    const patientIds = items.map((item) => item.profile.userId);
    const doctorLinks = patientIds.length
      ? await app.database
          .select({
            patientId: associations.patientId,
            doctorId: associations.doctorId,
            isPrimary: associations.isPrimary,
            email: users.email,
          })
          .from(associations)
          .innerJoin(users, eq(users.id, associations.doctorId))
          .where(inArray(associations.patientId, patientIds))
      : [];
    const doctorsByPatient = new Map<string, typeof doctorLinks>();
    for (const link of doctorLinks) {
      const existing = doctorsByPatient.get(link.patientId) ?? [];
      existing.push(link);
      doctorsByPatient.set(link.patientId, existing);
    }
    const deviceRows = patientIds.length
      ? await app.database
          .select({
            id: devices.id,
            patientId: devices.patientId,
            registrationStatus: devices.registrationStatus,
            isSimulated: devices.isSimulated,
            simScenario: devices.simScenario,
          })
          .from(devices)
          .where(
            and(
              inArray(devices.patientId, patientIds),
              eq(devices.registrationStatus, 'registered'),
            ),
          )
      : [];
    const devicesByPatient = new Map<string, (typeof deviceRows)[0]>();
    for (const d of deviceRows) {
      if (d.patientId) devicesByPatient.set(d.patientId, d);
    }
    const itemsWithDoctors = items.map((item) => {
      const doctors = doctorsByPatient.get(item.profile.userId) ?? [];
      const device = devicesByPatient.get(item.profile.userId) ?? null;
      return {
        ...item,
        doctors,
        doctorIds: doctors.map((doctor) => doctor.doctorId),
        device,
      };
    });
    const [total] = await app.database
      .select({ value: count() })
      .from(patientProfiles)
      .innerJoin(users, eq(users.id, patientProfiles.userId))
      .where(where);
    return {
      items: itemsWithDoctors,
      page: q.data.page,
      limit: q.data.limit,
      total: Number(total?.value ?? 0),
    };
  });

  app.patch(
    '/admin/devices/:deviceId',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ deviceId: uuid }).safeParse(request.params);
      const body = z
        .object({
          scenario: z.enum(['normal', 'deteriorating', 'noisy']).optional(),
          isSimulated: z.boolean().optional(),
        })
        .refine(
          (data) =>
            data.scenario !== undefined || data.isSimulated !== undefined,
          {
            message: 'at least one of scenario or isSimulated must be provided',
          },
        )
        .safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({
          code: 'VALIDATION_ERROR',
          message:
            params.error?.issues[0]?.message ??
            body.error?.issues[0]?.message ??
            'invalid device update payload',
        });
      }

      const result = await app.database.transaction(async (tx) => {
        const [existing] = await tx
          .select()
          .from(devices)
          .where(eq(devices.id, params.data.deviceId))
          .limit(1);

        if (!existing) return null;

        const updateData: {
          simScenario?: 'normal' | 'deteriorating' | 'noisy';
          isSimulated?: boolean;
        } = {};
        if (body.data.scenario !== undefined) {
          updateData.simScenario = body.data.scenario;
        }
        if (body.data.isSimulated !== undefined) {
          updateData.isSimulated = body.data.isSimulated;
        }

        await tx
          .update(devices)
          .set(updateData)
          .where(eq(devices.id, params.data.deviceId));

        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'device.scenario_update',
          targetType: 'device',
          targetId: params.data.deviceId,
          before: {
            scenario: existing.simScenario,
            isSimulated: existing.isSimulated,
          },
          after: {
            scenario: updateData.simScenario ?? existing.simScenario,
            isSimulated: updateData.isSimulated ?? existing.isSimulated,
          },
          ip: request.ip,
        });

        return {
          deviceId: existing.id,
          patientId: existing.patientId,
          isSimulated: updateData.isSimulated ?? existing.isSimulated,
          scenario: updateData.simScenario ?? existing.simScenario,
        };
      });

      if (!result) {
        return reply.code(404).send({
          code: 'DEVICE_NOT_FOUND',
          message: 'device not found',
        });
      }

      return reply.code(200).send(result);
    },
  );
  app.get('/admin/doctors', adminOptions(app), async (request, reply) => {
    const q = z
      .object({
        ...pageQuery.shape,
        institutionId: uuid.optional(),
        status: z
          .enum(['approved', 'pending', 'rejected', 'suspended'])
          .default('approved'),
        availability: z.enum(['available', 'unavailable']).optional(),
      })
      .safeParse(request.query);
    if (!q.success)
      return reply
        .code(400)
        .send({ code: 'INVALID_QUERY', message: 'invalid doctor filters' });
    const availabilityFilter = q.data.availability
      ? q.data.availability === 'available'
        ? or(
            eq(doctorProfiles.availabilityStatus, 'available'),
            sql`${doctorProfiles.unavailableUntil} IS NOT NULL AND ${doctorProfiles.unavailableUntil} <= now()`,
          )
        : and(
            eq(doctorProfiles.availabilityStatus, 'unavailable'),
            or(
              sql`${doctorProfiles.unavailableUntil} IS NULL`,
              sql`${doctorProfiles.unavailableUntil} > now()`,
            ),
          )
      : undefined;
    const where = and(
      eq(doctorProfiles.status, q.data.status),
      q.data.institutionId
        ? eq(doctorProfiles.institutionId, q.data.institutionId)
        : undefined,
      availabilityFilter,
      q.data.q
        ? or(
            ilike(users.email, `%${q.data.q}%`),
            ilike(doctorProfiles.specialization, `%${q.data.q}%`),
          )
        : undefined,
    );
    const rows = await app.database
      .select({
        profile: doctorProfiles,
        email: users.email,
        institutionName: institutions.name,
        institutionStatus: institutions.status,
      })
      .from(doctorProfiles)
      .innerJoin(users, eq(users.id, doctorProfiles.userId))
      .innerJoin(
        institutions,
        eq(institutions.id, doctorProfiles.institutionId),
      )
      .where(where)
      .orderBy(users.email)
      .limit(q.data.limit)
      .offset((q.data.page - 1) * q.data.limit);
    const items = await Promise.all(
      rows.map(async (row) => {
        const [patientCount] = await app.database
          .select({ value: count() })
          .from(associations)
          .where(eq(associations.doctorId, row.profile.userId));
        const countValue = Number(patientCount?.value ?? 0);
        return {
          ...row,
          patientCount: countValue,
          assignedPatientCount: countValue,
          availability: formatAvailability(row.profile),
        };
      }),
    );
    const [total] = await app.database
      .select({ value: count() })
      .from(doctorProfiles)
      .innerJoin(users, eq(users.id, doctorProfiles.userId))
      .where(where);
    return {
      items,
      page: q.data.page,
      limit: q.data.limit,
      total: Number(total?.value ?? 0),
    };
  });
  app.post(
    '/admin/patients/:patientId/assign-doctor',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ patientId: uuid }).safeParse(request.params);
      const body = z
        .object({
          doctorId: uuid,
          isPrimary: z.boolean().default(false),
          override: z.boolean().default(false),
          reason: z.string().trim().min(3).max(2000).optional(),
        })
        .superRefine((v, ctx) => {
          if (v.override && !v.reason)
            ctx.addIssue({
              code: 'custom',
              message:
                'reason is required when overriding institution preference',
              path: ['reason'],
            });
        })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'INVALID_ASSIGNMENT',
          message: body.success
            ? 'invalid patient id'
            : (body.error.issues[0]?.message ?? 'invalid assignment'),
        });
      const result = await app.database.transaction(async (tx) => {
        const [patient] = await tx
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.userId, params.data.patientId))
          .limit(1);
        const [doctor] = await tx
          .select({ profile: doctorProfiles, active: institutions.status })
          .from(doctorProfiles)
          .innerJoin(
            institutions,
            eq(institutions.id, doctorProfiles.institutionId),
          )
          .where(eq(doctorProfiles.userId, body.data.doctorId))
          .limit(1);
        if (!patient || !doctor) return { error: 'NOT_FOUND' as const };
        await tx.execute(
          sql`SELECT 1 FROM doctor_profiles WHERE user_id = ${body.data.doctorId} FOR SHARE`,
        );
        const eligibility = assessDoctorAssignment(
          doctor.profile.status,
          doctor.active,
          patient.preferredInstitutionId,
          doctor.profile.institutionId,
          body.data.override,
          doctor.profile.availabilityStatus,
          doctor.profile.unavailableUntil,
        );
        if (eligibility === 'doctor_ineligible')
          return { error: 'DOCTOR_INELIGIBLE' as const };
        if (eligibility === 'doctor_unavailable')
          return {
            error: 'DOCTOR_UNAVAILABLE' as const,
            note: doctor.profile.availabilityNote,
          };
        if (eligibility === 'preference_mismatch')
          return { error: 'PREFERENCE_MISMATCH' as const };
        if (body.data.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: false })
            .where(eq(associations.patientId, patient.userId));
        const [link] = await tx
          .insert(associations)
          .values({
            patientId: patient.userId,
            doctorId: body.data.doctorId,
            isPrimary: body.data.isPrimary,
          })
          .onConflictDoNothing()
          .returning();
        if (!link && body.data.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: true })
            .where(
              and(
                eq(associations.patientId, patient.userId),
                eq(associations.doctorId, body.data.doctorId),
              ),
            );
        await tx
          .update(patientProfiles)
          .set({ assignmentStatus: 'assigned' })
          .where(eq(patientProfiles.userId, patient.userId));
        const changed = !!link || body.data.isPrimary;
        if (changed) {
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'patient.assign_doctor',
            targetType: 'patient',
            targetId: patient.userId,
            before: { assignmentStatus: patient.assignmentStatus },
            after: {
              doctorId: body.data.doctorId,
              isPrimary: body.data.isPrimary,
            },
            reason: body.data.reason,
            ip: request.ip,
          });
          await tx.insert(notifications).values({
            recipientId: patient.userId,
            type: 'doctor_assigned',
            title: 'Doctor assigned',
            body: 'A doctor has been assigned to your care.',
            payload: { doctorId: body.data.doctorId },
          });
          await tx.insert(notifications).values({
            recipientId: body.data.doctorId,
            type: 'patient_assigned',
            title: 'Patient assigned',
            body: 'A patient has been assigned to your care.',
            payload: { patientId: patient.userId },
          });
        }
        return {
          error: null,
          patientId: patient.userId,
          doctorId: body.data.doctorId,
          changed,
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
          message:
            'doctor must be approved and belong to an active institution',
        });
      if (result.error === 'DOCTOR_UNAVAILABLE')
        return reply.code(409).send({
          code: 'DOCTOR_UNAVAILABLE',
          message: result.note
            ? `Doctor is currently marked as unavailable: ${result.note}`
            : 'Doctor is currently marked as unavailable for new patient assignments',
        });
      if (result.error === 'PREFERENCE_MISMATCH')
        return reply.code(409).send({
          code: 'INSTITUTION_PREFERENCE_MISMATCH',
          message:
            'doctor does not match the patient preferred institution; provide override and reason',
        });
      if (result.changed) {
        const [patient] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, result.patientId))
          .limit(1);
        const [doctor] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, result.doctorId))
          .limit(1);
        if (patient)
          await emailUser(
            app,
            patient.email,
            'VitalGuard doctor assignment',
            'An approved doctor has been assigned to your care.',
          );
        if (doctor)
          await emailUser(
            app,
            doctor.email,
            'VitalGuard patient assignment',
            'A patient has been assigned to your care. Sign in to view your patient list.',
          );
      }
      return {
        patientId: result.patientId,
        doctorId: result.doctorId,
        isPrimary: body.data.isPrimary,
      };
    },
  );
  app.delete(
    '/admin/patients/:patientId/doctors/:doctorId',
    adminOptions(app),
    async (request, reply) => {
      const params = z
        .object({ patientId: uuid, doctorId: uuid })
        .safeParse(request.params);
      if (!params.success)
        return reply.code(400).send({
          code: 'INVALID_ID',
          message: 'invalid patient or doctor id',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(associations)
          .where(
            and(
              eq(associations.patientId, params.data.patientId),
              eq(associations.doctorId, params.data.doctorId),
            ),
          )
          .limit(1);
        if (!before) return null;
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
        if (remaining.length) {
          if (before.isPrimary)
            await tx
              .update(associations)
              .set({ isPrimary: true })
              .where(
                and(
                  eq(associations.patientId, before.patientId),
                  eq(associations.doctorId, remaining[0]!.doctorId),
                ),
              );
        } else
          await tx
            .update(patientProfiles)
            .set({ assignmentStatus: 'unassigned' })
            .where(eq(patientProfiles.userId, before.patientId));
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'patient.unassign_doctor',
          targetType: 'patient',
          targetId: before.patientId,
          before,
          after: { remainingDoctors: remaining.length },
          ip: request.ip,
        });
        return {
          patientId: before.patientId,
          remainingDoctors: remaining.length,
        };
      });
      if (!result)
        return reply.code(404).send({
          code: 'ASSOCIATION_NOT_FOUND',
          message: 'doctor assignment not found',
        });
      return result;
    },
  );
  app.post(
    '/admin/patients/:patientId/transfer',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ patientId: uuid }).safeParse(request.params);
      const body = z
        .object({
          fromDoctorId: uuid,
          toDoctorId: uuid,
          override: z.boolean().default(false),
          reason: z.string().trim().min(3).max(2000).optional(),
        })
        .superRefine((v, ctx) => {
          if (v.fromDoctorId === v.toDoctorId)
            ctx.addIssue({
              code: 'custom',
              message: 'from and to doctors must differ',
            });
          if (v.override && !v.reason)
            ctx.addIssue({
              code: 'custom',
              message: 'reason is required for an institution override',
            });
        })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'INVALID_TRANSFER',
          message: 'invalid transfer details',
        });
      const result = await app.database.transaction(async (tx) => {
        const [patient] = await tx
          .select()
          .from(patientProfiles)
          .where(eq(patientProfiles.userId, params.data.patientId))
          .limit(1);
        const [from] = await tx
          .select()
          .from(associations)
          .where(
            and(
              eq(associations.patientId, params.data.patientId),
              eq(associations.doctorId, body.data.fromDoctorId),
            ),
          )
          .limit(1);
        const [to] = await tx
          .select({
            profile: doctorProfiles,
            institutionStatus: institutions.status,
          })
          .from(doctorProfiles)
          .innerJoin(
            institutions,
            eq(institutions.id, doctorProfiles.institutionId),
          )
          .where(eq(doctorProfiles.userId, body.data.toDoctorId))
          .limit(1);
        if (!patient || !from || !to) return { error: 'NOT_FOUND' as const };
        await tx.execute(
          sql`SELECT 1 FROM doctor_profiles WHERE user_id = ${body.data.toDoctorId} FOR SHARE`,
        );
        const eligibility = assessDoctorAssignment(
          to.profile.status,
          to.institutionStatus,
          patient.preferredInstitutionId,
          to.profile.institutionId,
          body.data.override,
          to.profile.availabilityStatus,
          to.profile.unavailableUntil,
        );
        if (eligibility === 'doctor_ineligible')
          return { error: 'DOCTOR_INELIGIBLE' as const };
        if (eligibility === 'doctor_unavailable')
          return {
            error: 'DOCTOR_UNAVAILABLE' as const,
            note: to.profile.availabilityNote,
          };
        if (eligibility === 'preference_mismatch')
          return { error: 'PREFERENCE_MISMATCH' as const };
        await tx
          .delete(associations)
          .where(
            and(
              eq(associations.patientId, patient.userId),
              eq(associations.doctorId, body.data.fromDoctorId),
            ),
          );
        if (from.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: false })
            .where(eq(associations.patientId, patient.userId));
        await tx
          .insert(associations)
          .values({
            patientId: patient.userId,
            doctorId: body.data.toDoctorId,
            isPrimary: from.isPrimary,
          })
          .onConflictDoNothing();
        if (from.isPrimary)
          await tx
            .update(associations)
            .set({ isPrimary: true })
            .where(
              and(
                eq(associations.patientId, patient.userId),
                eq(associations.doctorId, body.data.toDoctorId),
              ),
            );
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'patient.transfer',
          targetType: 'patient',
          targetId: patient.userId,
          before: from,
          after: {
            doctorId: body.data.toDoctorId,
            isPrimary: from.isPrimary,
          },
          reason: body.data.reason,
          ip: request.ip,
        });
        await tx.insert(notifications).values({
          recipientId: patient.userId,
          type: 'doctor_assigned',
          title: 'Doctor assignment updated',
          body: 'Your care team has been updated.',
          payload: { doctorId: body.data.toDoctorId },
        });
        await tx.insert(notifications).values({
          recipientId: body.data.toDoctorId,
          type: 'patient_assigned',
          title: 'Patient transferred to your care',
          body: 'A patient has been transferred to your care.',
          payload: { patientId: patient.userId },
        });
        return {
          error: null,
          patientId: patient.userId,
          fromDoctorId: body.data.fromDoctorId,
          toDoctorId: body.data.toDoctorId,
        };
      });
      if (result.error === 'NOT_FOUND')
        return reply.code(404).send({
          code: 'PATIENT_OR_ASSIGNMENT_NOT_FOUND',
          message:
            'patient, current assignment, or destination doctor not found',
        });
      if (result.error === 'DOCTOR_INELIGIBLE')
        return reply.code(409).send({
          code: 'DOCTOR_INELIGIBLE',
          message:
            'destination doctor must be approved at an active institution',
        });
      if (result.error === 'DOCTOR_UNAVAILABLE')
        return reply.code(409).send({
          code: 'DOCTOR_UNAVAILABLE',
          message: result.note
            ? `Destination doctor is currently marked as unavailable: ${result.note}`
            : 'Destination doctor is currently marked as unavailable for patient transfers',
        });
      if (result.error === 'PREFERENCE_MISMATCH')
        return reply.code(409).send({
          code: 'INSTITUTION_PREFERENCE_MISMATCH',
          message: 'destination doctor does not match patient preference',
        });
      const [patient] = await app.database
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, result.patientId))
        .limit(1);
      const [doctor] = await app.database
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, result.toDoctorId))
        .limit(1);
      if (patient)
        await emailUser(
          app,
          patient.email,
          'VitalGuard doctor assignment updated',
          'Your care team has been updated.',
        );
      if (doctor)
        await emailUser(
          app,
          doctor.email,
          'VitalGuard patient assignment',
          'A patient has been transferred to your care.',
        );
      return result;
    },
  );
}

async function registerCaregiverAdminRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get(
    '/admin/caregiver-requests',
    adminOptions(app),
    async (request, reply) => {
      const q = z
        .object({
          ...pageQuery.shape,
          status: z
            .enum(['pending', 'approved', 'rejected', 'cancelled'])
            .optional(),
        })
        .safeParse(request.query);
      if (!q.success)
        return reply.code(400).send({
          code: 'INVALID_QUERY',
          message: 'invalid caregiver request filters',
        });
      const where = and(
        q.data.status
          ? eq(caregiverLinkRequests.status, q.data.status)
          : undefined,
        q.data.q
          ? or(
              ilike(users.email, `%${q.data.q}%`),
              ilike(
                caregiverLinkRequests.requestedPatientEmail,
                `%${q.data.q}%`,
              ),
            )
          : undefined,
      );
      const items = await app.database
        .select({ request: caregiverLinkRequests, caregiverEmail: users.email })
        .from(caregiverLinkRequests)
        .innerJoin(users, eq(users.id, caregiverLinkRequests.caregiverId))
        .where(where)
        .orderBy(desc(caregiverLinkRequests.createdAt))
        .limit(q.data.limit)
        .offset((q.data.page - 1) * q.data.limit);
      const [total] = await app.database
        .select({ value: count() })
        .from(caregiverLinkRequests)
        .innerJoin(users, eq(users.id, caregiverLinkRequests.caregiverId))
        .where(where);
      return {
        items,
        page: q.data.page,
        limit: q.data.limit,
        total: Number(total?.value ?? 0),
      };
    },
  );
  app.post(
    '/admin/caregiver-requests/:id/approve',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ id: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid request id' });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(caregiverLinkRequests)
          .where(eq(caregiverLinkRequests.id, params.data.id))
          .limit(1);
        if (!before) return { error: 'NOT_FOUND' as const };
        if (before.status === 'approved')
          return {
            request: before,
            changed: false,
            patientId: before.patientId,
          };
        if (before.status !== 'pending')
          return { error: 'NOT_PENDING' as const };
        let patientId = before.patientId;
        if (!patientId && before.requestedPatientEmail) {
          const [patient] = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                sql`lower(${users.email}) = ${before.requestedPatientEmail.toLowerCase()}`,
                eq(users.role, 'patient'),
              ),
            )
            .limit(1);
          patientId = patient?.id ?? null;
        }
        if (!patientId) return { error: 'PATIENT_NOT_FOUND' as const };
        const consent = env.REQUIRE_PATIENT_CONSENT
          ? 'pending'
          : 'not_required';
        const [after] = await tx
          .update(caregiverLinkRequests)
          .set({
            patientId,
            status: 'approved',
            patientConsent: consent,
            reviewedBy: request.authUser.userId,
            reviewedAt: new Date(),
          })
          .where(eq(caregiverLinkRequests.id, before.id))
          .returning();
        if (canActivateCaregiverLink(env.REQUIRE_PATIENT_CONSENT, consent))
          await tx
            .insert(associationCaregivers)
            .values({ patientId, caregiverId: before.caregiverId })
            .onConflictDoNothing();
        else
          await tx.insert(notifications).values({
            recipientId: patientId,
            type: 'caregiver_consent',
            title: 'Caregiver access request',
            body: 'A caregiver would like access to your health information. Review and respond to this request.',
            payload: { requestId: before.id },
          });
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'caregiver_request.approve',
          targetType: 'caregiver_link_request',
          targetId: before.id,
          before,
          after,
          ip: request.ip,
        });
        return { request: after!, changed: true, patientId };
      });
      if ('error' in result) {
        if (result.error === 'NOT_FOUND')
          return reply.code(404).send({
            code: 'REQUEST_NOT_FOUND',
            message: 'caregiver request not found',
          });
        if (result.error === 'NOT_PENDING')
          return reply.code(409).send({
            code: 'REQUEST_NOT_PENDING',
            message: 'caregiver request is no longer pending',
          });
        return reply.code(404).send({
          code: 'PATIENT_NOT_FOUND',
          message: 'requested patient could not be found',
        });
      }
      if (result.changed && result.patientId) {
        const [patient] = await app.database
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, result.patientId))
          .limit(1);
        if (patient && env.REQUIRE_PATIENT_CONSENT)
          await emailUser(
            app,
            patient.email,
            'VitalGuard caregiver access request',
            'A caregiver is requesting access to your health information. Sign in to review the request.',
          );
      }
      return result.request;
    },
  );
  app.post(
    '/admin/caregiver-requests/:id/reject',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ id: uuid }).safeParse(request.params);
      const body = z
        .object({ reason: z.string().trim().min(3).max(2000) })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'REASON_REQUIRED',
          message: 'valid request id and rejection reason are required',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(caregiverLinkRequests)
          .where(eq(caregiverLinkRequests.id, params.data.id))
          .limit(1);
        if (!before) return null;
        if (before.status === 'rejected') return before;
        if (before.status !== 'pending')
          return { error: 'NOT_PENDING' as const };
        const [after] = await tx
          .update(caregiverLinkRequests)
          .set({
            status: 'rejected',
            reviewedBy: request.authUser.userId,
            reviewedAt: new Date(),
            rejectionReason: body.data.reason,
          })
          .where(eq(caregiverLinkRequests.id, before.id))
          .returning();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'caregiver_request.reject',
          targetType: 'caregiver_link_request',
          targetId: before.id,
          before,
          after,
          reason: body.data.reason,
          ip: request.ip,
        });
        return after;
      });
      if (!result)
        return reply.code(404).send({
          code: 'REQUEST_NOT_FOUND',
          message: 'caregiver request not found',
        });
      if ('error' in result)
        return reply.code(409).send({
          code: 'REQUEST_NOT_PENDING',
          message: 'only pending caregiver requests can be rejected',
        });
      return result;
    },
  );
  app.post(
    '/admin/patients/:patientId/caregivers',
    adminOptions(app),
    async (request, reply) => {
      const params = z.object({ patientId: uuid }).safeParse(request.params);
      const body = z.object({ caregiverId: uuid }).safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'INVALID_LINK',
          message: 'valid patient and caregiver ids are required',
        });
      const result = await app.database.transaction(async (tx) => {
        const roles = await tx
          .select({ id: users.id, role: users.role, email: users.email })
          .from(users)
          .where(
            or(
              eq(users.id, params.data.patientId),
              eq(users.id, body.data.caregiverId),
            ),
          );
        if (
          roles.find((v) => v.id === params.data.patientId)?.role !==
            'patient' ||
          roles.find((v) => v.id === body.data.caregiverId)?.role !==
            'caregiver'
        )
          return null;
        const [existingLink] = await tx
          .select()
          .from(associationCaregivers)
          .where(
            and(
              eq(associationCaregivers.patientId, params.data.patientId),
              eq(associationCaregivers.caregiverId, body.data.caregiverId),
            ),
          )
          .limit(1);
        if (existingLink)
          return {
            patientId: params.data.patientId,
            caregiverId: body.data.caregiverId,
            created: false,
            consentPending: false,
            patientEmail: roles.find((v) => v.id === params.data.patientId)
              ?.email,
          };
        if (env.REQUIRE_PATIENT_CONSENT) {
          const [pending] = await tx
            .select()
            .from(caregiverLinkRequests)
            .where(
              and(
                eq(caregiverLinkRequests.patientId, params.data.patientId),
                eq(caregiverLinkRequests.caregiverId, body.data.caregiverId),
                eq(caregiverLinkRequests.patientConsent, 'pending'),
              ),
            )
            .limit(1);
          if (pending)
            return {
              patientId: params.data.patientId,
              caregiverId: body.data.caregiverId,
              created: false,
              consentPending: true,
              patientEmail: roles.find((v) => v.id === params.data.patientId)
                ?.email,
            };
          const [requestRow] = await tx
            .insert(caregiverLinkRequests)
            .values({
              caregiverId: body.data.caregiverId,
              patientId: params.data.patientId,
              status: 'approved',
              patientConsent: 'pending',
              reviewedBy: request.authUser.userId,
              reviewedAt: new Date(),
            })
            .returning();
          await tx.insert(notifications).values({
            recipientId: params.data.patientId,
            type: 'caregiver_consent',
            title: 'Caregiver access request',
            body: 'An administrator added a caregiver request. Review and respond before access is granted.',
            payload: { requestId: requestRow!.id },
          });
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'caregiver.direct_link_request',
            targetType: 'patient',
            targetId: params.data.patientId,
            before: null,
            after: requestRow,
            ip: request.ip,
          });
          return {
            patientId: params.data.patientId,
            caregiverId: body.data.caregiverId,
            created: true,
            consentPending: true,
            patientEmail: roles.find((v) => v.id === params.data.patientId)
              ?.email,
          };
        }
        const [link] = await tx
          .insert(associationCaregivers)
          .values({
            patientId: params.data.patientId,
            caregiverId: body.data.caregiverId,
          })
          .onConflictDoNothing()
          .returning();
        if (link)
          await tx.insert(adminAuditLog).values({
            actorId: request.authUser.userId,
            action: 'caregiver.direct_link',
            targetType: 'patient',
            targetId: params.data.patientId,
            before: null,
            after: link,
            ip: request.ip,
          });
        return {
          patientId: params.data.patientId,
          caregiverId: body.data.caregiverId,
          created: !!link,
          consentPending: false,
          patientEmail: roles.find((v) => v.id === params.data.patientId)
            ?.email,
        };
      });
      if (!result)
        return reply.code(404).send({
          code: 'ACCOUNT_NOT_FOUND',
          message: 'patient or caregiver not found',
        });
      if (result.consentPending && result.created && result.patientEmail)
        await emailUser(
          app,
          result.patientEmail,
          'VitalGuard caregiver access request',
          'An administrator added a caregiver request. Sign in to review and respond.',
        );
      return reply.code(result.created ? 201 : 200).send({
        patientId: result.patientId,
        caregiverId: result.caregiverId,
        created: result.created,
        consentPending: result.consentPending,
      });
    },
  );
  app.delete(
    '/admin/patients/:patientId/caregivers/:caregiverId',
    adminOptions(app),
    async (request, reply) => {
      const params = z
        .object({ patientId: uuid, caregiverId: uuid })
        .safeParse(request.params);
      if (!params.success)
        return reply.code(400).send({
          code: 'INVALID_ID',
          message: 'invalid patient or caregiver id',
        });
      const removed = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(associationCaregivers)
          .where(
            and(
              eq(associationCaregivers.patientId, params.data.patientId),
              eq(associationCaregivers.caregiverId, params.data.caregiverId),
            ),
          )
          .limit(1);
        if (!before) return false;
        await tx
          .delete(associationCaregivers)
          .where(
            and(
              eq(associationCaregivers.patientId, before.patientId),
              eq(associationCaregivers.caregiverId, before.caregiverId),
            ),
          );
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'caregiver.unlink',
          targetType: 'patient',
          targetId: before.patientId,
          before,
          after: null,
          ip: request.ip,
        });
        return true;
      });
      return removed
        ? reply.code(204).send()
        : reply.code(404).send({
            code: 'LINK_NOT_FOUND',
            message: 'caregiver link not found',
          });
    },
  );
  app.post(
    '/caregiver/link-requests',
    { preHandler: [app.authenticate, requireRoles('caregiver')] },
    async (request, reply) => {
      const body = z
        .object({
          patientEmail: z
            .string()
            .email()
            .max(320)
            .transform((v) => v.toLowerCase()),
          relationshipNote: z.string().trim().max(500).optional(),
        })
        .safeParse(request.body);
      if (!body.success)
        return reply.code(400).send({
          code: 'INVALID_REQUEST',
          message: 'a valid patient email is required',
        });
      const [patient] = await app.database
        .select({ id: users.id })
        .from(users)
        .where(
          and(
            sql`lower(${users.email}) = ${body.data.patientEmail}`,
            eq(users.role, 'patient'),
          ),
        )
        .limit(1);
      await app.database.insert(caregiverLinkRequests).values({
        caregiverId: request.authUser.userId,
        patientId: patient?.id ?? null,
        requestedPatientEmail: body.data.patientEmail,
        relationshipNote: body.data.relationshipNote ?? null,
        status: 'pending',
        patientConsent: 'pending',
      });
      await notifyAdmins(
        app,
        'caregiver_link_request',
        'New caregiver link request',
        'A caregiver submitted a patient access request.',
      );
      return reply.code(202).send({
        status: 'pending',
        message: 'request submitted for administrator review',
      });
    },
  );
  app.get(
    '/caregiver/link-requests',
    { preHandler: [app.authenticate, requireRoles('caregiver')] },
    async (request) =>
      app.database
        .select({
          id: caregiverLinkRequests.id,
          status: caregiverLinkRequests.status,
          patientConsent: caregiverLinkRequests.patientConsent,
          createdAt: caregiverLinkRequests.createdAt,
        })
        .from(caregiverLinkRequests)
        .where(eq(caregiverLinkRequests.caregiverId, request.authUser.userId))
        .orderBy(desc(caregiverLinkRequests.createdAt)),
  );
  app.get(
    '/patients/me/access',
    { preHandler: [app.authenticate, requireRoles('patient')] },
    async (request) => {
      return app.database
        .select({
          caregiverId: associationCaregivers.caregiverId,
          email: users.email,
        })
        .from(associationCaregivers)
        .innerJoin(users, eq(users.id, associationCaregivers.caregiverId))
        .where(eq(associationCaregivers.patientId, request.authUser.userId));
    },
  );
  app.get(
    '/patients/me/profile',
    { preHandler: [app.authenticate, requireRoles('patient')] },
    async (request) => {
      const [profile] = await app.database
        .select()
        .from(patientProfiles)
        .where(eq(patientProfiles.userId, request.authUser.userId))
        .limit(1);
      return profile ?? null;
    },
  );
  app.get(
    '/patients/me/caregiver-consents',
    { preHandler: [app.authenticate, requireRoles('patient')] },
    async (request) => {
      return app.database
        .select({ request: caregiverLinkRequests, caregiverEmail: users.email })
        .from(caregiverLinkRequests)
        .innerJoin(users, eq(users.id, caregiverLinkRequests.caregiverId))
        .where(
          and(
            eq(caregiverLinkRequests.patientId, request.authUser.userId),
            eq(caregiverLinkRequests.status, 'approved'),
            eq(caregiverLinkRequests.patientConsent, 'pending'),
          ),
        )
        .orderBy(desc(caregiverLinkRequests.createdAt));
    },
  );
  app.post(
    '/patients/me/caregiver-consents/:requestId',
    { preHandler: [app.authenticate, requireRoles('patient')] },
    async (request, reply) => {
      const params = z.object({ requestId: uuid }).safeParse(request.params);
      const body = z
        .object({ decision: z.enum(['grant', 'deny']) })
        .safeParse(request.body);
      if (!params.success || !body.success)
        return reply.code(400).send({
          code: 'INVALID_CONSENT',
          message: 'valid consent decision is required',
        });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(caregiverLinkRequests)
          .where(
            and(
              eq(caregiverLinkRequests.id, params.data.requestId),
              eq(caregiverLinkRequests.patientId, request.authUser.userId),
            ),
          )
          .limit(1);
        if (
          !before ||
          before.status !== 'approved' ||
          before.patientConsent !== 'pending'
        )
          return null;
        const patientConsent =
          body.data.decision === 'grant' ? 'granted' : 'denied';
        const [after] = await tx
          .update(caregiverLinkRequests)
          .set({ patientConsent })
          .where(eq(caregiverLinkRequests.id, before.id))
          .returning();
        if (patientConsent === 'granted')
          await tx
            .insert(associationCaregivers)
            .values({
              patientId: request.authUser.userId,
              caregiverId: before.caregiverId,
            })
            .onConflictDoNothing();
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: `caregiver_consent.${body.data.decision}`,
          targetType: 'caregiver_link_request',
          targetId: before.id,
          before,
          after,
          ip: request.ip,
        });
        return after;
      });
      if (!result)
        return reply.code(404).send({
          code: 'CONSENT_REQUEST_NOT_FOUND',
          message: 'consent request not found or already resolved',
        });
      return result;
    },
  );
  app.delete(
    '/patients/me/caregivers/:caregiverId',
    { preHandler: [app.authenticate, requireRoles('patient')] },
    async (request, reply) => {
      const params = z.object({ caregiverId: uuid }).safeParse(request.params);
      if (!params.success)
        return reply
          .code(400)
          .send({ code: 'INVALID_ID', message: 'invalid caregiver id' });
      const result = await app.database.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(associationCaregivers)
          .where(
            and(
              eq(associationCaregivers.patientId, request.authUser.userId),
              eq(associationCaregivers.caregiverId, params.data.caregiverId),
            ),
          )
          .limit(1);
        if (!before) return false;
        await tx
          .delete(associationCaregivers)
          .where(
            and(
              eq(associationCaregivers.patientId, before.patientId),
              eq(associationCaregivers.caregiverId, before.caregiverId),
            ),
          );
        await tx.insert(adminAuditLog).values({
          actorId: request.authUser.userId,
          action: 'caregiver_consent.revoke',
          targetType: 'patient',
          targetId: before.patientId,
          before,
          after: null,
          ip: request.ip,
        });
        return true;
      });
      return result
        ? reply.code(204).send()
        : reply.code(404).send({
            code: 'CAREGIVER_LINK_NOT_FOUND',
            message: 'caregiver link not found',
          });
    },
  );
}

const publicInstitutionLimits = new Map<
  string,
  { count: number; until: number }
>();
function isUnique(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

function safeDoctorProfile(profile: typeof doctorProfiles.$inferSelect) {
  const { medicalLicenseNo, ...safe } = profile;
  return { ...safe, medicalLicenseLast4: medicalLicenseNo.slice(-4) };
}
