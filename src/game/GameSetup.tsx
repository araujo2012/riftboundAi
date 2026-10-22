import { useEffect, useState } from 'react';
import { ArrowRight, Swords } from 'lucide-react';
import { createGame } from './game-state.js';
import type { GameState } from './game-state.js';
import type { SavedDeck } from '../decks/types.js';

type GameSetupProps = {
  decks: SavedDeck[];
  onStart: (game: GameState) => void;
  onOpenDecks: () => void;
};

export function GameSetup({ decks, onStart, onOpenDecks }: GameSetupProps) {
  const [deckIds, setDeckIds] = useState<[string, string]>([
    decks[0]?.id ?? '',
    decks[1]?.id ?? decks[0]?.id ?? ''
  ]);
  const [fieldNames, setFieldNames] = useState<[string, string]>([
    firstFieldName(decks.find(({ id }) => id === deckIds[0])),
    defaultFieldName(
      decks.find(({ id }) => id === deckIds[1]),
      firstFieldName(decks.find(({ id }) => id === deckIds[0]))
    )
  ]);

  useEffect(() => {
    setDeckIds(([first, second]) => [
      decks.some(({ id }) => id === first) ? first : decks[0]?.id ?? '',
      decks.some(({ id }) => id === second)
        ? second
        : decks[1]?.id ?? decks[0]?.id ?? ''
    ]);
  }, [decks]);

  const deckOne = decks.find(({ id }) => id === deckIds[0]);
  const deckTwo = decks.find(({ id }) => id === deckIds[1]);
  const firstSelectedField = resolveFieldName(deckOne, fieldNames[0]);
  const selectedFields: [string | null, string | null] = [
    firstSelectedField,
    resolveFieldName(deckTwo, fieldNames[1], firstSelectedField)
  ];

  function startGame(): void {
    if (!deckOne || !deckTwo) return;

    onStart(
      createGame(
        [deckOne, deckTwo],
        selectedFields,
        Date.now()
      )
    );
  }

  if (decks.length === 0) {
    return (
      <main className="page-content setup-page">
        <div className="page-heading">
          <div>
            <p className="eyebrow">MESA LOCAL</p>
            <h1>Preparar partida</h1>
            <p className="page-description">Escolha os decks e abra a mesa para jogar.</p>
          </div>
        </div>
        <section className="no-decks-panel">
          <div className="empty-mark"><Swords size={23} aria-hidden="true" /></div>
          <h2>Sua mesa está pronta</h2>
          <p>Salve pelo menos um deck para iniciar uma partida local.</p>
          <button className="button button-primary" onClick={onOpenDecks} type="button">
            Abrir biblioteca
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="page-content setup-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">MESA LOCAL</p>
          <h1>Preparar partida</h1>
          <p className="page-description">
            Selecione um deck para cada jogador. Os campos compartilhados vêm das listas escolhidas.
          </p>
        </div>
      </div>

      <section className="setup-panel" aria-label="Configuração da partida">
        <div className="setup-seats">
          <SetupSeat
            seat={0}
            decks={decks}
            deck={deckOne}
            fieldName={selectedFields[0] ?? ''}
            onDeckChange={(deckId) => {
              setDeckIds(([_, second]) => [deckId, second]);
              const nextDeck = decks.find(({ id }) => id === deckId);
              setFieldNames(([_, second]) => [
                defaultFieldName(nextDeck, second),
                second
              ]);
            }}
            onFieldChange={(fieldName) => setFieldNames(([_, second]) => [fieldName, second])}
          />
          <div className="versus-mark" aria-hidden="true">VS</div>
          <SetupSeat
            seat={1}
            decks={decks}
            deck={deckTwo}
            fieldName={selectedFields[1] ?? ''}
            onDeckChange={(deckId) => {
              setDeckIds(([first]) => [first, deckId]);
              const nextDeck = decks.find(({ id }) => id === deckId);
              setFieldNames(([first]) => [
                first,
                defaultFieldName(nextDeck, first)
              ]);
            }}
            onFieldChange={(fieldName) => setFieldNames(([first]) => [first, fieldName])}
          />
        </div>
        <div className="setup-footer">
          <span>Partida local · zonas manuais · sem regras automáticas</span>
          <button className="button button-primary" disabled={!deckOne || !deckTwo} onClick={startGame} type="button">
            Iniciar partida
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </div>
      </section>
    </main>
  );
}

function SetupSeat({
  seat,
  decks,
  deck,
  fieldName,
  onDeckChange,
  onFieldChange
}: {
  seat: 0 | 1;
  decks: SavedDeck[];
  deck: SavedDeck | undefined;
  fieldName: string;
  onDeckChange: (deckId: string) => void;
  onFieldChange: (fieldName: string) => void;
}) {
  const fieldOptions = Array.from(
    new Set(deck?.cards.filter((card) => card.section === 'Battlefields').map((field) => field.cardName) ?? [])
  );

  return (
    <section className={`setup-seat seat-${seat}`}>
      <div className="setup-seat-heading">
        <span className="seat-marker">0{seat + 1}</span>
        <div>
          <span className="section-kicker">JOGADOR {seat + 1}</span>
          <h2>{deck?.name ?? 'Selecione um deck'}</h2>
        </div>
      </div>
      <label htmlFor={`setup-deck-${seat}`}>Deck do jogador {seat + 1}</label>
      <select
        aria-label={`Deck do jogador ${seat + 1}`}
        id={`setup-deck-${seat}`}
        onChange={(event) => onDeckChange(event.target.value)}
        value={deck?.id ?? ''}
      >
        {decks.map((savedDeck) => <option key={savedDeck.id} value={savedDeck.id}>{savedDeck.name}</option>)}
      </select>
      <div className="setup-field-list">
        {fieldOptions.length ? (
          <label className="field-label" htmlFor={`setup-field-${seat}`}>
            Campo compartilhado {seat + 1}
            <select
              id={`setup-field-${seat}`}
              onChange={(event) => onFieldChange(event.target.value)}
              value={fieldOptions.includes(fieldName) ? fieldName : fieldOptions[0]}
            >
              {fieldOptions.map((field, index) => <option key={`${field}-${index}`} value={field}>{field}</option>)}
            </select>
          </label>
        ) : (
          <span className="muted-note">Este deck não tem campos cadastrados; o espaço ficará vazio.</span>
        )}
      </div>
    </section>
  );
}

function firstFieldName(deck: SavedDeck | undefined): string {
  return deck?.cards.find((card) => card.section === 'Battlefields')?.cardName ?? '';
}

function defaultFieldName(deck: SavedDeck | undefined, avoidName: string): string {
  const fields = deck?.cards
    .filter((card) => card.section === 'Battlefields')
    .map((card) => card.cardName) ?? [];

  return fields.find((name) => name !== avoidName) ?? fields[0] ?? '';
}

function resolveFieldName(
  deck: SavedDeck | undefined,
  selected: string,
  avoidName: string | null = null
): string | null {
  if (!deck) return null;

  const fieldNames = deck.cards
    .filter((card) => card.section === 'Battlefields')
    .map((card) => card.cardName);

  if (fieldNames.includes(selected) && selected !== avoidName) return selected;
  return fieldNames.find((name) => name !== avoidName) ?? fieldNames[0] ?? null;
}
