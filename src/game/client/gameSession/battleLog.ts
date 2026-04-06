import { isShipDefId } from '../../data/ShipDefinitions.core';
import { getShipDefinitionUI } from '../../data/ShipDefinitionsUI';
import type {
  BattleLogHistoryResponse,
  BattleLogLineVm,
  BattleLogTokenVm,
  BattleLogTurnPlayerSummary,
  BattleLogTurnSideVm,
  BattleLogTurnVm,
  LeftRailViewModel,
} from './types';

type BattleLogVm = Pick<
  LeftRailViewModel,
  'battleLogNames' | 'battleLogTurns' | 'battleLogAutoScrollKey'
>;

type MapBattleLogTurnsArgs = {
  battleLogHistory: BattleLogHistoryResponse | null;
  localPlayerId: string | null;
  localPlayerName: string;
  opponentPlayerId: string | null;
  opponentName: string;
};

type IndexedPlayerSummary = BattleLogTurnPlayerSummary & {
  index: number;
};

type BattleLogSideSource = {
  playerId: string | null;
  name: string;
  healthEnd: number;
  healthDelta: number;
};

const EMPTY_SIDE_SOURCE: BattleLogSideSource = {
  playerId: null,
  name: '',
  healthEnd: 0,
  healthDelta: 0,
};

const SHIP_OR_MULTIPLIER_PATTERN = /\b[A-Z0-9]{3,5}\b|\bx\b/g;

export function mapBattleLogTurns(args: MapBattleLogTurnsArgs): BattleLogVm {
  const battleLogNames = {
    me: normalizeDisplayName(args.localPlayerName, 'Player 1'),
    opponent: normalizeDisplayName(args.opponentName, 'Player 2'),
  };

  const turns = Array.isArray(args.battleLogHistory?.turns)
    ? [...args.battleLogHistory.turns].sort((left, right) => left.turnNumber - right.turnNumber)
    : [];

  const battleLogTurns = turns.map((turn) =>
    mapBattleLogTurn(turn, {
      localPlayerId: args.localPlayerId,
      localPlayerName: battleLogNames.me,
      opponentPlayerId: args.opponentPlayerId,
      opponentName: battleLogNames.opponent,
    })
  );

  return {
    battleLogNames,
    battleLogTurns,
    battleLogAutoScrollKey: [
      'battle',
      args.battleLogHistory?.gameId ?? 'none',
      args.battleLogHistory?.revision ?? 0,
      args.battleLogHistory?.completedTurnCount ?? 0,
      battleLogTurns.length,
    ].join(':'),
  };
}

function normalizeDisplayName(name: string | null | undefined, fallback: string): string {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || fallback;
}

function mapBattleLogTurn(
  turn: BattleLogHistoryResponse['turns'][number],
  args: {
    localPlayerId: string | null;
    localPlayerName: string;
    opponentPlayerId: string | null;
    opponentName: string;
  }
): BattleLogTurnVm {
  const normalizedSides = normalizeBattleLogSides(turn.players, {
    localPlayerId: args.localPlayerId,
    localPlayerName: args.localPlayerName,
    opponentPlayerId: args.opponentPlayerId,
    opponentName: args.opponentName,
  });

  const me = mapBattleLogSide(
    normalizedSides.me,
    turn.buildLinesByPlayerId,
    turn.battleLinesByPlayerId
  );
  const opponent = mapBattleLogSide(
    normalizedSides.opponent,
    turn.buildLinesByPlayerId,
    turn.battleLinesByPlayerId
  );

  return {
    turnNumber: turn.turnNumber,
    diceValue: turn.diceValue,
    showBuildSection: me.buildLines.length > 0 || opponent.buildLines.length > 0,
    showBattleSection: me.battleLines.length > 0 || opponent.battleLines.length > 0,
    me,
    opponent,
  };
}

function normalizeBattleLogSides(
  players: BattleLogTurnPlayerSummary[],
  args: {
    localPlayerId: string | null;
    localPlayerName: string;
    opponentPlayerId: string | null;
    opponentName: string;
  }
): { me: BattleLogSideSource; opponent: BattleLogSideSource } {
  const remainingPlayers = players.map((player, index) => ({ ...player, index }));
  const meMatch = pullMatchingPlayer(remainingPlayers, args.localPlayerId, args.localPlayerName);
  const opponentMatch = pullMatchingPlayer(
    remainingPlayers,
    args.opponentPlayerId,
    args.opponentName
  );
  const sortedFallbacks = [...remainingPlayers].sort(compareIndexedPlayers);

  const me = toBattleLogSideSource(
    meMatch ?? sortedFallbacks.shift() ?? null,
    args.localPlayerId,
    args.localPlayerName
  );
  const opponent = toBattleLogSideSource(
    opponentMatch ?? sortedFallbacks.shift() ?? null,
    args.opponentPlayerId,
    args.opponentName
  );

  return { me, opponent };
}

function pullMatchingPlayer(
  players: IndexedPlayerSummary[],
  preferredPlayerId: string | null,
  preferredName: string
): IndexedPlayerSummary | null {
  const idMatchIndex =
    preferredPlayerId == null
      ? -1
      : players.findIndex((player) => player.playerId === preferredPlayerId);
  if (idMatchIndex >= 0) {
    return players.splice(idMatchIndex, 1)[0] ?? null;
  }

  const nameMatchIndex = players.findIndex(
    (player) => player.name.trim().toLowerCase() === preferredName.trim().toLowerCase()
  );
  if (nameMatchIndex >= 0) {
    return players.splice(nameMatchIndex, 1)[0] ?? null;
  }

  return null;
}

