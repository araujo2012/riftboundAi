import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GameSetup } from './GameSetup.js';
import type { SavedDeck } from '../decks/types.js';
import type { GameState } from './game-state.js';

const deck: SavedDeck = {
  id: 'deck-a',
  name: 'Control',
  sourceText: '',
  cards: [
    { section: 'Battlefields', quantity: 1, cardName: 'Field A' },
    { section: 'Battlefields', quantity: 1, cardName: 'Field B' },
    { section: 'Battlefields', quantity: 1, cardName: 'Field C' }
  ]
};

describe('GameSetup', () => {
  it('starts both shared fields on different available battlefields by default', async () => {
    const user = userEvent.setup();
    let startedGame: GameState | undefined;
    render(<GameSetup decks={[deck]} onOpenDecks={() => {}} onStart={(game) => { startedGame = game; }} />);

    await user.click(screen.getByRole('button', { name: 'Iniciar partida' }));

    expect(startedGame?.battlefields.map(({ name }) => name)).toEqual([
      'Field A',
      'Field B'
    ]);
  });
});
