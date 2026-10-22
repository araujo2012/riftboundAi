import { describe, expect, it } from 'vitest';
import type { SavedDeck } from '../decks/types.js';
import {
  createGame,
  drawCard,
  moveCard,
  passTurn,
  shuffleZone,
  type CardDestination,
  type GamePlayer,
  type PlayerIndex
} from './game-state.js';

const makeDeck = (id: string, cards: SavedDeck['cards']): SavedDeck => ({
  id,
  name: id,
  cards,
  sourceText: ''
});

const playerAt = (game: ReturnType<typeof createGame>, seat: PlayerIndex): GamePlayer =>
  game.players[seat];

describe('game state', () => {
  const deckA = makeDeck('a', [
    { section: 'Legend', quantity: 1, cardName: 'Legend A' },
    { section: 'Champion', quantity: 1, cardName: 'Champion A' },
    { section: 'MainDeck', quantity: 2, cardName: 'Unit A' },
    { section: 'Runes', quantity: 2, cardName: 'Calm Rune' },
    { section: 'Battlefields', quantity: 1, cardName: 'Field A' },
    { section: 'Battlefields', quantity: 1, cardName: 'Field B' }
  ]);
  const deckB = makeDeck('b', [
    { section: 'Legend', quantity: 1, cardName: 'Legend B' },
    { section: 'Champion', quantity: 1, cardName: 'Champion B' },
    { section: 'MainDeck', quantity: 1, cardName: 'Unit B' },
    { section: 'Runes', quantity: 1, cardName: 'Mind Rune' },
    { section: 'Battlefields', quantity: 1, cardName: 'Field C' }
  ]);

  it('sets up both seats, base cards, decks, runes, and two shared battlefields', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 42);

    expect(playerAt(game, 0).zones.base.map((card) => card.name)).toEqual([
      'Legend A',
      'Champion A'
    ]);
    expect(playerAt(game, 0).zones.mainDeck).toHaveLength(2);
    expect(playerAt(game, 0).zones.runeDeck).toHaveLength(2);
    expect(game.battlefields.map((field) => field.name)).toEqual([
      'Field A',
      'Field C'
    ]);
  });

  it('creates the same initial shuffle from the same seed', () => {
    const first = createGame([deckA, deckB], ['Field A', 'Field C'], 123);
    const second = createGame([deckA, deckB], ['Field A', 'Field C'], 123);

    expect(
      playerAt(first, 0).zones.mainDeck.map((card) => card.id)
    ).toEqual(playerAt(second, 0).zones.mainDeck.map((card) => card.id));
  });

  it('draws main-deck cards into hand and rune cards into the rune zone', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 10);
    const withCard = drawCard(game, 0, 'main');
    const withRune = drawCard(withCard, 0, 'rune');

    expect(playerAt(withCard, 0).zones.hand).toHaveLength(1);
    expect(playerAt(withCard, 0).zones.mainDeck).toHaveLength(1);
    expect(playerAt(withRune, 0).zones.runeZone).toHaveLength(1);
    expect(playerAt(withRune, 0).zones.runeDeck).toHaveLength(1);
  });

  it('leaves the game unchanged when drawing from an empty pile', () => {
    const deck = makeDeck('empty', []);
    const game = createGame([deck, deck], [null, null], 7);

    expect(drawCard(game, 0, 'main')).toBe(game);
  });

  it('moves selected cards between player zones and a shared battlefield', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 11);
    const withCard = drawCard(game, 0, 'main');
    const selectedCard = playerAt(withCard, 0).zones.hand[0]!;
    const destination: CardDestination = { type: 'battlefield', slot: 1 };
    const moved = moveCard(withCard, selectedCard.id, destination);

    expect(playerAt(moved, 0).zones.hand).toHaveLength(0);
    expect(moved.battlefields[1].cards[0]).toEqual(selectedCard);
  });

  it('moves banished cards out of visible zones while retaining them in state', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 12);
    const withCard = drawCard(game, 0, 'main');
    const selectedCard = playerAt(withCard, 0).zones.hand[0]!;
    const moved = moveCard(withCard, selectedCard.id, { type: 'banished' });

    expect(playerAt(moved, 0).zones.hand).toHaveLength(0);
    expect(playerAt(moved, 0).zones.banished).toEqual([selectedCard]);
  });

  it('does not change state for an unknown card id', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 13);

    expect(
      moveCard(game, 'unknown-card', { type: 'player-zone', player: 0, zone: 'hand' })
    ).toBe(game);
  });

  it('advances the turn after both players pass', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 14);
    const afterFirstPass = passTurn(game);
    const afterRound = passTurn(afterFirstPass);

    expect(afterFirstPass.activePlayer).toBe(1);
    expect(afterFirstPass.turn).toBe(1);
    expect(afterRound.activePlayer).toBe(0);
    expect(afterRound.turn).toBe(2);
  });

  it('shuffles a pile deterministically and advances its random seed', () => {
    const game = createGame([deckA, deckB], ['Field A', 'Field C'], 15);
    const first = shuffleZone(game, 0, 'main');
    const second = shuffleZone(game, 0, 'main');

    expect(playerAt(first, 0).zones.mainDeck.map((card) => card.id)).toEqual(
      playerAt(second, 0).zones.mainDeck.map((card) => card.id)
    );
    expect(first.randomSeed).not.toBe(game.randomSeed);
  });
});
