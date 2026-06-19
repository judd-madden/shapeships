import type {
  BattleLogHistoryResponse,
  BattleLogTurnPlayerAnalysis,
  BattleLogTurnPlayerSummary,
  BattleLogTurnSummary,
  GameStatsPlayerTurnViewModel,
  GameStatsViewModel,
} from './types';

type DisplayPlayerLike = {
  id?: unknown;
  playerId?: unknown;
  sessionId?: unknown;
  name?: unknown;
} | null | undefined;

type DeriveGameStatsViewModelArgs = {
  battleLogHistory: BattleLogHistoryResponse | null;
  isFinished: boolean;
  displayLeftPlayer: DisplayPlayerLike;
  displayRightPlayer: DisplayPlayerLike;
  displayLeftName: string;
  displayRightName: string;
  isSpectator: boolean;
};

type SideHint = {
  identityKeys: string[];
  normalizedName: string | null;
  fallbackPlayerId: string | null;
};

type IndexedPlayerSummary = BattleLogTurnPlayerSummary & {
  index: number;
};

type AnalysisStats = {
  healingReceived: number;
  damageTaken: number;
};

export function deriveGameStatsViewModel(
  args: DeriveGameStatsViewModelArgs,
): GameStatsViewModel | null {
  if (!args.isFinished || !args.battleLogHistory || args.battleLogHistory.turns.length <= 0) {
    return null;
  }

  const sortedTurns = args.battleLogHistory.turns
    .map((turn, index) => ({ turn, index }))
    .sort((left, right) => {
      const turnCompare = left.turn.turnNumber - right.turn.turnNumber;
      return turnCompare !== 0 ? turnCompare : left.index - right.index;
    })
    .map(({ turn }) => turn);

  const fallbackPlayers = sortedTurns.find((turn) => turn.players.length > 0)?.players ?? [];
  if (fallbackPlayers.length <= 0) {
    return null;
  }

  const viewerHint = createSideHint(args.displayLeftPlayer, fallbackPlayers[0]?.playerId ?? null);
  const opponentHint = createSideHint(args.displayRightPlayer, fallbackPlayers[1]?.playerId ?? null);
  const viewerName = normalizeDisplayName(args.displayLeftName, 'Player 1');
  const opponentName = normalizeDisplayName(args.displayRightName, 'Player 2');
  const sideLabels = args.isSpectator
    ? { viewer: viewerName, opponent: opponentName }
    : { viewer: 'You', opponent: 'Opponent' };
  const labels = args.isSpectator
    ? {
        viewerHealth: `${viewerName} Health`,
        opponentHealth: `${opponentName} Health`,
        viewerHealing: `${viewerName} Healing`,
        opponentDamage: `${opponentName} Damage`,
        viewerDamage: `${viewerName} Damage`,
        opponentHealing: `${opponentName} Healing`,
        viewerFleetValue: `${viewerName} Fleet Value`,
        opponentFleetValue: `${opponentName} Fleet Value`,
      }
    : {
        viewerHealth: 'Your Health',
        opponentHealth: 'Opponent Health',
        viewerHealing: 'Your Healing',
        opponentDamage: 'Opponent Damage',
        viewerDamage: 'Your Damage',
        opponentHealing: 'Opponent Healing',
        viewerFleetValue: 'Your Fleet Value',
        opponentFleetValue: 'Opponent Fleet Value',
      };

  const turns: GameStatsViewModel['turns'] = [];
  let viewerTotalHealing = 0;
  let viewerTotalDamage = 0;
  let opponentTotalHealing = 0;
  let opponentTotalDamage = 0;
  let pressureMaxInput = 0;
  let fleetValueMaxInput = 0;
  let minHealth = Number.POSITIVE_INFINITY;

  for (const turn of sortedTurns) {
    const [viewerPlayer, opponentPlayer] = matchTurnPlayersToSides(
      turn.players,
      [viewerHint, opponentHint],
    );
    if (!viewerPlayer || !opponentPlayer) {
      return null;
    }

    const viewerAnalysis = getAnalysisStats(turn.analysisByPlayerId, viewerPlayer.playerId);
    const opponentAnalysis = getAnalysisStats(turn.analysisByPlayerId, opponentPlayer.playerId);
    const viewerDamageDealt = opponentAnalysis.damageTaken;
    const opponentDamageDealt = viewerAnalysis.damageTaken;

    const viewer = toTurnPlayerVm({
      player: viewerPlayer,
      label: sideLabels.viewer,
      analysis: viewerAnalysis,
      damageDealt: viewerDamageDealt,
    });
    const opponent = toTurnPlayerVm({
      player: opponentPlayer,
      label: sideLabels.opponent,
      analysis: opponentAnalysis,
      damageDealt: opponentDamageDealt,
    });

    turns.push({
      turnNumber: turn.turnNumber,
      viewer,
      opponent,
      row2Net: viewer.healingReceived - opponent.damageDealt,
      row3Net: viewer.damageDealt - opponent.healingReceived,
    });

    viewerTotalHealing += viewer.healingReceived;
    viewerTotalDamage += viewer.damageDealt;
    opponentTotalHealing += opponent.healingReceived;
    opponentTotalDamage += opponent.damageDealt;
    pressureMaxInput = Math.max(
      pressureMaxInput,
      Math.abs(viewer.healingReceived),
      Math.abs(opponent.damageDealt),
      Math.abs(viewer.damageDealt),
      Math.abs(opponent.healingReceived),
    );
    fleetValueMaxInput = Math.max(fleetValueMaxInput, viewer.fleetValueEnd, opponent.fleetValueEnd);
    minHealth = Math.min(minHealth, viewer.healthEnd, opponent.healthEnd);
  }

  if (turns.length <= 0) {
    return null;
  }

  const finalTurn = turns[turns.length - 1];

  return {
    turnCount: turns.length,
    turns,
    summary: {
      viewer: {
        label: sideLabels.viewer,
        finalHealth: finalTurn.viewer.healthEnd,
        totalHealing: viewerTotalHealing,
        totalDamage: viewerTotalDamage,
        finalFleetValue: finalTurn.viewer.fleetValueEnd,
      },
      opponent: {
        label: sideLabels.opponent,
        finalHealth: finalTurn.opponent.healthEnd,
        totalHealing: opponentTotalHealing,
        totalDamage: opponentTotalDamage,
        finalFleetValue: finalTurn.opponent.fleetValueEnd,
      },
    },
    labels,
    scaleHints: {
      pressureMax: roundUpToStep(pressureMaxInput, 40, 10),
      fleetValueMax: roundUpToStep(fleetValueMaxInput, 10, 10),
      healthFloor: Number.isFinite(minHealth)
        ? Math.min(-10, Math.floor(minHealth / 10) * 10)
        : -10,
    },
  };
}

