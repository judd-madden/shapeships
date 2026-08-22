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

export type PresentedDiceValue = 1 | 2 | 3 | 4 | 5 | 6;

export interface TurnStartDiceModifierPresentation {
  chronoswarmRolls: PresentedDiceValue[];
  cubeDiceValueByPlayerId: Record<string, PresentedDiceValue>;
}

function normalizePresentedDiceValue(value: unknown): PresentedDiceValue | null {
  return typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
    ? value as PresentedDiceValue
    : null;
}

export function normalizeTurnStartDiceModifierPresentation(args: {
  chronoswarmRolls?: unknown[];
  cubeDiceValueByPlayerId?: Record<string, unknown>;
}): TurnStartDiceModifierPresentation {
  const chronoswarmRolls = Array.isArray(args.chronoswarmRolls)
    ? args.chronoswarmRolls
        .map(normalizePresentedDiceValue)
        .filter((value): value is PresentedDiceValue => value != null)
    : [];
  const cubeDiceValueByPlayerId: Record<string, PresentedDiceValue> = {};

  for (const [playerId, rawValue] of Object.entries(args.cubeDiceValueByPlayerId ?? {})) {
    const value = normalizePresentedDiceValue(rawValue);
    if (value != null) {
      cubeDiceValueByPlayerId[playerId] = value;
    }
  }

  return { chronoswarmRolls, cubeDiceValueByPlayerId };
}

export function holdTurnStartDiceModifierPresentation(args: {
  presented: TurnStartDiceModifierPresentation;
  authoritative: TurnStartDiceModifierPresentation;
}): TurnStartDiceModifierPresentation {
  const chronoswarmRolls = args.authoritative.chronoswarmRolls.map(
    (_value, index) => args.presented.chronoswarmRolls[index] ?? 1
  );
  const cubeDiceValueByPlayerId: Record<string, PresentedDiceValue> = {};

  for (const playerId of Object.keys(args.authoritative.cubeDiceValueByPlayerId)) {
    cubeDiceValueByPlayerId[playerId] =
      args.presented.cubeDiceValueByPlayerId[playerId] ?? 1;
  }

  return { chronoswarmRolls, cubeDiceValueByPlayerId };
}

export function classifyFirstTurnDiceSignature(args: {
  observedEligibleNoSignature: boolean;
}): 'hydrate' | 'present_roll' {
  return args.observedEligibleNoSignature ? 'present_roll' : 'hydrate';
}

export function isCurrentTurnDicePresentationSettled(args: {
  turnNumber: number;
  settledTurnNumber: number | null;
}): boolean {
  return args.settledTurnNumber === args.turnNumber;
}

export type BuildCatalogueContext = 'buildable' | 'reference_only' | 'unavailable';

export function applyTurnStartCataloguePresentationGate(args: {
  phaseKey: string;
  missionIntroHoldActive: boolean;
  matchupIntroHoldActive: boolean;
  currentTurnDicePresentationSettled: boolean;
  normalContext: BuildCatalogueContext;
}): BuildCatalogueContext {
  if (
    args.phaseKey === 'setup.species_selection' &&
    (args.missionIntroHoldActive || args.matchupIntroHoldActive)
  ) {
    return 'unavailable';
  }

  if (
    args.phaseKey === 'build.drawing' &&
    !args.currentTurnDicePresentationSettled &&
    args.normalContext === 'buildable'
  ) {
    return 'unavailable';
  }

  return args.normalContext;
}

export function isNormalDrawingInteractionHeld(args: {
  phaseKey: string;
  drawingStageKind: string;
  currentTurnDicePresentationSettled: boolean;
}): boolean {
  return (
    args.phaseKey === 'build.drawing' &&
    args.drawingStageKind === 'normal' &&
    !args.currentTurnDicePresentationSettled
  );
}

export interface BuildDrawingReadyEconomy {
  projectedSavedOrdinary: number;
  projectedSavedJoining: number;
  projectedSavedCombined: number;
  projectedSavedWasCapped: boolean;
}

export function deriveBuildDrawingReadyNote(args: {
  phaseKey: string;
  drawingStageKind: string;
  currentTurnDicePresentationSettled: boolean;
  economy: BuildDrawingReadyEconomy | null | undefined;
}): string | null {
  if (
    args.economy == null ||
    isNormalDrawingInteractionHeld(args) ||
    args.phaseKey !== 'build.drawing' ||
    args.drawingStageKind !== 'normal'
  ) {
    return null;
  }

  const cappedSuffix = args.economy.projectedSavedWasCapped ? ' (max)' : '';
  const ordinary = args.economy.projectedSavedOrdinary;
  const joining = args.economy.projectedSavedJoining;

  if (ordinary > 0 && joining > 0) {
    const lineLabel = ordinary === 1 ? 'line' : 'lines';
    return `Save ${ordinary} ${lineLabel} + ${joining}j${cappedSuffix}`;
  }

  if (ordinary > 0) {
    const lineLabel = ordinary === 1 ? 'line' : 'lines';
    return `Save ${ordinary} ${lineLabel}${cappedSuffix}`;
  }

  if (joining > 0) {
    return `Save ${joining}j${cappedSuffix}`;
  }

  return null;
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
