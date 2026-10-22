import { describe, expect, it } from 'vitest';
import { parseDeckList } from './parse-deck-list.js';

const sampleDeckList = `Legend:
1 Orianna, Lady of Clockwork

Champion:
1 Orianna, Mechanical Marvel

MainDeck:
3 Defy
3 Discipline
3 Zhonya's Hourglass
3 Stupefy
3 Thousand-Tailed Watcher
3 Guardian Angel
3 Sterak's Gage
3 Honeyfruit
3 Astral Heron
3 Helm of Suppression
3 Resplendent Rostrum
2 Singularity
2 Not So Fast
2 Bellows Breath

Battlefields:
1 Sigil of the Storm
1 Forgotten Monument
1 Cosmic Vista

Runes:
6 Calm Rune
6 Mind Rune`;

describe('parseDeckList', () => {
  it('parses the supplied deck format and preserves sections, names, and quantities', () => {
    const cards = parseDeckList(sampleDeckList);

    expect(cards).toHaveLength(21);
    expect(cards[0]).toEqual({
      section: 'Legend',
      quantity: 1,
      cardName: 'Orianna, Lady of Clockwork'
    });
    expect(cards).toContainEqual({
      section: 'MainDeck',
      quantity: 3,
      cardName: "Zhonya's Hourglass"
    });
    expect(cards).toContainEqual({
      section: 'Battlefields',
      quantity: 1,
      cardName: 'Cosmic Vista'
    });
    expect(cards).toContainEqual({
      section: 'Runes',
      quantity: 6,
      cardName: 'Mind Rune'
    });
  });

  it('accepts section headers without regard to capitalization or surrounding whitespace', () => {
    expect(parseDeckList('  maindeck:  \n2  Defy  ')).toEqual([
      { section: 'MainDeck', quantity: 2, cardName: 'Defy' }
    ]);
  });

  it('reports a line number when a card line is malformed', () => {
    expect(() => parseDeckList('MainDeck:\nDefy')).toThrow(
      'Linha 2: esperado quantidade e nome da carta.'
    );
  });

  it('rejects zero or negative quantities', () => {
    expect(() => parseDeckList('MainDeck:\n0 Defy')).toThrow(
      'Linha 2: a quantidade deve ser um inteiro positivo.'
    );
  });

  it('rejects cards before a recognized section', () => {
    expect(() => parseDeckList('1 Defy')).toThrow(
      'Linha 1: informe uma seção antes das cartas.'
    );
  });
});
