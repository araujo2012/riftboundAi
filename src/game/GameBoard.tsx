import { ArrowLeft, Dices, Hand, RotateCw, Swords } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import {
  drawCard,
  moveCard,
  passTurn,
  shuffleZone,
  type CardDestination,
  type CardInstance,
  type GameState,
  type PlayerIndex,
  type PlayerZoneName
} from './game-state.js';

type GameBoardProps = {
  game: GameState;
  onGameChange: (game: GameState) => void;
  onChangeDecks: () => void;
};

const zoneNames: { zone: PlayerZoneName; label: string }[] = [
  { zone: 'base', label: 'Base' },
  { zone: 'mainDeck', label: 'Deck principal' },
  { zone: 'hand', label: 'Mão' },
  { zone: 'trash', label: 'Descarte' },
  { zone: 'runeDeck', label: 'Deck de runas' },
  { zone: 'runeZone', label: 'Runas' }
];

export function GameBoard({ game, onGameChange, onChangeDecks }: GameBoardProps) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [destinationValue, setDestinationValue] = useState('player-0-trash');
  const selectedCard = findVisibleCard(game, selectedCardId);

  function moveSelectedCard(): void {
    if (!selectedCardId) return;
    onGameChange(moveCard(game, selectedCardId, destinationFromValue(destinationValue)));
    setSelectedCardId(null);
  }

  return (
    <main className="game-page">
      <div className="game-topbar">
        <div className="game-title-group">
          <button
            aria-label="Voltar à preparação"
            className="icon-button back-button"
            onClick={onChangeDecks}
            title="Trocar decks"
            type="button"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </button>
          <div>
            <p className="eyebrow">PARTIDA LOCAL</p>
            <h1>Mesa de jogo</h1>
          </div>
        </div>
        <div className="turn-controls">
          <span className="turn-indicator">
            <span className={`turn-dot seat-${game.activePlayer}`} />
            Turno {game.turn} <span className="turn-divider">/</span> Jogador {game.activePlayer + 1}
          </span>
          <button className="button button-secondary" onClick={() => onGameChange(passTurn(game))} type="button">
            Passar turno
            <ArrowLeft className="turn-arrow" size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {selectedCard && (
        <div className="selection-toolbar" role="region" aria-label="Mover carta selecionada">
          <div className="selection-copy">
            <span className="selection-mark"><Hand size={15} aria-hidden="true" /></span>
            <span><strong>{selectedCard.name}</strong> selecionada</span>
          </div>
          <label htmlFor="card-destination">Destino da carta selecionada</label>
          <select
            id="card-destination"
            onChange={(event) => setDestinationValue(event.target.value)}
            value={destinationValue}
          >
            <optgroup label="Jogador 1">
              {zoneNames.map(({ zone, label }) => (
                <option key={`p0-${zone}`} value={`player-0-${zone}`}>Jogador 1 · {label}</option>
              ))}
            </optgroup>
            <optgroup label="Jogador 2">
              {zoneNames.map(({ zone, label }) => (
                <option key={`p1-${zone}`} value={`player-1-${zone}`}>Jogador 2 · {label}</option>
              ))}
            </optgroup>
            <optgroup label="Compartilhado">
              <option value="field-0">Campo compartilhado 1</option>
              <option value="field-1">Campo compartilhado 2</option>
            </optgroup>
            <option value="banished">Banir carta</option>
          </select>
          <button className="button button-primary move-button" onClick={moveSelectedCard} type="button">
            Mover carta
          </button>
          <button
            aria-label="Cancelar seleção"
            className="icon-button close-selection"
            onClick={() => setSelectedCardId(null)}
            title="Cancelar seleção"
            type="button"
          >
            ×
          </button>
        </div>
      )}

      <div className="table-layout">
        <PlayerBoard
          game={game}
          onDraw={(seat, pile) => onGameChange(drawCard(game, seat, pile))}
          onSelectCard={setSelectedCardId}
          onShuffle={(seat, pile) => onGameChange(shuffleZone(game, seat, pile))}
          seat={1}
          selectedCardId={selectedCardId}
        />

        <section className="battlefield-row" aria-label="Campos compartilhados">
          {game.battlefields.map((field, slot) => (
            <CardZone
              className={`battlefield-zone battlefield-${slot}`}
              key={`${slot}-${field.name}`}
              label={`Campo compartilhado ${slot + 1}`}
              cards={field.cards}
              onSelectCard={setSelectedCardId}
              selectedCardId={selectedCardId}
              testId={`battlefield-${slot}`}
            >
              <div className="battlefield-name">
                <Swords size={14} aria-hidden="true" />
                <span>{field.name}</span>
              </div>
            </CardZone>
          ))}
        </section>

        <PlayerBoard
          game={game}
          onDraw={(seat, pile) => onGameChange(drawCard(game, seat, pile))}
          onSelectCard={setSelectedCardId}
          onShuffle={(seat, pile) => onGameChange(shuffleZone(game, seat, pile))}
          seat={0}
          selectedCardId={selectedCardId}
        />
      </div>
      <p className="game-footnote">Mesa livre · arrume as cartas manualmente · {game.players[0].deckName} x {game.players[1].deckName}</p>
    </main>
  );
}

