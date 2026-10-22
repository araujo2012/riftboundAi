import { useEffect, useState } from 'react';
import { listCards } from './card-api.js';
import type { Card } from './types.js';

export type CardCatalog = {
  find: (cardName: string) => Card | undefined;
};

const emptyCatalog: CardCatalog = { find: () => undefined };

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

const altArtRarities = new Set(['Showcase', 'Promo']);

// Reprints share a name; favour the standard printing over alt-art variants.
function keepPreferred(index: Map<string, Card>, key: string, card: Card): void {
  const current = index.get(key);
  if (!current || (altArtRarities.has(current.rarity ?? '') && !altArtRarities.has(card.rarity ?? ''))) {
    index.set(key, card);
  }
}

// Deck lists name cards as "Name, Title" while the catalog stores both parts
// separately, so index the full name first and the bare name as a fallback.
export function createCardCatalog(cards: readonly Card[]): CardCatalog {
  const byFullName = new Map<string, Card>();
  const byName = new Map<string, Card>();

  for (const card of cards) {
    if (card.title) keepPreferred(byFullName, normalizeName(`${card.name}, ${card.title}`), card);
    keepPreferred(byName, normalizeName(card.name), card);
  }

  return {
    find(cardName) {
      const key = normalizeName(cardName);
      return byFullName.get(key) ?? byName.get(key);
    }
  };
}

export function useCardCatalog(): CardCatalog {
  const [catalog, setCatalog] = useState<CardCatalog>(emptyCatalog);

  useEffect(() => {
    let isActive = true;
    void listCards()
      .then((cards) => {
        if (isActive) setCatalog(createCardCatalog(cards));
      })
      .catch(() => {
        // The table still works with text-only cards when the catalog is unavailable.
      });

    return () => {
      isActive = false;
    };
  }, []);

  return catalog;
}
