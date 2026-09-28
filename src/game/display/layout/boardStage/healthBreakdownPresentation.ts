import type {
  BoardViewModel,
  GameSessionViewModel,
  GameSessionViewerViewModel,
  GameStatsTurnViewModel,
  ThisTurnMetricVm,
} from '../../../client/gameSession/types';

type BoardModeViewModel = Extract<BoardViewModel, { mode: 'board' }>;
type HealthBreakdownTone = 'healing' | 'damage' | 'neutral';

export interface HealthBreakdownCardVm {
  heading: 'LAST TURN' | 'FINAL TURN';
  turnNumber: number;
  healingLabel: string;
  healingText: string;
  damageLabel: string;
  damageText: string;
  changeText: string;
  changeTone: HealthBreakdownTone;
}

export interface HealthBreakdownPresentationVm {
  my: HealthBreakdownCardVm | null;
  opponent: HealthBreakdownCardVm | null;
  hoverEligible: boolean;
  deltaVisible: boolean;
  confirmedFinal: boolean;
}

interface HealthBreakdownSource {
  heading: HealthBreakdownCardVm['heading'];
  turnNumber: number;
}

interface AvailableMetric extends Extract<ThisTurnMetricVm, { state: 'zero' | 'value' }> {}

function isAvailableMetric(metric: ThisTurnMetricVm): metric is AvailableMetric {
  return metric.state === 'zero' || metric.state === 'value';
}

function getMetrics(
  thisTurn: NonNullable<GameSessionViewModel['thisTurn']>,
  slot: 'current' | 'last',
): ThisTurnMetricVm[] {
  return [
    thisTurn.me.healing[slot],
    thisTurn.opponent.damage[slot],
    thisTurn.opponent.healing[slot],
    thisTurn.me.damage[slot],
  ];
}

function matchMetricSource(args: {
  boardVm: BoardModeViewModel;
  thisTurn: NonNullable<GameSessionViewModel['thisTurn']>;
  slot: 'current' | 'last';
  source: AvailableMetric['source'];
}): number | null {
  const metrics = getMetrics(args.thisTurn, args.slot);
  if (
    metrics.some((metric) => !isAvailableMetric(metric) || metric.source !== args.source)
  ) {
    return null;
  }

  const available = metrics as AvailableMetric[];
  const turnNumber = available[0]?.turnNumber ?? 0;
  if (turnNumber <= 0 || available.some((metric) => metric.turnNumber !== turnNumber)) {
    return null;
  }

  const [myHealing, opponentDamage, opponentHealing, myDamage] = available;
  return (
    myHealing.total === args.boardVm.myLastTurnHeal &&
    opponentDamage.total === args.boardVm.opponentLastTurnDamage &&
    opponentHealing.total === args.boardVm.opponentLastTurnHeal &&
    myDamage.total === args.boardVm.myLastTurnDamage
  ) ? turnNumber : null;
}

function historyTurnMatchesBoard(
  turn: GameStatsTurnViewModel,
  boardVm: BoardModeViewModel,
): boolean {
  return (
    turn.viewer.healingReceived === boardVm.myLastTurnHeal &&
    turn.viewer.damageDealt === boardVm.myLastTurnDamage &&
    turn.viewer.healthDelta === boardVm.myLastTurnNet &&
    turn.viewer.healthEnd === boardVm.myHealth &&
    turn.opponent.healingReceived === boardVm.opponentLastTurnHeal &&
    turn.opponent.damageDealt === boardVm.opponentLastTurnDamage &&
    turn.opponent.healthDelta === boardVm.opponentLastTurnNet &&
    turn.opponent.healthEnd === boardVm.opponentHealth
  );
}

