import type { DeckSection, SavedDeck } from '../decks/types.js';

export type PlayerIndex = 0 | 1;
export type DrawPile = 'main' | 'rune';

export type CardInstance = {
  id: string;
  name: string;
  section: DeckSection;
  owner: PlayerIndex;
};

export type PlayerZoneName =
  | 'legend'
  | 'champion'
  | 'base'
  | 'mainDeck'
  | 'hand'
  | 'trash'
  | 'runeDeck'
  | 'runeZone'
  | 'banished';

export type PlayerZones = Record<PlayerZoneName, CardInstance[]>;

export type GamePlayer = {
  deckId: string;
  deckName: string;
  zones: PlayerZones;
};

export type Battlefield = {
  name: string;
  cards: CardInstance[];
};

export type GameState = {
  players: [GamePlayer, GamePlayer];
  battlefields: [Battlefield, Battlefield];
  activePlayer: PlayerIndex;
  turn: number;
  randomSeed: number;
};

export type CardDestination =
  | { type: 'player-zone'; player: PlayerIndex; zone: PlayerZoneName }
  | { type: 'battlefield'; slot: PlayerIndex }
  | { type: 'banished' };

type CardLocation =
  | { type: 'player-zone'; player: PlayerIndex; zone: PlayerZoneName }
  | { type: 'battlefield'; slot: PlayerIndex };

const playerZoneNames: PlayerZoneName[] = [
  'legend',
  'champion',
  'base',
  'mainDeck',
  'hand',
  'trash',
  'runeDeck',
  'runeZone',
  'banished'
];

export function createGame(
  decks: readonly [SavedDeck, SavedDeck],
  battlefieldNames: readonly [string | null, string | null],
  seed = 1
): GameState {
  const firstPlayer = createPlayer(decks[0], 0, normalizeSeed(seed));
  const secondPlayer = createPlayer(decks[1], 1, firstPlayer.randomSeed);
  const players: [GamePlayer, GamePlayer] = [firstPlayer.player, secondPlayer.player];
  const battlefields: [Battlefield, Battlefield] = [
    createBattlefield(decks[0], battlefieldNames[0]),
    createBattlefield(decks[1], battlefieldNames[1])
  ];

  return {
    players,
    battlefields,
    activePlayer: 0,
    turn: 1,
    randomSeed: secondPlayer.randomSeed
  };
}

export function drawCard(
  game: GameState,
  player: PlayerIndex,
  pile: DrawPile
): GameState {
  const zones = game.players[player].zones;
  const source = pile === 'main' ? zones.mainDeck : zones.runeDeck;

  if (source.length === 0) {
    return game;
  }

  const card = source[source.length - 1];
  if (!card) return game;

  const players = clonePlayers(game.players);
  const nextZones = players[player].zones;

  if (pile === 'main') {
    nextZones.mainDeck = source.slice(0, -1);
    nextZones.hand = [...nextZones.hand, card];
  } else {
    nextZones.runeDeck = source.slice(0, -1);
    nextZones.runeZone = [...nextZones.runeZone, card];
  }

  return { ...game, players };
}

export function moveCard(
  game: GameState,
  cardId: string,
  destination: CardDestination
): GameState {
  const location = findCardLocation(game, cardId);

  if (!location || sameLocation(location, destination)) {
    return game;
  }

  const card = getCardAt(game, location, cardId);
  if (!card) return game;

  const players = clonePlayers(game.players);
  const battlefields = cloneBattlefields(game.battlefields);

  if (location.type === 'player-zone') {
    const sourceCards = players[location.player].zones[location.zone];
    players[location.player].zones[location.zone] = sourceCards.filter(
      ({ id }) => id !== cardId
    );
  } else {
    battlefields[location.slot].cards = battlefields[location.slot].cards.filter(
      ({ id }) => id !== cardId
    );
  }

  if (destination.type === 'player-zone') {
    const destinationCards = players[destination.player].zones[destination.zone];
    players[destination.player].zones[destination.zone] = [...destinationCards, card];
  } else if (destination.type === 'battlefield') {
    battlefields[destination.slot].cards = [
      ...battlefields[destination.slot].cards,
      card
    ];
  } else {
    players[card.owner].zones.banished = [
      ...players[card.owner].zones.banished,
      card
    ];
  }

  return { ...game, players, battlefields };
}

export function passTurn(game: GameState): GameState {
  if (game.activePlayer === 0) {
    return { ...game, activePlayer: 1 };
  }

  return { ...game, activePlayer: 0, turn: game.turn + 1 };
}

