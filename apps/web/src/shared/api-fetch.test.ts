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
});
