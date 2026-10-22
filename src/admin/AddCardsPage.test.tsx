import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyCardDraft } from '../cards/types.js';
import type { Card, CardDraft } from '../cards/types.js';
import { AddCardsPage, nextCollectorNumber } from './AddCardsPage.js';

const mocks = vi.hoisted(() => {
  class MockCardApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message);
    }
  }

  return {
    CardApiError: MockCardApiError,
    listCards: vi.fn(),
    createCard: vi.fn(),
    updateCard: vi.fn(),
    deleteCard: vi.fn(),
    uploadCardImage: vi.fn()
  };
});

vi.mock('../cards/card-api.js', () => mocks);

function card(overrides: Partial<Card> = {}): Card {
  return {
    ...createEmptyCardDraft(),
    id: 'card-1',
    name: 'Jinx',
    title: 'Loose Cannon',
    set: 'OGN',
    collectorNumber: '030',
    domains: ['Fury'],
    ...overrides
  };
}

describe('AddCardsPage', () => {
  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCards.mockResolvedValue([]);
    mocks.createCard.mockImplementation(async (draft: CardDraft) => ({ id: 'created-id', ...draft }));
    mocks.updateCard.mockImplementation(async (id: string, draft: CardDraft) => ({ id, ...draft }));
    mocks.deleteCard.mockResolvedValue(undefined);
    mocks.uploadCardImage.mockResolvedValue('/api/cards/images/000000000000000000000001');
  });

  it('creates a card with every filled-in field', async () => {
    const user = userEvent.setup();
    render(<AddCardsPage />);
    await screen.findByText('Nenhuma carta ainda');

    await user.type(screen.getByLabelText('Nome *'), 'Jinx');
    await user.type(screen.getByLabelText('Título / subtítulo'), 'Loose Cannon');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'Unit');
    await user.click(screen.getByRole('button', { name: 'Campeão' }));
    await user.click(screen.getByRole('button', { name: 'Fury' }));
    await user.click(screen.getByRole('button', { name: 'Chaos' }));
    await user.type(screen.getByLabelText('Custo de energia'), '4');
    await user.type(screen.getByLabelText('Custo de poder'), '1');
    await user.type(screen.getByLabelText('Might'), '4');
    await user.type(screen.getByLabelText('Keywords'), 'Assault{Enter}Tank,');
    await user.type(screen.getByLabelText('Tags'), 'Zaun{Enter}');
    await user.type(screen.getByLabelText('Texto de regras'), 'Deal 2.');
    await user.type(screen.getByLabelText('Set'), 'OGN');
    await user.type(screen.getByLabelText('Número'), '030');
    await user.selectOptions(screen.getByLabelText('Raridade'), 'Rare');
    await user.click(screen.getByRole('button', { name: 'Adicionar campo' }));
    await user.type(screen.getByLabelText('Nome do campo 1'), 'Errata');
    await user.type(screen.getByLabelText('Valor do campo 1'), 'Nenhuma');
    await user.click(screen.getByRole('button', { name: 'Criar carta' }));

    await waitFor(() => expect(mocks.createCard).toHaveBeenCalledTimes(1));
    expect(mocks.createCard.mock.calls[0]?.[0]).toEqual({
      ...createEmptyCardDraft(),
      name: 'Jinx',
      title: 'Loose Cannon',
      type: 'Unit',
      supertypes: ['Champion'],
      domains: ['Fury', 'Chaos'],
      energyCost: 4,
      powerCost: 1,
      might: 4,
      keywords: ['Assault', 'Tank'],
      tags: ['Zaun'],
      rulesText: 'Deal 2.',
      set: 'OGN',
      collectorNumber: '030',
      rarity: 'Rare',
      customFields: [{ label: 'Errata', value: 'Nenhuma' }]
    });
    expect(await screen.findByRole('button', { name: 'Editar carta Jinx' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeTruthy();
  });

  it('edits an existing card', async () => {
    mocks.listCards.mockResolvedValue([card()]);
    const user = userEvent.setup();
    render(<AddCardsPage />);

    await user.click(await screen.findByRole('button', { name: 'Editar carta Jinx' }));
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('Jinx');
    await user.clear(screen.getByLabelText('Título / subtítulo'));
    await user.type(screen.getByLabelText('Título / subtítulo'), 'Rebel');
    await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(mocks.updateCard).toHaveBeenCalledWith('card-1', expect.objectContaining({ title: 'Rebel' })));
    expect(await screen.findByText('Alterações salvas.')).toBeTruthy();
  });

  it('keeps the set and advances the number after "save and next"', async () => {
    const user = userEvent.setup();
    render(<AddCardsPage />);
    await screen.findByText('Nenhuma carta ainda');

    await user.type(screen.getByLabelText('Nome *'), 'Jinx');
    await user.type(screen.getByLabelText('Set'), 'OGN');
    await user.type(screen.getByLabelText('Número'), '009');
    await user.click(screen.getByRole('button', { name: 'Salvar e criar próxima' }));

    await waitFor(() => expect(mocks.createCard).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText('Nome *') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Set') as HTMLInputElement).value).toBe('OGN');
    expect((screen.getByLabelText('Número') as HTMLInputElement).value).toBe('010');
  });

  it('uploads an image file and stores its URL on the card', async () => {
    const user = userEvent.setup();
    render(<AddCardsPage />);
    await screen.findByText('Nenhuma carta ainda');

    const file = new File(['png'], 'jinx.png', { type: 'image/png' });
    await user.upload(screen.getByLabelText('Arquivo de imagem'), file);

    await waitFor(() => expect(mocks.uploadCardImage).toHaveBeenCalledWith(file));
    expect((screen.getByLabelText('URL da imagem') as HTMLInputElement).value)
      .toBe('/api/cards/images/000000000000000000000001');
  });

  it('warns about a repeated set and collector number', async () => {
    mocks.listCards.mockResolvedValue([card()]);
    const user = userEvent.setup();
    render(<AddCardsPage />);
    await screen.findByRole('button', { name: 'Editar carta Jinx' });

    await user.type(screen.getByLabelText('Set'), 'OGN');
    await user.type(screen.getByLabelText('Número'), '030');

    expect(screen.getByText('Já existe "Jinx" com OGN #030.')).toBeTruthy();
  });

  it('filters the card list by search text', async () => {
    mocks.listCards.mockResolvedValue([card(), card({ id: 'card-2', name: 'Vi', tags: ['Piltover'] })]);
    const user = userEvent.setup();
    render(<AddCardsPage />);
    await screen.findByRole('button', { name: 'Editar carta Vi' });

    await user.type(screen.getByLabelText('Buscar cartas'), 'piltover');

    expect(screen.queryByRole('button', { name: 'Editar carta Jinx' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Editar carta Vi' })).toBeTruthy();
  });

  it('deletes the selected card after confirmation', async () => {
    mocks.listCards.mockResolvedValue([card()]);
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(<AddCardsPage />);

    await user.click(await screen.findByRole('button', { name: 'Editar carta Jinx' }));
    await user.click(screen.getByRole('button', { name: 'Excluir' }));

    await waitFor(() => expect(mocks.deleteCard).toHaveBeenCalledWith('card-1'));
    expect(screen.queryByRole('button', { name: 'Editar carta Jinx' })).toBeNull();
  });
});

describe('nextCollectorNumber', () => {
  it('increments the last number and keeps padding and affixes', () => {
    expect(nextCollectorNumber('030')).toBe('031');
    expect(nextCollectorNumber('OGN-009a')).toBe('OGN-010a');
    expect(nextCollectorNumber('099')).toBe('100');
    expect(nextCollectorNumber('promo')).toBe('');
  });
});
