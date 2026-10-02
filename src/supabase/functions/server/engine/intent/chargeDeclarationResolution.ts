import type {
  AcceptedChargeDeclaration,
  AncientAcceptedDeclaration,
  AncientEnergyPool,
  AncientNormalizedOrdinaryChargeChoice,
  AncientNormalizedSolarCast,
  ShipActivationCueSource,
} from '../state/GameStateTypes.ts';
import {
  ANCIENT_SOLAR_POWER_IDS,
  type AncientSolarPowerId,
} from '../state/GameStateTypes.ts';
import {
  CHARGE_DECLARATION_CONTRACT_VERSION,
  type ChargeDeclarationSubmitPayload,
} from './IntentTypes.ts';
import {
  ancientAtomicDeclarationContractApplies,
  getAcceptedDeclarationForCurrentBattle,
  getChargeDeclarationBattleTurnNumber,
  getSnappedOrdinaryChargeSourceIds,
  isAncientPlayer,
} from './chargeDeclarationEligibility.ts';
import { resolvePowerAction } from '../../engine_shared/resolve/resolvePowerAction.ts';
import type { EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import {
  createBattleLogBattleCaptureEventsFromResolution,
} from '../state/battleLogHistory.ts';
import {
  appendShipActivationCueBatch,
  getShipActivationSourcesFromAppliedEffects,
} from '../state/shipActivationCues.ts';
import {
  recordChargeDeclarationSpendAcknowledgements,
  requireChargeDeclarationLegalityState,
} from '../state/chargeDeclarationVisibility.ts';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
  type ManualSolarResolverRegistry,
} from '../ancient/manualSolarDeclaration.ts';
import {
  buildMonoColourAutocastCasts,
  PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
  SIPHON_SOLAR_RESOLVER,
  VORTEX_SOLAR_RESOLVER,
} from '../ancient/solarPowerResolvers.ts';
import { BLACK_HOLE_SOLAR_RESOLVER } from '../ancient/blackHoleSolarPower.ts';
import { SIMULACRUM_SOLAR_RESOLVER } from '../ancient/simulacrumSolarPower.ts';

export const PRODUCTION_SOLAR_RESOLVERS: Readonly<ManualSolarResolverRegistry> = Object.freeze({
  ...PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
  SSIP: SIPHON_SOLAR_RESOLVER,
  SVOR: VORTEX_SOLAR_RESOLVER,
  SBLA: BLACK_HOLE_SOLAR_RESOLVER,
  SSIM: SIMULACRUM_SOLAR_RESOLVER,
});

export type NormalizedChargeDeclaration = {
  contractVersion: 1;
  declarationId: string;
  ordinaryChargeActions: AncientNormalizedOrdinaryChargeChoice[];
  solarCasts: AncientNormalizedSolarCast[];
  autocastEnabled: boolean;
};

export type ChargeDeclarationResolutionResult = {
  status: 'applied' | 'idempotent';
  state: any;
  events: any[];
  normalized: NormalizedChargeDeclaration;
};

export type DisposableOrdinaryChargeResolution = {
  action: AncientNormalizedOrdinaryChargeChoice;
  stateBeforeResolution: any;
  effects: any[];
  events: any[];
  spentCharge: boolean;
};

export type DisposableChargeDeclarationResult = {
  state: any;
  normalized: NormalizedChargeDeclaration;
  battleTurnNumber: number;
  initialEnergy: AncientEnergyPool;
  initialEnergySourceIds: string[];
  ordinaryResolutions: DisposableOrdinaryChargeResolution[];
};

