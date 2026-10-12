import { afterEach, describe, expect, it } from 'vitest';
import type { Database } from '../src/db/client.js';
import { buildApp } from '../src/app.js';
import { signToken } from '../src/auth/tokens.js';
import { doctorProfiles, users } from '../src/db/schema.js';

const doctorId = '11111111-1111-4111-8111-111111111111';
const adminId = '22222222-2222-4222-8222-222222222222';

function databaseMock() {
  let profile: Record<string, unknown> = {
    userId: doctorId,
    status: 'pending',
    specialization: 'Cardiology',
    medicalLicenseNo: 'LICENSE1234',
    institutionId: '33333333-3333-4333-8333-333333333333',
    rejectionReason: null,
  };
  const auditRows: unknown[] = [];
  const database = {
    select: () => {
      let table: unknown;
      const builder = {
        from(value: unknown) {
          table = value;
          return builder;
        },
        where() {
          return builder;
        },
        limit: async () =>
          table === users
            ? [
                {
                  mustChangePassword: false,
                  isSuspended: false,
                  email: 'doctor@example.test',
                },
              ]
            : table === doctorProfiles
              ? [profile]
              : [],
      };
      return builder;
    },
    update: () => {
      let values: Record<string, unknown> = {};
      const builder = {
        set(input: Record<string, unknown>) {
          values = input;
          return builder;
        },
        where() {
          return builder;
        },
        returning: async () => {
          profile = { ...profile, ...values };
          return [profile];
        },
      };
      return builder;
    },
    insert: () => ({
      values: async (value: unknown) => {
        auditRows.push(value);
      },
    }),
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback(database),
  };
  return { database: database as unknown as Database, auditRows };
}

describe('empty JSON request bodies', () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it('approves with an empty JSON body and is idempotent for audit rows', async () => {
    const { database, auditRows } = databaseMock();
    app = await buildApp(database);
    const token = await signToken({ userId: adminId, role: 'administrator' });
    const response = () =>
      app!.inject({
        method: 'POST',
        url: `/admin/doctor-requests/${doctorId}/approve`,
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
      });

    const first = await response();
    const second = await response();
    expect(first.statusCode).toBe(200);
    expect(first.json().status).toBe('approved');
    expect(second.statusCode).toBe(200);
    expect(auditRows).toHaveLength(1);
  });

  it('keeps malformed non-empty JSON as a structured 400', async () => {
    app = await buildApp(databaseMock().database);
    const response = await app.inject({
      method: 'POST',
      url: '/health',
      headers: { 'content-type': 'application/json' },
      payload: '{not-json',
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toHaveProperty('message');
  });

  it('validates a missing rejection reason instead of failing JSON parsing', async () => {
    app = await buildApp(databaseMock().database);
    const token = await signToken({ userId: adminId, role: 'administrator' });
    const response = await app.inject({
      method: 'POST',
      url: `/admin/doctor-requests/${doctorId}/reject`,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: 'REASON_REQUIRED',
      message: 'valid doctor id and reason are required',
    });
  });
});
