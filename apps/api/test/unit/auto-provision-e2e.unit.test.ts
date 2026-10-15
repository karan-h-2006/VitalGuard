import Fastify from 'fastify';
import { describe, expect, it, vi } from 'vitest';
import { authPlugin } from '../../src/plugins/auth.js';
import { registerAuthRoutes } from '../../src/features/auth/routes.js';
import { registerDeviceRoutes } from '../../src/features/devices/routes.js';
import { registerAdminGovernanceRoutes } from '../../src/features/governance/admin-routes.js';

import { devices, patientProfiles, users } from '../../src/db/schema.js';
import { env } from '../../src/env.js';

describe('Auto-provisioning & Discovery Verification', () => {
  it('registers a patient, provisions simulated device, and discovers it via internal endpoint', async () => {
    const createdUsers: Record<string, unknown>[] = [];
    const createdProfiles: Record<string, unknown>[] = [];
    const createdDevices: Record<string, unknown>[] = [];

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockImplementation((table: unknown) => ({
        values: vi.fn().mockImplementation((val: Record<string, unknown>) => {
          if (table === users) {
            const user = {
              id: 'patient-auto-id-1234',
              role: 'patient',
              ...val,
              createdAt: new Date(),
            };
            createdUsers.push(user);
            return {
              returning: vi.fn().mockResolvedValue([user]),
            };
          }
          if (table === patientProfiles) {
            createdProfiles.push(val);
            return Promise.resolve([val]);
          }
          if (table === devices) {
            createdDevices.push(val);
            return Promise.resolve([val]);
          }
          return Promise.resolve([val]);
        }),
      })),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const mockDb = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation(() => {
            // For internal discovery endpoint
            return Promise.resolve([
              {
                deviceId: 'device-auto-1234',
                patientId: 'patient-auto-id-1234',
                scenario: 'normal',
              },
            ]);
          }),
        }),
      })),
      transaction: vi
        .fn()
        .mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    };

    const app = Fastify();
    app.decorate('database', mockDb as never);
    await app.register(authPlugin);
    await registerAuthRoutes(app);
    await registerDeviceRoutes(app);
    await registerAdminGovernanceRoutes(app);

    // 1. Patient registration
    const registerRes = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: {
        role: 'patient',
        email: 'autotest@vitalguard.local',
        password: 'Password123!',
      },
    });

    expect(registerRes.statusCode).toBe(201);
    expect(createdDevices.length).toBe(1);
    expect(createdDevices[0]).toMatchObject({
      patientId: 'patient-auto-id-1234',
      isSimulated: true,
      simScenario: 'normal',
      registrationStatus: 'registered',
    });

    // 2. Internal simulated devices endpoint discovery
    (
      env as unknown as { SIMULATOR_SERVICE_TOKEN: string }
    ).SIMULATOR_SERVICE_TOKEN = 'test-discovery-token-secret';

    const discoveryRes = await app.inject({
      method: 'GET',
      url: '/internal/simulated-devices',
      headers: {
        authorization: 'Bearer test-discovery-token-secret',
      },
    });

    expect(discoveryRes.statusCode).toBe(200);
    const discovered = discoveryRes.json();
    expect(discovered).toEqual([
      {
        deviceId: 'device-auto-1234',
        patientId: 'patient-auto-id-1234',
        scenario: 'normal',
      },
    ]);
  });
});
