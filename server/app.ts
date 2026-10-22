import express from 'express';
import { toNodeHandler } from 'better-auth/node';
import type { Db } from 'mongodb';
import type { createAuth } from './auth.js';
import { createDeckRoutes } from './decks/deck-routes.js';

type AppOptions = {
  auth: ReturnType<typeof createAuth>;
  db: Db;
};

export function createApp({ auth, db }: AppOptions) {
  const app = express();

  app.all('/api/auth/*splat', toNodeHandler(auth));
  app.use(express.json());
  app.get('/api/health', async (_request, response) => {
    try {
      await db.command({ ping: 1 });
      response.json({ status: 'ok' });
    } catch {
      response.status(503).json({ status: 'unavailable' });
    }
  });
  app.use('/api/decks', createDeckRoutes(auth, db));

  return app;
}