function PlayerBoard({
  game,
  seat,
  selectedCardId,
  onSelectCard,
  onDraw,
  onShuffle
}: {
  game: GameState;
  seat: PlayerIndex;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onDraw: (seat: PlayerIndex, pile: 'main' | 'rune') => void;
  onShuffle: (seat: PlayerIndex, pile: 'main' | 'rune') => void;
}) {
  const player = game.players[seat];

  return (
    <section
      className={`player-board seat-${seat}${game.activePlayer === seat ? ' is-active' : ''}`}
      data-testid={`player-board-${seat}`}
      aria-label={`Tabuleiro do jogador ${seat + 1}`}
    >
      <header className="player-board-heading">
        <div className="player-identity">
          <span className={`seat-number seat-${seat}`}>0{seat + 1}</span>
          <div>
            <span className="section-kicker">JOGADOR {seat + 1}</span>
            <h2>{player.deckName}</h2>
          </div>
        </div>
        {game.activePlayer === seat && <span className="active-label">EM AÇÃO</span>}
      </header>

      <div className="player-actions">
        <button className="compact-action" onClick={() => onDraw(seat, 'main')} type="button">
          <Hand size={15} aria-hidden="true" />
          Comprar carta
        </button>
        <button className="compact-action" onClick={() => onDraw(seat, 'rune')} type="button">
          <PlusIcon />
          Comprar runa
        </button>
        <button className="compact-action quiet-action" onClick={() => onShuffle(seat, 'main')} type="button">
          <RotateCw size={14} aria-hidden="true" />
          Embaralhar deck
        </button>
        <button className="compact-action quiet-action" onClick={() => onShuffle(seat, 'rune')} type="button">
          <Dices size={14} aria-hidden="true" />
          Embaralhar runas
        </button>
      </div>

      <div className="primary-zones">
        <CardZone
          label={`Base · ${player.zones.base.length}`}
          cards={player.zones.base}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          testId={`player-${seat}-base`}
          emptyText="Base vazia"
        />
        <PileZone
          label={`Deck principal · ${player.zones.mainDeck.length}`}
          cards={player.zones.mainDeck}
          kind="main"
          testId={`player-${seat}-main-deck`}
        />
        <CardZone
          label={`Descarte · ${player.zones.trash.length}`}
          cards={player.zones.trash}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          testId={`player-${seat}-trash`}
          emptyText="Sem cartas"
        />
      </div>

      <CardZone
        className="hand-zone"
        label={`Mão · ${player.zones.hand.length}`}
        cards={player.zones.hand}
        onSelectCard={onSelectCard}
        selectedCardId={selectedCardId}
        testId={`player-${seat}-hand`}
        emptyText="A mão está vazia"
      />

      <div className="rune-zones">
        <CardZone
          label={`Zona de runas · ${player.zones.runeZone.length}`}
          cards={player.zones.runeZone}
          onSelectCard={onSelectCard}
          selectedCardId={selectedCardId}
          testId={`player-${seat}-rune-zone`}
          emptyText="Sem runas na zona"
        />
        <PileZone
          label={`Deck de runas · ${player.zones.runeDeck.length}`}
          cards={player.zones.runeDeck}
          kind="rune"
          testId={`player-${seat}-rune-deck`}
        />
      </div>
    </section>
  );
}

