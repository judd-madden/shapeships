import type {
  DrawingPreludePlayerState,
  DrawingPreludeSourcePower,
  GameState,
  ShipActivationCueSource,
  ShipInstance,
} from '../state/GameStateTypes.ts';
import {
  getCarrierDrawingPreludeChoiceLegality,
  getCurrentDrawingPreludePlayerState,
  isDrawingPreludeSourceResolved,
  validateFrozenCarrierDrawingPreludeSource,
} from '../state/drawingPreludeState.ts';
import { createPrivateDrawingPreludeCueKey } from '../state/drawingPreludeProjection.ts';
import { mergePrivateDrawingPreludeCueBatchStrict } from '../state/shipActivationCues.ts';
import { createBattleLogBuildCaptureEventsFromResolution } from '../state/battleLogHistory.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import type { Effect } from '../../engine_shared/effects/Effect.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { applyEffects, type EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import {
  countVerifiedCreatedShipsByTargetPlayerId,
  verifyAppliedEffectsOneToOne,
} from '../../engine_shared/effects/appliedEffectVerification.ts';
import { translateChoiceOptionEffects } from '../../engine_shared/effects/translateShipPowers.ts';
import {
  createBugBreederSourceEffects,
  createQueenSourceEffects,
  createRecurringZenithSourceEffects,
} from '../../engine_shared/resolve/shipsThatBuildSourceEffects.ts';
import { getEffectiveDiceRollForPlayer } from '../../engine_shared/resolve/phaseComputedEffects.ts';

export type DrawingPreludeResolutionErrorKind = 'invariant' | 'unsupported' | 'player';
export type DrawingPreludeResolutionError = {
  kind: DrawingPreludeResolutionErrorKind;
  code: string;
  message: string;
};
export type DrawingPreludeResolutionResult =
  | { ok: true; state: GameState; events: any[]; changed: boolean }
  | { ok: false; state: GameState; events: []; error: DrawingPreludeResolutionError };

export type DrawingPreludePowerAction = {
  actionType?: string;
  actionId?: string;
  sourceInstanceId?: string;
  choiceId?: string;
  passIndex?: 1 | 2;
  targetInstanceId?: string;
  targetInstanceIds?: string[];
};

function fail(
  originalState: GameState,
  kind: DrawingPreludeResolutionErrorKind,
  code: string,
  message: string,
): DrawingPreludeResolutionResult {
  return { ok: false, state: originalState, events: [], error: { kind, code, message } };
}

function currentPhase(state: Readonly<GameState>) {
  const gameData = state.gameData as any;
  return buildPhaseKey(gameData.currentPhase, gameData.currentSubPhase);
}

function requireCurrentPlayer(
  state: Readonly<GameState>,
  playerId: string,
): { ok: true; playerState: DrawingPreludePlayerState } | { ok: false; error: DrawingPreludeResolutionError } {
  if (currentPhase(state) !== 'build.drawing') {
    return { ok: false, error: { kind: 'invariant', code: 'WRONG_PRELUDE_PHASE', message: 'Drawing prelude requires build.drawing' } };
  }
  const playerState = getCurrentDrawingPreludePlayerState(state, playerId);
  if (!playerState) {
    return { ok: false, error: { kind: 'invariant', code: 'INVALID_REQUESTER_PRELUDE', message: 'Current Drawing-prelude requester state is missing or malformed' } };
  }
  return { ok: true, playerState };
}

function getRollForActivePass(
  state: Readonly<GameState>,
  playerId: string,
  playerState: Readonly<DrawingPreludePlayerState>,
): { ok: true; roll: number | undefined } | { ok: false; error: DrawingPreludeResolutionError } {
  if (playerState.activePassIndex === 1) {
    return { ok: true, roll: getEffectiveDiceRollForPlayer(state as GameState, playerId) };
  }

  const roll = state.gameData.turnData?.chronoswarmRolls?.[0];
  if (
    typeof roll !== 'number' ||
    !Number.isFinite(roll) ||
    !Number.isInteger(roll) ||
    roll < 1 ||
    roll > 6
  ) {
    return {
      ok: false,
      error: {
        kind: 'invariant',
        code: 'INVALID_CHRONOSWARM_ROLL',
        message: 'Drawing-prelude pass 2 requires a canonical first Chronoswarm roll from 1 to 6',
      },
    };
  }
  return { ok: true, roll };
}

function effectNamespace(
  playerState: DrawingPreludePlayerState,
  playerId: string,
  source: DrawingPreludeSourcePower,
  choiceOrAutomatic: string,
): string {
  return `drawing-prelude:${playerState.turnNumber}:${playerId}:pass:${playerState.activePassIndex}:${source.key}:${choiceOrAutomatic}:`;
}

export function createDrawingPreludeEffectId(args: {
  turnNumber: number;
  playerId: string;
  activePassIndex: 1 | 2;
  frozenSourceKey: string;
  choiceOrAutomatic: string;
  effectOrdinal: number;
}): string {
  return `drawing-prelude:${args.turnNumber}:${args.playerId}:pass:${args.activePassIndex}:${args.frozenSourceKey}:${args.choiceOrAutomatic}:${args.effectOrdinal}`;
}

function incrementVerifiedCreatedCounts(
  state: GameState,
  counts: Record<string, number>,
): void {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (entries.length === 0) return;
  const turnData = state.gameData.turnData ?? (state.gameData.turnData = {} as any);
  const prior = turnData.shipsMadeThisTurnByPlayerId ?? {};
  turnData.shipsMadeThisTurnByPlayerId = { ...prior };
  for (const [playerId, count] of entries) {
    turnData.shipsMadeThisTurnByPlayerId[playerId] = (prior[playerId] ?? 0) + count;
  }
}

function markResolvedInPlace(
  state: GameState,
  playerId: string,
  sourceKey: string,
): boolean {
  const playerState = state.gameData.turnData?.drawingPreludeByPlayerId?.[playerId];
  if (!playerState) return false;
  const current = new Set(playerState.resolvedSourcePowerKeysByPass[playerState.activePassIndex] ?? []);
  current.add(sourceKey);
  playerState.resolvedSourcePowerKeysByPass[playerState.activePassIndex] = playerState.eligibleSourcePowers
    .map((source) => source.key)
    .filter((key) => current.has(key));
  return true;
}

function findLiveFrozenSource(
  state: Readonly<GameState>,
  playerId: string,
  source: Readonly<DrawingPreludeSourcePower>,
): ShipInstance | null {
  const live = state.gameData.ships?.[playerId]?.find(
    (ship) => ship.instanceId === source.sourceInstanceId,
  );
  return live && live.shipDefId === source.shipDefId ? live : null;
}

function validateAutomaticSource(
  state: Readonly<GameState>,
  playerId: string,
  source: Readonly<DrawingPreludeSourcePower>,
): ShipInstance | null {
  const expectedCoordinate = source.shipDefId === 'BUG'
    ? 'BUG#0'
    : source.shipDefId === 'QUE'
    ? 'QUE#0'
    : source.shipDefId === 'ZEN'
    ? 'ZEN#1'
    : null;
  if (
    source.mode !== 'automatic' ||
    !expectedCoordinate ||
    `${source.shipDefId}#${source.rawPowerIndex}` !== expectedCoordinate ||
    source.key !== `${source.sourceInstanceId}:${expectedCoordinate}`
  ) return null;
  const live = findLiveFrozenSource(state, playerId, source);
  if (!live) return null;
  return live;
}

function loadAutomaticEffects(
  state: GameState,
  playerId: string,
  playerState: DrawingPreludePlayerState,
  source: DrawingPreludeSourcePower,
  roll: number | undefined,
): { effects: Effect[]; namespace: string } | null {
  const live = validateAutomaticSource(state, playerId, source);
  if (!live) return null;
  const rawPower = getShipDefinition(source.shipDefId)?.powers[source.rawPowerIndex];
  if (!rawPower || rawPower.activationTiming !== 'start_of_drawing') return null;
  const namespace = effectNamespace(playerState, playerId, source, 'automatic');
  const common = {
    source: live,
    playerId,
    turnNumber: playerState.turnNumber,
    phaseKey: 'build.drawing' as const,
    effectIdFactory: (ordinal: number) => createDrawingPreludeEffectId({
      turnNumber: playerState.turnNumber,
      playerId,
      activePassIndex: playerState.activePassIndex,
      frozenSourceKey: source.key,
      choiceOrAutomatic: 'automatic',
      effectOrdinal: ordinal,
    }),
  };
  const effects = source.shipDefId === 'BUG'
    ? createBugBreederSourceEffects(common)
    : source.shipDefId === 'QUE'
    ? createQueenSourceEffects(common)
    : createRecurringZenithSourceEffects({
        ...common,
        roll,
      });
  return { effects, namespace };
}

function markOwnerPrivate(events: readonly any[], playerId: string): any[] {
  return events.map((event) => ({
    ...event,
    drawingPreludeVisibility: { audience: 'owner', playerId },
  }));
}

function allResolved(playerState: DrawingPreludePlayerState): boolean {
  return playerState.eligibleSourcePowers.every((source) =>
    isDrawingPreludeSourceResolved(playerState, source.key)
  );
}

export function advanceDrawingPreludeForPlayer(args: {
  state: GameState;
  playerId: string;
  nowMs: number;
}): DrawingPreludeResolutionResult {
  const originalState = args.state;
  const required = requireCurrentPlayer(originalState, args.playerId);
  if (!required.ok) return fail(originalState, required.error.kind, required.error.code, required.error.message);
  if (required.playerState.status === 'complete') {
    return { ok: true, state: originalState, events: [], changed: false };
  }

  let working = structuredClone(originalState) as GameState;
  const emitted: any[] = [];
  let changed = false;

  for (let passIteration = 0; passIteration < 2; passIteration += 1) {
    let livePlayerState = getCurrentDrawingPreludePlayerState(working, args.playerId);
    if (!livePlayerState) {
      return fail(originalState, 'invariant', 'INVALID_REQUESTER_PRELUDE', 'Drawing-prelude state became malformed');
    }
    const passIndex = livePlayerState.activePassIndex;
    const passRoll = getRollForActivePass(working, args.playerId, livePlayerState);
    if (!passRoll.ok) {
      return fail(originalState, passRoll.error.kind, passRoll.error.code, passRoll.error.message);
    }
    const cueSources: ShipActivationCueSource[] = [];

    for (const frozenSource of livePlayerState.eligibleSourcePowers) {
      const currentPlayerState = getCurrentDrawingPreludePlayerState(working, args.playerId);
      if (!currentPlayerState) {
        return fail(originalState, 'invariant', 'INVALID_REQUESTER_PRELUDE', 'Drawing-prelude state became malformed');
      }
      if (isDrawingPreludeSourceResolved(currentPlayerState, frozenSource.key, passIndex)) continue;
      if (frozenSource.mode !== 'automatic') continue;

      const prepared = loadAutomaticEffects(
        working,
        args.playerId,
        currentPlayerState,
        frozenSource,
        passRoll.roll,
      );
      if (!prepared) {
        return fail(originalState, 'invariant', 'INVALID_AUTOMATIC_SOURCE', `Frozen automatic source is invalid: ${frozenSource.key}`);
      }
      if (prepared.effects.length > 0) {
        const before = working;
        const applied = applyEffects(working, prepared.effects);
        const verified = verifyAppliedEffectsOneToOne({
          expectedEffects: prepared.effects,
          effectEvents: applied.events,
          effectIdNamespace: prepared.namespace,
        });
        if (!verified.ok) return fail(originalState, 'invariant', verified.code, verified.message);
        working = applied.state;
        incrementVerifiedCreatedCounts(working, countVerifiedCreatedShipsByTargetPlayerId(verified.matches));
        emitted.push(...applied.events);
        emitted.push(...createBattleLogBuildCaptureEventsFromResolution({
          stateBeforeResolution: before,
          turnNumber: currentPlayerState.turnNumber,
          playerId: args.playerId,
          effects: prepared.effects,
          effectEvents: applied.events,
          producedBuildOccurrence: {
            stage: 'drawing_prelude',
            passIndex,
          },
        }));
        cueSources.push({ playerId: args.playerId, sourceInstanceId: frozenSource.sourceInstanceId });
      }
      if (!markResolvedInPlace(working, args.playerId, frozenSource.key)) {
        return fail(originalState, 'invariant', 'MARKER_FAILURE', 'Could not record automatic source resolution');
      }
      changed = true;
    }

    livePlayerState = getCurrentDrawingPreludePlayerState(working, args.playerId);
    if (!livePlayerState) {
      return fail(originalState, 'invariant', 'INVALID_REQUESTER_PRELUDE', 'Drawing-prelude state became malformed');
    }
    for (const source of livePlayerState.eligibleSourcePowers) {
      if (
        source.mode !== 'interactive' ||
        isDrawingPreludeSourceResolved(livePlayerState, source.key, passIndex)
      ) continue;
      const validated = validateFrozenCarrierDrawingPreludeSource(working, args.playerId, source);
      if (!validated.ok) return fail(originalState, 'invariant', validated.error.code, validated.error.message);
      const legality = getCarrierDrawingPreludeChoiceLegality(working, args.playerId, source);
      if (!legality.ok) return fail(originalState, 'invariant', legality.error.code, legality.error.message);
      if (legality.value.holdOnly) {
        if (!markResolvedInPlace(working, args.playerId, source.key)) {
          return fail(originalState, 'invariant', 'MARKER_FAILURE', 'Could not record forced Carrier Hold');
        }
        changed = true;
        livePlayerState = getCurrentDrawingPreludePlayerState(working, args.playerId)!;
      }
    }

    if (cueSources.length > 0) {
      const merged = mergePrivateDrawingPreludeCueBatchStrict(working, {
        key: createPrivateDrawingPreludeCueKey({
          turnNumber: livePlayerState.turnNumber,
          playerId: args.playerId,
          passIndex,
        }),
        turnNumber: livePlayerState.turnNumber,
        playerId: args.playerId,
        sources: cueSources,
      });
      if (!merged.ok) return fail(originalState, 'invariant', merged.error.code, merged.error.message);
      working = merged.state;
    }

    livePlayerState = getCurrentDrawingPreludePlayerState(working, args.playerId);
    if (!livePlayerState) {
      return fail(originalState, 'invariant', 'INVALID_REQUESTER_PRELUDE', 'Drawing-prelude state became malformed');
    }
    const canonicalPlayerState = working.gameData.turnData!.drawingPreludeByPlayerId![args.playerId];
    if (!allResolved(livePlayerState)) {
      if (canonicalPlayerState.status !== 'awaiting_actions') changed = true;
      canonicalPlayerState.status = 'awaiting_actions';
      return { ok: true, state: working, events: markOwnerPrivate(emitted, args.playerId), changed };
    }

    if (passIndex === 1 && livePlayerState.requiredPassCount === 2) {
      canonicalPlayerState.activePassIndex = 2;
      canonicalPlayerState.status = 'awaiting_actions';
      changed = true;
      continue;
    }

    if (canonicalPlayerState.status !== 'complete') changed = true;
    canonicalPlayerState.status = 'complete';
    return { ok: true, state: working, events: markOwnerPrivate(emitted, args.playerId), changed };
  }

  return fail(originalState, 'invariant', 'PRELUDE_PASS_BOUND_EXCEEDED', 'Drawing prelude exceeded its two-pass advancement bound');
}

function resolveCarrierActions(args: {
  state: GameState;
  playerId: string;
  actions: readonly DrawingPreludePowerAction[];
  nowMs: number;
  batch: boolean;
}): DrawingPreludeResolutionResult {
  const originalState = args.state;
  if (args.actions.length === 0) return fail(originalState, 'player', 'EMPTY_BATCH', 'Drawing-prelude batch cannot be empty');
  const required = requireCurrentPlayer(originalState, args.playerId);
  if (!required.ok) return fail(originalState, required.error.kind, required.error.code, required.error.message);
  const seen = new Set<string>();
  for (const action of args.actions) {
    if (
      action.actionType !== 'power' ||
      action.actionId !== 'CAR#0' ||
      typeof action.sourceInstanceId !== 'string' ||
      !action.sourceInstanceId ||
      typeof action.choiceId !== 'string' ||
      !action.choiceId ||
      (action.passIndex !== 1 && action.passIndex !== 2) ||
      action.targetInstanceId !== undefined ||
      action.targetInstanceIds !== undefined
    ) return fail(originalState, 'player', 'INVALID_CARRIER_ACTION', 'Only complete CAR#0 power actions are accepted');
    if (action.passIndex !== required.playerState.activePassIndex) {
      return fail(originalState, 'player', 'STALE_PRELUDE_PASS', 'Carrier action does not belong to the current Drawing-prelude pass');
    }
    if (seen.has(action.sourceInstanceId)) return fail(originalState, 'player', 'DUPLICATE_BATCH_SOURCE', 'A Carrier source may appear only once per batch');
    seen.add(action.sourceInstanceId);
  }

  if (required.playerState.status === 'complete') return fail(originalState, 'player', 'ALREADY_RESOLVED', 'Drawing-prelude source is already resolved');
  if (required.playerState.eligibleSourcePowers.some((source) =>
    source.mode === 'automatic' && !isDrawingPreludeSourceResolved(required.playerState, source.key)
  )) return fail(originalState, 'invariant', 'AUTOMATIC_SOURCES_UNRESOLVED', 'Automatic Drawing-prelude sources must resolve first');

  let working = structuredClone(originalState) as GameState;
  const emitted: any[] = [];
  const cueSources: ShipActivationCueSource[] = [];
  const opponentId = working.players.find((player) => player.role === 'player' && player.id !== args.playerId)?.id ?? args.playerId;

  for (const action of args.actions) {
    const playerState = getCurrentDrawingPreludePlayerState(working, args.playerId);
    if (!playerState) return fail(originalState, 'invariant', 'INVALID_REQUESTER_PRELUDE', 'Current Drawing-prelude requester state is malformed');
    if (action.passIndex !== playerState.activePassIndex) {
      return fail(originalState, 'player', 'STALE_PRELUDE_PASS', 'Carrier action does not belong to the current Drawing-prelude pass');
    }
    const source = playerState.eligibleSourcePowers.find((candidate) =>
      candidate.sourceInstanceId === action.sourceInstanceId
    );
    if (!source || source.mode !== 'interactive') return fail(originalState, 'player', 'UNRELATED_ACTION', 'Carrier source is not frozen for this prelude');
    if (isDrawingPreludeSourceResolved(playerState, source.key)) return fail(originalState, 'player', 'ALREADY_RESOLVED', 'Carrier source is already resolved');
    const validated = validateFrozenCarrierDrawingPreludeSource(working, args.playerId, source);
    if (!validated.ok) return fail(originalState, 'invariant', validated.error.code, validated.error.message);
    const legality = getCarrierDrawingPreludeChoiceLegality(working, args.playerId, source);
    if (!legality.ok) return fail(originalState, 'invariant', legality.error.code, legality.error.message);
    const choiceId = action.choiceId!;
    if (choiceId !== 'hold' && !legality.value.nonHoldChoiceIds.includes(choiceId as any)) {
      return fail(originalState, 'player', 'ILLEGAL_CARRIER_CHOICE', 'Carrier choice is not currently legal');
    }
    const option = validated.value.choicePower.options.find((candidate) => candidate.choiceId === choiceId);
    if (!option) return fail(originalState, 'player', 'INVALID_CARRIER_CHOICE', 'Carrier choice is not defined');

    let effects: Effect[] = [];
    let effectEvents: EffectEvent[] = [];
    if (choiceId !== 'hold') {
      const namespace = effectNamespace(playerState, args.playerId, source, choiceId);
      effects = translateChoiceOptionEffects(
        option.effects,
        source.rawPowerIndex,
        'build.drawing',
        {
          shipInstanceId: source.sourceInstanceId,
          shipDefId: source.shipDefId,
          ownerPlayerId: args.playerId,
          opponentPlayerId: opponentId,
        },
        choiceId,
      ).map((effect, ordinal) => ({
        ...effect,
        id: createDrawingPreludeEffectId({
          turnNumber: playerState.turnNumber,
          playerId: args.playerId,
          activePassIndex: playerState.activePassIndex,
          frozenSourceKey: source.key,
          choiceOrAutomatic: choiceId,
          effectOrdinal: ordinal,
        }),
      }));
      const before = working;
      const applied = applyEffects(working, effects);
      const verified = verifyAppliedEffectsOneToOne({ expectedEffects: effects, effectEvents: applied.events, effectIdNamespace: namespace });
      if (!verified.ok) return fail(originalState, 'invariant', verified.code, verified.message);
      working = applied.state;
      effectEvents = applied.events;
      incrementVerifiedCreatedCounts(working, countVerifiedCreatedShipsByTargetPlayerId(verified.matches));
      emitted.push(...effectEvents);
      emitted.push(...createBattleLogBuildCaptureEventsFromResolution({
        stateBeforeResolution: before,
        turnNumber: playerState.turnNumber,
        playerId: args.playerId,
        effects,
        effectEvents,
        producedBuildOccurrence: {
          stage: 'drawing_prelude',
          passIndex: playerState.activePassIndex,
        },
      }));
      cueSources.push({ playerId: args.playerId, sourceInstanceId: source.sourceInstanceId });
    }
    if (!markResolvedInPlace(working, args.playerId, source.key)) return fail(originalState, 'invariant', 'MARKER_FAILURE', 'Could not mark Carrier source');
    emitted.push({
      type: 'POWER_USED',
      playerId: args.playerId,
      phaseKey: 'build.drawing',
      actionId: 'CAR#0',
      sourceInstanceId: source.sourceInstanceId,
      choiceId,
      spentCharge: effects.some((effect) => effect.kind === EffectKind.SpendCharge),
      atMs: args.nowMs,
    });
  }

  if (cueSources.length > 0) {
    const playerState = getCurrentDrawingPreludePlayerState(working, args.playerId)!;
    const merged = mergePrivateDrawingPreludeCueBatchStrict(working, {
      key: createPrivateDrawingPreludeCueKey({ turnNumber: playerState.turnNumber, playerId: args.playerId, passIndex: playerState.activePassIndex }),
      turnNumber: playerState.turnNumber,
      playerId: args.playerId,
      sources: cueSources,
    });
    if (!merged.ok) return fail(originalState, 'invariant', merged.error.code, merged.error.message);
    working = merged.state;
  }

  if (args.batch) emitted.push({ type: 'POWERS_BATCH_SUBMITTED', playerId: args.playerId, phaseKey: 'build.drawing', count: args.actions.length, atMs: args.nowMs });
  const advanced = advanceDrawingPreludeForPlayer({ state: working, playerId: args.playerId, nowMs: args.nowMs });
  if (!advanced.ok) return fail(originalState, advanced.error.kind, advanced.error.code, advanced.error.message);
  return {
    ok: true,
    state: advanced.state,
    events: markOwnerPrivate([...emitted, ...advanced.events], args.playerId),
    changed: true,
  };
}

export function resolveDrawingPreludePowerAction(args: {
  state: GameState;
  playerId: string;
  action: DrawingPreludePowerAction;
  nowMs: number;
}): DrawingPreludeResolutionResult {
  return resolveCarrierActions({ ...args, actions: [args.action], batch: false });
}

export function resolveDrawingPreludePowerActionsBatch(args: {
  state: GameState;
  playerId: string;
  actions: readonly DrawingPreludePowerAction[];
  nowMs: number;
}): DrawingPreludeResolutionResult {
  return resolveCarrierActions({ ...args, batch: true });
}
