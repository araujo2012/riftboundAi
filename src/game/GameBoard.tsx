import { ArrowLeft, Dices, Hand, RotateCw, Swords } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useCardCatalog, type CardCatalog } from '../cards/card-catalog.js';
import { cardTypeLabels, type Card } from '../cards/types.js';
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

type InspectedCard = { name: string; section?: CardInstance['section'] };

const zoneNames: { zone: PlayerZoneName; label: string }[] = [
  { zone: 'base', label: 'Base' },
  { zone: 'legend', label: 'Lenda' },
  { zone: 'champion', label: 'Campeão' },
  { zone: 'mainDeck', label: 'Deck principal' },
  { zone: 'hand', label: 'Mão' },
  { zone: 'trash', label: 'Descarte' },
  { zone: 'runeDeck', label: 'Deck de runas' },
  { zone: 'runeZone', label: 'Runas' }
];

const visibleZones = ['legend', 'champion', 'base', 'hand', 'trash', 'runeZone'] as const;

export function GameBoard({ game, onGameChange, onChangeDecks }: GameBoardProps) {
  const catalog = useCardCatalog();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<InspectedCard | null>(null);
  const [destinationValue, setDestinationValue] = useState('player-0-trash');
  const selectedCard = findVisibleCard(game, selectedCardId);
  const inspectedCard = hoveredCard ?? selectedCard ?? null;

  function moveSelectedCard(): void {
    if (!selectedCardId) return;
    onGameChange(moveCard(game, selectedCardId, destinationFromValue(destinationValue)));
    setSelectedCardId(null);
  }

  function toggleSelection(cardId: string): void {
    setSelectedCardId((current) => current === cardId ? null : cardId);
  }

  const boardProps = {
    catalog,
    game,
    onDraw: (seat: PlayerIndex, pile: 'main' | 'rune') => onGameChange(drawCard(game, seat, pile)),
    onInspect: setHoveredCard,
    onSelectCard: toggleSelection,
    onShuffle: (seat: PlayerIndex, pile: 'main' | 'rune') => onGameChange(shuffleZone(game, seat, pile)),
    selectedCardId
  };

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

      <div className="game-table">
        <div className="table-surface">
          <PlayerBoard {...boardProps} seat={1} />

          <section className="battlefield-row" aria-label="Campos compartilhados">
            {game.battlefields.map((field, slot) => (
              <section
                className={`battlefield-zone battlefield-${slot}`}
                data-testid={`battlefield-${slot}`}
                key={`${slot}-${field.name}`}
              >
                <header className="zone-heading battlefield-heading">
                  <h3>Campo compartilhado {slot + 1}</h3>
                </header>
                <div className="battlefield-body">
                  <BattlefieldArt
                    catalog={catalog}
                    name={field.name}
                    onInspect={setHoveredCard}
                  />
                  <div className="battlefield-sides">
                    {([1, 0] as const).map((owner) => (
                      <CardRow
                        cards={field.cards.filter((card) => card.owner === owner)}
                        catalog={catalog}
                        className={`battlefield-side side-seat-${owner}`}
                        key={owner}
                        onInspect={setHoveredCard}
                        onSelectCard={toggleSelection}
                        selectedCardId={selectedCardId}
                      />
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </section>

          <PlayerBoard {...boardProps} seat={0} />
        </div>

        <CardInspector card={inspectedCard} catalog={catalog} />
      </div>
      <p className="game-footnote">Mesa livre · clique numa carta para movê-la · passe o mouse para ampliar · {game.players[0].deckName} x {game.players[1].deckName}</p>
    </main>
  );
}

type PlayerBoardProps = {
  catalog: CardCatalog;
  game: GameState;
  seat: PlayerIndex;
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onInspect: (card: InspectedCard | null) => void;
  onDraw: (seat: PlayerIndex, pile: 'main' | 'rune') => void;
  onShuffle: (seat: PlayerIndex, pile: 'main' | 'rune') => void;
};

function PlayerBoard({
  catalog,
  game,
  seat,
  selectedCardId,
  onSelectCard,
  onInspect,
  onDraw,
  onShuffle
}: PlayerBoardProps) {
  const player = game.players[seat];
  const zoneProps = { catalog, onInspect, onSelectCard, selectedCardId };

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

      <div className="player-mat">
        <PileZone
          area="rune-deck"
          cards={player.zones.runeDeck}
          drawLabel="Comprar runa"
          kind="rune"
          label="Runas"
          onDraw={() => onDraw(seat, 'rune')}
          onShuffle={() => onShuffle(seat, 'rune')}
          shuffleIcon={<Dices size={13} aria-hidden="true" />}
          shuffleLabel="Embaralhar runas"
          testId={`player-${seat}-rune-deck`}
        />
        <CardZone
          {...zoneProps}
          area="runes"
          cards={player.zones.runeZone}
          className="rune-zone"
          emptyText="Sem runas na zona"
          label={`Zona de runas · ${player.zones.runeZone.length}`}
          testId={`player-${seat}-rune-zone`}
        />
        <CardZone
          {...zoneProps}
          area="base"
          cards={player.zones.base}
          className="base-zone"
          emptyText="Base vazia"
          label={`Base · ${player.zones.base.length}`}
          testId={`player-${seat}-base`}
        />
        <CardZone
          {...zoneProps}
          area="legend"
          cards={player.zones.legend}
          className="slot-zone"
          emptyText="Lenda"
          label="Lenda"
          testId={`player-${seat}-legend`}
        />
        <CardZone
          {...zoneProps}
          area="champion"
          cards={player.zones.champion}
          className="slot-zone"
          emptyText="Campeão"
          label="Campeão"
          testId={`player-${seat}-champion`}
        />
        <CardZone
          {...zoneProps}
          area="hand"
          cards={player.zones.hand}
          className="hand-zone"
          emptyText="A mão está vazia"
          label={`Mão · ${player.zones.hand.length}`}
          testId={`player-${seat}-hand`}
        />
        <PileZone
          area="main-deck"
          cards={player.zones.mainDeck}
          drawLabel="Comprar carta"
          kind="main"
          label="Deck"
          onDraw={() => onDraw(seat, 'main')}
          onShuffle={() => onShuffle(seat, 'main')}
          shuffleIcon={<RotateCw size={13} aria-hidden="true" />}
          shuffleLabel="Embaralhar deck"
          testId={`player-${seat}-main-deck`}
        />
        <CardZone
          {...zoneProps}
          area="trash"
          cards={player.zones.trash}
          className="trash-zone"
          emptyText="Sem cartas"
          label={`Descarte · ${player.zones.trash.length}`}
          testId={`player-${seat}-trash`}
        />
      </div>
    </section>
  );
}

type CardRowProps = {
  catalog: CardCatalog;
  cards: CardInstance[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onInspect: (card: InspectedCard | null) => void;
  className?: string;
  emptyText?: string;
};

function CardRow({ catalog, cards, selectedCardId, onSelectCard, onInspect, className = '', emptyText }: CardRowProps) {
  return (
    <div className={`zone-cards ${className}`}>
      {cards.length ? (
        cards.map((card) => (
          <GameCard
            card={card}
            catalogCard={catalog.find(card.name)}
            key={card.id}
            onInspect={onInspect}
            onSelect={onSelectCard}
            selected={selectedCardId === card.id}
          />
        ))
      ) : (
        emptyText && <span className="zone-empty">{emptyText}</span>
      )}
    </div>
  );
}

function CardZone({
  label,
  area,
  testId,
  className = '',
  children,
  ...rowProps
}: CardRowProps & {
  label: string;
  area: string;
  testId: string;
  children?: ReactNode;
}) {
  return (
    <section className={`card-zone ${className}`} data-testid={testId} style={{ gridArea: area }}>
      <header className="zone-heading">
        <h3>{label}</h3>
      </header>
      {children}
      <CardRow {...rowProps} />
    </section>
  );
}

function PileZone({
  label,
  area,
  cards,
  kind,
  testId,
  drawLabel,
  shuffleLabel,
  shuffleIcon,
  onDraw,
  onShuffle
}: {
  label: string;
  area: string;
  cards: CardInstance[];
  kind: 'main' | 'rune';
  testId: string;
  drawLabel: string;
  shuffleLabel: string;
  shuffleIcon: ReactNode;
  onDraw: () => void;
  onShuffle: () => void;
}) {
  return (
    <section className={`card-zone pile-zone ${kind}-pile`} data-testid={testId} style={{ gridArea: area }}>
      <header className="zone-heading">
        <h3>{label}</h3>
        <button
          aria-label={shuffleLabel}
          className="pile-shuffle"
          onClick={onShuffle}
          title={shuffleLabel}
          type="button"
        >
          {shuffleIcon}
        </button>
      </header>
      <button
        aria-label={drawLabel}
        className="pile-stack"
        disabled={cards.length === 0}
        onClick={onDraw}
        title={drawLabel}
        type="button"
      >
        {cards.length > 0 ? <CardBack kind={kind} /> : <span className="pile-empty">Vazio</span>}
        <span className="pile-count">{cards.length}</span>
      </button>
    </section>
  );
}

function CardBack({ kind }: { kind: 'main' | 'rune' }) {
  return (
    <span className={`card-back card-back-${kind}`} aria-hidden="true">
      <span className="card-back-emblem" />
    </span>
  );
}

function GameCard({
  card,
  catalogCard,
  selected,
  onSelect,
  onInspect
}: {
  card: CardInstance;
  catalogCard: Card | undefined;
  selected: boolean;
  onSelect: (cardId: string) => void;
  onInspect: (card: InspectedCard | null) => void;
}) {
  const domain = catalogCard?.domains[0]?.toLowerCase() ?? 'colorless';

  return (
    <button
      aria-pressed={selected}
      aria-label={`Selecionar carta ${card.name}`}
      className={`game-card domain-${domain} owner-${card.owner}${selected ? ' is-selected' : ''}`}
      onBlur={() => onInspect(null)}
      onClick={() => onSelect(card.id)}
      onFocus={() => onInspect(card)}
      onMouseEnter={() => onInspect(card)}
      onMouseLeave={() => onInspect(null)}
      title={card.name}
      type="button"
    >
      <CardFace card={catalogCard} name={card.name} section={card.section} />
    </button>
  );
}

function CardFace({ card, name, section }: { card: Card | undefined; name: string; section?: CardInstance['section'] | undefined }) {
  if (card?.imageUrl) {
    return <img alt="" className="card-face-image" draggable={false} loading="lazy" src={card.imageUrl} />;
  }

  const cost = card?.energyCost;
  return (
    <span className={`card-face-text type-${(section ?? 'maindeck').toLowerCase()}`}>
      {cost !== null && cost !== undefined && <span className="card-face-cost">{cost}</span>}
      <span className="card-face-name">{name}</span>
      {card && <span className="card-face-type">{cardTypeLabels[card.type]}</span>}
    </span>
  );
}

function BattlefieldArt({
  catalog,
  name,
  onInspect
}: {
  catalog: CardCatalog;
  name: string;
  onInspect: (card: InspectedCard | null) => void;
}) {
  const card = catalog.find(name);
  const hasField = name !== 'Campo vazio';

  return (
    <div
      className={`battlefield-art${card?.imageUrl ? ' has-image' : ''}`}
      onMouseEnter={() => hasField && onInspect({ name, section: 'Battlefields' })}
      onMouseLeave={() => onInspect(null)}
    >
      {card?.imageUrl && <LandscapeImage src={card.imageUrl} />}
      <div className="battlefield-name">
        <Swords size={14} aria-hidden="true" />
        <span>{name}</span>
      </div>
    </div>
  );
}

// Battlefield cards are printed sideways, so catalog scans usually arrive in
// portrait; rotate those to sit flat on the table.
function LandscapeImage({ src }: { src: string }) {
  const [isPortrait, setIsPortrait] = useState(false);

  return (
    <div className="landscape-frame">
      <img
        alt=""
        className={isPortrait ? 'is-rotated' : undefined}
        draggable={false}
        onLoad={(event) => setIsPortrait(event.currentTarget.naturalHeight > event.currentTarget.naturalWidth)}
        src={src}
      />
    </div>
  );
}

function CardInspector({ card, catalog }: { card: InspectedCard | null; catalog: CardCatalog }) {
  const details = card ? catalog.find(card.name) : undefined;

  return (
    <aside aria-label="Detalhes da carta" className="card-inspector">
      {card ? (
        <>
          {details?.type === 'Battlefield' && details.imageUrl ? (
            <div className="inspector-art is-landscape"><LandscapeImage src={details.imageUrl} /></div>
          ) : (
            <div className="inspector-art">
              <CardFace card={details} name={card.name} section={card.section} />
            </div>
          )}
          <div className="inspector-body">
            <h2>{card.name}</h2>
            {details && <p className="inspector-type">{cardTypeLabels[details.type]}{details.tags.length > 0 && ` · ${details.tags.join(' · ')}`}</p>}
            {details?.rulesText && <p className="inspector-rules">{details.rulesText}</p>}
            {!details && <p className="inspector-missing">Carta sem cadastro no catálogo.</p>}
          </div>
        </>
      ) : (
        <div className="inspector-empty">
          <CardBack kind="main" />
          <span>Passe o mouse sobre uma carta para ampliar</span>
        </div>
      )}
    </aside>
  );
}

function findVisibleCard(game: GameState, cardId: string | null): CardInstance | undefined {
  if (!cardId) return undefined;

  for (const player of game.players) {
    for (const zoneName of visibleZones) {
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
