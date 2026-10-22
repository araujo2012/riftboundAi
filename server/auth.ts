import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import type { Db } from 'mongodb';
import { defaultUserRole } from '../src/auth/roles.js';
import type { ServerConfig } from './config.js';

export function createAuth(db: Db, config: ServerConfig) {
  return betterAuth({
    database: mongodbAdapter(db),
    baseURL: config.appOrigin,
    secret: config.betterAuthSecret,
    trustedOrigins: [config.appOrigin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8
    },
    user: {
      additionalFields: {
        // Roles are only changed directly in the database; sign-up cannot set them.
        role: {
          type: 'string',
          required: false,
          defaultValue: defaultUserRole,
          input: false
        }
      }
    }
  });
}
