// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Db } from 'mongodb';
import { createApp } from './app.js';
import type { createAuth } from './auth.js';

describe('API health endpoint', () => {
  it('returns unavailable when Mongo cannot answer the health check', async () => {
    const db = {
      command: vi.fn().mockRejectedValue(new Error('database unavailable')),
      collection: vi.fn(() => ({}))
    } as unknown as Db;
    const auth = {} as ReturnType<typeof createAuth>;

    const response = await request(createApp({ auth, db })).get('/api/health');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ status: 'unavailable' });
  });
});
