import { z } from 'zod';

const configSchema = z.object({
  MONGO_URI: z.string().refine((value) => {
    try {
      const uri = new URL(value);
      return ['mongodb:', 'mongodb+srv:'].includes(uri.protocol) && Boolean(uri.hostname);
    } catch {
      return false;
    }
  }, 'must be a valid MongoDB connection URI'),
  BETTER_AUTH_SECRET: z.string().min(32),
  APP_ORIGIN: z.string().url().refine((value) => {
    const origin = new URL(value);
    return origin.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(origin.hostname) &&
      origin.pathname === '/' &&
      !origin.search &&
      !origin.hash;
  }, 'must be a localhost HTTP origin'),
  API_PORT: z.coerce.number().int().min(1).max(65535)
});

export type ServerConfig = {
  mongoUri: string;
  betterAuthSecret: string;
  appOrigin: string;
  apiPort: number;
};

export function loadConfig(environment: Record<string, string | undefined>): ServerConfig {
  const result = configSchema.safeParse(environment);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${String(issue.path[0] ?? 'environment')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid server configuration: ${details}`);
  }

  return {
    mongoUri: result.data.MONGO_URI,
    betterAuthSecret: result.data.BETTER_AUTH_SECRET,
    appOrigin: result.data.APP_ORIGIN,
    apiPort: result.data.API_PORT
  };
}