function CardZone({
  label,
  cards,
  onSelectCard,
  selectedCardId,
  testId,
  className = '',
  emptyText,
  children
}: {
  label: string;
  cards: CardInstance[];
  onSelectCard: (cardId: string) => void;
  selectedCardId: string | null;
  testId: string;
  className?: string;
  emptyText?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card-zone ${className}`} data-testid={testId}>
      <header className="zone-heading">
        <h3>{label}</h3>
      </header>
      {children}
      <div className="zone-cards">
        {cards.length ? (
          cards.map((card) => (
            <CardTile
              card={card}
              key={card.id}
              onSelect={onSelectCard}
              selected={selectedCardId === card.id}
            />
          ))
        ) : (
          <span className="zone-empty">{emptyText ?? 'Vazio'}</span>
        )}
      </div>
    </section>
  );
}

function PileZone({
  label,
  cards,
  kind,
  testId
}: {
  label: string;
  cards: CardInstance[];
  kind: 'main' | 'rune';
  testId: string;
}) {
  return (
    <section className={`card-zone pile-zone ${kind}-pile`} data-testid={testId}>
      <header className="zone-heading"><h3>{label}</h3></header>
      <div className="pile-stack" aria-hidden="true">
        <div className="pile-card pile-card-back"><span>R</span></div>
        <span>{cards.length} cartas</span>
      </div>
      <span className="pile-caption">{kind === 'main' ? 'COMPRA NO TOPO' : 'RESERVA DE RUNAS'}</span>
    </section>
  );
}

function CardTile({
  card,
  selected,
  onSelect
}: {
  card: CardInstance;
  selected: boolean;
  onSelect: (cardId: string) => void;
}) {
  return (
    <button
      aria-pressed={selected}
      aria-label={`Selecionar carta ${card.name}`}
      className={`card-tile${selected ? ' is-selected' : ''}`}
      onClick={() => onSelect(card.id)}
      type="button"
    >
      <span className={`card-type-mark type-${card.section.toLowerCase()}`} />
      <span className="card-tile-name">{card.name}</span>
    </button>
  );
}

function PlusIcon() {
  return <span aria-hidden="true" className="plus-icon">+</span>;
}

function findVisibleCard(game: GameState, cardId: string | null): CardInstance | undefined {
  if (!cardId) return undefined;

  for (const player of game.players) {
    for (const zoneName of ['base', 'hand', 'trash', 'runeZone'] as const) {
      const card = player.zones[zoneName].find(({ id }) => id === cardId);
      if (card) return card;
    }
  }

  for (const field of game.battlefields) {
    const card = field.cards.find(({ id }) => id === cardId);
    if (card) return card;
  }

  return undefined;
}

function destinationFromValue(value: string): CardDestination {
  if (value === 'banished') return { type: 'banished' };

  if (value.startsWith('field-')) {
    return { type: 'battlefield', slot: Number(value.slice(-1)) as PlayerIndex };
  }

  const [, playerText, zoneText] = value.split('-');
  return {
    type: 'player-zone',
    player: Number(playerText) as PlayerIndex,
    zone: zoneText as PlayerZoneName
  };
}
