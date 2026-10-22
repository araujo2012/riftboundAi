import { describe, expect, it } from 'vitest';
import { createCardCatalog } from './card-catalog.js';
import { createEmptyCardDraft, type Card } from './types.js';

const makeCard = (id: string, overrides: Partial<Card>): Card => ({
  ...createEmptyCardDraft(),
  id,
  ...overrides
});

describe('card catalog', () => {
  it('matches deck names written as "Name, Title" before falling back to the bare name', () => {
    const catalog = createCardCatalog([
      makeCard('legend', { name: 'Orianna', title: 'Lady of Clockwork', type: 'Legend' }),
      makeCard('champion', { name: 'Orianna', title: 'Mechanical Marvel' }),
      makeCard('spell', { name: 'Defy', type: 'Spell' })
    ]);

    expect(catalog.find('Orianna, Mechanical Marvel')?.id).toBe('champion');
    expect(catalog.find('  orianna,  lady of clockwork ')?.id).toBe('legend');
    expect(catalog.find('Defy')?.id).toBe('spell');
    expect(catalog.find('Unknown card')).toBeUndefined();
  });

  it('prefers the standard printing over alt-art reprints', () => {
    const catalog = createCardCatalog([
      makeCard('showcase', { name: 'Calm Rune', rarity: 'Showcase' }),
      makeCard('standard', { name: 'Calm Rune', rarity: 'Common' }),
      makeCard('later', { name: 'Calm Rune', rarity: 'Common' })
    ]);

    expect(catalog.find('Calm Rune')?.id).toBe('standard');
  });
});
