import type {
  ThisTurnMetricPairVm,
  ThisTurnPresentationVm,
} from '../types';

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

export interface TurnStartStatPresentationState {
  gameId: string | null;
  orientationKey: string | null;
  authoritativeTurnNumber: number | null;
  latestKey: string | null;
  latest: ThisTurnPresentationVm | null;
  presented: ThisTurnPresentationVm | null;
  pendingTurnNumber: number | null;
}

export function getTurnStartStatOrientationKey(args: {
  viewerRole: 'player' | 'spectator' | 'unknown';
  leftPlayerId: string | null;
  rightPlayerId: string | null;
}): string {
  return JSON.stringify([
    args.viewerRole,
    args.leftPlayerId,
    args.rightPlayerId,
  ]);
}

function getTurnStartStatPresentationKey(
  presentation: ThisTurnPresentationVm | null,
): string | null {
  return presentation == null ? null : JSON.stringify(presentation);
}

function reuseEquivalentTurnStartStatPresentationState(
  current: TurnStartStatPresentationState,
  next: TurnStartStatPresentationState,
): TurnStartStatPresentationState {
  return current.gameId === next.gameId &&
      current.orientationKey === next.orientationKey &&
      current.authoritativeTurnNumber === next.authoritativeTurnNumber &&
      current.latestKey === next.latestKey &&
      current.pendingTurnNumber === next.pendingTurnNumber &&
      getTurnStartStatPresentationKey(current.presented) ===
        getTurnStartStatPresentationKey(next.presented)
    ? current
    : next;
}

function createNeutralTurnStartMetricPair(
  turnNumber: number,
  latest: ThisTurnMetricPairVm,
): ThisTurnMetricPairVm {
  return {
    current: latest.current.state === 'concealed'
      ? { state: 'concealed', turnNumber }
      : {
          state: 'zero',
          turnNumber,
          source: 'turn_start_baseline',
          total: 0,
          rows: [],
        },
    last: {
      state: 'zero',
      turnNumber: Math.max(0, turnNumber - 1),
      source: 'last_actual',
      total: 0,
      rows: [],
    },
  };
}

export function createNeutralTurnStartStatPresentation(args: {
  gameId: string;
  turnNumber: number;
  latest: ThisTurnPresentationVm;
}): ThisTurnPresentationVm {
  const makePlayer = (latest: ThisTurnPresentationVm['me']) => ({
    playerId: latest.playerId,
    damage: createNeutralTurnStartMetricPair(args.turnNumber, latest.damage),
    healing: createNeutralTurnStartMetricPair(args.turnNumber, latest.healing),
  });

  return {
    turnNumber: args.turnNumber,
    phaseKey: args.latest.phaseKey,
    liveLog: null,
    me: makePlayer(args.latest.me),
    opponent: makePlayer(args.latest.opponent),
    archiveHandoff: null,
    mobile: {
      pairKey: `${args.gameId}::${args.turnNumber}::neutral`,
      opponentDetail: 'this_turn',
    },
  };
}

export function createTurnStartStatPresentationState(args: {
  gameId: string | null;
  orientationKey: string | null;
  turnNumber: number | null;
  presentation: ThisTurnPresentationVm | null;
  firstTurnRollPresentationActive: boolean;
  resolvedPresentationTurnNumber?: number | null;
}): TurnStartStatPresentationState {
  const resolvedPresentationTurnNumber =
    args.resolvedPresentationTurnNumber != null &&
      args.presentation?.turnNumber === args.resolvedPresentationTurnNumber
      ? args.resolvedPresentationTurnNumber
      : null;
  const shouldUseNeutralFirstTurn =
    resolvedPresentationTurnNumber == null &&
    args.gameId != null &&
    args.turnNumber === 1 &&
    args.presentation != null &&
    args.firstTurnRollPresentationActive;
  const presented = shouldUseNeutralFirstTurn
    ? createNeutralTurnStartStatPresentation({
        gameId: args.gameId!,
        turnNumber: args.turnNumber!,
        latest: args.presentation!,
      })
    : args.presentation;

  return {
    gameId: args.gameId,
    orientationKey: args.orientationKey,
    authoritativeTurnNumber:
      resolvedPresentationTurnNumber ?? args.turnNumber,
    latestKey: getTurnStartStatPresentationKey(args.presentation),
    latest: args.presentation,
    presented,
    pendingTurnNumber: shouldUseNeutralFirstTurn ? 1 : null,
  };
}

