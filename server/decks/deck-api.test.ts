// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';
import { createAuth } from '../auth.js';
import { loadConfig } from '../config.js';
import { createMongoTestDatabase } from '../test/mongo-test-db.js';

const origin = 'http://localhost:5173';
let app: ReturnType<typeof createApp>;
let testDatabase: Awaited<ReturnType<typeof createMongoTestDatabase>>;
let nextEmail = 1;

function draft(name = 'Control deck') {
  return {
    name,
    cards: [{ section: 'Champion', quantity: 1, cardName: 'Rune Mage' }],
    sourceText: 'Champion:\n1 Rune Mage'
  };
}

async function createAccountCookie(): Promise<string> {
  const email = `deck-owner-${nextEmail++}@example.test`;
  const response = await request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({ name: 'Deck Owner', email, password: 'test-password-123' });
  expect(response.status).toBe(200);
  const cookies = response.headers['set-cookie'] as string[] | string | undefined;
  return (Array.isArray(cookies) ? cookies : cookies ? [cookies] : [])
    .map((cookie) => cookie.split(';', 1)[0])
    .join('; ');
}

beforeAll(async () => {
  testDatabase = await createMongoTestDatabase();
  const config = loadConfig({
    MONGO_URI: testDatabase.uri,
    BETTER_AUTH_SECRET: 'deck-api-test-secret-with-more-than-32-characters',
    APP_ORIGIN: origin,
    API_PORT: '3001'
  });
  const auth = createAuth(testDatabase.db, config);
  app = createApp({ auth, db: testDatabase.db });
});

afterAll(async () => {
  await testDatabase?.close();
});

describe('user-owned deck API', () => {
  it('requires a session for every deck operation', async () => {
    const responses = await Promise.all([
      request(app).get('/api/decks'),
      request(app).post('/api/decks').send(draft()),
      request(app).put('/api/decks/000000000000000000000001').send(draft()),
      request(app).delete('/api/decks/000000000000000000000001')
    ]);

    expect(responses.map(({ status }) => status)).toEqual([401, 401, 401, 401]);
  });

  it('returns an empty list for a signed-in account without decks', async () => {
    const cookie = await createAccountCookie();

    const response = await request(app).get('/api/decks').set('Cookie', cookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ decks: [] });
  });

  it('creates, lists, updates, and deletes a deck for its owner', async () => {
    const cookie = await createAccountCookie();
    const created = await request(app)
      .post('/api/decks')
      .set('Cookie', cookie)
      .send(draft());

    expect(created.status).toBe(201);
    expect(created.body.deck).toMatchObject(draft());
    expect(typeof created.body.deck.id).toBe('string');
    expect(created.body.deck).not.toHaveProperty('ownerId');

    const listed = await request(app).get('/api/decks').set('Cookie', cookie);
    expect(listed.body.decks).toHaveLength(1);
    expect(listed.body.decks[0].id).toBe(created.body.deck.id);

    const updated = await request(app)
      .put(`/api/decks/${created.body.deck.id}`)
      .set('Cookie', cookie)
      .send(draft('Updated control deck'));
    expect(updated.status).toBe(200);
    expect(updated.body.deck.name).toBe('Updated control deck');

    const deleted = await request(app)
      .delete(`/api/decks/${created.body.deck.id}`)
      .set('Cookie', cookie);
    expect(deleted.status).toBe(204);
    expect((await request(app).get('/api/decks').set('Cookie', cookie)).body.decks).toEqual([]);
  });

  it('ignores a client-supplied ownerId and keeps the deck private', async () => {
    const ownerCookie = await createAccountCookie();
    const otherCookie = await createAccountCookie();
    const created = await request(app)
      .post('/api/decks')
      .set('Cookie', ownerCookie)
      .send({ ...draft(), ownerId: 'attacker-selected-owner' });

    expect(created.status).toBe(201);
    expect(created.body.deck).not.toHaveProperty('ownerId');

    const otherList = await request(app).get('/api/decks').set('Cookie', otherCookie);
    expect(otherList.body.decks).toEqual([]);
  });

  it('returns the same not-found response for another user and a missing deck', async () => {
    const ownerCookie = await createAccountCookie();
    const otherCookie = await createAccountCookie();
    const created = await request(app)
      .post('/api/decks')
      .set('Cookie', ownerCookie)
      .send(draft());
    const foreignId = created.body.deck.id as string;

    const foreignGet = await request(app).get(`/api/decks/${foreignId}`).set('Cookie', otherCookie);
    const foreignUpdate = await request(app)
      .put(`/api/decks/${foreignId}`)
      .set('Cookie', otherCookie)
      .send(draft('Attempted update'));
    const foreignDelete = await request(app).delete(`/api/decks/${foreignId}`).set('Cookie', otherCookie);
    const missingGet = await request(app)
      .get('/api/decks/000000000000000000000001')
      .set('Cookie', otherCookie);

    expect(foreignGet.status).toBe(404);
    expect(foreignUpdate.status).toBe(404);
    expect(foreignDelete.status).toBe(404);
    expect(foreignGet.body).toEqual(missingGet.body);
  });

  it('rejects invalid deck content', async () => {
    const cookie = await createAccountCookie();

    const response = await request(app)
      .post('/api/decks')
      .set('Cookie', cookie)
      .send({ ...draft(), name: '   ', cards: [{ section: 'Unknown', quantity: 0, cardName: '' }] });

    expect(response.status).toBe(400);
  });
});
