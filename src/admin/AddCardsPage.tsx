import { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Search } from 'lucide-react';
import { CardApiError, createCard, deleteCard, listCards, updateCard, uploadCardImage } from '../cards/card-api.js';
import { cardTypeLabels, cardTypes, createEmptyCardDraft, toCardDraft } from '../cards/types.js';
import type { Card, CardDraft, CardType } from '../cards/types.js';
import { CardEditor } from './CardEditor.js';
import type { CardSuggestions, EditorMessage } from './CardEditor.js';

const knownKeywords = [
  'Accelerate', 'Action', 'Assault', 'Deathknell', 'Deflect', 'Ganking', 'Hidden',
  'Legion', 'Reaction', 'Shield', 'Tank', 'Temporary', 'Vision'
];
const knownSets = ['OGN', 'OGS', 'SFD'];

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

function compareCards(a: Card, b: Card): number {
  return collator.compare(a.set, b.set) ||
    collator.compare(a.collectorNumber, b.collectorNumber) ||
    collator.compare(a.name, b.name);
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set(values)].filter(Boolean).sort(collator.compare);
}

// "030" -> "031", "OGN-009a" -> "OGN-010a"; anything without digits stays empty.
export function nextCollectorNumber(value: string): string {
  const match = /(\d+)(?!.*\d)/.exec(value);
  if (!match) return '';
  const digits = match[1] ?? '';
  const next = String(Number(digits) + 1).padStart(digits.length, '0');
  return value.slice(0, match.index) + next + value.slice(match.index + digits.length);
}

function errorMessage(error: unknown, action: string): string {
  if (error instanceof CardApiError) {
    if (error.status === 401) return 'Sua sessão expirou. Entre novamente.';
    if (error.status === 403) return 'Apenas administradores podem alterar cartas.';
    if (error.status === 400) return 'Dados da carta inválidos. Confira os campos.';
  }
  return `Não foi possível ${action}. Tente novamente.`;
}

function matchesSearch(card: Card, query: string): boolean {
  if (!query) return true;
  const haystack = [card.name, card.title, card.rulesText, card.collectorNumber, ...card.tags, ...card.keywords]
    .join('\n')
    .toLowerCase();
  return query.toLowerCase().split(/\s+/).every((term) => haystack.includes(term));
}

