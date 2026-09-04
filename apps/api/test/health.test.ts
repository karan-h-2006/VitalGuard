import { afterAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

const app = await buildApp();

afterAll(async () => {
  await app.close();
});

describe('GET /health', () => {
  it('returns status and uptime', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { status: string; uptimeSeconds: number };
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');
  });
});
