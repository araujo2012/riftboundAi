import { describe, expect, it, vi } from 'vitest';
import { createDeckApi, DeckApiError } from './deck-api.js';
import type { SavedDeck } from './types.js';

const draft = {
  name: 'Control deck',
  cards: [{ section: 'Champion' as const, quantity: 1, cardName: 'Rune Mage' }],
  sourceText: 'Champion:\n1 Rune Mage'
};
const savedDeck: SavedDeck = { id: 'deck-123', ...draft };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('deck API client', () => {
  it('lists decks with same-origin credentials', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ decks: [savedDeck] }));
    const api = createDeckApi(fetcher);

    await expect(api.listDecks()).resolves.toEqual([savedDeck]);
    expect(fetcher).toHaveBeenCalledWith('/api/decks', { credentials: 'same-origin' });
  });

  it('creates a deck using a JSON POST body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ deck: savedDeck }, 201));
    const api = createDeckApi(fetcher);

    await expect(api.createDeck(draft)).resolves.toEqual(savedDeck);
    expect(fetcher).toHaveBeenCalledWith('/api/decks', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft)
    });
  });

  it('updates a deck using its server id', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ deck: savedDeck }));
    const api = createDeckApi(fetcher);

    await expect(api.updateDeck(savedDeck.id, draft)).resolves.toEqual(savedDeck);
    expect(fetcher).toHaveBeenCalledWith('/api/decks/deck-123', expect.objectContaining({ method: 'PUT' }));
  });

  it('deletes a deck without trying to parse an empty response body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createDeckApi(fetcher);

    await expect(api.deleteDeck(savedDeck.id)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('/api/decks/deck-123', expect.objectContaining({ method: 'DELETE' }));
  });

  it('converts non-success responses to a typed API error', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ error: 'INVALID_DECK' }, 400));
    const api = createDeckApi(fetcher);

    await expect(api.createDeck(draft)).rejects.toMatchObject({
      name: 'DeckApiError',
      status: 400,
      message: 'INVALID_DECK'
    });
    expect(new DeckApiError(400, 'INVALID_DECK')).toBeInstanceOf(Error);
  });
});