export function AddCardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CardDraft>(createEmptyCardDraft);
  const [baseline, setBaseline] = useState<CardDraft>(createEmptyCardDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<EditorMessage | null>(null);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<CardType | ''>('');
  const [setFilter, setSetFilter] = useState('');

  const isDirty = JSON.stringify(draft) !== JSON.stringify(baseline);

  useEffect(() => {
    let isActive = true;
    void listCards()
      .then((loaded) => {
        if (isActive) setCards([...loaded].sort(compareCards));
      })
      .catch(() => {
        if (isActive) setLoadError('Não foi possível carregar as cartas.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!isDirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty]);

  const suggestions = useMemo<CardSuggestions>(() => ({
    tags: uniqueSorted(cards.flatMap((card) => card.tags)),
    keywords: uniqueSorted([...knownKeywords, ...cards.flatMap((card) => card.keywords)]),
    sets: uniqueSorted([...knownSets, ...cards.map((card) => card.set)]),
    artists: uniqueSorted(cards.map((card) => card.artist))
  }), [cards]);

  const sets = useMemo(() => uniqueSorted(cards.map((card) => card.set)), [cards]);
  const visibleCards = cards.filter((card) =>
    (!typeFilter || card.type === typeFilter) &&
    (!setFilter || card.set === setFilter) &&
    matchesSearch(card, query.trim()));

  const duplicateWarning = useMemo(() => {
    const set = draft.set.trim().toLowerCase();
    const number = draft.collectorNumber.trim().toLowerCase();
    if (!set || !number) return '';
    const duplicate = cards.find((card) =>
      card.id !== selectedId &&
      card.set.toLowerCase() === set &&
      card.collectorNumber.toLowerCase() === number);
    return duplicate ? `Já existe "${duplicate.name}" com ${draft.set} #${draft.collectorNumber}.` : '';
  }, [cards, draft.set, draft.collectorNumber, selectedId]);

  function confirmDiscard(): boolean {
    return !isDirty || window.confirm('Descartar as alterações não salvas desta carta?');
  }

  function openDraft(nextDraft: CardDraft, id: string | null, nextBaseline = nextDraft) {
    setSelectedId(id);
    setDraft(nextDraft);
    setBaseline(nextBaseline);
    setMessage(null);
  }

  function handleNew() {
    if (!confirmDiscard()) return;
    openDraft(createEmptyCardDraft(), null);
  }

  function handleSelect(card: Card) {
    if (card.id === selectedId || !confirmDiscard()) return;
    openDraft(toCardDraft(card), card.id);
  }

  function handleDuplicate() {
    // The copy carries any unsaved edits along, so nothing is discarded here.
    openDraft({ ...draft, collectorNumber: '' }, null, createEmptyCardDraft());
    setMessage({ kind: 'info', text: 'Cópia criada. Ajuste e salve como nova carta.' });
  }

  async function save(): Promise<Card | null> {
    setIsSaving(true);
    setMessage(null);
    try {
      const saved = selectedId ? await updateCard(selectedId, draft) : await createCard(draft);
      setCards((current) => [...current.filter((card) => card.id !== saved.id), saved].sort(compareCards));
      return saved;
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error, 'salvar a carta') });
      return null;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSave() {
    const wasNew = !selectedId;
    const saved = await save();
    if (!saved) return;
    openDraft(toCardDraft(saved), saved.id);
    setMessage({ kind: 'success', text: wasNew ? 'Carta criada.' : 'Alterações salvas.' });
  }

  async function handleSaveAndNext() {
    const saved = await save();
    if (!saved) return;
    const next: CardDraft = {
      ...createEmptyCardDraft(),
      set: saved.set,
      collectorNumber: nextCollectorNumber(saved.collectorNumber)
    };
    openDraft(next, null, next);
    setMessage({ kind: 'success', text: `"${saved.name}" criada. Pronto para a próxima.` });
  }

  async function handleDelete() {
    if (!selectedId || !window.confirm(`Excluir a carta "${baseline.name}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await deleteCard(selectedId);
      setCards((current) => current.filter((card) => card.id !== selectedId));
      openDraft(createEmptyCardDraft(), null);
      setMessage({ kind: 'success', text: 'Carta excluída.' });
    } catch (error) {
      setMessage({ kind: 'error', text: errorMessage(error, 'excluir a carta') });
    }
  }

  return (
    <main className="page-content cards-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ADMINISTRAÇÃO</p>
          <h1>Adicionar cartas</h1>
          <p className="page-description">Cadastre e edite as cartas usadas pelo simulador.</p>
        </div>
        <button className="button button-primary" onClick={handleNew} type="button">
          <Plus size={15} aria-hidden="true" />
          Nova carta
        </button>
      </div>

      <div className="cards-layout">
        <section aria-label="Cartas cadastradas" className="card-sidebar">
          <div className="section-heading">
            <h2>Cartas</h2>
            <span className="count-badge">{cards.length}</span>
          </div>

          <div className="card-filters">
            <div className="search-field">
              <Search size={14} aria-hidden="true" />
              <input
                aria-label="Buscar cartas"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar nome, texto, tag…"
                type="search"
                value={query}
              />
            </div>
            <div className="card-filter-row">
              <select aria-label="Filtrar por tipo" onChange={(event) => setTypeFilter(event.target.value as CardType | '')} value={typeFilter}>
                <option value="">Todos os tipos</option>
                {cardTypes.map((type) => <option key={type} value={type}>{cardTypeLabels[type]}</option>)}
              </select>
              <select aria-label="Filtrar por set" onChange={(event) => setSetFilter(event.target.value)} value={setFilter}>
                <option value="">Todos os sets</option>
                {sets.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>

          {isLoading && <p className="muted-note" role="status">Carregando cartas…</p>}
          {loadError && <p className="form-message error" role="alert">{loadError}</p>}
          {!isLoading && !loadError && cards.length === 0 && (
            <div className="empty-library">
              <PackagePlus size={24} aria-hidden="true" />
              <p>Nenhuma carta ainda</p>
              <span>Preencha o formulário para criar a primeira.</span>
            </div>
          )}
          {cards.length > 0 && visibleCards.length === 0 && <p className="muted-note">Nenhuma carta encontrada.</p>}

          <ul className="card-list">
            {visibleCards.map((card) => (
              <li key={card.id}>
                <button
                  aria-label={`Editar carta ${card.name}`}
                  className={`card-list-item${card.id === selectedId ? ' is-selected' : ''}`}
                  onClick={() => handleSelect(card)}
                  type="button"
                >
                  <span className="card-list-name">{card.name}{card.title && <small>{card.title}</small>}</span>
                  <span className="card-list-meta">
                    <span>{[card.set, card.collectorNumber && `#${card.collectorNumber}`, cardTypeLabels[card.type]].filter(Boolean).join(' · ')}</span>
                    <span className="card-list-domains">
                      {card.domains.map((domain) => (
                        <span className={`domain-dot domain-${domain.toLowerCase()}`} key={domain} title={domain} />
                      ))}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <CardEditor
          draft={draft}
          isDirty={isDirty}
          isNew={!selectedId}
          isSaving={isSaving}
          message={message}
          onChange={(next) => {
            setDraft(next);
            if (message?.kind !== 'error') setMessage(null);
          }}
          onDelete={() => void handleDelete()}
          onDuplicate={handleDuplicate}
          onSave={() => void handleSave()}
          onSaveAndNext={() => void handleSaveAndNext()}
          onUploadImage={uploadCardImage}
          suggestions={suggestions}
          warning={duplicateWarning}
        />
      </div>
    </main>
  );
}
