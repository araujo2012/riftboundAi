import type { SavedDeck } from './types.js';

export type DeckDraft = Omit<SavedDeck, 'id'>;

export class DeckApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'DeckApiError';
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
    throw new DeckApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export function createDeckApi(fetcher: typeof fetch) {
  return {
    async listDecks(): Promise<SavedDeck[]> {
      const result = await request<{ decks: SavedDeck[] }>(fetcher, '/api/decks');
      return result.decks;
    },

    async createDeck(draft: DeckDraft): Promise<SavedDeck> {
      const result = await request<{ deck: SavedDeck }>(fetcher, '/api/decks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      return result.deck;
    },

    async updateDeck(id: string, draft: DeckDraft): Promise<SavedDeck> {
      const result = await request<{ deck: SavedDeck }>(fetcher, `/api/decks/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      return result.deck;
    },

    async deleteDeck(id: string): Promise<void> {
      await request<void>(fetcher, `/api/decks/${encodeURIComponent(id)}`, { method: 'DELETE' });
    }
  };
}

const deckApi = createDeckApi(globalThis.fetch.bind(globalThis));

export const listDecks = deckApi.listDecks;
export const createDeck = deckApi.createDeck;
export const updateDeck = deckApi.updateDeck;
export const deleteDeck = deckApi.deleteDeck;