function createSideHint(player: DisplayPlayerLike, fallbackPlayerId: string | null): SideHint {
  return {
    identityKeys: getPlayerIdentityKeys(player),
    normalizedName: getNormalizedPlayerName(player),
    fallbackPlayerId,
  };
}

function matchTurnPlayersToSides(
  players: BattleLogTurnSummary['players'],
  hints: [SideHint, SideHint],
): [BattleLogTurnPlayerSummary | null, BattleLogTurnPlayerSummary | null] {
  const remainingPlayers: IndexedPlayerSummary[] = players.map((player, index) => ({
    ...player,
    index,
  }));
  const matches = hints.map((hint) => pullMatchingPlayer(remainingPlayers, hint));

  return matches.map((match) => match ?? remainingPlayers.shift() ?? null) as [
    BattleLogTurnPlayerSummary | null,
    BattleLogTurnPlayerSummary | null,
  ];
}

function pullMatchingPlayer(
  players: IndexedPlayerSummary[],
  hint: SideHint,
): IndexedPlayerSummary | null {
  const identityMatchIndex = players.findIndex((player) =>
    hint.identityKeys.includes(player.playerId),
  );
  if (identityMatchIndex >= 0) {
    return players.splice(identityMatchIndex, 1)[0] ?? null;
  }

  if (hint.normalizedName) {
    const nameMatches = players
      .map((player, index) => ({ player, index }))
      .filter(({ player }) => normalizeComparableName(player.name) === hint.normalizedName);
    if (nameMatches.length === 1) {
      return players.splice(nameMatches[0].index, 1)[0] ?? null;
    }
  }

  const fallbackMatchIndex =
    hint.fallbackPlayerId == null
      ? -1
      : players.findIndex((player) => player.playerId === hint.fallbackPlayerId);
  if (fallbackMatchIndex >= 0) {
    return players.splice(fallbackMatchIndex, 1)[0] ?? null;
  }

  return null;
}

function toTurnPlayerVm(args: {
  player: BattleLogTurnPlayerSummary;
  label: string;
  analysis: AnalysisStats;
  damageDealt: number;
}): GameStatsPlayerTurnViewModel {
  return {
    playerId: args.player.playerId,
    label: args.label,
    healthEnd: args.player.healthEnd,
    healthDelta: args.player.healthDelta,
    healingReceived: args.analysis.healingReceived,
    damageTaken: args.analysis.damageTaken,
    damageDealt: args.damageDealt,
    fleetValueEnd: args.player.fleetValueEnd,
  };
}

function getAnalysisStats(
  analysisByPlayerId: Record<string, BattleLogTurnPlayerAnalysis> | undefined,
  playerId: string,
): AnalysisStats {
  const analysis = analysisByPlayerId?.[playerId];
  return {
    healingReceived: toFiniteNumberOrZero(analysis?.healReceived),
    damageTaken: toFiniteNumberOrZero(analysis?.damageTaken),
  };
}

function getPlayerIdentityKeys(player: DisplayPlayerLike): string[] {
  const keys = [
    getStringField(player, 'playerId'),
    getStringField(player, 'id'),
    getStringField(player, 'sessionId'),
  ].filter((key): key is string => key != null && key.trim().length > 0);

  return [...new Set(keys)];
}

function getNormalizedPlayerName(player: DisplayPlayerLike): string | null {
  const name = getStringField(player, 'name');
  return name ? normalizeComparableName(name) : null;
}

function getStringField(player: DisplayPlayerLike, key: 'id' | 'playerId' | 'sessionId' | 'name'): string | null {
  if (!player || typeof player !== 'object') {
    return null;
  }

  const value = player[key];
  return typeof value === 'string' ? value : null;
}

function normalizeDisplayName(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeComparableName(value: string): string {
  return value.trim().toLowerCase();
}

function toFiniteNumberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function roundUpToStep(value: number, minimum: number, step: number): number {
  const target = Math.max(minimum, Number.isFinite(value) ? value : 0);
  return Math.ceil(target / step) * step;
}