export function syncTurnStartStatPresentation(
  state: TurnStartStatPresentationState,
  args: {
    gameId: string | null;
    orientationKey: string | null;
    turnNumber: number | null;
    presentation: ThisTurnPresentationVm | null;
    settledTurnNumber: number | null;
    firstTurnRollPresentationActive: boolean;
    resolvedPresentationTurnNumber?: number | null;
  },
): TurnStartStatPresentationState {
  if (
    state.gameId !== args.gameId ||
    state.orientationKey !== args.orientationKey ||
    args.gameId == null ||
    args.orientationKey == null ||
    args.turnNumber == null ||
    args.presentation == null ||
    state.authoritativeTurnNumber == null ||
    args.turnNumber < state.authoritativeTurnNumber
  ) {
    return reuseEquivalentTurnStartStatPresentationState(
      state,
      createTurnStartStatPresentationState(args),
    );
  }

  const latestKey = getTurnStartStatPresentationKey(args.presentation);
  const isSettled = args.settledTurnNumber === args.turnNumber;
  const resolvedPresentationTurnNumber =
    args.resolvedPresentationTurnNumber != null &&
      args.presentation.turnNumber === args.resolvedPresentationTurnNumber
      ? args.resolvedPresentationTurnNumber
      : null;

  if (resolvedPresentationTurnNumber != null) {
    return reuseEquivalentTurnStartStatPresentationState(state, {
      ...state,
      authoritativeTurnNumber: resolvedPresentationTurnNumber,
      latestKey,
      latest: args.presentation,
      presented: args.presentation,
      pendingTurnNumber: null,
    });
  }

  if (
    args.turnNumber === 1 &&
    args.firstTurnRollPresentationActive &&
    !isSettled
  ) {
    const neutralPairKey = `${args.gameId}::${args.turnNumber}::neutral`;
    const presented =
      state.pendingTurnNumber === args.turnNumber &&
        state.presented?.mobile.pairKey === neutralPairKey
        ? state.presented
        : createNeutralTurnStartStatPresentation({
            gameId: args.gameId,
            turnNumber: args.turnNumber,
            latest: args.presentation,
          });
    return reuseEquivalentTurnStartStatPresentationState(state, {
      ...state,
      authoritativeTurnNumber: args.turnNumber,
      latestKey,
      latest: args.presentation,
      presented,
      pendingTurnNumber: args.turnNumber,
    });
  }

  if (args.turnNumber > state.authoritativeTurnNumber) {
    if (state.presented == null || isSettled) {
      return reuseEquivalentTurnStartStatPresentationState(state, {
        ...state,
        authoritativeTurnNumber: args.turnNumber,
        latestKey,
        latest: args.presentation,
        presented: args.presentation,
        pendingTurnNumber: null,
      });
    }

    return reuseEquivalentTurnStartStatPresentationState(state, {
      ...state,
      authoritativeTurnNumber: args.turnNumber,
      latestKey,
      latest: args.presentation,
      pendingTurnNumber: args.turnNumber,
    });
  }

  if (state.pendingTurnNumber === args.turnNumber) {
    const latest = latestKey === state.latestKey && state.latest != null
      ? state.latest
      : args.presentation;
    return reuseEquivalentTurnStartStatPresentationState(state, {
      ...state,
      latestKey,
      latest,
      presented: isSettled ? latest : state.presented,
      pendingTurnNumber: isSettled ? null : state.pendingTurnNumber,
    });
  }

  if (latestKey === state.latestKey) {
    return state;
  }

  return {
    ...state,
    latestKey,
    latest: args.presentation,
    presented: args.presentation,
  };
}

export function shouldHoldTurnStartFleetMaterialisation(args: {
  isSameGame: boolean;
  turnNumber: number;
  previouslyObservedTurnNumber: number | null;
  releaseTurnNumber: number | null;
  settledTurnNumber: number | null;
}): boolean {
  if (!args.isSameGame || args.settledTurnNumber === args.turnNumber) {
    return false;
  }

  const authoritativeTurnJustAdvanced =
    args.previouslyObservedTurnNumber != null &&
    args.turnNumber > args.previouslyObservedTurnNumber;
  const currentTurnReleasePending =
    args.releaseTurnNumber === args.turnNumber;

  return authoritativeTurnJustAdvanced || currentTurnReleasePending;
}

export function shouldHoldSetupTurnDiceCatchUp(args: {
  setupTurnDiceCatchUpPending: boolean;
  currentTurnDicePresentationSettled: boolean;
}): boolean {
  return (
    args.setupTurnDiceCatchUpPending &&
    !args.currentTurnDicePresentationSettled
  );
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
