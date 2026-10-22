import { describe, expect, it } from 'vitest';
import {
  determinePurgeDecisions,
  type SuperTournamentPlayer
} from './determine-purge-decisions.js';

const player = (
  id: string,
  parentIds: string[] = [],
  points = 0
): SuperTournamentPlayer => ({
  id,
  name: id,
  points,
  parentIds
});

describe('determinePurgeDecisions', () => {
  it('keeps every player when the ranking has no genealogy links', () => {
    const decisions = determinePurgeDecisions([
      player('first', [], 9),
      player('second', [], 3),
      player('third', [], 12)
    ]);

    expect(decisions).toEqual([
      { playerId: 'first', status: 'keep' },
      { playerId: 'second', status: 'keep' },
      { playerId: 'third', status: 'keep' }
    ]);
  });

  it('keeps a direct child when its inherited match stays below the purge threshold', () => {
    const decisions = determinePurgeDecisions([
      player('parent'),
      player('other-parent-a'),
      player('other-parent-b'),
      player('child', ['parent', 'other-parent-a', 'other-parent-b'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'child', status: 'keep' });
  });

  it('uses the product of direct lineage weights for grandchildren', () => {
    const decisions = determinePurgeDecisions([
      player('grandparent'),
      player('parent-a', ['grandparent', 'missing-root-a', 'missing-root-b']),
      player('grandchild', [
        'parent-a',
        'missing-parent-a',
        'missing-parent-b'
      ])
    ]);

    expect(decisions).toContainEqual({ playerId: 'grandchild', status: 'keep' });
  });

  it('sums multiple direct lineage paths between the same two players', () => {
    const decisions = determinePurgeDecisions([
      player('grandparent'),
      player('parent-a', ['grandparent', 'missing-root-a', 'missing-root-b']),
      player('parent-b', ['grandparent', 'missing-root-c', 'missing-root-d']),
      player('grandchild', ['parent-a', 'parent-b', 'missing-unrelated-parent'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'grandchild', status: 'keep' });
  });

  it('does not delete a player whose accumulator is exactly 1.0', () => {
    const decisions = determinePurgeDecisions([
      player('parent-a'),
      player('parent-b'),
      player('child', ['parent-a', 'parent-b'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'child', status: 'keep' });
  });

  it('deletes a player when its accumulator becomes greater than 1.0', () => {
    const decisions = determinePurgeDecisions([
      player('grandparent'),
      player('parent-a', ['grandparent', 'missing-root-a', 'missing-root-b']),
      player('parent-b'),
      player('parent-c'),
      player('child', ['parent-a', 'parent-b', 'parent-c'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'child', status: 'delete' });
  });

  it('does not delete a player whose accumulator reaches 1.0 through direct parents only', () => {
    const decisions = determinePurgeDecisions([
      player('parent-a'),
      player('parent-b'),
      player('parent-c'),
      player('child', ['parent-a', 'parent-b', 'parent-c'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'child', status: 'keep' });
  });

  it('protects a kept player from later purge accumulation', () => {
    const decisions = determinePurgeDecisions([
      player('child', ['parent-a', 'parent-b', 'parent-c']),
      player('parent-a'),
      player('parent-b'),
      player('parent-c')
    ]);

    expect(decisions).toEqual([
      { playerId: 'child', status: 'keep' },
      { playerId: 'parent-a', status: 'keep' },
      { playerId: 'parent-b', status: 'keep' },
      { playerId: 'parent-c', status: 'keep' }
    ]);
  });

  it('ignores missing parent ids for that path and continues with known genealogy', () => {
    const decisions = determinePurgeDecisions([
      player('known-parent'),
      player('other-parent'),
      player('child', ['known-parent', 'missing-parent', 'other-parent'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'child', status: 'keep' });
  });

  it('does not accumulate through sibling or cousin paths', () => {
    const decisions = determinePurgeDecisions([
      player('sibling-a', ['shared-parent']),
      player('shared-parent'),
      player('sibling-b', ['shared-parent'])
    ]);

    expect(decisions).toContainEqual({ playerId: 'sibling-b', status: 'keep' });
  });

  it('rejects duplicate player ids', () => {
    expect(() =>
      determinePurgeDecisions([player('duplicate'), player('duplicate')])
    ).toThrow('Duplicate player id: duplicate');
  });

  it('rejects players that list themselves as a parent', () => {
    expect(() => determinePurgeDecisions([player('self', ['self'])])).toThrow(
      'Player cannot be its own parent: self'
    );
  });

  it('rejects known genealogy cycles', () => {
    expect(() =>
      determinePurgeDecisions([player('a', ['b']), player('b', ['a'])])
    ).toThrow('Genealogy cycle detected involving player: a');
  });
});
