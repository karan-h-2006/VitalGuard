import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MINIMUM_PASSWORD_LENGTH, hashPassword, verifyPassword } from '../../auth/passwords.js';
import { signToken, type AuthRole } from '../../auth/tokens.js';
import { users } from '../../db/schema.js';
import { env } from '../../env.js';
import { requireRoles } from '../../plugins/auth.js';

const publicRegistrationRoles = z.enum(['patient', 'caregiver']);
const accountSchema = z.object({ role: z.enum(['patient', 'caregiver', 'doctor', 'administrator']), email: z.string().email().max(320).transform((value) => value.toLowerCase()), password: z.string().min(MINIMUM_PASSWORD_LENGTH) });
type LoginAttempt = { count: number; resetAt: number };
const attempts = new Map<string, LoginAttempt>();
export function resetLoginRateLimiter(): void { attempts.clear(); }

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', async (request, reply) => {
    const input = accountSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ message: input.error.issues[0]?.message ?? 'invalid registration' });
    if (!publicRegistrationRoles.safeParse(input.data.role).success) return reply.code(400).send({ message: 'only patient and caregiver accounts may be self-registered' });
    try {
      const [user] = await app.database.insert(users).values({ ...input.data, passwordHash: await hashPassword(input.data.password) }).returning({ id: users.id, role: users.role });
      return reply.code(201).send({ token: await signToken({ userId: user.id, role: user.role as AuthRole }) });
    } catch (error: unknown) { if (isUniqueViolation(error)) return reply.code(409).send({ message: 'email already registered' }); throw error; }
  });
  app.post('/auth/login', async (request, reply) => {
    const key = request.ip, now = Date.now(), limit = env.LOGIN_RATE_LIMIT_MAX, prior = attempts.get(key);
    if (prior && prior.resetAt > now && prior.count >= limit) return reply.code(429).send({ message: 'too many login attempts; try again later' });
    const input = z.object({ email: z.string().email(), password: z.string() }).safeParse(request.body);
    const invalid = async () => { const current = attempts.get(key), windowMs = env.LOGIN_RATE_LIMIT_WINDOW_SECONDS * 1000; attempts.set(key, !current || current.resetAt <= now ? { count: 1, resetAt: now + windowMs } : { ...current, count: current.count + 1 }); return reply.code(401).send({ message: 'invalid credentials' }); };
    if (!input.success) return invalid();
    const [user] = await app.database.select().from(users).where(eq(users.email, input.data.email.toLowerCase())).limit(1);
    if (!user || !(await verifyPassword(user.passwordHash, input.data.password))) return invalid();
    attempts.delete(key);
    return { token: await signToken({ userId: user.id, role: user.role as AuthRole }) };
  });
  app.post('/admin/users', { preHandler: [app.authenticate, requireRoles('administrator')] }, async (request, reply) => {
    const input = accountSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ message: input.error.issues[0]?.message ?? 'invalid account' });
    if (!['doctor', 'administrator'].includes(input.data.role)) return reply.code(400).send({ message: 'admin endpoint only creates doctor or administrator accounts' });
    try { const [user] = await app.database.insert(users).values({ ...input.data, passwordHash: await hashPassword(input.data.password) }).returning({ id: users.id, role: users.role, email: users.email }); return reply.code(201).send(user); }
    catch (error: unknown) { if (isUniqueViolation(error)) return reply.code(409).send({ message: 'email already registered' }); throw error; }
  });
}
function isUniqueViolation(error: unknown): boolean { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'; }
