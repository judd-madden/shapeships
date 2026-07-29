import type {
  AncientAcceptedDeclaration,
  AncientEnergyPool,
  AncientNormalizedOrdinaryChargeChoice,
  AncientNormalizedSolarCast,
  AncientNormalizedSolarGridChoice,
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
  getSnappedSolarGridSourceIds,
  isAncientPlayer,
  resolveSnapshottedSolarGridSource,
} from './chargeDeclarationEligibility.ts';
import { resolvePowerAction } from '../../engine_shared/resolve/resolvePowerAction.ts';
import { applyEffects, type EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';
import {
  createBattleLogBattleCaptureEventsFromResolution,
} from '../state/battleLogHistory.ts';
import {
  appendShipActivationCueBatch,
  getShipActivationSourcesFromAppliedEffects,
} from '../state/shipActivationCues.ts';
import {
  resolveManualSolarDeclaration,
  resolveSolarCastSequence,
  type ManualSolarResolverRegistry,
} from '../ancient/manualSolarDeclaration.ts';
import {
  buildMonoColourAutocastCasts,
  PRODUCTION_MONO_COLOUR_SOLAR_RESOLVERS,
} from '../ancient/monoColourSolarPowers.ts';
import { SIPHON_SOLAR_RESOLVER } from '../ancient/siphonSolarPower.ts';
import { VORTEX_SOLAR_RESOLVER } from '../ancient/vortexSolarPower.ts';
import { BLACK_HOLE_SOLAR_RESOLVER } from '../ancient/blackHoleSolarPower.ts';
import { SIMULACRUM_SOLAR_RESOLVER } from '../ancient/simulacrumSolarPower.ts';

const PRODUCTION_SOLAR_RESOLVERS: Readonly<ManualSolarResolverRegistry> = Object.freeze({
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
  solarGridChoices: AncientNormalizedSolarGridChoice[];
  solarCasts: AncientNormalizedSolarCast[];
  autocastEnabled: boolean;
};

export type ChargeDeclarationResolutionResult = {
  status: 'applied' | 'idempotent';
  state: any;
  events: any[];
  normalized: NormalizedChargeDeclaration;
};

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
  if (payload.contractVersion !== CHARGE_DECLARATION_CONTRACT_VERSION) {
    throw new Error(`Unsupported charge declaration contract version: ${String(payload.contractVersion)}`);
  }
  const declarationId = requireNonEmptyString(payload.declarationId, 'declarationId');
  if (!Array.isArray(payload.ordinaryChargeActions)) {
    throw new Error('ordinaryChargeActions must be an array');
  }
  if (!Array.isArray(payload.solarGridChoices)) {
    throw new Error('solarGridChoices must be an array');
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
    const sourceInstanceId = requireNonEmptyString(
      candidate.sourceInstanceId,
      `ordinaryChargeActions[${index}].sourceInstanceId`,
    );
    if (seenOrdinarySources.has(sourceInstanceId)) {
      throw new Error(`Duplicate ordinary charge source: ${sourceInstanceId}`);
    }
    seenOrdinarySources.add(sourceInstanceId);
    const targetInstanceIds = normalizeTargetInstanceIds(candidate.targetInstanceIds);
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

  const seenSolarSources = new Set<string>();
  const solarGridChoices = payload.solarGridChoices.map((candidate: any, index) => {
    if (!candidate || typeof candidate !== 'object') {
      throw new Error(`solarGridChoices[${index}] must be an object`);
    }
    const sourceInstanceId = requireNonEmptyString(
      candidate.sourceInstanceId,
      `solarGridChoices[${index}].sourceInstanceId`,
    );
    if (seenSolarSources.has(sourceInstanceId)) {
      throw new Error(`Duplicate Solar Grid source: ${sourceInstanceId}`);
    }
    seenSolarSources.add(sourceInstanceId);
    if (candidate.choiceId !== 'use' && candidate.choiceId !== 'hold') {
      throw new Error(`Invalid Solar Grid choice for ${sourceInstanceId}`);
    }
    return { sourceInstanceId, choiceId: candidate.choiceId as 'use' | 'hold' };
  }).sort((a, b) => a.sourceInstanceId.localeCompare(b.sourceInstanceId));

  return {
    contractVersion: CHARGE_DECLARATION_CONTRACT_VERSION,
    declarationId,
    ordinaryChargeActions,
    solarGridChoices,
    solarCasts: normalizeSolarCasts(payload.solarCasts),
    autocastEnabled: payload.autocastEnabled,
  };
}

export function fingerprintChargeDeclaration(normalized: NormalizedChargeDeclaration): string {
  return JSON.stringify({
    contractVersion: normalized.contractVersion,
    ordinaryChargeActions: normalized.ordinaryChargeActions,
    solarGridChoices: normalized.solarGridChoices,
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

  const requiredSolarIds = getSnappedSolarGridSourceIds(state, playerId);
  const submittedSolarIds = normalized.solarGridChoices.map((choice) => choice.sourceInstanceId);
  if (
    requiredSolarIds.length !== submittedSolarIds.length ||
    requiredSolarIds.some((sourceInstanceId, index) => submittedSolarIds[index] !== sourceInstanceId)
  ) {
    const missing = requiredSolarIds.filter((sourceInstanceId) => !submittedSolarIds.includes(sourceInstanceId));
    const extra = submittedSolarIds.filter((sourceInstanceId) => !requiredSolarIds.includes(sourceInstanceId));
    throw new Error(`Solar Grid choices must exactly match the declaration snapshot; missing=${missing.join(',')}; extra=${extra.join(',')}`);
  }

  for (const choice of normalized.solarGridChoices) {
    const source = resolveSnapshottedSolarGridSource(state, playerId, choice.sourceInstanceId);
    if (!source || (source.snapshot.chargesCurrent ?? 0) <= 0) {
      throw new Error(`Invalid snapshotted Solar Grid source: ${choice.sourceInstanceId}`);
    }
    if (choice.choiceId === 'use' && (source.current.chargesCurrent ?? 0) <= 0) {
      throw new Error(`Solar Grid has no charge to use: ${choice.sourceInstanceId}`);
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
    solarGridChoices: structuredClone(args.normalized.solarGridChoices),
    solarCasts: structuredClone(args.normalized.solarCasts),
    autocastEnabled: args.normalized.autocastEnabled,
  };
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
  const accepted = getAcceptedDeclarationForCurrentBattle(args.state, args.playerId);

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

  validateAuthoritativeSourceSets(args.state, args.playerId, normalized);

  let workingState = structuredClone(args.state);
  const events: any[] = [];
  const activationSources: ShipActivationCueSource[] = [];
  let ordinaryChargeSpent = false;

  for (const action of normalized.ordinaryChargeActions) {
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
    const effectEvents = getEffectEvents(outcome.events);
    activationSources.push(...getShipActivationSourcesFromAppliedEffects(outcome.effects, effectEvents));
    events.push(...createBattleLogBattleCaptureEventsFromResolution({
      stateBeforeResolution,
      turnNumber: getChargeDeclarationBattleTurnNumber(stateBeforeResolution),
      playerId: args.playerId,
      phaseKey: 'battle.charge_declaration',
      choiceId: action.choiceId,
      effects: outcome.effects,
      effectEvents,
    }));
    events.push({
      type: 'POWER_USED',
      playerId: args.playerId,
      phaseKey: 'battle.charge_declaration',
      actionId: action.actionId,
      sourceInstanceId: action.sourceInstanceId,
      choiceId: action.choiceId,
      targetInstanceId: action.targetInstanceId,
      targetInstanceIds: action.targetInstanceIds,
      spentCharge: outcome.spentCharge,
      atMs: args.nowMs,
    });
    ordinaryChargeSpent ||= outcome.spentCharge;
  }

  const battleTurnNumber = getChargeDeclarationBattleTurnNumber(workingState);
  const initialEnergyState = workingState.gameData.ancient.energyByPlayerId[args.playerId];
  const initialEnergy = cloneEnergyPool(initialEnergyState?.pool);
  const initialEnergySourceIds = Array.isArray(initialEnergyState?.sources)
    ? initialEnergyState.sources.map((source: any) => source.sourceId).filter((id: any) => typeof id === 'string')
    : [];
  let nextEnergy = cloneEnergyPool(initialEnergy);
  const nextSources = Array.isArray(initialEnergyState?.sources)
    ? structuredClone(initialEnergyState.sources)
    : [];
  let nextSourceOrder = nextSources.reduce(
    (maximum: number, source: any) => Math.max(maximum, Number.isFinite(source?.order) ? source.order : -1),
    -1,
  ) + 1;

  for (const choice of normalized.solarGridChoices) {
    if (choice.choiceId === 'hold') continue;
    const effect: Effect = {
      id: `solar_grid_charge:${battleTurnNumber}:${args.playerId}:${choice.sourceInstanceId}`,
      ownerPlayerId: args.playerId,
      source: { type: 'ship', instanceId: choice.sourceInstanceId, shipDefId: 'SOL' },
      timing: 'battle.charge_declaration',
      activationTag: EffectTiming.Charge,
      survivability: SurvivabilityRule.ResolvesIfDestroyed,
      target: { playerId: args.playerId, shipInstanceId: choice.sourceInstanceId },
      kind: EffectKind.SpendCharge,
      amount: 1,
    };
    const applied = applyEffects(workingState, [effect]);
    workingState = applied.state;
    const effectEvents = getEffectEvents(applied.events);
    activationSources.push(...getShipActivationSourcesFromAppliedEffects([effect], effectEvents));
    nextEnergy = {
      green: nextEnergy.green + 1,
      red: nextEnergy.red + 1,
      blue: nextEnergy.blue + 1,
    };
    nextSources.push({
      sourceId: `ancient-solar-grid-energy:${battleTurnNumber}:${args.playerId}:${choice.sourceInstanceId}`,
      sourceInstanceId: choice.sourceInstanceId,
      sourceShipDefId: 'SOL',
      battleTurnNumber,
      order: nextSourceOrder++,
      amounts: { green: 1, red: 1, blue: 1 },
    });
  }

  const manualSolar = resolveManualSolarDeclaration({
    state: workingState,
    playerId: args.playerId,
    declarationId: normalized.declarationId,
    battleTurnNumber,
    initialEnergy: nextEnergy,
    casts: normalized.solarCasts,
    resolvers: dependencies.manualSolarResolvers,
  });
  workingState = manualSolar.state;
  nextEnergy = manualSolar.remainingEnergy;

  const ledgerEntries = [...manualSolar.ledgerEntries];

  const autocastCasts = normalized.autocastEnabled
    ? buildMonoColourAutocastCasts(nextEnergy)
    : [];
  if (normalized.autocastEnabled) {
    const autocastSolar = resolveSolarCastSequence({
      state: workingState,
      playerId: args.playerId,
      declarationId: normalized.declarationId,
      battleTurnNumber,
      initialEnergy: nextEnergy,
      casts: autocastCasts,
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
  if (ordinaryChargeSpent) {
    workingState.gameData.turnData.anyChargesSpentInDeclaration = true;
  }
  workingState.gameData.ancient.acceptedDeclarationByPlayerId[args.playerId] = buildAcceptedDeclaration({
    normalized,
    playerId: args.playerId,
    battleTurnNumber,
    initialEnergy,
    initialEnergySourceIds,
  });
  workingState = appendShipActivationCueBatch(workingState, {
    phaseKey: 'battle.charge_declaration',
    sources: activationSources,
  });
  events.push({
    type: 'CHARGE_DECLARATION_ACCEPTED',
    playerId: args.playerId,
    declarationId: normalized.declarationId,
    atMs: args.nowMs,
  });

  return { status: 'applied', state: workingState, events, normalized };
}
