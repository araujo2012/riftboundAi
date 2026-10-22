export const cardTypes = ['Unit', 'Spell', 'Gear', 'Rune', 'Battlefield', 'Legend', 'Card'] as const;
export const cardSupertypes = ['Champion', 'Signature', 'Token', 'Basic'] as const;
export const cardDomains = ['Fury', 'Calm', 'Mind', 'Body', 'Chaos', 'Order', 'Colorless'] as const;
export const cardRarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Showcase', 'Promo'] as const;

export type CardType = (typeof cardTypes)[number];
export type CardSupertype = (typeof cardSupertypes)[number];
export type CardDomain = (typeof cardDomains)[number];
export type CardRarity = (typeof cardRarities)[number];

export const cardTypeLabels: Record<CardType, string> = {
  Unit: 'Unidade',
  Spell: 'Feitiço',
  Gear: 'Equipamento',
  Rune: 'Runa',
  Battlefield: 'Campo de batalha',
  Legend: 'Lenda',
  Card: 'Outra (marcador)'
};

export const cardSupertypeLabels: Record<CardSupertype, string> = {
  Champion: 'Campeão',
  Signature: 'Assinatura',
  Token: 'Token',
  Basic: 'Básica'
};

export const cardRarityLabels: Record<CardRarity, string> = {
  Common: 'Comum',
  Uncommon: 'Incomum',
  Rare: 'Rara',
  Epic: 'Épica',
  Showcase: 'Showcase',
  Promo: 'Promo'
};

// Free-form label/value pairs for anything the fixed fields do not cover yet.
export type CardCustomField = {
  label: string;
  value: string;
};

export type Card = {
  id: string;
  name: string;
  title: string;
  type: CardType;
  supertypes: CardSupertype[];
  domains: CardDomain[];
  energyCost: number | null;
  powerCost: number | null;
  might: number | null;
  mightBonus: number | null;
  tags: string[];
  keywords: string[];
  rulesText: string;
  flavorText: string;
  set: string;
  collectorNumber: string;
  rarity: CardRarity | null;
  artist: string;
  imageUrl: string;
  notes: string;
  customFields: CardCustomField[];
};

export type CardDraft = Omit<Card, 'id'>;

export const cardImagePathPrefix = '/api/cards/images/';

export function createEmptyCardDraft(): CardDraft {
  return {
    name: '',
    title: '',
    type: 'Unit',
    supertypes: [],
    domains: [],
    energyCost: null,
    powerCost: null,
    might: null,
    mightBonus: null,
    tags: [],
    keywords: [],
    rulesText: '',
    flavorText: '',
    set: '',
    collectorNumber: '',
    rarity: null,
    artist: '',
    imageUrl: '',
    notes: '',
    customFields: []
  };
}

export function toCardDraft({ id: _id, ...draft }: Card): CardDraft {
  return draft;
}
