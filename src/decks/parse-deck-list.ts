import { deckSections, type DeckCard, type DeckSection } from './types.js';

const sectionByHeader = new Map<string, DeckSection>(
  deckSections.map((section) => [normalizeSection(section), section])
);

export class DeckListParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DeckListParseError';
  }
}

export function parseDeckList(source: string): DeckCard[] {
  const cards: DeckCard[] = [];
  let currentSection: DeckSection | undefined;

  for (const [index, rawLine] of source.split(/\r?\n/).entries()) {
    const lineNumber = index + 1;
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    if (line.endsWith(':')) {
      const section = sectionByHeader.get(normalizeSection(line.slice(0, -1)));

      if (!section) {
        throw new DeckListParseError(
          `Linha ${lineNumber}: seção desconhecida "${line.slice(0, -1).trim()}".`
        );
      }

      currentSection = section;
      continue;
    }

    if (!currentSection) {
      throw new DeckListParseError(
        `Linha ${lineNumber}: informe uma seção antes das cartas.`
      );
    }

    const match = line.match(/^(-?\d+)\s+(.+)$/);

    if (!match) {
      throw new DeckListParseError(
        `Linha ${lineNumber}: esperado quantidade e nome da carta.`
      );
    }

    const quantity = Number(match[1] ?? '');
    const cardName = (match[2] ?? '').trim();

    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      throw new DeckListParseError(
        `Linha ${lineNumber}: a quantidade deve ser um inteiro positivo.`
      );
    }

    if (!cardName) {
      throw new DeckListParseError(
        `Linha ${lineNumber}: informe o nome da carta.`
      );
    }

    cards.push({ section: currentSection, quantity, cardName });
  }

  return cards;
}

function normalizeSection(section: string): string {
  return section.trim().toLocaleLowerCase('en-US').replace(/[\s_-]/g, '');
}
