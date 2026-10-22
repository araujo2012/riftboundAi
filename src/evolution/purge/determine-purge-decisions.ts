export type SuperTournamentPlayer = {
  id: string;
  name: string;
  points: number;
  parentIds: string[];
};

export type PurgeDecision = {
  playerId: string;
  status: 'keep' | 'delete';
};

type PurgeStatus = PurgeDecision['status'];

export function determinePurgeDecisions(
  rankedPlayers: readonly SuperTournamentPlayer[]
): PurgeDecision[] {
  const playersById = indexPlayersById(rankedPlayers);
  validatePlayers(rankedPlayers, playersById);

  const childIdsByParentId = indexChildIdsByParentId(rankedPlayers, playersById);
  const purgeAccumulatorById = new Map(
    rankedPlayers.map((player) => [player.id, 0])
  );
  const statusById = new Map<string, PurgeStatus>();

  for (const player of rankedPlayers) {
    if (statusById.get(player.id) === 'delete') {
      continue;
    }

    statusById.set(player.id, 'keep');

    const geneticMatches = calculateDirectLineageMatches(
      player,
      playersById,
      childIdsByParentId
    );

    for (const [relatedPlayerId, geneticMatch] of geneticMatches) {
      if (statusById.has(relatedPlayerId)) {
        continue;
      }

      const nextAccumulator =
        (purgeAccumulatorById.get(relatedPlayerId) ?? 0) + geneticMatch;
      purgeAccumulatorById.set(relatedPlayerId, nextAccumulator);

      if (nextAccumulator > 1) {
        statusById.set(relatedPlayerId, 'delete');
      }
    }
  }

  return rankedPlayers.map((player) => ({
    playerId: player.id,
    status: statusById.get(player.id) ?? 'keep'
  }));
}

function indexPlayersById(
  rankedPlayers: readonly SuperTournamentPlayer[]
): Map<string, SuperTournamentPlayer> {
  const playersById = new Map<string, SuperTournamentPlayer>();

  for (const player of rankedPlayers) {
    if (playersById.has(player.id)) {
      throw new Error(`Duplicate player id: ${player.id}`);
    }

    playersById.set(player.id, player);
  }

  return playersById;
}

function validatePlayers(
  rankedPlayers: readonly SuperTournamentPlayer[],
  playersById: ReadonlyMap<string, SuperTournamentPlayer>
): void {
  for (const player of rankedPlayers) {
    if (player.parentIds.includes(player.id)) {
      throw new Error(`Player cannot be its own parent: ${player.id}`);
    }
  }

  assertNoKnownGenealogyCycles(rankedPlayers, playersById);
}

function assertNoKnownGenealogyCycles(
  rankedPlayers: readonly SuperTournamentPlayer[],
  playersById: ReadonlyMap<string, SuperTournamentPlayer>
): void {
  const visitStateById = new Map<string, 'visiting' | 'visited'>();

  const visit = (playerId: string): void => {
    const visitState = visitStateById.get(playerId);

    if (visitState === 'visiting') {
      throw new Error(`Genealogy cycle detected involving player: ${playerId}`);
    }

    if (visitState === 'visited') {
      return;
    }

    const player = playersById.get(playerId);

    if (!player) {
      return;
    }

    visitStateById.set(playerId, 'visiting');

    for (const parentId of player.parentIds) {
      if (playersById.has(parentId)) {
        visit(parentId);
      }
    }

    visitStateById.set(playerId, 'visited');
  };

  for (const player of rankedPlayers) {
    visit(player.id);
  }
}

function indexChildIdsByParentId(
  rankedPlayers: readonly SuperTournamentPlayer[],
  playersById: ReadonlyMap<string, SuperTournamentPlayer>
): Map<string, string[]> {
  const childIdsByParentId = new Map<string, string[]>();

  for (const child of rankedPlayers) {
    for (const parentId of child.parentIds) {
      if (!playersById.has(parentId)) {
        continue;
      }

      const childIds = childIdsByParentId.get(parentId);

      if (childIds) {
        childIds.push(child.id);
      } else {
        childIdsByParentId.set(parentId, [child.id]);
      }
    }
  }

  return childIdsByParentId;
}

function calculateDirectLineageMatches(
  selectedPlayer: SuperTournamentPlayer,
  playersById: ReadonlyMap<string, SuperTournamentPlayer>,
  childIdsByParentId: ReadonlyMap<string, readonly string[]>
): Map<string, number> {
  const geneticMatchesById = new Map<string, number>();

  collectAncestorMatches(selectedPlayer, 1, playersById, geneticMatchesById);
  collectDescendantMatches(
    selectedPlayer.id,
    1,
    playersById,
    childIdsByParentId,
    geneticMatchesById
  );

  return geneticMatchesById;
}

function collectAncestorMatches(
  child: SuperTournamentPlayer,
  pathWeight: number,
  playersById: ReadonlyMap<string, SuperTournamentPlayer>,
  geneticMatchesById: Map<string, number>
): void {
  if (child.parentIds.length === 0) {
    return;
  }

  const edgeWeight = 1 / child.parentIds.length;

  for (const parentId of child.parentIds) {
    const parent = playersById.get(parentId);

    if (!parent) {
      continue;
    }

    const geneticMatch = pathWeight * edgeWeight;
    addGeneticMatch(parent.id, geneticMatch, geneticMatchesById);
    collectAncestorMatches(
      parent,
      geneticMatch,
      playersById,
      geneticMatchesById
    );
  }
}

function collectDescendantMatches(
  parentId: string,
  pathWeight: number,
  playersById: ReadonlyMap<string, SuperTournamentPlayer>,
  childIdsByParentId: ReadonlyMap<string, readonly string[]>,
  geneticMatchesById: Map<string, number>
): void {
  const childIds = childIdsByParentId.get(parentId) ?? [];

  for (const childId of childIds) {
    const child = playersById.get(childId);

    if (!child || child.parentIds.length === 0) {
      continue;
    }

    const geneticMatch = pathWeight * (1 / child.parentIds.length);
    addGeneticMatch(child.id, geneticMatch, geneticMatchesById);
    collectDescendantMatches(
      child.id,
      geneticMatch,
      playersById,
      childIdsByParentId,
      geneticMatchesById
    );
  }
}

function addGeneticMatch(
  playerId: string,
  geneticMatch: number,
  geneticMatchesById: Map<string, number>
): void {
  geneticMatchesById.set(
    playerId,
    (geneticMatchesById.get(playerId) ?? 0) + geneticMatch
  );
}
