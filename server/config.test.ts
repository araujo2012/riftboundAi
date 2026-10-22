// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const validEnvironment = {
  MONGO_URI: 'mongodb://riftbound:local-only@127.0.0.1:27017/riftbound?authSource=admin',
  BETTER_AUTH_SECRET: 'local-test-secret-at-least-32-characters-long',
  APP_ORIGIN: 'http://localhost:5173',
  API_PORT: '3001'
};

describe('loadConfig', () => {
  it('parses a valid local environment', () => {
    expect(loadConfig(validEnvironment)).toEqual({
      mongoUri: validEnvironment.MONGO_URI,
      betterAuthSecret: validEnvironment.BETTER_AUTH_SECRET,
      appOrigin: validEnvironment.APP_ORIGIN,
      apiPort: 3001
    });
  });

  it('rejects a missing Mongo URI', () => {
    expect(() => loadConfig({ ...validEnvironment, MONGO_URI: '' })).toThrow(/MONGO_URI/);
  });

  it('rejects a short Better Auth secret', () => {
    expect(() => loadConfig({ ...validEnvironment, BETTER_AUTH_SECRET: 'short' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('rejects an app origin outside localhost', () => {
    expect(() => loadConfig({ ...validEnvironment, APP_ORIGIN: 'https://example.com' })).toThrow(/APP_ORIGIN/);
  });

  it('rejects a non-integer or out-of-range API port', () => {
    expect(() => loadConfig({ ...validEnvironment, API_PORT: '0' })).toThrow(/API_PORT/);
    expect(() => loadConfig({ ...validEnvironment, API_PORT: '3001.5' })).toThrow(/API_PORT/);
  });
});
