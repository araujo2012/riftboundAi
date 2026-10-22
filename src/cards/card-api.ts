import type { Card, CardDraft } from './types.js';

export class CardApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'CardApiError';
  }
}

async function request<T>(fetcher: typeof fetch, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetcher(path, {
    credentials: 'same-origin',
    ...init
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        message = body.error;
      }
    } catch {
      // Keep the status-based message when the server did not return JSON.
    }
    throw new CardApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function createCardApi(fetcher: typeof fetch) {
  return {
    async listCards(): Promise<Card[]> {
      const result = await request<{ cards: Card[] }>(fetcher, '/api/cards');
      return result.cards;
    },

    async createCard(draft: CardDraft): Promise<Card> {
      const result = await request<{ card: Card }>(fetcher, '/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      return result.card;
    },

    async updateCard(id: string, draft: CardDraft): Promise<Card> {
      const result = await request<{ card: Card }>(fetcher, `/api/cards/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      return result.card;
    },

    async deleteCard(id: string): Promise<void> {
      await request<void>(fetcher, `/api/cards/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },

    async uploadCardImage(file: Blob): Promise<string> {
      const result = await request<{ imageUrl: string }>(fetcher, '/api/cards/images', {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file
      });
      return result.imageUrl;
    }
  };
}

const cardApi = createCardApi(globalThis.fetch.bind(globalThis));

export const listCards = cardApi.listCards;
export const createCard = cardApi.createCard;
export const updateCard = cardApi.updateCard;
export const deleteCard = cardApi.deleteCard;
export const uploadCardImage = cardApi.uploadCardImage;
