import { Router } from 'express';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { deckSections } from '../../src/decks/types.js';
import type { createAuth } from '../auth.js';
import { createDeckRepository } from './deck-repository.js';

const deckDraftSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cards: z.array(z.object({
    section: z.enum(deckSections),
    quantity: z.number().int().positive(),
    cardName: z.string().trim().min(1)
  })).min(1),
  sourceText: z.string().refine((value) => value.trim().length > 0)
});

function parseObjectId(value: string): ObjectId | null {
  return /^[a-f\d]{24}$/i.test(value) ? new ObjectId(value) : null;
}

export function createDeckRoutes(auth: ReturnType<typeof createAuth>, db: Db) {
  const router = Router();
  const repository = createDeckRepository(db);

  async function ownerFor(request: Request, response: Response): Promise<string | null> {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      response.status(401).json({ error: 'UNAUTHENTICATED' });
      return null;
    }
    return session.user.id;
  }

  router.get('/', async (request, response) => {
    const ownerId = await ownerFor(request, response);
    if (!ownerId) return;
    response.json({ decks: await repository.listByOwner(ownerId) });
  });

  router.post('/', async (request, response) => {
    const ownerId = await ownerFor(request, response);
    if (!ownerId) return;
    const parsed = deckDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_DECK' });
      return;
    }
    response.status(201).json({ deck: await repository.createForOwner(ownerId, parsed.data) });
  });

  router.get('/:id', async (request, response) => {
    const ownerId = await ownerFor(request, response);
    if (!ownerId) return;
    const id = parseObjectId(request.params.id ?? '');
    const deck = id ? await repository.findByOwner(id, ownerId) : null;
    if (!deck) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.json({ deck });
  });

  router.put('/:id', async (request, response) => {
    const ownerId = await ownerFor(request, response);
    if (!ownerId) return;
    const id = parseObjectId(request.params.id ?? '');
    const parsed = deckDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_DECK' });
      return;
    }
    const deck = id ? await repository.updateByOwner(id, ownerId, parsed.data) : null;
    if (!deck) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.json({ deck });
  });

  router.delete('/:id', async (request, response) => {
    const ownerId = await ownerFor(request, response);
    if (!ownerId) return;
    const id = parseObjectId(request.params.id ?? '');
    const deleted = id ? await repository.deleteByOwner(id, ownerId) : false;
    if (!deleted) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.status(204).end();
  });

  return router;
}
