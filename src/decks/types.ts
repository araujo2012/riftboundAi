export const deckSections = [
  'Legend',
  'Champion',
  'MainDeck',
  'Battlefields',
  'Runes'
] as const;

export type DeckSection = (typeof deckSections)[number];

export type DeckCard = {
  section: DeckSection;
  quantity: number;
  cardName: string;
};

export type SavedDeck = {
  id: string;
  name: string;
  cards: DeckCard[];
  sourceText: string;
};
