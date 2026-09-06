import websocket from '@fastify/websocket';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { alerts, associationCaregivers, associations, reports, vitalReadings } from '../../db/schema.js';
import { verifyToken } from '../../auth/tokens.js';
import { requireAssociation } from '../../plugins/auth.js';
import { env } from '../../env.js';
import { getPatientStatus, readRawStatus } from './status.js';
import { generateWeeklyReport } from './reports.js';

export async function registerDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get('/patients/:patientId/vitals/latest', { preHandler: [app.authenticate, requireAssociation()] }, async (request) => {
    const patientId = (request.params as { patientId: string }).patientId;
    return getPatientStatus(app.database, patientId);
  });
  app.get('/patients/:patientId/vitals/history', { preHandler: [app.authenticate, requireAssociation()] }, async (request, reply) => {
    const { patientId } = request.params as { patientId: string };
    const query = request.query as { range?: string; vitalType?: string };
    const hours = query.range === '7d' ? 168 : query.range === '30d' ? 720 : query.range === '24h' || !query.range ? 24 : 0;
    if (!hours || !query.vitalType) return reply.code(400).send({ message: 'range must be 24h, 7d, or 30d and vitalType is required' });
    const since = new Date(Date.now() - hours * 3_600_000);
    const rows = await app.database.select({ timestamp: vitalReadings.timestamp, value: vitalReadings.value }).from(vitalReadings).where(and(eq(vitalReadings.patientId, patientId), eq(vitalReadings.vitalType, query.vitalType as 'heart_rate' | 'spo2' | 'temperature' | 'motion'), gte(vitalReadings.timestamp, since))).orderBy(vitalReadings.timestamp);
    return { patientId, range: query.range, vitalType: query.vitalType, points: rows.map((row) => ({ timestamp: row.timestamp.toISOString(), value: Number(row.value) })) };
  });
  app.get('/patients', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = request.authUser;
    if (!['doctor', 'caregiver'].includes(user.role)) return reply.code(403).send({ message: 'triage is available to doctors and caregivers only' });
    const links = user.role === 'doctor'
      ? await app.database.select({ patientId: associations.patientId }).from(associations).where(eq(associations.doctorId, user.userId))
      : await app.database.select({ patientId: associationCaregivers.patientId }).from(associationCaregivers).where(eq(associationCaregivers.caregiverId, user.userId));
    const patients = await Promise.all(links.map(async ({ patientId }) => {
      const latest = await getPatientStatus(app.database, patientId);
      const [open] = await app.database.select({ count: sql<number>`count(*)` }).from(alerts).where(and(eq(alerts.patientId, patientId), eq(alerts.status, 'open')));
      return { patientId, ...latest, openAlertCount: Number(open?.count ?? 0), lastReadingAt: latest.status?.timestamp ?? null };
    }));
    const rank: Record<string, number> = { Critical: 4, Warning: 3, Watch: 2, Normal: 1 };
    return patients.sort((a, b) => (rank[b.status?.severityTier ?? ''] ?? 0) - (rank[a.status?.severityTier ?? ''] ?? 0));
  });
  app.get('/patients/:patientId/reports', { preHandler: [app.authenticate, requireAssociation()] }, async (request) => {
    const { patientId } = request.params as { patientId: string };
    return app.database.select().from(reports).where(eq(reports.patientId, patientId)).orderBy(reports.generatedAt);
  });
  app.post('/patients/:patientId/reports', { preHandler: [app.authenticate, requireAssociation()] }, async (request, reply) => {
    if (!['doctor', 'caregiver'].includes(request.authUser.role)) return reply.code(403).send({ message: 'only clinicians and caregivers may generate reports' });
    return generateWeeklyReport(app.database, (request.params as { patientId: string }).patientId);
  });
  await app.register(websocket);
  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as { token?: string }).token;
    void connect(socket as unknown as WebSocketConnection, token, app);
  });
}
type WebSocketConnection = { send(data: string): void; close(code: number, reason: string): void; on(event: 'message', listener: (payload: Buffer) => void): void; on(event: 'close', listener: () => void): void };
async function connect(socket: WebSocketConnection, token: string | undefined, app: FastifyInstance) {
  let user;
  try { user = await verifyToken(token ?? ''); } catch { socket.close(4401, 'invalid or expired token'); return; }
  let timer: NodeJS.Timeout | undefined, patientId: string | undefined, previous: string | null = null;
  socket.on('message', async (payload) => {
    try {
      const message = JSON.parse(payload.toString()) as { type?: string; patientId?: string };
      if (message.type !== 'subscribe' || !message.patientId) throw new Error('expected subscribe message with patientId');
      const allowed = user.role === 'administrator' || (user.role === 'patient' && user.userId === message.patientId) || await associated(app, user.userId, user.role, message.patientId);
      if (!allowed) { socket.close(4403, 'not authorized for this patient'); return; }
      patientId = message.patientId; socket.send(JSON.stringify({ type: 'subscribed', patientId }));
      if (timer) clearInterval(timer);
      timer = setInterval(async () => { if (!patientId) return; const raw = await readRawStatus(patientId); if (raw && raw !== previous) { previous = raw; socket.send(raw); } }, env.WEBSOCKET_POLL_INTERVAL_MS);
    } catch (error) { socket.send(JSON.stringify({ type: 'error', message: error instanceof Error ? error.message : 'invalid subscription' })); }
  });
  socket.on('close', () => { if (timer) clearInterval(timer); });
}
async function associated(app: FastifyInstance, userId: string, role: string, patientId: string): Promise<boolean> {
  if (role === 'doctor') return (await app.database.select().from(associations).where(and(eq(associations.patientId, patientId), eq(associations.doctorId, userId))).limit(1)).length > 0;
  if (role === 'caregiver') return (await app.database.select().from(associationCaregivers).where(and(eq(associationCaregivers.patientId, patientId), eq(associationCaregivers.caregiverId, userId))).limit(1)).length > 0;
  return false;
}