export class ChargeDeclarationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChargeDeclarationConflictError';
  }
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing or invalid ${field}`);
  }
  return value;
}

function normalizeTargetInstanceIds(value: unknown): string[] | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!Array.isArray(value)) throw new Error('targetInstanceIds must be an array');
  return value.map((candidate, index) =>
    requireNonEmptyString(candidate, `targetInstanceIds[${index}]`)
  ).sort((a, b) => a.localeCompare(b));
}

const ANCIENT_SOLAR_POWER_ID_SET = new Set<AncientSolarPowerId>(ANCIENT_SOLAR_POWER_IDS);

function normalizeSolarCasts(value: unknown[]): AncientNormalizedSolarCast[] {
  return value.map((candidate, index) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`solarCasts[${index}] must be an object`);
    }
    const source = candidate as Record<string, unknown>;
    const allowedFields = new Set(['solarPowerId', 'targetInstanceId', 'targetInstanceIds', 'lockedAmount']);
    const unsupportedField = Object.keys(source).find((field) => !allowedFields.has(field));
    if (unsupportedField) {
      throw new Error(`solarCasts[${index}] contains unsupported field: ${unsupportedField}`);
    }
    if (typeof source.solarPowerId !== 'string' || !ANCIENT_SOLAR_POWER_ID_SET.has(source.solarPowerId as AncientSolarPowerId)) {
      throw new Error(`Unknown Solar Power ID at solarCasts[${index}]: ${String(source.solarPowerId)}`);
    }
    if (typeof source.targetInstanceId !== 'undefined' && typeof source.targetInstanceIds !== 'undefined') {
      throw new Error(`solarCasts[${index}] cannot include both targetInstanceId and targetInstanceIds`);
    }
    const targetInstanceId = typeof source.targetInstanceId === 'undefined'
      ? undefined
      : requireNonEmptyString(source.targetInstanceId, `solarCasts[${index}].targetInstanceId`);
    let targetInstanceIds: string[] | undefined;
    if (typeof source.targetInstanceIds !== 'undefined') {
      if (!Array.isArray(source.targetInstanceIds)) {
        throw new Error(`solarCasts[${index}].targetInstanceIds must be an array`);
      }
      targetInstanceIds = source.targetInstanceIds.map((target, targetIndex) =>
        requireNonEmptyString(target, `solarCasts[${index}].targetInstanceIds[${targetIndex}]`)
      );
      if (new Set(targetInstanceIds).size !== targetInstanceIds.length) {
        throw new Error(`solarCasts[${index}].targetInstanceIds contains duplicates`);
      }
      targetInstanceIds.sort((a, b) => a.localeCompare(b));
    }
    if (
      typeof source.lockedAmount !== 'undefined' &&
      (typeof source.lockedAmount !== 'number' ||
        !Number.isFinite(source.lockedAmount) ||
        !Number.isInteger(source.lockedAmount) ||
        source.lockedAmount < 0)
    ) {
      throw new Error(`solarCasts[${index}].lockedAmount must be a non-negative integer`);
    }
    return {
      solarPowerId: source.solarPowerId as AncientSolarPowerId,
      ...(targetInstanceId ? { targetInstanceId } : {}),
      ...(targetInstanceIds ? { targetInstanceIds } : {}),
      ...(typeof source.lockedAmount === 'number' ? { lockedAmount: source.lockedAmount } : {}),
    };
  });
}

export function normalizeChargeDeclarationPayload(value: unknown): NormalizedChargeDeclaration {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Missing or invalid charge declaration payload');
  }
  const payload = value as ChargeDeclarationSubmitPayload;
  const allowedFields = new Set([
    'contractVersion',
    'declarationId',
    'ordinaryChargeActions',
    'solarCasts',
    'autocastEnabled',
  ]);
  const unsupportedField = Object.keys(payload).find((field) => !allowedFields.has(field));
  if (unsupportedField) {
    throw new Error(`Charge declaration payload contains unsupported field: ${unsupportedField}`);
  }
  if (payload.contractVersion !== CHARGE_DECLARATION_CONTRACT_VERSION) {
    throw new Error(`Unsupported charge declaration contract version: ${String(payload.contractVersion)}`);
  }
  const declarationId = requireNonEmptyString(payload.declarationId, 'declarationId');
  if (!Array.isArray(payload.ordinaryChargeActions)) {
    throw new Error('ordinaryChargeActions must be an array');
  }
  if (!Array.isArray(payload.solarCasts)) {
    throw new Error('solarCasts must be an array');
  }
  if (typeof payload.autocastEnabled !== 'boolean') {
    throw new Error('autocastEnabled must be an explicit boolean');
  }
  const seenOrdinarySources = new Set<string>();
  const ordinaryChargeActions = payload.ordinaryChargeActions.map((candidate: any, index) => {
    if (!candidate || typeof candidate !== 'object' || candidate.actionType !== 'power') {
      throw new Error(`ordinaryChargeActions[${index}] must be a power action`);
    }
    const allowedActionFields = new Set([
      'actionType',
      'actionId',
      'sourceInstanceId',
      'choiceId',
      'targetInstanceId',
      'targetInstanceIds',
    ]);
    const unsupportedActionField = Object.keys(candidate).find((field) =>
      !allowedActionFields.has(field)
    );
    if (unsupportedActionField) {
      throw new Error(
        `ordinaryChargeActions[${index}] contains unsupported field: ${unsupportedActionField}`,
      );
    }
    if (
      typeof candidate.targetInstanceId !== 'undefined' &&
      typeof candidate.targetInstanceIds !== 'undefined'
    ) {
      throw new Error(
        `ordinaryChargeActions[${index}] cannot include both targetInstanceId and targetInstanceIds`,
      );
    }
    const sourceInstanceId = requireNonEmptyString(
      candidate.sourceInstanceId,
      `ordinaryChargeActions[${index}].sourceInstanceId`,
    );
    if (seenOrdinarySources.has(sourceInstanceId)) {
      throw new Error(`Duplicate ordinary charge source: ${sourceInstanceId}`);
    }
    seenOrdinarySources.add(sourceInstanceId);
    const targetInstanceIds = normalizeTargetInstanceIds(candidate.targetInstanceIds);
    if (targetInstanceIds && new Set(targetInstanceIds).size !== targetInstanceIds.length) {
      throw new Error(`ordinaryChargeActions[${index}].targetInstanceIds contains duplicates`);
    }
    return {
      actionType: 'power' as const,
      actionId: requireNonEmptyString(candidate.actionId, `ordinaryChargeActions[${index}].actionId`),
      sourceInstanceId,
      choiceId: requireNonEmptyString(candidate.choiceId, `ordinaryChargeActions[${index}].choiceId`),
      ...(typeof candidate.targetInstanceId !== 'undefined'
        ? { targetInstanceId: requireNonEmptyString(candidate.targetInstanceId, `ordinaryChargeActions[${index}].targetInstanceId`) }
        : {}),
      ...(targetInstanceIds ? { targetInstanceIds } : {}),
    };
  });

  return {
    contractVersion: CHARGE_DECLARATION_CONTRACT_VERSION,
    declarationId,
    ordinaryChargeActions,
    solarCasts: normalizeSolarCasts(payload.solarCasts),
    autocastEnabled: payload.autocastEnabled,
  };
}

export function fingerprintChargeDeclaration(normalized: NormalizedChargeDeclaration): string {
  return JSON.stringify({
    contractVersion: normalized.contractVersion,
    ordinaryChargeActions: normalized.ordinaryChargeActions,
    solarCasts: normalized.solarCasts,
    autocastEnabled: normalized.autocastEnabled,
  });
}

function getPhaseKey(state: any): string | null {
  if (typeof state?.phaseKey === 'string') return state.phaseKey;
  const major = state?.gameData?.currentPhase;
  const sub = state?.gameData?.currentSubPhase;
  return typeof major === 'string' && typeof sub === 'string' ? `${major}.${sub}` : null;
}

function getEffectEvents(events: unknown[]): EffectEvent[] {
  return events.filter((event): event is EffectEvent =>
    !!event && typeof event === 'object' && (event as any).type === 'EFFECT_APPLIED'
  );
}

function validateAuthoritativeSourceSets(
  state: any,
  playerId: string,
  normalized: NormalizedChargeDeclaration,
): void {
  const ordinarySourceIds = new Set(getSnappedOrdinaryChargeSourceIds(state, playerId));
  for (const action of normalized.ordinaryChargeActions) {
    if (!ordinarySourceIds.has(action.sourceInstanceId)) {
      throw new Error(`Ordinary charge source is not in the declaration snapshot: ${action.sourceInstanceId}`);
    }
  }

}

function cloneEnergyPool(value: any): AncientEnergyPool {
  return {
    green: Number.isFinite(value?.green) ? Math.max(0, Math.floor(value.green)) : 0,
    red: Number.isFinite(value?.red) ? Math.max(0, Math.floor(value.red)) : 0,
    blue: Number.isFinite(value?.blue) ? Math.max(0, Math.floor(value.blue)) : 0,
  };
}

function buildAcceptedDeclaration(args: {
  normalized: NormalizedChargeDeclaration;
  playerId: string;
  battleTurnNumber: number;
  initialEnergy: AncientEnergyPool;
  initialEnergySourceIds: string[];
}): AncientAcceptedDeclaration {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    declarationId: args.normalized.declarationId,
    declarationFingerprint: fingerprintChargeDeclaration(args.normalized),
    playerId: args.playerId,
    context: {
      contextVersion: 1,
      battleTurnNumber: args.battleTurnNumber,
      initialEnergy: args.initialEnergy,
      energySourceIds: args.initialEnergySourceIds,
    },
    ordinaryChargeActions: structuredClone(args.normalized.ordinaryChargeActions),
    solarCasts: structuredClone(args.normalized.solarCasts),
    autocastEnabled: args.normalized.autocastEnabled,
  };
}

export function buildAcceptedChargeDeclaration(args: {
  normalized: NormalizedChargeDeclaration;
  playerId: string;
  battleTurnNumber: number;
}): AcceptedChargeDeclaration {
  return {
    schemaVersion: 1,
    contractVersion: 1,
    battleTurnNumber: args.battleTurnNumber,
    declarationId: args.normalized.declarationId,
    declarationFingerprint: fingerprintChargeDeclaration(args.normalized),
    playerId: args.playerId,
    ordinaryChargeActions: structuredClone(args.normalized.ordinaryChargeActions),
    solarCasts: structuredClone(args.normalized.solarCasts),
    autocastEnabled: args.normalized.autocastEnabled,
  };
}

/**
 * Applies a normalized declaration to a disposable clone. This is the one
 * authoritative resolution path shared by persistence and requester-private
 * estimates; callers own persistence, events, readiness, and phase movement.
 */
export function resolveChargeDeclarationDisposable(args: {
  state: any;
  playerId: string;
  normalized: NormalizedChargeDeclaration;
}, dependencies: {
  manualSolarResolvers: Readonly<ManualSolarResolverRegistry>;
} = { manualSolarResolvers: PRODUCTION_SOLAR_RESOLVERS }): DisposableChargeDeclarationResult {
  if (getPhaseKey(args.state) !== 'battle.charge_declaration') {
    throw new Error('Charge declaration resolution is only allowed during battle.charge_declaration');
  }
  requireChargeDeclarationLegalityState(args.state);
  validateAuthoritativeSourceSets(args.state, args.playerId, args.normalized);

  const hasSolarInput = args.normalized.solarCasts.length > 0 || args.normalized.autocastEnabled;
  if (hasSolarInput && !isAncientPlayer(args.state, args.playerId)) {
    throw new Error('Only Ancient players may submit Solar Power input');
  }

  let workingState = structuredClone(args.state);
  const ordinaryResolutions: DisposableOrdinaryChargeResolution[] = [];
  for (const action of args.normalized.ordinaryChargeActions) {
    const stateBeforeResolution = workingState;
    const outcome = resolvePowerAction({
      state: workingState,
      playerId: args.playerId,
      phaseKey: 'battle.charge_declaration',
      actionId: action.actionId,
      sourceInstanceId: action.sourceInstanceId,
      choiceId: action.choiceId,
      targetInstanceId: action.targetInstanceId,
      targetInstanceIds: action.targetInstanceIds,
    });
    workingState = outcome.state;
    ordinaryResolutions.push({
      action,
      stateBeforeResolution,
      effects: outcome.effects,
      events: outcome.events,
      spentCharge: outcome.spentCharge,
    });
  }

  const battleTurnNumber = getChargeDeclarationBattleTurnNumber(workingState);
  const initialEnergyState = workingState?.gameData?.ancient?.energyByPlayerId?.[args.playerId];
  const initialEnergy = cloneEnergyPool(initialEnergyState?.pool);
  const initialEnergySourceIds = Array.isArray(initialEnergyState?.sources)
    ? initialEnergyState.sources.map((source: any) => source.sourceId).filter((id: any) => typeof id === 'string')
    : [];

  if (isAncientPlayer(workingState, args.playerId)) {
    let nextEnergy = cloneEnergyPool(initialEnergy);
    const nextSources = Array.isArray(initialEnergyState?.sources)
      ? structuredClone(initialEnergyState.sources)
      : [];
    const manualSolar = resolveManualSolarDeclaration({
      state: workingState,
      playerId: args.playerId,
      declarationId: args.normalized.declarationId,
      battleTurnNumber,
      initialEnergy: nextEnergy,
      casts: args.normalized.solarCasts,
      resolvers: dependencies.manualSolarResolvers,
    });
    workingState = manualSolar.state;
    nextEnergy = manualSolar.remainingEnergy;
    const ledgerEntries = [...manualSolar.ledgerEntries];

    if (args.normalized.autocastEnabled) {
      const autocastSolar = resolveSolarCastSequence({
        state: workingState,
        playerId: args.playerId,
        declarationId: args.normalized.declarationId,
        battleTurnNumber,
        initialEnergy: nextEnergy,
        casts: buildMonoColourAutocastCasts(nextEnergy),
        resolvers: dependencies.manualSolarResolvers,
        sourceMode: 'autocast',
        initialLedgerOrder: ledgerEntries.length,
      });
      workingState = autocastSolar.state;
      nextEnergy = autocastSolar.remainingEnergy;
      ledgerEntries.push(...autocastSolar.ledgerEntries);
    }

    workingState.gameData.ancient.energyByPlayerId[args.playerId] = {
      battleTurnNumber,
      pool: nextEnergy,
      sources: nextSources,
    };
    workingState.gameData.ancient.solarLedgerByPlayerId[args.playerId] = {
      battleTurnNumber,
      entries: ledgerEntries,
    };
  }

  return {
    state: workingState,
    normalized: args.normalized,
    battleTurnNumber,
    initialEnergy,
    initialEnergySourceIds,
    ordinaryResolutions,
  };
}

export function applyDisposableChargeDeclarationToProduction(args: {
  result: DisposableChargeDeclarationResult;
  playerId: string;
  nowMs: number;
}): { state: any; events: any[] } {
  let workingState = args.result.state;
  const events: any[] = [];
  const activationSources: ShipActivationCueSource[] = [];
  for (const resolution of args.result.ordinaryResolutions) {
    const effectEvents = getEffectEvents(resolution.events);
    recordChargeDeclarationSpendAcknowledgements(workingState, args.playerId, effectEvents);
    activationSources.push(...getShipActivationSourcesFromAppliedEffects(resolution.effects, effectEvents));
    events.push(...createBattleLogBattleCaptureEventsFromResolution({
      stateBeforeResolution: resolution.stateBeforeResolution,
      turnNumber: getChargeDeclarationBattleTurnNumber(resolution.stateBeforeResolution),
      playerId: args.playerId,
      phaseKey: 'battle.charge_declaration',
      choiceId: resolution.action.choiceId,
      effects: resolution.effects,
      effectEvents,
    }));
    events.push({
      type: 'POWER_USED',
      playerId: args.playerId,
      phaseKey: 'battle.charge_declaration',
      actionId: resolution.action.actionId,
      sourceInstanceId: resolution.action.sourceInstanceId,
      choiceId: resolution.action.choiceId,
      targetInstanceId: resolution.action.targetInstanceId,
      targetInstanceIds: resolution.action.targetInstanceIds,
      spentCharge: resolution.spentCharge,
      atMs: args.nowMs,
    });
  }
  workingState = appendShipActivationCueBatch(workingState, {
    phaseKey: 'battle.charge_declaration',
    sources: activationSources,
  });
  return { state: workingState, events };
}

function actionsEqual(
  left: AncientNormalizedOrdinaryChargeChoice,
  right: AncientNormalizedOrdinaryChargeChoice,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function currentAcceptedGenericDeclaration(state: any, playerId: string): AcceptedChargeDeclaration | null {
  const accepted = state?.gameData?.turnData?.acceptedChargeDeclarationsByPlayerId?.[playerId];
  return accepted?.battleTurnNumber === getChargeDeclarationBattleTurnNumber(state)
    ? accepted as AcceptedChargeDeclaration
    : null;
}

export function getRetainedOrdinaryChargeActions(
  state: any,
  playerId: string,
): AncientNormalizedOrdinaryChargeChoice[] {
  const retained = state?.gameData?.turnData
    ?.chargeDeclarationAcceptedOrdinaryActionsByPlayerId?.[playerId];
  return retained?.battleTurnNumber === getChargeDeclarationBattleTurnNumber(state) &&
      Array.isArray(retained.actions)
    ? structuredClone(retained.actions)
    : [];
}

export function mergeRetainedOrdinaryChargeActions(args: {
  state: any;
  playerId: string;
  draftActions: AncientNormalizedOrdinaryChargeChoice[];
}): AncientNormalizedOrdinaryChargeChoice[] {
  const finalized = currentAcceptedGenericDeclaration(args.state, args.playerId);
  const retained = finalized
    ? finalized.ordinaryChargeActions
    : getRetainedOrdinaryChargeActions(args.state, args.playerId);
  const bySourceId = new Map(retained.map((action) => [action.sourceInstanceId, action]));
  const merged = structuredClone(retained);
  for (const draft of args.draftActions) {
    const accepted = bySourceId.get(draft.sourceInstanceId);
    if (accepted) {
      if (!actionsEqual(accepted, draft)) {
        throw new ChargeDeclarationConflictError(
          `Charge source already has a different accepted declaration: ${draft.sourceInstanceId}`,
        );
      }
      continue;
    }
    if (finalized) {
      throw new Error('The charge declaration is finalized; new sources cannot be added');
    }
    bySourceId.set(draft.sourceInstanceId, draft);
    merged.push(structuredClone(draft));
  }
  return merged;
}

export function submitOrdinaryChargeActions(args: {
  state: any;
  playerId: string;
  actions: unknown[];
  nowMs: number;
}): { status: 'applied' | 'idempotent'; state: any; events: any[] } {
  const battleTurnNumber = getChargeDeclarationBattleTurnNumber(args.state);
  const normalized = normalizeChargeDeclarationPayload({
    contractVersion: 1,
    declarationId: `ordinary:${battleTurnNumber}:${args.playerId}`,
    ordinaryChargeActions: args.actions,
    solarCasts: [],
    autocastEnabled: false,
  });
  const finalized = currentAcceptedGenericDeclaration(args.state, args.playerId);
  const retained = finalized
    ? finalized.ordinaryChargeActions
    : getRetainedOrdinaryChargeActions(args.state, args.playerId);
  const retainedBySourceId = new Map(retained.map((action) => [action.sourceInstanceId, action]));
  const newActions: AncientNormalizedOrdinaryChargeChoice[] = [];
  for (const action of normalized.ordinaryChargeActions) {
    const previous = retainedBySourceId.get(action.sourceInstanceId);
    if (previous) {
      if (!actionsEqual(previous, action)) {
        throw new ChargeDeclarationConflictError(
          `Charge source already has a different accepted declaration: ${action.sourceInstanceId}`,
        );
      }
      continue;
    }
    if (finalized) {
      throw new Error('The charge declaration is finalized; new sources cannot be added');
    }
    retainedBySourceId.set(action.sourceInstanceId, action);
    newActions.push(action);
  }
  if (newActions.length === 0) {
    return { status: 'idempotent', state: args.state, events: [] };
  }

  const newOnly = { ...normalized, ordinaryChargeActions: newActions };
  const disposable = resolveChargeDeclarationDisposable({
    state: args.state,
    playerId: args.playerId,
    normalized: newOnly,
  });
  const applied = applyDisposableChargeDeclarationToProduction({
    result: disposable,
    playerId: args.playerId,
    nowMs: args.nowMs,
  });
  const turnData = applied.state.gameData.turnData ?? (applied.state.gameData.turnData = {});
  const retainedByPlayerId = turnData.chargeDeclarationAcceptedOrdinaryActionsByPlayerId ??
    (turnData.chargeDeclarationAcceptedOrdinaryActionsByPlayerId = {});
  retainedByPlayerId[args.playerId] = {
    schemaVersion: 1,
    battleTurnNumber,
    playerId: args.playerId,
    actions: [...structuredClone(retained), ...structuredClone(newActions)],
  };
  return { status: 'applied', state: applied.state, events: applied.events };
}

export function finalizeOrdinaryChargeDeclaration(state: any, playerId: string): void {
  if (currentAcceptedGenericDeclaration(state, playerId)) return;
  const battleTurnNumber = getChargeDeclarationBattleTurnNumber(state);
  const normalized: NormalizedChargeDeclaration = {
    contractVersion: 1,
    declarationId: `ordinary:${battleTurnNumber}:${playerId}`,
    ordinaryChargeActions: getRetainedOrdinaryChargeActions(state, playerId),
    solarCasts: [],
    autocastEnabled: false,
  };
  const turnData = state.gameData.turnData ?? (state.gameData.turnData = {});
  const acceptedByPlayerId = turnData.acceptedChargeDeclarationsByPlayerId ??
    (turnData.acceptedChargeDeclarationsByPlayerId = {});
  acceptedByPlayerId[playerId] = buildAcceptedChargeDeclaration({
    normalized,
    playerId,
    battleTurnNumber,
  });
}

export function resolveChargeDeclarationSubmission(args: {
  state: any;
  playerId: string;
  payload: unknown;
  nowMs: number;
}): ChargeDeclarationResolutionResult {
  return resolveChargeDeclarationSubmissionWithDependencies(args, {
    manualSolarResolvers: PRODUCTION_SOLAR_RESOLVERS,
  });
}

export function resolveChargeDeclarationSubmissionWithDependencies(args: {
  state: any;
  playerId: string;
  payload: unknown;
  nowMs: number;
}, dependencies: {
  manualSolarResolvers: Readonly<ManualSolarResolverRegistry>;
}): ChargeDeclarationResolutionResult {
  const normalized = normalizeChargeDeclarationPayload(args.payload);
  const fingerprint = fingerprintChargeDeclaration(normalized);
  const genericAccepted = args.state?.gameData?.turnData?.acceptedChargeDeclarationsByPlayerId?.[args.playerId];
  const ancientAccepted = getAcceptedDeclarationForCurrentBattle(args.state, args.playerId);
  const accepted = genericAccepted?.battleTurnNumber === getChargeDeclarationBattleTurnNumber(args.state)
    ? genericAccepted
    : ancientAccepted;

  if (accepted) {
    if (
      accepted.declarationId === normalized.declarationId &&
      accepted.declarationFingerprint === fingerprint
    ) {
      return { status: 'idempotent', state: args.state, events: [], normalized };
    }
    throw new Error('A different charge declaration has already been accepted for this Battle turn');
  }

  if (getPhaseKey(args.state) !== 'battle.charge_declaration') {
    throw new Error('CHARGE_DECLARATION_SUBMIT is only allowed during battle.charge_declaration');
  }
  if (!isAncientPlayer(args.state, args.playerId)) {
    throw new Error('Only Ancient players may submit the atomic charge declaration contract');
  }
  if (!ancientAtomicDeclarationContractApplies(args.state, args.playerId)) {
    throw new Error('This Ancient player has no atomic charge declaration input');
  }

  const disposable = resolveChargeDeclarationDisposable({
    state: args.state,
    playerId: args.playerId,
    normalized,
  }, dependencies);
  const applied = applyDisposableChargeDeclarationToProduction({
    result: disposable,
    playerId: args.playerId,
    nowMs: args.nowMs,
  });
  const workingState = applied.state;
  const events = applied.events;
  workingState.gameData.ancient.acceptedDeclarationByPlayerId[args.playerId] = buildAcceptedDeclaration({
    normalized,
    playerId: args.playerId,
    battleTurnNumber: disposable.battleTurnNumber,
    initialEnergy: disposable.initialEnergy,
    initialEnergySourceIds: disposable.initialEnergySourceIds,
  });
  const turnData = workingState.gameData.turnData ?? (workingState.gameData.turnData = {});
  const acceptedByPlayerId = turnData.acceptedChargeDeclarationsByPlayerId ??
    (turnData.acceptedChargeDeclarationsByPlayerId = {});
  acceptedByPlayerId[args.playerId] = buildAcceptedChargeDeclaration({
    normalized,
    playerId: args.playerId,
    battleTurnNumber: disposable.battleTurnNumber,
  });
  events.push({
    type: 'CHARGE_DECLARATION_ACCEPTED',
    playerId: args.playerId,
    declarationId: normalized.declarationId,
    atMs: args.nowMs,
  });

  return { status: 'applied', state: workingState, events, normalized };
}
