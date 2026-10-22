import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';
import { DeckApiError } from './decks/deck-api.js';
import type { SavedDeck } from './decks/types.js';

const mocks = vi.hoisted(() => {
  class MockDeckApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  }

  return {
    DeckApiError: MockDeckApiError,
    useSession: vi.fn(),
    signOut: vi.fn(),
    refetchSession: vi.fn(),
    listDecks: vi.fn(),
    createDeck: vi.fn(),
    updateDeck: vi.fn(),
    deleteDeck: vi.fn()
  };
});

vi.mock('./auth/auth-client.js', () => ({
  authClient: {
    useSession: mocks.useSession,
    signOut: mocks.signOut
  }
}));

vi.mock('./decks/deck-api.js', () => ({
  DeckApiError: mocks.DeckApiError,
  listDecks: mocks.listDecks,
  createDeck: mocks.createDeck,
  updateDeck: mocks.updateDeck,
  deleteDeck: mocks.deleteDeck
}));

const signedInSession = {
  user: { id: 'user-1', name: 'Ari Lima', email: 'ari@example.test' },
  session: { id: 'session-1' }
};
const legacyDeckStorageKey = 'riftbound-ai:decks:v1';

function savedDeck(draft: Omit<SavedDeck, 'id'>, id = 'server-deck-id'): SavedDeck {
  return { id, ...draft };
}

