import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { associationCaregivers, associations, thresholds, users } from '../../db/schema.js';
import { requireAssociation, requireRoles } from '../../plugins/auth.js';

const uuid = z.string().uuid();
const relationInput = z.object({ patientId: uuid, doctorId: uuid.optional(), caregiverId: uuid.optional() }).refine((value) => value.doctorId || value.caregiverId, 'provide a doctorId or caregiverId');
const vitalType = z.enum(['heart_rate', 'spo2', 'temperature', 'motion']);
const bands: Record<z.infer<typeof vitalType>, [number, number]> = { heart_rate: [20, 250], spo2: [50, 100], temperature: [30, 45], motion: [0, 100000] };

export async function registerPatientRoutes(app: FastifyInstance): Promise<void> {
  app.post('/associations', { preHandler: [app.authenticate, requireRoles('administrator', 'doctor')] }, async (request, reply) => {
    const input = relationInput.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ message: input.error.issues[0]?.message ?? 'invalid association' });
    if (request.authUser.role === 'doctor' && input.data.doctorId !== request.authUser.userId) return reply.code(403).send({ message: 'doctors may only create their own doctor association' });
    const ids = [input.data.patientId, input.data.doctorId, input.data.caregiverId].filter(Boolean) as string[];
    const accountRows = await app.database.select({ id: users.id, role: users.role }).from(users);
    const roles = new Map(accountRows.filter((row) => ids.includes(row.id)).map((row) => [row.id, row.role]));
    if (roles.get(input.data.patientId) !== 'patient' || (input.data.doctorId && roles.get(input.data.doctorId) !== 'doctor') || (input.data.caregiverId && roles.get(input.data.caregiverId) !== 'caregiver')) return reply.code(400).send({ message: 'association users must exist with the correct roles' });
    if (input.data.doctorId) await app.database.insert(associations).values({ patientId: input.data.patientId, doctorId: input.data.doctorId }).onConflictDoNothing();
    if (input.data.caregiverId) await app.database.insert(associationCaregivers).values({ patientId: input.data.patientId, caregiverId: input.data.caregiverId }).onConflictDoNothing();
    return reply.code(201).send(input.data);
  });

  app.delete('/associations/:patientId/:relationship/:userId', { preHandler: [app.authenticate, requireRoles('administrator', 'doctor')] }, async (request, reply) => {
    const params = z.object({ patientId: uuid, relationship: z.enum(['doctor', 'caregiver']), userId: uuid }).safeParse(request.params);
    if (!params.success) return reply.code(400).send({ message: 'invalid association path' });
    if (request.authUser.role === 'doctor' && (params.data.relationship !== 'doctor' || params.data.userId !== request.authUser.userId)) return reply.code(403).send({ message: 'doctors may only remove their own doctor association' });
    if (params.data.relationship === 'doctor') await app.database.delete(associations).where(and(eq(associations.patientId, params.data.patientId), eq(associations.doctorId, params.data.userId)));
    else await app.database.delete(associationCaregivers).where(and(eq(associationCaregivers.patientId, params.data.patientId), eq(associationCaregivers.caregiverId, params.data.userId)));
    return reply.code(204).send();
  });

  app.get('/patients/:patientId/associations', { preHandler: [app.authenticate, requireAssociation()] }, async (request, reply) => {
    const patientId = uuid.safeParse((request.params as { patientId: string }).patientId);
    if (!patientId.success) return reply.code(400).send({ message: 'invalid patient id' });
    const [doctors, caregivers] = await Promise.all([
      app.database.select({ doctorId: associations.doctorId }).from(associations).where(eq(associations.patientId, patientId.data)),
      app.database.select({ caregiverId: associationCaregivers.caregiverId }).from(associationCaregivers).where(eq(associationCaregivers.patientId, patientId.data)),
    ]);
    return { patientId: patientId.data, doctors: doctors.map((row) => row.doctorId), caregivers: caregivers.map((row) => row.caregiverId) };
  });

  app.put('/patients/:patientId/thresholds/:vitalType', { preHandler: [app.authenticate, requireRoles('doctor'), requireAssociation()] }, async (request, reply) => {
    const params = z.object({ patientId: uuid, vitalType }).safeParse(request.params);
    const input = z.object({ minimum: z.number().finite(), maximum: z.number().finite() }).safeParse(request.body);
    if (!params.success || !input.success) return reply.code(400).send({ message: 'invalid threshold override' });
    const [lower, upper] = bands[params.data.vitalType];
    if (input.data.minimum >= input.data.maximum || input.data.minimum < lower || input.data.maximum > upper) return reply.code(400).send({ message: `thresholds must satisfy ${lower} <= minimum < maximum <= ${upper}` });
    const [threshold] = await app.database.insert(thresholds).values({ patientId: params.data.patientId, vitalType: params.data.vitalType, minimum: String(input.data.minimum), maximum: String(input.data.maximum), clinicianOverride: true }).onConflictDoUpdate({ target: [thresholds.patientId, thresholds.vitalType], set: { minimum: String(input.data.minimum), maximum: String(input.data.maximum), clinicianOverride: true } }).returning();
    return threshold;
  });
}
