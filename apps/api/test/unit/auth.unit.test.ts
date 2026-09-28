/**
 * Unit tests — Module 5 Auth & Access Management
 * Uses the JWT_SECRET from vitest.config.ts test env.
 * The rate-limiter tests use a minimal Fastify instance with a mocked database.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import Fastify from 'fastify';
import { z } from 'zod';
import { MINIMUM_PASSWORD_LENGTH } from '../../src/auth/passwords.js';
import { signToken, verifyToken } from '../../src/auth/tokens.js';
import { decideRbacAccess } from '../../src/plugins/auth.js';
import {
  resetLoginRateLimiter,
  registerAuthRoutes,
} from '../../src/features/auth/routes.js';

// The vitest.config.ts sets JWT_SECRET to this value.
const TEST_SECRET = 'test-only-placeholder-not-a-real-secret';
const secretBytes = new TextEncoder().encode(TEST_SECRET);

// ── Password policy ───────────────────────────────────────────────────────────

describe('MINIMUM_PASSWORD_LENGTH', () => {
  it('is exactly 10', () => {
    expect(MINIMUM_PASSWORD_LENGTH).toBe(10);
  });

  it('a string of length 9 fails the Zod min check', () => {
    const result = z
      .string()
      .min(MINIMUM_PASSWORD_LENGTH)
      .safeParse('123456789');
    expect(result.success).toBe(false);
  });

  it('a string of length 10 passes the Zod min check', () => {
    const result = z
      .string()
      .min(MINIMUM_PASSWORD_LENGTH)
      .safeParse('1234567890');
    expect(result.success).toBe(true);
  });
});

// ── JWT sign / verify roundtrip ───────────────────────────────────────────────

describe('signToken / verifyToken roundtrip', () => {
  it('produces a token that verifies and yields the correct payload', async () => {
    const token = await signToken({ userId: 'user-abc', role: 'doctor' });
    const payload = await verifyToken(token);
    expect(payload.userId).toBe('user-abc');
    expect(payload.role).toBe('doctor');
    expect(payload.patientId).toBeUndefined();
  });

  it('includes patientId in the payload for patient role tokens', async () => {
    const token = await signToken({ userId: 'patient-xyz', role: 'patient' });
    const payload = await verifyToken(token);
    expect(payload.role).toBe('patient');
    expect(payload.patientId).toBe('patient-xyz');
  });
});

describe('verifyToken — rejection cases', () => {
  it('rejects an already-expired token', async () => {
    const expiredToken = await new SignJWT({ role: 'doctor' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime(new Date(Date.now() - 5_000)) // expired 5 seconds ago
      .sign(secretBytes);

    await expect(verifyToken(expiredToken)).rejects.toThrow();
  });

  it('rejects a malformed / non-JWT string', async () => {
    await expect(verifyToken('not.a.token')).rejects.toThrow();
  });

  it('rejects a token signed with a different secret', async () => {
    const wrongKeyToken = await new SignJWT({ role: 'doctor' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('user-1')
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(
        new TextEncoder().encode('completely-different-secret-key-padding'),
      );

    await expect(verifyToken(wrongKeyToken)).rejects.toThrow();
  });
});

// ── RBAC decision — pure function ─────────────────────────────────────────────

describe('decideRbacAccess', () => {
  it('administrator always gets access regardless of association', () => {
    expect(
      decideRbacAccess('administrator', 'any-id', 'any-patient', false),
    ).toBe(true);
    expect(decideRbacAccess('administrator', 'a', 'b', true)).toBe(true);
  });

  it('patient gets access when userId matches targetPatientId', () => {
    expect(decideRbacAccess('patient', 'p1', 'p1', false)).toBe(true);
  });

  it('patient is denied when userId does not match targetPatientId', () => {
    expect(decideRbacAccess('patient', 'p1', 'p2', false)).toBe(false);
  });

  it('doctor gets access when association exists', () => {
    expect(decideRbacAccess('doctor', 'd1', 'p1', true)).toBe(true);
  });

  it('doctor is denied when no association exists', () => {
    expect(decideRbacAccess('doctor', 'd1', 'p1', false)).toBe(false);
  });

  it('caregiver gets access when association exists', () => {
    expect(decideRbacAccess('caregiver', 'c1', 'p1', true)).toBe(true);
  });

  it('caregiver is denied when no association exists', () => {
    expect(decideRbacAccess('caregiver', 'c1', 'p1', false)).toBe(false);
  });
});

// ── Rate limiter — attempt counting and window reset ─────────────────────────

/**
 * We test the rate limiter by registering the auth routes on a minimal Fastify
 * instance with a mock database that always returns "no user found", causing
 * every login to fail and increment the attempt counter.
 */
async function buildTestApp() {
  const app = Fastify({ logger: false });

  // Provide the decorators that registerAuthRoutes assumes are present
  app.decorate('database', {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]), // user not found → login fails
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        returning: () => Promise.resolve([{ id: 'u1', role: 'patient' }]),
      }),
    }),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.decorate('authenticate', async (_req: any, reply: any) => {
    await reply.code(403).send({ message: 'admin not tested here' });
  });

  await registerAuthRoutes(app);
  await app.ready();
  return app;
}

const LOGIN_PAYLOAD = JSON.stringify({
  email: 'user@test.com',
  password: 'wrongpassword1',
});

describe('rate limiter', () => {
  beforeEach(() => {
    resetLoginRateLimiter();
  });

  it('allows requests up to the limit (5 by default)', async () => {
    const app = await buildTestApp();
    for (let i = 0; i < 5; i++) {
      const response = await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: LOGIN_PAYLOAD,
      });
      // Each failed attempt should return 401, not 429
      expect(response.statusCode).toBe(401);
    }
    await app.close();
  });

  it('returns 429 on the attempt immediately after the limit is reached', async () => {
    const app = await buildTestApp();

    // Exhaust the limit (5 attempts)
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: LOGIN_PAYLOAD,
      });
    }

    // 6th attempt within the same window → 429
    const blocked = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: LOGIN_PAYLOAD,
    });
    expect(blocked.statusCode).toBe(429);
    await app.close();
  });

  it('resets the counter after resetLoginRateLimiter() is called', async () => {
    const app = await buildTestApp();

    // Exhaust limit then reset
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/auth/login',
        headers: { 'Content-Type': 'application/json' },
        payload: LOGIN_PAYLOAD,
      });
    }

    resetLoginRateLimiter();

    // After reset the first attempt should be 401, not 429
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { 'Content-Type': 'application/json' },
      payload: LOGIN_PAYLOAD,
    });
    expect(response.statusCode).toBe(401);
    await app.close();
  });
});
