import { describe, expect, it, vi } from 'vitest';
import Fastify from 'fastify';
import { registerDeviceRoutes } from '../../src/features/devices/routes.js';
import { registerAdminGovernanceRoutes } from '../../src/features/governance/admin-routes.js';
import { authPlugin } from '../../src/plugins/auth.js';
import { signToken } from '../../src/auth/tokens.js';
import { env } from '../../src/env.js';

describe('Device Routes & Discovery', () => {
  it('GET /internal/simulated-devices rejects when token is missing or wrong', async () => {
    // Set a known simulator token
    (
      env as unknown as { SIMULATOR_SERVICE_TOKEN: string }
    ).SIMULATOR_SERVICE_TOKEN = 'secret-simulator-token-12345';

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { mustChangePassword: false, isSuspended: false },
              ]),
          }),
        }),
      }),
    };

    const app = Fastify();
    app.decorate('database', mockDb as never);
    await app.register(authPlugin);
    await registerDeviceRoutes(app);

    // Missing auth header
    const resNoAuth = await app.inject({
      method: 'GET',
      url: '/internal/simulated-devices',
    });
    expect(resNoAuth.statusCode).toBe(401);

    // Wrong token
    const resBadAuth = await app.inject({
      method: 'GET',
      url: '/internal/simulated-devices',
      headers: {
        authorization: 'Bearer wrong-token',
      },
    });
    expect(resBadAuth.statusCode).toBe(401);

    // Mock query for simulated devices
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          {
            deviceId: '00000000-0000-4000-8000-000000000002',
            patientId: '00000000-0000-4000-8000-000000000001',
            scenario: 'normal',
          },
        ]),
      }),
    });

    // Correct token
    const resSuccess = await app.inject({
      method: 'GET',
      url: '/internal/simulated-devices',
      headers: {
        authorization: 'Bearer secret-simulator-token-12345',
      },
    });
    expect(resSuccess.statusCode).toBe(200);
    expect(resSuccess.json()).toEqual([
      {
        deviceId: '00000000-0000-4000-8000-000000000002',
        patientId: '00000000-0000-4000-8000-000000000001',
        scenario: 'normal',
      },
    ]);
  });

  it('GET /internal/simulated-devices returns 503 when token is unconfigured', async () => {
    (
      env as unknown as { SIMULATOR_SERVICE_TOKEN: string | undefined }
    ).SIMULATOR_SERVICE_TOKEN = undefined;

    const app = Fastify();
    app.decorate('database', {} as never);
    await app.register(authPlugin);
    await registerDeviceRoutes(app);

    const res = await app.inject({
      method: 'GET',
      url: '/internal/simulated-devices',
      headers: {
        authorization: 'Bearer any-token',
      },
    });
    expect(res.statusCode).toBe(503);
  });

  it('PATCH /admin/devices/:deviceId updates scenario with audit log', async () => {
    const adminToken = await signToken({
      userId: '00000000-0000-4000-8000-000000000099',
      role: 'administrator',
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: '00000000-0000-4000-8000-000000000002',
                patientId: '00000000-0000-4000-8000-000000000001',
                isSimulated: true,
                simScenario: 'normal',
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      }),
    };

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([
                { mustChangePassword: false, isSuspended: false },
              ]),
          }),
        }),
      }),
      transaction: vi
        .fn()
        .mockImplementation((cb: (tx: typeof mockTx) => unknown) => cb(mockTx)),
    };

    const app = Fastify();
    app.decorate('database', mockDb as never);
    await app.register(authPlugin);
    await registerAdminGovernanceRoutes(app);

    // Invalid body
    const resInvalid = await app.inject({
      method: 'PATCH',
      url: '/admin/devices/00000000-0000-4000-8000-000000000002',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { scenario: 'invalid-scenario' },
    });
    expect(resInvalid.statusCode).toBe(400);

    // Successful update
    const resSuccess = await app.inject({
      method: 'PATCH',
      url: '/admin/devices/00000000-0000-4000-8000-000000000002',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { scenario: 'deteriorating' },
    });
    expect(resSuccess.statusCode).toBe(200);
    expect(resSuccess.json()).toMatchObject({
      deviceId: '00000000-0000-4000-8000-000000000002',
      scenario: 'deteriorating',
      isSimulated: true,
    });
    expect(mockTx.update).toHaveBeenCalled();
    expect(mockTx.insert).toHaveBeenCalled();

    // Successful update with isSimulated: false (hardware toggle)
    const resHardware = await app.inject({
      method: 'PATCH',
      url: '/admin/devices/00000000-0000-4000-8000-000000000002',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { isSimulated: false },
    });
    expect(resHardware.statusCode).toBe(200);
    expect(resHardware.json()).toMatchObject({
      deviceId: '00000000-0000-4000-8000-000000000002',
      isSimulated: false,
    });
  });
});
