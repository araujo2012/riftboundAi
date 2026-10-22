// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { createAuth } from './auth.js';
import { loadConfig } from './config.js';
import { createMongoTestDatabase } from './test/mongo-test-db.js';

const origin = 'http://localhost:5173';
const password = 'test-password-123';
let app: ReturnType<typeof createApp>;
let testDatabase: Awaited<ReturnType<typeof createMongoTestDatabase>>;
let nextEmail = 1;

function uniqueEmail(): string {
  return `account-${nextEmail++}@example.test`;
}

function cookieFrom(response: { headers: Record<string, string | string[] | undefined> }): string {
  const cookies = response.headers['set-cookie'];
  const values = Array.isArray(cookies) ? cookies : cookies ? [cookies] : [];
  return values.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

async function signUp(email: string) {
  return request(app)
    .post('/api/auth/sign-up/email')
    .set('Origin', origin)
    .send({ name: 'Test User', email, password });
}

beforeAll(async () => {
  testDatabase = await createMongoTestDatabase();
  const config = loadConfig({
    MONGO_URI: testDatabase.uri,
    BETTER_AUTH_SECRET: 'integration-test-secret-with-more-than-32-characters',
    APP_ORIGIN: origin,
    API_PORT: '3001'
  });
  const auth = createAuth(testDatabase.db, config);
  app = createApp({ auth, db: testDatabase.db });
});

afterAll(async () => {
  await testDatabase?.close();
});

describe('authentication API', () => {
  it('reports healthy only after the Mongo connection is ready', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('registers an account and returns an authenticated session cookie', async () => {
    const email = uniqueEmail();
    const registration = await signUp(email);

    expect(registration.status).toBe(200);
    expect(cookieFrom(registration)).not.toBe('');

    const sessionResponse = await request(app)
      .get('/api/auth/get-session')
      .set('Origin', origin)
      .set('Cookie', cookieFrom(registration));

    expect(sessionResponse.status).toBe(200);
    expect(sessionResponse.body.user.email).toBe(email);
    expect(typeof sessionResponse.body.user.id).toBe('string');
  });

  it('creates new accounts with the user role and exposes it in the session', async () => {
    const email = uniqueEmail();
    const registration = await signUp(email);
    const sessionResponse = await request(app)
      .get('/api/auth/get-session')
      .set('Origin', origin)
      .set('Cookie', cookieFrom(registration));

    expect(sessionResponse.body.user.role).toBe('user');
    expect((await testDatabase.db.collection('user').findOne({ email }))?.role).toBe('user');
  });

  it('ignores a role sent during sign-up', async () => {
    const email = uniqueEmail();
    const registration = await request(app)
      .post('/api/auth/sign-up/email')
      .set('Origin', origin)
      .send({ name: 'Test User', email, password, role: 'admin' });

    expect((await testDatabase.db.collection('user').findOne({ email }))?.role).not.toBe('admin');
    if (registration.status === 200) {
      const sessionResponse = await request(app)
        .get('/api/auth/get-session')
        .set('Origin', origin)
        .set('Cookie', cookieFrom(registration));
      expect(sessionResponse.body.user.role).toBe('user');
    }
  });

  it('exposes the admin role stored in the database', async () => {
    const email = uniqueEmail();
    const registration = await signUp(email);
    await testDatabase.db.collection('user').updateOne({ email }, { $set: { role: 'admin' } });
    const sessionResponse = await request(app)
      .get('/api/auth/get-session')
      .set('Origin', origin)
      .set('Cookie', cookieFrom(registration));

    expect(sessionResponse.body.user.role).toBe('admin');
  });

  it('rejects a duplicate email without creating a second account', async () => {
    const email = uniqueEmail();
    expect((await signUp(email)).status).toBe(200);

    const duplicate = await signUp(email);

    expect(duplicate.status).toBeGreaterThanOrEqual(400);
    expect(await testDatabase.db.collection('user').countDocuments({ email })).toBe(1);
  });

  it('uses the same public error for an unknown email and a wrong password', async () => {
    const email = uniqueEmail();
    await signUp(email);

    const signIn = (loginEmail: string, loginPassword: string) => request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email: loginEmail, password: loginPassword });
    const unknownEmail = await signIn(uniqueEmail(), password);
    const wrongPassword = await signIn(email, 'incorrect-password');

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(unknownEmail.body.message).toBe(wrongPassword.body.message);
  });

  it('logs in and invalidates the session on logout', async () => {
    const email = uniqueEmail();
    await signUp(email);

    const login = await request(app)
      .post('/api/auth/sign-in/email')
      .set('Origin', origin)
      .send({ email, password });
    const sessionCookie = cookieFrom(login);

    expect(login.status).toBe(200);
    expect(sessionCookie).not.toBe('');
    expect((await request(app).get('/api/auth/get-session').set('Cookie', sessionCookie)).body.user.email).toBe(email);

    const logout = await request(app)
      .post('/api/auth/sign-out')
      .set('Origin', origin)
      .set('Cookie', sessionCookie);
    const expiredSession = await request(app)
      .get('/api/auth/get-session')
      .set('Origin', origin)
      .set('Cookie', sessionCookie);

    expect(logout.status).toBe(200);
    expect(expiredSession.body).toBeNull();
  });
});