describe('authenticated simulator app', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useSession.mockReturnValue({ data: signedInSession, isPending: false, refetch: mocks.refetchSession });
    mocks.signOut.mockResolvedValue({ data: null, error: null });
    mocks.refetchSession.mockResolvedValue({ data: null });
    mocks.listDecks.mockResolvedValue([]);
    mocks.createDeck.mockImplementation(async (draft: Omit<SavedDeck, 'id'>) => savedDeck(draft));
    mocks.updateDeck.mockImplementation(async (id: string, draft: Omit<SavedDeck, 'id'>) => savedDeck(draft, id));
    mocks.deleteDeck.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('shows authentication while signed out', () => {
    mocks.useSession.mockReturnValue({ data: null, isPending: false, refetch: mocks.refetchSession });
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Decks' })).toBeNull();
  });

  it('loads an empty API deck list for a signed-in user', async () => {
    render(<App />);
    await waitFor(() => expect(mocks.listDecks).toHaveBeenCalledTimes(1));
    expect(screen.getByText('Nenhum deck salvo')).toBeTruthy();
  });

  it('refetches the session when loading decks returns unauthorized', async () => {
    mocks.listDecks.mockRejectedValue(new DeckApiError(401, 'UNAUTHENTICATED'));
    render(<App />);

    await waitFor(() => expect(mocks.refetchSession).toHaveBeenCalledTimes(1));
  });

  it('shows the session identity and calls sign-out', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Sair' }));

    expect(screen.getByText('Ari Lima')).toBeTruthy();
    expect(screen.getByText('ari@example.test')).toBeTruthy();
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
  });

  it('hides the admin mode toggle from regular users', async () => {
    render(<App />);
    await screen.findByRole('button', { name: 'Sair' });

    expect(screen.queryByRole('button', { name: 'Modo admin' })).toBeNull();
  });

  it('lets an admin switch to the add-cards screen and back', async () => {
    mocks.useSession.mockReturnValue({
      data: { ...signedInSession, user: { ...signedInSession.user, role: 'admin' } },
      isPending: false,
      refetch: mocks.refetchSession
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole('button', { name: 'Modo admin' }));
    expect(screen.getByRole('heading', { name: 'Adicionar cartas' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: /Decks/ })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Modo usuário' }));
    expect(screen.queryByRole('heading', { name: 'Adicionar cartas' })).toBeNull();
    expect(screen.getByRole('tab', { name: /Decks/ })).toBeTruthy();
  });

  it('creates and renders a deck using the server-returned id', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Carregar exemplo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar deck' }));

    await waitFor(() => expect(mocks.createDeck).toHaveBeenCalledTimes(1));
    expect(mocks.createDeck.mock.calls[0]?.[0]).not.toHaveProperty('id');
    expect(await screen.findByRole('button', { name: 'Selecionar deck Orianna, Mechanical Marvel' })).toBeTruthy();
  });

  it('updates the selected deck using its server id', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Carregar exemplo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar deck' }));
    await screen.findByRole('button', { name: 'Selecionar deck Orianna, Mechanical Marvel' });
    await user.clear(screen.getByLabelText('Nome do deck'));
    await user.type(screen.getByLabelText('Nome do deck'), 'Updated deck');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(mocks.updateDeck).toHaveBeenCalledWith(
      'server-deck-id',
      expect.objectContaining({ name: 'Updated deck' })
    ));
  });

  it('deletes through the API before removing the deck from the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Carregar exemplo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar deck' }));
    await screen.findByRole('button', { name: 'Selecionar deck Orianna, Mechanical Marvel' });
    await user.click(screen.getByRole('button', { name: 'Excluir deck Orianna, Mechanical Marvel' }));

    await waitFor(() => expect(mocks.deleteDeck).toHaveBeenCalledWith('server-deck-id'));
    expect(screen.queryByRole('button', { name: 'Selecionar deck Orianna, Mechanical Marvel' })).toBeNull();
  });

  it('keeps imported text visible after a save error', async () => {
    mocks.createDeck.mockRejectedValue(new Error('offline'));
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Carregar exemplo' }));
    const deckText = screen.getByLabelText('Lista do deck') as HTMLTextAreaElement;
    const importedText = deckText.value;
    await user.click(screen.getByRole('button', { name: 'Salvar deck' }));

    expect(await screen.findByText('Não foi possível salvar o deck. Tente novamente.')).toBeTruthy();
    expect(deckText.value).toBe(importedText);
  });

  it('does not read or clear the legacy deck-storage key', async () => {
    window.localStorage.setItem(legacyDeckStorageKey, 'keep-this-legacy-value');
    const getItemSpy = vi.spyOn(Storage.prototype, 'getItem');
    const removeItemSpy = vi.spyOn(Storage.prototype, 'removeItem');
    const clearSpy = vi.spyOn(Storage.prototype, 'clear');
    render(<App />);

    await waitFor(() => expect(mocks.listDecks).toHaveBeenCalledTimes(1));
    expect(getItemSpy.mock.calls.some(([key]) => key === legacyDeckStorageKey)).toBe(false);
    expect(removeItemSpy).not.toHaveBeenCalled();
    expect(clearSpy).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(legacyDeckStorageKey)).toBe('keep-this-legacy-value');
  });

  it('imports the example deck, starts a local game, draws and moves a card', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'Carregar exemplo' }));
    await user.click(screen.getByRole('button', { name: 'Salvar deck' }));
    await screen.findByRole('button', { name: 'Selecionar deck Orianna, Mechanical Marvel' });

    await user.click(screen.getByRole('tab', { name: 'Mesa' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar partida' }));
    expect(screen.getByRole('heading', { name: 'Mesa de jogo' })).toBeTruthy();

    const playerOne = screen.getByTestId('player-board-0');
    await user.click(within(playerOne).getByRole('button', { name: 'Comprar carta' }));
    expect(within(playerOne).getByText('Mão · 1')).toBeTruthy();

    const hand = within(playerOne).getByTestId('player-0-hand');
    const handCard = within(hand).getByRole('button', { name: /Selecionar carta/ });
    await user.click(handCard);
    await user.selectOptions(screen.getByLabelText('Destino da carta selecionada'), 'player-0-trash');
    await user.click(screen.getByRole('button', { name: 'Mover carta' }));

    expect(within(playerOne).getByText('Descarte · 1')).toBeTruthy();
    expect(within(playerOne).getByText('Mão · 0')).toBeTruthy();
  });
});
