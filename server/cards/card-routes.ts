import express, { Router } from 'express';
import type { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { GridFSBucket, ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Db } from 'mongodb';
import { isAdmin } from '../../src/auth/roles.js';
import {
  cardDomains,
  cardImagePathPrefix,
  cardRarities,
  cardSupertypes,
  cardTypes
} from '../../src/cards/types.js';
import type { createAuth } from '../auth.js';
import { createCardRepository } from './card-repository.js';

const maxImageBytes = 10 * 1024 * 1024;
const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];

const statSchema = z.number().int().min(0).max(999).nullable();
const labelListSchema = z
  .array(z.string().trim().min(1).max(60))
  .max(40)
  .transform((values) => [...new Set(values)]);

const imageUrlSchema = z.string().trim().max(2000).refine((value) => {
  if (!value || value.startsWith(cardImagePathPrefix)) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}, 'must be an uploaded image or an http(s) URL');

const cardDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120),
  type: z.enum(cardTypes),
  supertypes: z.array(z.enum(cardSupertypes)).transform((values) => [...new Set(values)]),
  domains: z.array(z.enum(cardDomains)).transform((values) => [...new Set(values)]),
  energyCost: statSchema,
  powerCost: statSchema,
  might: statSchema,
  mightBonus: statSchema,
  tags: labelListSchema,
  keywords: labelListSchema,
  rulesText: z.string().max(4000),
  flavorText: z.string().max(1000),
  set: z.string().trim().max(60),
  collectorNumber: z.string().trim().max(30),
  rarity: z.enum(cardRarities).nullable(),
  artist: z.string().trim().max(120),
  imageUrl: imageUrlSchema,
  notes: z.string().max(4000),
  customFields: z.array(z.object({
    label: z.string().trim().min(1).max(60),
    value: z.string().max(1000)
  })).max(50)
});

function parseObjectId(value: string): ObjectId | null {
  return /^[a-f\d]{24}$/i.test(value) ? new ObjectId(value) : null;
}

export function createCardRoutes(auth: ReturnType<typeof createAuth>, db: Db) {
  const router = Router();
  const repository = createCardRepository(db);
  const images = new GridFSBucket(db, { bucketName: 'cardImages' });

  async function userFor(request: Request, response: Response) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      response.status(401).json({ error: 'UNAUTHENTICATED' });
      return null;
    }
    return session.user;
  }

  // Any signed-in account can read the card pool; only admins can change it.
  async function adminFor(request: Request, response: Response): Promise<string | null> {
    const user = await userFor(request, response);
    if (!user) return null;
    if (!isAdmin(user)) {
      response.status(403).json({ error: 'FORBIDDEN' });
      return null;
    }
    return user.id;
  }

  router.get('/', async (request, response) => {
    if (!await userFor(request, response)) return;
    response.json({ cards: await repository.list() });
  });

  router.post('/', async (request, response) => {
    const userId = await adminFor(request, response);
    if (!userId) return;
    const parsed = cardDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_CARD' });
      return;
    }
    response.status(201).json({ card: await repository.create(userId, parsed.data) });
  });

  router.post(
    '/images',
    express.raw({ type: allowedImageTypes, limit: maxImageBytes }),
    async (request, response) => {
      const userId = await adminFor(request, response);
      if (!userId) return;
      const contentType = request.get('content-type')?.split(';', 1)[0]?.trim() ?? '';
      if (!allowedImageTypes.includes(contentType) || !Buffer.isBuffer(request.body) || !request.body.length) {
        response.status(400).json({ error: 'INVALID_IMAGE' });
        return;
      }

      const upload = images.openUploadStream(`card-image-${Date.now()}`, {
        metadata: { contentType, uploadedBy: userId }
      });
      await new Promise<void>((resolve, reject) => {
        upload.once('finish', resolve);
        upload.once('error', reject);
        upload.end(request.body);
      });
      response.status(201).json({ imageUrl: `${cardImagePathPrefix}${upload.id.toHexString()}` });
    }
  );

  router.get('/images/:id', async (request, response) => {
    if (!await userFor(request, response)) return;
    const id = parseObjectId(request.params.id ?? '');
    const file = id ? await images.find({ _id: id }).next() : null;
    if (!id || !file) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    const contentType = typeof file.metadata?.contentType === 'string'
      ? file.metadata.contentType
      : 'application/octet-stream';
    response.set({
      'Content-Type': contentType,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, max-age=31536000, immutable'
    });
    images.openDownloadStream(id).pipe(response);
  });

  router.get('/:id', async (request, response) => {
    if (!await userFor(request, response)) return;
    const id = parseObjectId(request.params.id ?? '');
    const card = id ? await repository.find(id) : null;
    if (!card) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.json({ card });
  });

  router.put('/:id', async (request, response) => {
    const userId = await adminFor(request, response);
    if (!userId) return;
    const id = parseObjectId(request.params.id ?? '');
    const parsed = cardDraftSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({ error: 'INVALID_CARD' });
      return;
    }
    const card = id ? await repository.update(id, userId, parsed.data) : null;
    if (!card) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.json({ card });
  });

  router.delete('/:id', async (request, response) => {
    if (!await adminFor(request, response)) return;
    const id = parseObjectId(request.params.id ?? '');
    const deleted = id ? await repository.delete(id) : false;
    if (!deleted) {
      response.status(404).json({ error: 'NOT_FOUND' });
      return;
    }
    response.status(204).end();
  });

  return router;
}
