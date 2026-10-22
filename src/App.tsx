import { useEffect, useState } from 'react';
import { Layers3, LogOut, PackagePlus, Shield, Swords, UserRound } from 'lucide-react';
import { AddCardsPage } from './admin/AddCardsPage.js';
import { AuthPanel } from './auth/AuthPanel.js';
import { authClient } from './auth/auth-client.js';
import { isAdmin } from './auth/roles.js';
import { createDeck, deleteDeck, DeckApiError, listDecks, updateDeck } from './decks/deck-api.js';
import { DeckLibrary } from './decks/DeckLibrary.js';
import type { SavedDeck } from './decks/types.js';
import { GameBoard } from './game/GameBoard.js';
import { GameSetup } from './game/GameSetup.js';
import type { GameState } from './game/game-state.js';

type AppTab = 'decks' | 'game';
type AppMode = 'user' | 'admin';
type DeckDraft = Omit<SavedDeck, 'id'>;

export default function App() {
  const { data: session, isPending, refetch } = authClient.useSession();
  const [decks, setDecks] = useState<SavedDeck[]>([]);
  const [isLoadingDecks, setIsLoadingDecks] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [activeTab, setActiveTab] = useState<AppTab>('decks');
  const [game, setGame] = useState<GameState | null>(null);
  const [mode, setMode] = useState<AppMode>('user');
  const canAdminister = isAdmin(session?.user);
  const isAdminMode = canAdminister && mode === 'admin';

  useEffect(() => {
    if (!canAdminister) setMode('user');
  }, [canAdminister]);

  useEffect(() => {
    let isActive = true;
    const userId = session?.user.id;

    if (!userId) {
      setDecks([]);
      setIsLoadingDecks(false);
      return () => {
        isActive = false;
      };
    }

    setDecks([]);
    setLibraryError('');
    setIsLoadingDecks(true);
    void listDecks()
      .then((loadedDecks) => {
        if (isActive) setDecks(loadedDecks);
      })
      .catch(async (error: unknown) => {
        if (error instanceof DeckApiError && error.status === 401) {
          await refetch();
          return;
        }
        if (isActive) setLibraryError('Não foi possível carregar seus decks.');
      })
      .finally(() => {
        if (isActive) setIsLoadingDecks(false);
      });

    return () => {
      isActive = false;
    };
  }, [session?.user.id, refetch]);

  async function refetchIfUnauthorized(error: unknown): Promise<boolean> {
    if (!(error instanceof DeckApiError) || error.status !== 401) return false;
    await refetch();
    return true;
  }

  async function handleSaveDeck(deck: DeckDraft, existingDeckId?: string): Promise<SavedDeck> {
    try {
      const savedDeck = existingDeckId
        ? await updateDeck(existingDeckId, deck)
        : await createDeck(deck);
      setDecks((current) => existingDeckId
        ? current.map((item) => item.id === savedDeck.id ? savedDeck : item)
        : [savedDeck, ...current]);
      setLibraryError('');
      return savedDeck;
    } catch (error) {
      await refetchIfUnauthorized(error);
      throw error;
    }
  }

  async function handleDeleteDeck(deckId: string): Promise<void> {
    try {
      await deleteDeck(deckId);
      setDecks((current) => current.filter((deck) => deck.id !== deckId));
      setLibraryError('');
    } catch (error) {
      const wasUnauthorized = await refetchIfUnauthorized(error);
      if (!wasUnauthorized) setLibraryError('Não foi possível excluir o deck. Tente novamente.');
    }
  }

  async function handleSignOut(): Promise<void> {
    try {
      const result = await authClient.signOut();
      if (result.error) setLibraryError('Não foi possível encerrar a sessão. Tente novamente.');
    } catch {
      setLibraryError('Não foi possível encerrar a sessão. Tente novamente.');
    }
  }

  if (isPending) {
    return (
      <div className="app-shell">
        <main className="page-content"><p role="status">Verificando sessão…</p></main>
      </div>
    );
  }

  if (!session?.user) {
    return <div className="app-shell"><AuthPanel /></div>;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a
          aria-label="Riftbound Simulator início"
          className="brand"
          href="#decks"
          onClick={() => {
            setMode('user');
            setActiveTab('decks');
          }}
        >
          <span className="brand-mark"><span /></span>
          <span className="brand-copy">
            <strong>RIFTBOUND</strong>
            <small>{isAdminMode ? 'ADMINISTRAÇÃO' : 'SIMULADOR LOCAL'}</small>
          </span>
        </a>

        {isAdminMode ? (
          <nav aria-label="Navegação de administração" className="primary-nav" role="tablist">
            <button aria-selected className="nav-tab active" role="tab" type="button">
              <PackagePlus size={16} aria-hidden="true" />
              Adicionar cartas
            </button>
          </nav>
        ) : (
          <nav aria-label="Navegação principal" className="primary-nav" role="tablist">
            <button
              aria-selected={activeTab === 'decks'}
              className={`nav-tab${activeTab === 'decks' ? ' active' : ''}`}
              onClick={() => setActiveTab('decks')}
              role="tab"
              type="button"
            >
              <Layers3 size={16} aria-hidden="true" />
              Decks
              <span className="nav-tab-count">{decks.length}</span>
            </button>
            <button
              aria-selected={activeTab === 'game'}
              className={`nav-tab${activeTab === 'game' ? ' active' : ''}`}
              onClick={() => setActiveTab('game')}
              role="tab"
              type="button"
            >
              <Swords size={16} aria-hidden="true" />
              Mesa
            </button>
          </nav>
        )}

        <div className="header-actions">
          <div className="header-identity">
            <strong>{session.user.name || session.user.email}</strong>
            <small>{session.user.email}</small>
          </div>
          {canAdminister && (
            <button
              aria-pressed={isAdminMode}
              className={`button button-secondary header-mode-toggle${isAdminMode ? ' is-admin' : ''}`}
              onClick={() => setMode(isAdminMode ? 'user' : 'admin')}
              type="button"
            >
              {isAdminMode
                ? <UserRound size={15} aria-hidden="true" />
                : <Shield size={15} aria-hidden="true" />}
              {isAdminMode ? 'Modo usuário' : 'Modo admin'}
            </button>
          )}
          <button className="button button-secondary header-sign-out" onClick={() => void handleSignOut()} type="button">
            <LogOut size={15} aria-hidden="true" />
            Sair
          </button>
        </div>
      </header>

      {libraryError && <p className="app-error" role="alert">{libraryError}</p>}

      {isAdminMode && <AddCardsPage />}

      <div hidden={isAdminMode}>
        {isLoadingDecks && <p className="api-status" role="status">Carregando seus decks…</p>}

        <div hidden={activeTab !== 'decks'}>
          <DeckLibrary decks={decks} onDelete={handleDeleteDeck} onSave={handleSaveDeck} />
        </div>

        <div hidden={activeTab !== 'game'}>
          {game ? (
            <GameBoard game={game} onChangeDecks={() => setGame(null)} onGameChange={setGame} />
          ) : (
            <GameSetup decks={decks} onOpenDecks={() => setActiveTab('decks')} onStart={setGame} />
          )}
        </div>
      </div>

      <footer className="app-footer">
        <span>RIFTBOUND AI</span>
        <span>SIMULADOR EM DESENVOLVIMENTO</span>
      </footer>
    </div>
  );
}