export function shuffleZone(
  game: GameState,
  player: PlayerIndex,
  pile: DrawPile
): GameState {
  const zones = game.players[player].zones;
  const zoneName = pile === 'main' ? 'mainDeck' : 'runeDeck';
  const shuffled = shuffleCards(zones[zoneName], game.randomSeed);
  const players = clonePlayers(game.players);
  players[player].zones[zoneName] = shuffled.cards;

  return { ...game, players, randomSeed: shuffled.seed };
}

function expandCards(
  deck: SavedDeck,
  owner: PlayerIndex,
  sections: readonly DeckSection[]
): CardInstance[] {
  const cards: CardInstance[] = [];

  deck.cards.forEach((entry, entryIndex) => {
    if (!sections.includes(entry.section)) {
      return;
    }

    for (let copyIndex = 0; copyIndex < entry.quantity; copyIndex += 1) {
      cards.push({
        id: `${owner}:${deck.id}:${entry.section}:${entryIndex}:${copyIndex}`,
        name: entry.cardName,
        section: entry.section,
        owner
      });
    }
  });

  return cards;
}

function createPlayer(
  deck: SavedDeck,
  owner: PlayerIndex,
  seed: number
): { player: GamePlayer; randomSeed: number } {
  const legend = expandCards(deck, owner, ['Legend']);
  const champion = expandCards(deck, owner, ['Champion']);
  const mainDeck = shuffleCards(expandCards(deck, owner, ['MainDeck']), seed);
  const runeDeck = shuffleCards(expandCards(deck, owner, ['Runes']), mainDeck.seed);

  return {
    player: {
      deckId: deck.id,
      deckName: deck.name,
      zones: {
        legend,
        champion,
        base: [],
        mainDeck: mainDeck.cards,
        hand: [],
        trash: [],
        runeDeck: runeDeck.cards,
        runeZone: [],
        banished: []
      }
    },
    randomSeed: runeDeck.seed
  };
}

function createBattlefield(deck: SavedDeck, name: string | null): Battlefield {
  if (!name) return { name: 'Campo vazio', cards: [] };

  const exists = deck.cards.some(
    (card) => card.section === 'Battlefields' && card.cardName === name
  );

  if (!exists) {
    throw new Error(`Campo de batalha não encontrado: ${name}`);
  }

  return { name, cards: [] };
}

function shuffleCards<T>(cards: readonly T[], seed: number): { cards: T[]; seed: number } {
  const shuffled = [...cards];
  let state = normalizeSeed(seed);

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    const swapIndex = state % (index + 1);
    const current = shuffled[index]!;
    const swap = shuffled[swapIndex]!;
    shuffled[index] = swap;
    shuffled[swapIndex] = current;
  }

  return { cards: shuffled, seed: state };
}

function normalizeSeed(seed: number): number {
  const normalized = seed >>> 0;
  return normalized === 0 ? 0x6d2b79f5 : normalized;
}

function clonePlayers(players: [GamePlayer, GamePlayer]): [GamePlayer, GamePlayer] {
  return players.map((player) => ({
    ...player,
    zones: Object.fromEntries(
      playerZoneNames.map((zone) => [zone, [...player.zones[zone]]])
    ) as PlayerZones
  })) as [GamePlayer, GamePlayer];
}

function cloneBattlefields(
  battlefields: [Battlefield, Battlefield]
): [Battlefield, Battlefield] {
  return battlefields.map((field) => ({ ...field, cards: [...field.cards] })) as [
    Battlefield,
    Battlefield
  ];
}

function findCardLocation(game: GameState, cardId: string): CardLocation | null {
  for (const player of [0, 1] as const) {
    for (const zone of playerZoneNames) {
      if (game.players[player].zones[zone].some(({ id }) => id === cardId)) {
        return { type: 'player-zone', player, zone };
      }
    }
  }

  for (const slot of [0, 1] as const) {
    if (game.battlefields[slot].cards.some(({ id }) => id === cardId)) {
      return { type: 'battlefield', slot };
    }
  }

  return null;
}

function getCardAt(
  game: GameState,
  location: CardLocation,
  cardId: string
): CardInstance | undefined {
  if (location.type === 'player-zone') {
    return game.players[location.player].zones[location.zone].find(
      ({ id }) => id === cardId
    );
  }

  return game.battlefields[location.slot].cards.find(({ id }) => id === cardId);
}

function sameLocation(location: CardLocation, destination: CardDestination): boolean {
  if (location.type !== destination.type) {
    return false;
  }

  if (location.type === 'player-zone' && destination.type === 'player-zone') {
    return location.player === destination.player && location.zone === destination.zone;
  }

  return (
    location.type === 'battlefield' &&
    destination.type === 'battlefield' &&
    location.slot === destination.slot
  );
}