function compareIndexedPlayers(left: IndexedPlayerSummary, right: IndexedPlayerSummary): number {
  const keyCompare = getStablePlayerKey(left).localeCompare(getStablePlayerKey(right));
  if (keyCompare !== 0) {
    return keyCompare;
  }
  return left.index - right.index;
}

function getStablePlayerKey(player: BattleLogTurnPlayerSummary): string {
  return `${player.playerId || ''}:${player.name || ''}`;
}

function toBattleLogSideSource(
  player: BattleLogTurnPlayerSummary | null,
  fallbackPlayerId: string | null,
  fallbackName: string
): BattleLogSideSource {
  if (!player) {
    return {
      ...EMPTY_SIDE_SOURCE,
      playerId: fallbackPlayerId,
      name: fallbackName,
    };
  }

  return {
    playerId: player.playerId,
    name: normalizeDisplayName(player.name, fallbackName),
    healthEnd: player.healthEnd,
    healthDelta: player.healthDelta,
  };
}

function mapBattleLogSide(
  side: BattleLogSideSource,
  buildLinesByPlayerId: Record<string, string[]>,
  battleLinesByPlayerId: Record<string, string[]>
): BattleLogTurnSideVm {
  const buildLines = side.playerId ? buildLinesByPlayerId[side.playerId] : [];
  const battleLines = side.playerId ? battleLinesByPlayerId[side.playerId] : [];

  return {
    healthEnd: side.healthEnd,
    healthDelta: side.healthDelta,
    buildLines: mapBattleLogLines(buildLines, tokenizeBuildLine),
    battleLines: mapBattleLogLines(battleLines, tokenizeBattleLine),
  };
}

function mapBattleLogLines(
  rawLines: string[] | undefined,
  tokenize: (line: string) => BattleLogTokenVm[]
): BattleLogLineVm[] {
  if (!Array.isArray(rawLines)) {
    return [];
  }

  return rawLines.flatMap((line) => {
    const trimmedLine = typeof line === 'string' ? line.trim() : '';
    if (!trimmedLine) {
      return [];
    }

    return [{ tokens: tokenize(trimmedLine) }];
  });
}

function tokenizeBuildLine(line: string): BattleLogTokenVm[] {
  const countedBuildMatch = line.match(/^(\d+)\s+x\s+([A-Z0-9]{3,5})(?:\s+\(([A-Z0-9]{3,5})\))?$/);
  if (!countedBuildMatch) {
    return tokenizeGenericLine(line);
  }

  const [, count, builtShipDefId, sourceShipDefId] = countedBuildMatch;
  if (!isKnownShipId(builtShipDefId) || (sourceShipDefId && !isKnownShipId(sourceShipDefId))) {
    return tokenizeGenericLine(line);
  }

  const tokens: BattleLogTokenVm[] = [
    makeTextToken(`${count} `),
    makeMultiplierToken(),
    makeTextToken(' '),
    makeShipToken(builtShipDefId, true),
  ];

  if (sourceShipDefId) {
    tokens.push(makeTextToken(' ('));
    tokens.push(makeShipToken(sourceShipDefId, false));
    tokens.push(makeTextToken(')'));
  }

  return tokens;
}

function tokenizeBattleLine(line: string): BattleLogTokenVm[] {
  return tokenizeGenericLine(line);
}

function tokenizeGenericLine(line: string): BattleLogTokenVm[] {
  const tokens: BattleLogTokenVm[] = [];
  let lastIndex = 0;

  for (const match of line.matchAll(SHIP_OR_MULTIPLIER_PATTERN)) {
    const start = match.index ?? 0;
    const value = match[0];

    if (start > lastIndex) {
      tokens.push(makeTextToken(line.slice(lastIndex, start)));
    }

    if (value === 'x') {
      tokens.push(makeMultiplierToken());
    } else if (isKnownShipId(value)) {
      tokens.push(makeShipToken(value, false));
    } else {
      tokens.push(makeTextToken(value));
    }

    lastIndex = start + value.length;
  }

  if (lastIndex < line.length) {
    tokens.push(makeTextToken(line.slice(lastIndex)));
  }

  return tokens.length > 0 ? tokens : [makeTextToken(line)];
}

function makeTextToken(text: string): BattleLogTokenVm {
  return {
    kind: 'text',
    text,
  };
}

function makeMultiplierToken(): BattleLogTokenVm {
  return {
    kind: 'multiplier',
    text: 'x',
  };
}

function makeShipToken(shipDefId: string, allowUpgradeColor: boolean): BattleLogTokenVm {
  const upgradeColorName =
    allowUpgradeColor && isUpgradeableBuildShip(shipDefId)
      ? getShipDefinitionUI(shipDefId)?.colour ?? null
      : null;

  return {
    kind: 'ship',
    text: shipDefId,
    shipDefId,
    allowUpgradeColor,
    upgradeColorName,
  };
}

function isKnownShipId(shipDefId: string): boolean {
  return isShipDefId(shipDefId);
}

function isUpgradeableBuildShip(shipDefId: string): shipDefId is Parameters<typeof getShipDefinitionUI>[0] {
  if (!isShipDefId(shipDefId)) {
    return false;
  }

  return getShipDefinitionUI(shipDefId)?.shipType === 'Upgraded';
}
