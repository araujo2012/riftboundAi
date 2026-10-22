import { useMemo, useState } from 'react';
import { BookOpen, Check, FileText, Plus, Save, Trash2, Upload } from 'lucide-react';
import { exampleDeckList } from './example-deck-list.js';
import { parseDeckList } from './parse-deck-list.js';
import { deckSections, type DeckSection, type SavedDeck } from './types.js';

type DeckLibraryProps = {
  decks: SavedDeck[];
  onSave: (deck: Omit<SavedDeck, 'id'>, existingDeckId?: string) => Promise<SavedDeck>;
  onDelete: (deckId: string) => Promise<void>;
};

const sectionLabels: Record<DeckSection, string> = {
  Legend: 'Lenda',
  Champion: 'Campeão',
  MainDeck: 'Deck principal',
  Battlefields: 'Campos de batalha',
  Runes: 'Runas'
};

export function DeckLibrary({ decks, onSave, onDelete }: DeckLibraryProps) {
  const [deckName, setDeckName] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [editingDeckId, setEditingDeckId] = useState<string | null>(null);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const parsedDeck = useMemo(() => {
    if (!sourceText.trim()) return { cards: [], error: '' };

    try {
      return { cards: parseDeckList(sourceText), error: '' };
    } catch (error) {
      return {
        cards: [],
        error: error instanceof Error ? error.message : 'Não foi possível ler a lista.'
      };
    }
  }, [sourceText]);

  const selectedDeck = decks.find(({ id }) => id === selectedDeckId);
  const totalCards = parsedDeck.cards.reduce((total, card) => total + card.quantity, 0);

  function loadExample(): void {
    setDeckName('Orianna, Mechanical Marvel');
    setSourceText(exampleDeckList);
    setEditingDeckId(null);
    setFormError('');
  }

  function startNewDeck(): void {
    setDeckName('');
    setSourceText('');
    setEditingDeckId(null);
    setFormError('');
  }

  function selectDeck(deck: SavedDeck): void {
    setSelectedDeckId(deck.id);
    setDeckName(deck.name);
    setSourceText(deck.sourceText);
    setEditingDeckId(deck.id);
    setFormError('');
  }

  async function saveCurrentDeck(): Promise<void> {
    const name = deckName.trim();

    if (!name) {
      setFormError('Dê um nome para o deck.');
      return;
    }

    if (parsedDeck.error || parsedDeck.cards.length === 0) {
      setFormError(parsedDeck.error || 'A lista precisa conter pelo menos uma carta.');
      return;
    }

    const deck = {
      name,
      cards: parsedDeck.cards,
      sourceText
    };

    try {
      const savedDeck = await onSave(deck, editingDeckId ?? undefined);
      setSelectedDeckId(savedDeck.id);
      setEditingDeckId(savedDeck.id);
      setFormError('');
    } catch {
      setFormError('Não foi possível salvar o deck. Tente novamente.');
    }
  }

  return (
    <main className="page-content deck-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PREPARAÇÃO</p>
          <h1>Biblioteca de decks</h1>
          <p className="page-description">
            Importe uma lista, confira as cartas e deixe seus decks prontos para a mesa.
          </p>
        </div>
        <button className="button button-secondary" onClick={startNewDeck} type="button">
          <Plus size={16} aria-hidden="true" />
          Novo deck
        </button>
      </div>

      <div className="library-layout">
        <aside className="deck-sidebar" aria-label="Decks salvos">
          <div className="section-heading">
            <div>
              <span className="section-kicker">SUA COLEÇÃO</span>
              <h2>Decks salvos</h2>
            </div>
            <span className="count-badge">{decks.length}</span>
          </div>

          {decks.length === 0 ? (
            <div className="empty-library">
              <BookOpen size={22} aria-hidden="true" />
              <p>Nenhum deck salvo</p>
              <span>Importe uma lista para começar.</span>
            </div>
          ) : (
            <ul className="deck-list">
              {decks.map((deck) => {
                const count = deck.cards.reduce((sum, card) => sum + card.quantity, 0);

                return (
                  <li className="deck-list-item" key={deck.id}>
                    <button
                      aria-current={selectedDeckId === deck.id ? 'true' : undefined}
                      aria-label={`Selecionar deck ${deck.name}`}
                      className={`deck-list-select${selectedDeckId === deck.id ? ' is-selected' : ''}`}
                      onClick={() => selectDeck(deck)}
                      type="button"
                    >
                      <span className="deck-list-name">{deck.name}</span>
                      <span className="deck-list-meta">{count} cartas</span>
                    </button>
                    <button
                      aria-label={`Excluir deck ${deck.name}`}
                      className="icon-button deck-delete"
                      onClick={() => {
                        void onDelete(deck.id);
                        if (selectedDeckId === deck.id) startNewDeck();
                      }}
                      title="Excluir deck"
                      type="button"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {selectedDeck && (
            <div className="selected-deck-summary">
              <span className="section-kicker">RESUMO</span>
              <DeckSummary cards={selectedDeck.cards} />
            </div>
          )}
        </aside>

        <section className="deck-editor" aria-labelledby="deck-editor-title">
          <div className="section-heading editor-heading">
            <div>
              <span className="section-kicker">IMPORTAR LISTA</span>
              <h2 id="deck-editor-title">{editingDeckId ? 'Editar deck' : 'Criar deck'}</h2>
            </div>
            <button className="text-button" onClick={loadExample} type="button">
              <FileText size={15} aria-hidden="true" />
              Carregar exemplo
            </button>
          </div>

          <label className="field-label" htmlFor="deck-name">
            Nome do deck
          </label>
          <input
            autoComplete="off"
            id="deck-name"
            onChange={(event) => setDeckName(event.target.value)}
            placeholder="Ex.: Orianna Control"
            value={deckName}
          />

          <label className="field-label" htmlFor="deck-list">
            Lista do deck
          </label>
          <textarea
            id="deck-list"
            onChange={(event) => setSourceText(event.target.value)}
            placeholder={'Legend:\n1 Nome da carta\n\nChampion:\n1 Nome do campeão\n\nMainDeck:\n3 Nome da carta'}
            spellCheck={false}
            value={sourceText}
          />

          <div className="editor-footer">
            <div aria-live="polite" className={formError || parsedDeck.error ? 'form-message error' : 'form-message'}>
              {formError || parsedDeck.error ? (
                <span>{formError || parsedDeck.error}</span>
              ) : sourceText.trim() ? (
                <span className="valid-message">
                  <Check size={14} aria-hidden="true" />
                  {totalCards} cartas reconhecidas
                </span>
              ) : (
                <span>Cole a lista completa para conferir antes de salvar.</span>
              )}
            </div>
            <button
              className="button button-primary"
              disabled={!sourceText.trim() || Boolean(parsedDeck.error)}
              onClick={saveCurrentDeck}
              type="button"
            >
              {editingDeckId ? <Save size={16} aria-hidden="true" /> : <Upload size={16} aria-hidden="true" />}
              {editingDeckId ? 'Salvar alterações' : 'Salvar deck'}
            </button>
          </div>

          {parsedDeck.cards.length > 0 && !parsedDeck.error && (
            <div className="import-preview">
              <div className="preview-heading">
                <span className="section-kicker">PRÉVIA</span>
                <span>{parsedDeck.cards.length} tipos de carta</span>
              </div>
              <DeckSummary cards={parsedDeck.cards} expanded />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function DeckSummary({
  cards,
  expanded = false
}: {
  cards: SavedDeck['cards'];
  expanded?: boolean;
}) {
  return (
    <div className={`deck-summary${expanded ? ' expanded' : ''}`}>
      {deckSections.map((section) => {
        const sectionCards = cards.filter((card) => card.section === section);
        const quantity = sectionCards.reduce((sum, card) => sum + card.quantity, 0);

        if (!quantity) return null;

        return (
          <div className="summary-section" key={section}>
            <div className="summary-section-heading">
              <span>{sectionLabels[section]}</span>
              <span>{quantity}</span>
            </div>
            {expanded && (
              <ul>
                {sectionCards.map((card, index) => (
                  <li key={`${section}-${card.cardName}-${index}`}>
                    <span>{card.cardName}</span>
                    <span>×{card.quantity}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