function selectSource(args: {
  boardVm: BoardModeViewModel;
  thisTurn: GameSessionViewModel['thisTurn'];
  gameStats: GameSessionViewModel['gameStats'];
}): HealthBreakdownSource | null {
  const { boardVm, thisTurn, gameStats } = args;
  if (!thisTurn) {
    return null;
  }

  const heldTurnNumber = matchMetricSource({
    boardVm,
    thisTurn,
    slot: 'current',
    source: 'held_actual',
  });
  if (heldTurnNumber !== null) {
    return { heading: 'LAST TURN', turnNumber: heldTurnNumber };
  }

  const finalTurnNumber = matchMetricSource({
    boardVm,
    thisTurn,
    slot: 'current',
    source: 'final_actual',
  });
  if (finalTurnNumber !== null) {
    return { heading: 'FINAL TURN', turnNumber: finalTurnNumber };
  }

  if (gameStats) {
    const latestHistoryTurn = gameStats.turns[gameStats.turns.length - 1];
    if (!latestHistoryTurn || !historyTurnMatchesBoard(latestHistoryTurn, boardVm)) {
      return null;
    }

    return latestHistoryTurn.turnNumber === boardVm.turnNumber
      ? { heading: 'FINAL TURN', turnNumber: latestHistoryTurn.turnNumber }
      : latestHistoryTurn.turnNumber < boardVm.turnNumber
        ? { heading: 'LAST TURN', turnNumber: latestHistoryTurn.turnNumber }
        : null;
  }

  if (thisTurn.phaseKey === 'game.finished') {
    return null;
  }

  const lastTurnNumber = matchMetricSource({
    boardVm,
    thisTurn,
    slot: 'last',
    source: 'last_actual',
  });
  return lastTurnNumber === null
    ? null
    : { heading: 'LAST TURN', turnNumber: lastTurnNumber };
}

function formatUnsignedTotal(value: number): string {
  return String(Math.max(0, value));
}

export function formatHealthChange(value: number): string {
  if (value > 0) {
    return `+${value}`;
  }

  if (value < 0) {
    return `−${Math.abs(value)}`;
  }

  return '±0';
}

function getChangeTone(value: number): HealthBreakdownTone {
  return value > 0 ? 'healing' : value < 0 ? 'damage' : 'neutral';
}

function getLabels(
  viewer: GameSessionViewerViewModel,
  gameStats: GameSessionViewModel['gameStats'],
) {
  if (gameStats) {
    return gameStats.labels;
  }

  return viewer.isSpectator
    ? {
        viewerHealing: `${viewer.p1Name} Healing`,
        opponentDamage: `${viewer.p2Name} Damage`,
        viewerDamage: `${viewer.p1Name} Damage`,
        opponentHealing: `${viewer.p2Name} Healing`,
      }
    : {
        viewerHealing: 'Your Healing',
        opponentDamage: 'Opponent Damage',
        viewerDamage: 'Your Damage',
        opponentHealing: 'Opponent Healing',
      };
}

export function buildHealthBreakdownPresentation(args: {
  boardVm: BoardModeViewModel;
  thisTurn: GameSessionViewModel['thisTurn'];
  gameStats: GameSessionViewModel['gameStats'];
  viewer: GameSessionViewerViewModel;
}): HealthBreakdownPresentationVm {
  const source = selectSource(args);
  const confirmedFinal = source?.heading === 'FINAL TURN';
  const deltaVisible =
    args.boardVm.turnNumber > 1 ||
    args.boardVm.healthDeltaPresentationKey != null ||
    (args.boardVm.turnNumber === 1 && confirmedFinal);

  if (!source) {
    return {
      my: null,
      opponent: null,
      hoverEligible: false,
      deltaVisible,
      confirmedFinal: false,
    };
  }

  const labels = getLabels(args.viewer, args.gameStats);
  return {
    my: {
      ...source,
      healingLabel: labels.viewerHealing,
      healingText: formatUnsignedTotal(args.boardVm.myLastTurnHeal),
      damageLabel: labels.opponentDamage,
      damageText: formatUnsignedTotal(args.boardVm.opponentLastTurnDamage),
      changeText: formatHealthChange(args.boardVm.myLastTurnNet),
      changeTone: getChangeTone(args.boardVm.myLastTurnNet),
    },
    opponent: {
      ...source,
      healingLabel: labels.opponentHealing,
      healingText: formatUnsignedTotal(args.boardVm.opponentLastTurnHeal),
      damageLabel: labels.viewerDamage,
      damageText: formatUnsignedTotal(args.boardVm.myLastTurnDamage),
      changeText: formatHealthChange(args.boardVm.opponentLastTurnNet),
      changeTone: getChangeTone(args.boardVm.opponentLastTurnNet),
    },
    hoverEligible: true,
    deltaVisible,
    confirmedFinal,
  };
}
