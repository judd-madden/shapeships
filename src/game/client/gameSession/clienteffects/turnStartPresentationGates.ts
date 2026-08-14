export interface TurnStartEconomyPresentation<TBreakdownRow = unknown> {
  myBonusLines: number;
  opponentBonusLines: number;
  myBonusLinesOnEven: number;
  opponentBonusLinesOnEven: number;
  myDisplayedSavedLines: number;
  opponentDisplayedSavedLines: number;
  myDisplayedSavedJoiningLines: number;
  opponentDisplayedSavedJoiningLines: number;
  mySavedJoiningLines: number;
  opponentSavedJoiningLines: number;
  myJoiningBonusLines: number;
  opponentJoiningBonusLines: number;
  myBonusBreakdownRows: TBreakdownRow[];
  opponentBonusBreakdownRows: TBreakdownRow[];
}

export interface TurnStartEconomyPresentationState<TBreakdownRow = unknown> {
  gameId: string | null;
  authoritativeTurnNumber: number | null;
  latestKey: string | null;
  latest: TurnStartEconomyPresentation<TBreakdownRow> | null;
  presented: TurnStartEconomyPresentation<TBreakdownRow> | null;
  pendingTurnNumber: number | null;
}

export function getTurnStartEconomyPresentationKey<TBreakdownRow>(
  value: TurnStartEconomyPresentation<TBreakdownRow> | null
): string | null {
  return value == null ? null : JSON.stringify(value);
}

export function createTurnStartEconomyPresentationState<TBreakdownRow>(args: {
  gameId: string | null;
  turnNumber: number | null;
  economy: TurnStartEconomyPresentation<TBreakdownRow> | null;
}): TurnStartEconomyPresentationState<TBreakdownRow> {
  return {
    gameId: args.gameId,
    authoritativeTurnNumber: args.turnNumber,
    latestKey: getTurnStartEconomyPresentationKey(args.economy),
    latest: args.economy,
    presented: args.economy,
    pendingTurnNumber: null,
  };
}

export function syncTurnStartEconomyPresentation<TBreakdownRow>(
  state: TurnStartEconomyPresentationState<TBreakdownRow>,
  args: {
    gameId: string | null;
    turnNumber: number | null;
    economy: TurnStartEconomyPresentation<TBreakdownRow> | null;
  }
): TurnStartEconomyPresentationState<TBreakdownRow> {
  const latestKey = getTurnStartEconomyPresentationKey(args.economy);

  if (
    state.gameId !== args.gameId ||
    args.gameId == null ||
    args.turnNumber == null ||
    args.economy == null ||
    state.authoritativeTurnNumber == null ||
    args.turnNumber < state.authoritativeTurnNumber
  ) {
    return createTurnStartEconomyPresentationState(args);
  }

  if (
    args.turnNumber === state.authoritativeTurnNumber &&
    latestKey === state.latestKey
  ) {
    return state;
  }

  if (args.turnNumber > state.authoritativeTurnNumber) {
    return {
      ...state,
      authoritativeTurnNumber: args.turnNumber,
      latestKey,
      latest: args.economy,
      pendingTurnNumber: args.turnNumber,
    };
  }

  return {
    ...state,
    latestKey,
    latest: args.economy,
    presented: state.pendingTurnNumber == null ? args.economy : state.presented,
  };
}

export function settleTurnStartEconomyPresentation<TBreakdownRow>(
  state: TurnStartEconomyPresentationState<TBreakdownRow>,
  settledTurnNumber: number
): TurnStartEconomyPresentationState<TBreakdownRow> {
  if (state.pendingTurnNumber !== settledTurnNumber || state.latest == null) {
    return state;
  }

  return {
    ...state,
    presented: state.latest,
    pendingTurnNumber: null,
  };
}

export type DrawingActivationDisposition = 'ready' | 'pending' | 'stale';

export function classifyDrawingActivationPresentation(args: {
  eventTurnNumber: number;
  eventPhaseKey: string;
  presentedTurnNumber: number | null;
  presentedMilestoneIndex: number;
}): DrawingActivationDisposition {
  if (args.eventPhaseKey !== 'build.drawing') return 'ready';
  if (args.presentedTurnNumber == null) return 'pending';
  if (args.eventTurnNumber < args.presentedTurnNumber) return 'stale';
  if (args.eventTurnNumber > args.presentedTurnNumber) return 'pending';

  return args.presentedMilestoneIndex >= 1
    ? 'ready'
    : 'pending';
}

export function appendUniqueActivationEvents<T extends { eventKey: string }>(
  pending: T[],
  incoming: T[]
): T[] {
  const keys = new Set(pending.map((event) => event.eventKey));
  const next = [...pending];

  for (const event of incoming) {
    if (keys.has(event.eventKey)) continue;
    keys.add(event.eventKey);
    next.push(event);
  }

  return next;
}
