import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from './api-fetch.js';

describe('apiFetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does not send Content-Type when the request has no body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/admin/approve', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer token',
        'Content-Type': 'application/json',
      },
    });

    const sentHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(sentHeaders.has('Content-Type')).toBe(false);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('sets JSON Content-Type when a request has a body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/api/admin/reject', {
      method: 'POST',
      body: '{"reason":"valid reason"}',
    });

    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get('Content-Type'),
    ).toBe('application/json');
  });

  describe('Session handling & error rules', () => {
    it('dispatches vitalguard:session-expired on 401 when request is authenticated', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"Unauthorized"}', { status: 401 }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const dispatchSpy = vi.fn();
      vi.stubGlobal('window', {
        location: { pathname: '/administrator' },
        dispatchEvent: dispatchSpy,
      });

      const res = await apiFetch('/api/admin/patients', {
        headers: { Authorization: 'Bearer valid-jwt' },
      });

      expect(res.status).toBe(401);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
      expect(event.type).toBe('vitalguard:session-expired');
      expect(event.detail.pathname).toBe('/administrator');
    });

    it('does not dispatch session-expired on unauthenticated 401 (e.g. login failure)', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(
          new Response('{"message":"invalid credentials"}', { status: 401 }),
        );
      vi.stubGlobal('fetch', fetchMock);

      const dispatchSpy = vi.fn();
      vi.stubGlobal('window', {
        location: { pathname: '/login' },
        dispatchEvent: dispatchSpy,
      });

      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'bad' }),
      });

      expect(res.status).toBe(401);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    it('dispatches vitalguard:password-change-required on 403 with code PASSWORD_CHANGE_REQUIRED', async () => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: 'PASSWORD_CHANGE_REQUIRED' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const dispatchSpy = vi.fn();
      vi.stubGlobal('window', {
        location: { pathname: '/administrator' },
        dispatchEvent: dispatchSpy,
      });

      const res = await apiFetch('/api/admin/doctors', {
        headers: { Authorization: 'Bearer valid-jwt' },
      });

      expect(res.status).toBe(403);
      expect(dispatchSpy).toHaveBeenCalledTimes(1);
      const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent;
      expect(event.type).toBe('vitalguard:password-change-required');
    });

    it('does not dispatch session-expired or password-change-required on standard 403, 404, or 500', async () => {
      const dispatchSpy = vi.fn();
      vi.stubGlobal('window', {
        location: { pathname: '/administrator' },
        dispatchEvent: dispatchSpy,
      });

      for (const status of [403, 404, 422, 500]) {
        const fetchMock = vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ message: 'Error' }), {
            status,
            headers: { 'Content-Type': 'application/json' },
          }),
        );
        vi.stubGlobal('fetch', fetchMock);

        const res = await apiFetch('/api/admin/resource', {
          headers: { Authorization: 'Bearer valid-jwt' },
        });

        expect(res.status).toBe(status);
        expect(dispatchSpy).not.toHaveBeenCalled();
      }
    });
  });
});
