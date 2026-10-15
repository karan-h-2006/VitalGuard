import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  MINIMUM_PASSWORD_LENGTH,
  hashPassword,
  verifyPassword,
} from '../../auth/passwords.js';
import { signToken, type AuthRole } from '../../auth/tokens.js';
import {
  adminAuditLog,
  caregiverLinkRequests,
  devices,
  doctorProfiles,
  institutions,
  patientProfiles,
  users,
} from '../../db/schema.js';
import { env } from '../../env.js';
import { requireRoles } from '../../plugins/auth.js';
import { notifyAdmins } from '../governance/notifications.js';

const registrationSchema = z.object({
  role: z.enum(['patient', 'caregiver', 'doctor', 'administrator', 'admin']),
  email: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(MINIMUM_PASSWORD_LENGTH),
  preferredInstitutionId: z.string().uuid().optional(),
  institutionId: z.string().uuid().optional(),
  medicalLicenseNo: z.string().trim().min(1).max(128).optional(),
  specialization: z.string().trim().min(1).max(255).optional(),
  patientEmail: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.toLowerCase())
    .optional(),
});
const attempts = new Map<string, { count: number; resetAt: number }>();
export function resetLoginRateLimiter(): void {
  attempts.clear();
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const input = registrationSchema.safeParse(request.body);
    if (!input.success)
      return reply.code(400).send({
        code: 'INVALID_REGISTRATION',
        message: input.error.issues[0]?.message ?? 'invalid registration',
      });
    if (input.data.role === 'administrator' || input.data.role === 'admin')
      return reply.code(400).send({
        code: 'ADMIN_REGISTRATION_DISABLED',
        message: 'administrator accounts cannot be self-registered',
      });
    if (
      input.data.role === 'doctor' &&
      (!input.data.institutionId ||
        !input.data.medicalLicenseNo ||
        !input.data.specialization)
    )
      return reply.code(400).send({
        code: 'DOCTOR_DETAILS_REQUIRED',
        message:
          'institutionId, medicalLicenseNo, and specialization are required for doctors',
      });
    try {
      const [created] = await app.database.transaction(async (tx) => {
        const [user] = await tx
          .insert(users)
          .values({
            role: input.data.role as 'patient' | 'caregiver' | 'doctor',
            email: input.data.email,
            passwordHash: await hashPassword(input.data.password),
          })
          .returning({ id: users.id, role: users.role });
        if (!user) throw new Error('user creation returned no record');
        if (user.role === 'patient') {
          await tx.insert(patientProfiles).values({
            userId: user.id,
            preferredInstitutionId: input.data.preferredInstitutionId ?? null,
            assignmentStatus: 'unassigned',
          });
          if (env.AUTO_PROVISION_SIMULATED_DEVICE) {
            await tx.insert(devices).values({
              patientId: user.id,
              registrationStatus: 'registered',
              isSimulated: true,
              simScenario: 'normal',
            });
          }
        }
        if (user.role === 'patient' && input.data.preferredInstitutionId) {
          const [preferred] = await tx
            .select({ id: institutions.id })
            .from(institutions)
            .where(
              and(
                eq(institutions.id, input.data.preferredInstitutionId),
                eq(institutions.status, 'active'),
              ),
            )
            .limit(1);
          if (!preferred)
            throw Object.assign(new Error('institution is unavailable'), {
              code: 'INSTITUTION_UNAVAILABLE',
            });
        }
        if (user.role === 'doctor') {
          const [institution] = await tx
            .select({ id: institutions.id })
            .from(institutions)
            .where(
              and(
                eq(institutions.id, input.data.institutionId!),
                eq(institutions.status, 'active'),
              ),
            )
            .limit(1);
          if (!institution)
            throw Object.assign(new Error('institution is unavailable'), {
              code: 'INSTITUTION_UNAVAILABLE',
            });
          await tx.insert(doctorProfiles).values({
            userId: user.id,
            institutionId: institution.id,
            medicalLicenseNo: input.data.medicalLicenseNo!,
            specialization: input.data.specialization!,
            status: 'pending',
          });
        }
        if (user.role === 'caregiver' && input.data.patientEmail) {
          const [patient] = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                eq(users.email, input.data.patientEmail),
                eq(users.role, 'patient'),
              ),
            )
            .limit(1);
          await tx.insert(caregiverLinkRequests).values({
            caregiverId: user.id,
            patientId: patient?.id ?? null,
            requestedPatientEmail: input.data.patientEmail,
            status: 'pending',
            patientConsent: 'pending',
          });
        }
        return [user] as const;
      });
      if (created.role === 'doctor')
        await notifyAdmins(
          app,
          'doctor_request',
          'New doctor application',
          'A doctor registration is awaiting review.',
          { doctorId: created.id },
        );
      if (created.role === 'patient')
        await notifyAdmins(
          app,
          'unassigned_patient',
          'New unassigned patient',
          'A patient account is awaiting doctor assignment.',
          { patientId: created.id },
        );
      if (created.role === 'caregiver' && input.data.patientEmail)
        await notifyAdmins(
          app,
          'caregiver_link_request',
          'New caregiver link request',
          'A caregiver submitted a patient access request.',
        );
      return reply.code(201).send({
        token: await signToken({
          userId: created.id,
          role: created.role as AuthRole,
        }),
      });
    } catch (error: unknown) {
      if (isUniqueViolation(error))
        return reply.code(409).send({
          code: 'EMAIL_ALREADY_REGISTERED',
          message: 'email already registered',
        });
      if (isNamedError(error, 'INSTITUTION_UNAVAILABLE'))
        return reply.code(400).send({
          code: 'INSTITUTION_UNAVAILABLE',
          message: 'institution is not active or does not exist',
        });
      throw error;
    }
  });

  app.post('/auth/login', async (request, reply) => {
    const input = z
      .object({ email: z.string().email(), password: z.string() })
      .safeParse(request.body);
    if (!input.success)
      return reply
        .code(401)
        .send({ code: 'INVALID_CREDENTIALS', message: 'invalid credentials' });
    const email = input.data.email.toLowerCase();
    const key = `${request.ip}:${email}`;
    const now = Date.now();
    const [user] = await app.database
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    const adminAttempt = user?.role === 'administrator';
    const limit = adminAttempt
      ? env.ADMIN_LOGIN_RATE_LIMIT_MAX
      : env.LOGIN_RATE_LIMIT_MAX;
    const windowMs =
      (adminAttempt
        ? env.ADMIN_LOGIN_RATE_LIMIT_WINDOW_SECONDS
        : env.LOGIN_RATE_LIMIT_WINDOW_SECONDS) * 1000;
    const prior = attempts.get(key);
    if (prior && prior.resetAt > now && prior.count >= limit)
      return reply.code(429).send({
        code: 'LOGIN_RATE_LIMITED',
        message: 'too many login attempts; try again later',
      });
    if (
      !user ||
      !(await verifyPassword(user.passwordHash, input.data.password))
    ) {
      attempts.set(
        key,
        !prior || prior.resetAt <= now
          ? { count: 1, resetAt: now + windowMs }
          : { ...prior, count: prior.count + 1 },
      );
      return reply
        .code(401)
        .send({ code: 'INVALID_CREDENTIALS', message: 'invalid credentials' });
    }
    attempts.delete(key);
    return {
      token: await signToken({ userId: user.id, role: user.role as AuthRole }),
    };
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (request) => {
    const [user] = await app.database
      .select({
        id: users.id,
        role: users.role,
        email: users.email,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(eq(users.id, request.authUser.userId))
      .limit(1);
    return user ?? null;
  });
  app.post(
    '/auth/logout',
    { preHandler: [app.authenticate] },
    async (_request, reply) => reply.code(204).send(),
  );
  app.post(
    '/auth/change-password',
    { preHandler: [app.authenticate] },
    async (request, reply) => {
      const input = z
        .object({
          currentPassword: z.string(),
          newPassword: z.string().min(MINIMUM_PASSWORD_LENGTH),
        })
        .safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({
          code: 'INVALID_PASSWORD',
          message: input.error.issues[0]?.message ?? 'invalid password',
        });
      const [user] = await app.database
        .select()
        .from(users)
        .where(eq(users.id, request.authUser.userId))
        .limit(1);
      if (
        !user ||
        !(await verifyPassword(user.passwordHash, input.data.currentPassword))
      )
        return reply.code(400).send({
          code: 'CURRENT_PASSWORD_INVALID',
          message: 'current password is incorrect',
        });
      if (user.role === 'administrator' && input.data.newPassword.length < 12)
        return reply.code(400).send({
          code: 'ADMIN_PASSWORD_TOO_SHORT',
          message: 'administrator passwords must be at least 12 characters',
        });
      await app.database
        .update(users)
        .set({
          passwordHash: await hashPassword(input.data.newPassword),
          mustChangePassword: false,
        })
        .where(eq(users.id, user.id));
      return reply.code(204).send();
    },
  );

  app.get(
    '/doctors/me/application',
    { preHandler: [app.authenticate, requireRoles('doctor')] },
    async (request, reply) => {
      const [profile] = await app.database
        .select()
        .from(doctorProfiles)
        .where(eq(doctorProfiles.userId, request.authUser.userId))
        .limit(1);
      if (!profile)
        return reply.code(404).send({
          code: 'APPLICATION_NOT_FOUND',
          message: 'doctor application not found',
        });
      return {
        status: profile.status,
        rejectionReason: profile.rejectionReason,
        reapplicationCount: profile.reapplicationCount,
        mayReapply:
          profile.status === 'rejected' && profile.reapplicationCount < 3,
      };
    },
  );
  app.post(
    '/doctors/me/reapply',
    { preHandler: [app.authenticate, requireRoles('doctor')] },
    async (request, reply) => {
      const input = z
        .object({
          institutionId: z.string().uuid(),
          medicalLicenseNo: z.string().trim().min(1).max(128),
          specialization: z.string().trim().min(1).max(255),
        })
        .safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({
          code: 'INVALID_APPLICATION',
          message:
            'institutionId, medicalLicenseNo, and specialization are required',
        });
      const [profile] = await app.database
        .select()
        .from(doctorProfiles)
        .where(eq(doctorProfiles.userId, request.authUser.userId))
        .limit(1);
      if (!profile || profile.status !== 'rejected')
        return reply.code(409).send({
          code: 'APPLICATION_NOT_REJECTED',
          message: 'only rejected applications can be resubmitted',
        });
      if (profile.reapplicationCount >= 3)
        return reply.code(409).send({
          code: 'REAPPLICATION_LIMIT_REACHED',
          message: 'reapplication limit reached; contact the administrator',
        });
      const [institution] = await app.database
        .select({ id: institutions.id })
        .from(institutions)
        .where(
          and(
            eq(institutions.id, input.data.institutionId),
            eq(institutions.status, 'active'),
          ),
        )
        .limit(1);
      if (!institution)
        return reply.code(400).send({
          code: 'INSTITUTION_UNAVAILABLE',
          message: 'institution is not active or does not exist',
        });
      await app.database
        .update(doctorProfiles)
        .set({
          institutionId: institution.id,
          medicalLicenseNo: input.data.medicalLicenseNo,
          specialization: input.data.specialization,
          status: 'pending',
          submittedAt: new Date(),
          reviewedBy: null,
          reviewedAt: null,
          rejectionReason: null,
          reapplicationCount: profile.reapplicationCount + 1,
        })
        .where(eq(doctorProfiles.userId, request.authUser.userId));
      await notifyAdmins(
        app,
        'doctor_reapplication',
        'Doctor application resubmitted',
        'A doctor resubmitted an application for review.',
        { doctorId: request.authUser.userId },
      );
      return reply.code(202).send({
        status: 'pending',
        reapplicationCount: profile.reapplicationCount + 1,
      });
    },
  );

  app.post(
    '/admin/users',
    { preHandler: [app.authenticate, requireRoles('administrator')] },
    async (request, reply) => {
      const input = z
        .object({
          role: z.enum(['doctor', 'administrator']),
          email: z
            .string()
            .email()
            .max(320)
            .transform((value) => value.toLowerCase()),
          password: z.string().min(MINIMUM_PASSWORD_LENGTH),
        })
        .safeParse(request.body);
      if (!input.success)
        return reply.code(400).send({
          code: 'INVALID_ACCOUNT',
          message: input.error.issues[0]?.message ?? 'invalid account',
        });
      if (input.data.role === 'doctor')
        return reply.code(400).send({
          code: 'DOCTOR_SELF_REGISTRATION',
          message: 'doctors must use public registration and await approval',
        });
      if (!env.ALLOW_ADDITIONAL_ADMINS)
        return reply.code(403).send({
          code: 'ADDITIONAL_ADMINS_DISABLED',
          message: 'additional administrator creation is disabled',
        });
      if (input.data.password.length < 12)
        return reply.code(400).send({
          code: 'ADMIN_PASSWORD_TOO_SHORT',
          message: 'administrator passwords must be at least 12 characters',
        });
      try {
        const [user] = await app.database.transaction(async (tx) => {
          const [created] = await tx
            .insert(users)
            .values({
              ...input.data,
              passwordHash: await hashPassword(input.data.password),
              mustChangePassword: true,
            })
            .returning({ id: users.id, role: users.role, email: users.email });
          if (created)
            await tx.insert(adminAuditLog).values({
              actorId: request.authUser.userId,
              action: 'user.create_admin',
              targetType: 'user',
              targetId: created.id,
              before: null,
              after: {
                id: created.id,
                role: created.role,
                email: created.email,
              },
              ip: request.ip,
            });
          return [created] as const;
        });
        return reply.code(201).send(user);
      } catch (error: unknown) {
        if (isUniqueViolation(error))
          return reply.code(409).send({
            code: 'EMAIL_ALREADY_REGISTERED',
            message: 'email already registered',
          });
        throw error;
      }
    },
  );
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}
function isNamedError(error: unknown, code: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === code
  );
}
