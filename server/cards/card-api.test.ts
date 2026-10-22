// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createEmptyCardDraft } from '../../src/cards/types.js';
import type { CardDraft } from '../../src/cards/types.js';
import { createApp } from '../app.js';
import { createAuth } from '../auth.js';
import { loadConfig } from '../config.js';
import { createMongoTestDatabase } from '../test/mongo-test-db.js';

const origin = 'http://localhost:5173';
let app: ReturnType<typeof createApp>;
let testDatabase: Awaited<ReturnType<typeof createMongoTestDatabase>>;
let nextEmail = 1;

function draft(overrides: Partial<CardDraft> = {}): CardDraft {
  return {
    ...createEmptyCardDraft(),
    name: 'Jinx',
    title: 'Loose Cannon',
    type: 'Unit',
    supertypes: ['Champion'],
    domains: ['Fury', 'Chaos'],
    energyCost: 4,
    powerCost: 1,
    might: 4,
    tags: ['Jinx', 'Zaun'],
    keywords: ['Assault'],
    rulesText: 'When I attack, deal 2 to an enemy unit.',
    set: 'OGN',
    collectorNumber: '030',
    rarity: 'Rare',
    customFields: [{ label: 'Errata', value: 'None yet' }],
    ...overrides
  };
}

async function createAccountCookie(role?: 'admin'): Promise<string> {
  const email = `card-user-${nextEmail++}@example.test`;
  const response = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({ name: 'Card User', email, password: 'test-password-123' });
  expect(response.status).toBe(200);
  if (role) await testDatabase.db.collection('user').updateOne({ email }, { $set: { role } });
  const cookies = response.headers['set-cookie'] as string[] | string | undefined;
  return (Array.isArray(cookies) ? cookies : cookies ? [cookies] : [])
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

beforeAll(async () => {
  testDatabase = await createMongoTestDatabase();
  const config = loadConfig({
    MONGO_URI: testDatabase.uri,
    BETTER_AUTH_SECRET: 'card-api-test-secret-with-more-than-32-characters',
    APP_ORIGIN: origin,
    API_PORT: '3001'
  });
  const auth = createAuth(testDatabase.db, config);
  app = createApp({ auth, db: testDatabase.db });
});

afterAll(async () => {
  await testDatabase?.close();
});

describe('card API', () => {
  it('requires a session to read cards', async () => {
    const response = await request(app).get('/api/cards');

    expect(response.status).toBe(401);
  });

  it('lets only admins create, update, and delete cards', async () => {
    const userCookie = await createAccountCookie();
    const id = '000000000000000000000001';

    const responses = await Promise.all([
      request(app).post('/api/cards').set('Cookie', userCookie).send(draft()),
      request(app).put(`/api/cards/${id}`).set('Cookie', userCookie).send(draft()),
      request(app).delete(`/api/cards/${id}`).set('Cookie', userCookie),
      request(app).post('/api/cards/images').set('Cookie', userCookie).set('Content-Type', 'image/png').send(Buffer.from('png'))
    ]);

    expect(responses.map(({ status }) => status)).toEqual([403, 403, 403, 403]);
  });

  it('creates, lists, updates, and deletes a card as admin', async () => {
    const adminCookie = await createAccountCookie('admin');
    const userCookie = await createAccountCookie();

    const created = await request(app).post('/api/cards').set('Cookie', adminCookie).send(draft());
    expect(created.status).toBe(201);
    expect(created.body.card).toMatchObject(draft());
    expect(created.body.card).not.toHaveProperty('createdBy');

    const listed = await request(app).get('/api/cards').set('Cookie', userCookie);
    expect(listed.body.cards.map((card: { id: string }) => card.id)).toContain(created.body.card.id);

    const updated = await request(app)
      .put(`/api/cards/${created.body.card.id}`)
      .set('Cookie', adminCookie)
      .send(draft({ might: 5, keywords: ['Assault', 'Assault', 'Tank'] }));
    expect(updated.status).toBe(200);
    expect(updated.body.card.might).toBe(5);
    expect(updated.body.card.keywords).toEqual(['Assault', 'Tank']);

    const deleted = await request(app).delete(`/api/cards/${created.body.card.id}`).set('Cookie', adminCookie);
    expect(deleted.status).toBe(204);
    const missing = await request(app).get(`/api/cards/${created.body.card.id}`).set('Cookie', adminCookie);
    expect(missing.status).toBe(404);
  });

  it('rejects invalid card content', async () => {
    const adminCookie = await createAccountCookie('admin');

    const responses = await Promise.all([
      request(app).post('/api/cards').set('Cookie', adminCookie).send(draft({ name: '  ' })),
      request(app).post('/api/cards').set('Cookie', adminCookie).send({ ...draft(), type: 'Wizard' }),
      request(app).post('/api/cards').set('Cookie', adminCookie).send(draft({ energyCost: -1 })),
      request(app).post('/api/cards').set('Cookie', adminCookie).send(draft({ imageUrl: 'javascript:alert(1)' }))
    ]);

    expect(responses.map(({ status }) => status)).toEqual([400, 400, 400, 400]);
  });

  it('stores uploaded images and serves them back', async () => {
    const adminCookie = await createAccountCookie('admin');
    const userCookie = await createAccountCookie();
    const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

    const uploaded = await request(app)
      .post('/api/cards/images')
      .set('Cookie', adminCookie)
      .set('Content-Type', 'image/png')
      .send(bytes);
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.imageUrl).toMatch(/^\/api\/cards\/images\/[a-f\d]{24}$/);

    const served = await request(app).get(uploaded.body.imageUrl).set('Cookie', userCookie);
    expect(served.status).toBe(200);
    expect(served.headers['content-type']).toBe('image/png');
    expect(Buffer.compare(served.body as Buffer, bytes)).toBe(0);

    const rejected = await request(app)
      .post('/api/cards/images')
      .set('Cookie', adminCookie)
      .set('Content-Type', 'text/plain')
      .send('not an image');
    expect(rejected.status).toBe(400);
  });
});
