import type {
  AncientAcceptedDeclaration,
  AncientEnergyPool,
  AncientEnergySource,
  AncientPendingBlackHoleDestruction,
  AncientPendingSimulacrumCopy,
  AncientPlayerEnergyState,
  AncientNormalizedOrdinaryChargeChoice,
  AncientNormalizedSolarCast,
  AncientSimulacrumPresentation,
  AncientSolarLedgerEntry,
  AncientSolarLedgerState,
  AncientState,
  GameState,
  ShipInstance,
  ShipPermanentConfiguration,
} from './GameStateTypes.ts';
import {
  ANCIENT_SOLAR_POWER_IDS,
  type AncientSolarPowerId,
} from './GameStateTypes.ts';
import { getEffectiveDiceRollForPlayer } from '../../engine_shared/resolve/phaseComputedEffects.ts';
import {
  deriveMaterializedSimulacrumFleetInstanceIdsByPlayerId,
  deriveMaterializedSimulacrumLedgerEntryIdsByPlayerId,
  pruneCompletedSimulacrumCopiesAtBattleReveal,
} from '../ancient/simulacrumSolarPower.ts';
import {
  isChargeDeclarationPrivacyActive,
  projectChargeDeclarationAncientForViewer,
  projectChargeDeclarationStateForViewer,
  redactChargeDeclarationTurnDataForClient,
} from './chargeDeclarationVisibility.ts';
import {
  projectDrawingPreludeFleetsForViewer,
  redactDrawingPreludeTurnDataForClient,
} from './drawingPreludeProjection.ts';
import { debugLog } from '../../utils/serverLogger.ts';
import { applyEffects } from '../../engine_shared/effects/applyEffects.ts';
import {
  EffectKind,
  EffectTiming,
  SurvivabilityRule,
  type Effect,
} from '../../engine_shared/effects/Effect.ts';
import {
  appendShipActivationCueBatch,
  getShipActivationSourcesFromAppliedEffects,
} from './shipActivationCues.ts';

export const ANCIENT_STATE_SCHEMA_VERSION = 1 as const;
const ANCIENT_SOLAR_POWER_ID_SET = new Set<AncientSolarPowerId>(ANCIENT_SOLAR_POWER_IDS);

export type AncientCompatibilityRisk = {
  code:
    | 'malformed_canonical_record'
    | 'duplicate_stable_id'
    | 'missing_ancient_schema_version'
    | 'invalid_ancient_schema_version'
    | 'unsupported_ancient_schema_version';
  path: string;
  stableId?: string;
  actualVersion?: number;
};

export type AncientNormalizationResult<T = any> = {
  state: T;
  changed: boolean;
  compatibilityRisks: AncientCompatibilityRisk[];
};

type NormalizedEntry<T> = {
  value: T;
  stableId: string;
  order: number;
  fingerprint: string;
};

function isObject(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!isObject(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function normalizeAncientNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' &&
    Number.isFinite(value) &&
    Number.isInteger(value) &&
    value >= 0;
}

function normalizeBattleTurnNumber(value: unknown): number | null {
  if (value === null || typeof value === 'undefined') return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return normalizeAncientNumber(value);
}

export function createEmptyAncientEnergyPool(): AncientEnergyPool {
  return { green: 0, red: 0, blue: 0 };
}

function normalizeEnergyPool(value: unknown): AncientEnergyPool {
  const source = isObject(value) ? value : {};
  return {
    green: normalizeAncientNumber(source.green),
    red: normalizeAncientNumber(source.red),
    blue: normalizeAncientNumber(source.blue),
  };
}

export function createEmptyAncientPlayerEnergyState(): AncientPlayerEnergyState {
  return {
    battleTurnNumber: null,
    pool: createEmptyAncientEnergyPool(),
    sources: [],
  };
}

export function createEmptyAncientSolarLedgerState(): AncientSolarLedgerState {
  return {
    battleTurnNumber: null,
    entries: [],
  };
}

function getPlayerSeatIds(players: unknown): string[] {
  if (!Array.isArray(players)) return [];
  return [...new Set(players
    .filter((player: any) => player?.role === 'player' && isNonEmptyString(player?.id))
    .map((player: any) => player.id as string))]
    .sort((a, b) => a.localeCompare(b));
}

export function createEmptyAncientState(players: unknown): AncientState {
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const solarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};

  for (const playerId of getPlayerSeatIds(players)) {
    energyByPlayerId[playerId] = createEmptyAncientPlayerEnergyState();
    solarLedgerByPlayerId[playerId] = createEmptyAncientSolarLedgerState();
  }

  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    energyByPlayerId,
    acceptedDeclarationByPlayerId: {},
    solarLedgerByPlayerId,
    pendingSimulacrumCopies: [],
    pendingBlackHoleDestructions: [],
  };
}

function pushMalformedRisk(
  risks: AncientCompatibilityRisk[],
  path: string,
): void {
  risks.push({ code: 'malformed_canonical_record', path });
}

function normalizeUniqueEntries<T>(args: {
  raw: unknown;
  path: string;
  risks: AncientCompatibilityRisk[];
  normalize: (value: unknown, index: number) => { value: T; stableId: string; order?: number } | null;
}): T[] {
  const { raw, path, risks, normalize } = args;
  if (!Array.isArray(raw)) {
    if (typeof raw !== 'undefined') pushMalformedRisk(risks, path);
    return [];
  }

  const normalized: NormalizedEntry<T>[] = [];
  raw.forEach((candidate, index) => {
    const result = normalize(candidate, index);
    if (!result) {
      pushMalformedRisk(risks, `${path}[${index}]`);
      return;
    }
    normalized.push({
      value: result.value,
      stableId: result.stableId,
      order: result.order ?? 0,
      fingerprint: JSON.stringify(result.value),
    });
  });

  // Duplicate winner: lowest normalized order, then lexicographically smallest
  // normalized record fingerprint. This stays deterministic regardless of input order.
  normalized.sort((a, b) =>
    a.order - b.order ||
    a.stableId.localeCompare(b.stableId) ||
    a.fingerprint.localeCompare(b.fingerprint)
  );

  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of normalized) {
    if (seen.has(entry.stableId)) {
      risks.push({
        code: 'duplicate_stable_id',
        path,
        stableId: entry.stableId,
      });
      continue;
    }
    seen.add(entry.stableId);
    result.push(entry.value);
  }
  return result;
}

function normalizeEnergySource(value: unknown): AncientEnergySource | null {
  if (!isObject(value) || !isNonEmptyString(value.sourceId) || !isNonEmptyString(value.sourceShipDefId)) {
    return null;
  }
  return {
    sourceId: value.sourceId,
    ...(isNonEmptyString(value.sourceInstanceId) ? { sourceInstanceId: value.sourceInstanceId } : {}),
    sourceShipDefId: value.sourceShipDefId,
    battleTurnNumber: normalizeBattleTurnNumber(value.battleTurnNumber),
    order: normalizeAncientNumber(value.order),
    amounts: normalizeEnergyPool(value.amounts),
  };
}

function normalizePlayerEnergyState(
  value: unknown,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientPlayerEnergyState {
  const source = isObject(value) ? value : {};
  if (!isObject(value) && typeof value !== 'undefined') pushMalformedRisk(risks, path);
  const sources = normalizeUniqueEntries({
    raw: source.sources,
    path: `${path}.sources`,
    risks,
    normalize(candidate) {
      const normalized = normalizeEnergySource(candidate);
      return normalized
        ? { value: normalized, stableId: normalized.sourceId, order: normalized.order }
        : null;
    },
  });
  return {
    battleTurnNumber: normalizeBattleTurnNumber(source.battleTurnNumber),
    pool: normalizeEnergyPool(source.pool),
    sources,
  };
}

function normalizeTargetReferences(value: unknown): Array<{ playerId: string; shipInstanceId?: string }> | undefined {
  if (typeof value === 'undefined') return undefined;
  if (!Array.isArray(value)) return undefined;
  const targets = value
    .filter((target) => isObject(target) && isNonEmptyString(target.playerId))
    .map((target: any) => ({
      playerId: target.playerId,
      ...(isNonEmptyString(target.shipInstanceId) ? { shipInstanceId: target.shipInstanceId } : {}),
    }));
  return targets;
}

function normalizeSimulacrumPermanentConfiguration(
  value: unknown,
): ShipPermanentConfiguration | undefined {
  if (!isPlainObject(value)) return undefined;
  const hasSelectedNumber = Object.prototype.hasOwnProperty.call(
    value,
    'selectedNumber',
  );
  if (hasSelectedNumber) {
    const selectedNumber = value.selectedNumber;
    return typeof selectedNumber === 'number' &&
        Number.isInteger(selectedNumber) &&
        selectedNumber >= 1 &&
        selectedNumber <= 6
      ? { selectedNumber }
      : undefined;
  }
  return Object.keys(value).length === 0 ? {} : undefined;
}

function normalizeSolarLedgerEntry(value: unknown): AncientSolarLedgerEntry | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.entryId) ||
    !isNonEmptyString(value.solarPowerId) ||
    !ANCIENT_SOLAR_POWER_ID_SET.has(value.solarPowerId as AncientSolarPowerId) ||
    !['manual', 'autocast'].includes(value.sourceMode)
  ) {
    return null;
  }

  const targets = normalizeTargetReferences(value.targets);
  let simulacrum: AncientSimulacrumPresentation | undefined;
  if (
    isObject(value.simulacrum) &&
    isNonEmptyString(value.simulacrum.sourceTargetInstanceId) &&
    isNonEmptyString(value.simulacrum.copiedShipDefId)
  ) {
    const capturedStartOfBattleCharges =
      value.simulacrum.capturedStartOfBattleCharges;
    const permanentConfiguration = normalizeSimulacrumPermanentConfiguration(
      value.simulacrum.permanentConfiguration,
    );
    simulacrum = {
      sourceTargetInstanceId: value.simulacrum.sourceTargetInstanceId,
      copiedShipDefId: value.simulacrum.copiedShipDefId,
      ...(isNonNegativeInteger(capturedStartOfBattleCharges)
        ? { capturedStartOfBattleCharges }
        : {}),
      ...(permanentConfiguration ? { permanentConfiguration } : {}),
      ...(isNonEmptyString(value.simulacrum.matchupKey)
        ? { matchupKey: value.simulacrum.matchupKey }
        : {}),
    };
  }

  return {
    entryId: value.entryId,
    order: normalizeAncientNumber(value.order),
    solarPowerId: value.solarPowerId as AncientSolarPowerId,
    sourceMode: value.sourceMode,
    paidEnergy: normalizeEnergyPool(value.paidEnergy),
    ...(typeof value.lockedAmount !== 'undefined'
      ? { lockedAmount: normalizeAncientNumber(value.lockedAmount) }
      : {}),
    ...(targets ? { targets } : {}),
    ...(simulacrum ? { simulacrum } : {}),
  };
}

function normalizeSolarLedgerState(
  value: unknown,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientSolarLedgerState {
  const source = isObject(value) ? value : {};
  if (!isObject(value) && typeof value !== 'undefined') pushMalformedRisk(risks, path);
  return {
    battleTurnNumber: normalizeBattleTurnNumber(source.battleTurnNumber),
    entries: normalizeUniqueEntries({
      raw: source.entries,
      path: `${path}.entries`,
      risks,
      normalize(candidate) {
        const normalized = normalizeSolarLedgerEntry(candidate);
        return normalized
          ? { value: normalized, stableId: normalized.entryId, order: normalized.order }
          : null;
      },
    }),
  };
}

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(isNonEmptyString))].sort((a, b) => a.localeCompare(b));
}

function normalizeAcceptedOrdinaryChargeActions(value: unknown): AncientNormalizedOrdinaryChargeChoice[] {
  if (!Array.isArray(value)) return [];
  const actions: AncientNormalizedOrdinaryChargeChoice[] = [];
  for (const candidate of value) {
    if (
      !isObject(candidate) ||
      candidate.actionType !== 'power' ||
      !isNonEmptyString(candidate.actionId) ||
      !isNonEmptyString(candidate.sourceInstanceId) ||
      !isNonEmptyString(candidate.choiceId)
    ) {
      continue;
    }
    actions.push({
      actionType: 'power',
      actionId: candidate.actionId,
      sourceInstanceId: candidate.sourceInstanceId,
      choiceId: candidate.choiceId,
      ...(isNonEmptyString(candidate.targetInstanceId)
        ? { targetInstanceId: candidate.targetInstanceId }
        : {}),
      ...(Array.isArray(candidate.targetInstanceIds)
        ? { targetInstanceIds: candidate.targetInstanceIds.filter(isNonEmptyString).sort((a, b) => a.localeCompare(b)) }
        : {}),
    });
  }
  return actions;
}

function normalizeStoredSolarCast(value: unknown): AncientNormalizedSolarCast | null {
  if (!isObject(value)) return null;
  const allowedFields = new Set(['solarPowerId', 'targetInstanceId', 'targetInstanceIds', 'lockedAmount']);
  if (Object.keys(value).some((field) => !allowedFields.has(field))) return null;
  if (
    !isNonEmptyString(value.solarPowerId) ||
    !ANCIENT_SOLAR_POWER_ID_SET.has(value.solarPowerId as AncientSolarPowerId) ||
    (typeof value.targetInstanceId !== 'undefined' && typeof value.targetInstanceIds !== 'undefined')
  ) {
    return null;
  }
  if (typeof value.targetInstanceId !== 'undefined' && !isNonEmptyString(value.targetInstanceId)) {
    return null;
  }
  let targetInstanceIds: string[] | undefined;
  if (typeof value.targetInstanceIds !== 'undefined') {
    if (!Array.isArray(value.targetInstanceIds) || !value.targetInstanceIds.every(isNonEmptyString)) {
      return null;
    }
    if (new Set(value.targetInstanceIds).size !== value.targetInstanceIds.length) return null;
    targetInstanceIds = [...value.targetInstanceIds].sort((a, b) => a.localeCompare(b));
  }
  if (
    typeof value.lockedAmount !== 'undefined' &&
    (typeof value.lockedAmount !== 'number' ||
      !Number.isFinite(value.lockedAmount) ||
      !Number.isInteger(value.lockedAmount) ||
      value.lockedAmount < 0)
  ) {
    return null;
  }
  return {
    solarPowerId: value.solarPowerId as AncientSolarPowerId,
    ...(isNonEmptyString(value.targetInstanceId) ? { targetInstanceId: value.targetInstanceId } : {}),
    ...(targetInstanceIds ? { targetInstanceIds } : {}),
    ...(typeof value.lockedAmount === 'number' ? { lockedAmount: value.lockedAmount } : {}),
  };
}

function normalizeAcceptedSolarCasts(
  value: unknown,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientNormalizedSolarCast[] {
  if (typeof value === 'undefined') return [];
  if (!Array.isArray(value)) {
    pushMalformedRisk(risks, path);
    return [];
  }
  const casts: AncientNormalizedSolarCast[] = [];
  value.forEach((candidate, index) => {
    const normalized = normalizeStoredSolarCast(candidate);
    if (!normalized) {
      pushMalformedRisk(risks, `${path}[${index}]`);
      return;
    }
    casts.push(normalized);
  });
  return casts;
}

function fingerprintAcceptedDeclarationContent(value: {
  ordinaryChargeActions: AncientNormalizedOrdinaryChargeChoice[];
  solarCasts: AncientNormalizedSolarCast[];
  autocastEnabled: boolean;
}): string {
  return JSON.stringify({
    contractVersion: ANCIENT_STATE_SCHEMA_VERSION,
    ordinaryChargeActions: value.ordinaryChargeActions,
    solarCasts: value.solarCasts,
    autocastEnabled: value.autocastEnabled,
  });
}

function normalizeAcceptedDeclaration(
  value: unknown,
  playerId: string,
  path: string,
  risks: AncientCompatibilityRisk[],
): AncientAcceptedDeclaration | null {
  if (
    !isObject(value) ||
    value.schemaVersion !== ANCIENT_STATE_SCHEMA_VERSION ||
    !isNonEmptyString(value.declarationId) ||
    value.playerId !== playerId ||
    !isObject(value.context) ||
    value.context.contextVersion !== ANCIENT_STATE_SCHEMA_VERSION ||
    !isObject(value.context.initialEnergy) ||
    !Array.isArray(value.context.energySourceIds)
  ) {
    return null;
  }
  const context = value.context;
  const ordinaryChargeActions = normalizeAcceptedOrdinaryChargeActions(value.ordinaryChargeActions);
  const solarCasts = normalizeAcceptedSolarCasts(value.solarCasts, `${path}.solarCasts`, risks);
  let autocastEnabled = false;
  if (typeof value.autocastEnabled === 'boolean') {
    autocastEnabled = value.autocastEnabled;
  } else if (typeof value.autocastEnabled !== 'undefined') {
    pushMalformedRisk(risks, `${path}.autocastEnabled`);
  }
  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    contractVersion: ANCIENT_STATE_SCHEMA_VERSION,
    declarationId: value.declarationId,
    declarationFingerprint: fingerprintAcceptedDeclarationContent({
      ordinaryChargeActions,
      solarCasts,
      autocastEnabled,
    }),
    playerId,
    context: {
      contextVersion: ANCIENT_STATE_SCHEMA_VERSION,
      battleTurnNumber: normalizeBattleTurnNumber(context.battleTurnNumber),
      initialEnergy: normalizeEnergyPool(context.initialEnergy),
      energySourceIds: normalizeStringList(context.energySourceIds),
    },
    ordinaryChargeActions,
    solarCasts,
    autocastEnabled,
  };
}

function normalizePendingSimulacrumCopy(
  value: unknown,
  fallbackQueueOrder: number,
): AncientPendingSimulacrumCopy | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.pendingCopyId) ||
    !isNonEmptyString(value.declarationId) ||
    !isNonEmptyString(value.ownerPlayerId) ||
    !isNonEmptyString(value.sourceTargetInstanceId) ||
    !isNonEmptyString(value.copiedShipDefId) ||
    value.sourceMode !== 'primary' ||
    !['queued', 'materialized'].includes(value.status)
  ) {
    return null;
  }
  const configuration = isObject(value.permanentConfiguration) ? value.permanentConfiguration : {};
  const normalizeOutcome = (raw: unknown) => {
    const rawOutcome = isObject(raw) ? raw : null;
    const rawProducedShips = rawOutcome?.producedShips;
    return rawOutcome &&
        isNonNegativeInteger(rawOutcome.joiningLinesGranted) &&
        Array.isArray(rawProducedShips) &&
        rawProducedShips.every((produced) =>
          isObject(produced) &&
          isNonEmptyString(produced.instanceId) &&
          isNonEmptyString(produced.shipDefId) &&
          isNonEmptyString(produced.sourceShipDefId)
        )
      ? {
        joiningLinesGranted: rawOutcome.joiningLinesGranted,
        producedShips: rawProducedShips.map((produced) => ({
          instanceId: produced.instanceId as string,
          shipDefId: produced.shipDefId as string,
          sourceShipDefId: produced.sourceShipDefId as string,
        })),
      }
      : null;
  };
  const materializationOutcome = normalizeOutcome(value.materializationOutcome);
  const repeatedMaterializationOutcome = normalizeOutcome(value.repeatedMaterializationOutcome);
  const hasRepeatSlot = isNonEmptyString(value.repeatedMaterializedInstanceId) ||
    repeatedMaterializationOutcome !== null;
  const materializationMultiplicity = value.materializationMultiplicity === 2 || hasRepeatSlot
    ? 2
    : value.materializationMultiplicity === 1 || value.status === 'materialized'
    ? 1
    : undefined;
  return {
    pendingCopyId: value.pendingCopyId,
    declarationId: value.declarationId,
    ownerPlayerId: value.ownerPlayerId,
    sourceTargetInstanceId: value.sourceTargetInstanceId,
    copiedShipDefId: value.copiedShipDefId,
    queuedTurnNumber: normalizeAncientNumber(value.queuedTurnNumber),
    materializationTurnNumber: normalizeAncientNumber(value.materializationTurnNumber),
    queueOrder: isNonNegativeInteger(value.queueOrder)
      ? value.queueOrder
      : fallbackQueueOrder,
    capturedStartOfBattleCharges: normalizeAncientNumber(value.capturedStartOfBattleCharges),
    permanentConfiguration: {
      ...(typeof configuration.selectedNumber !== 'undefined'
        ? { selectedNumber: normalizeAncientNumber(configuration.selectedNumber) }
        : {}),
    },
    sourceMode: value.sourceMode,
    status: value.status,
    ...(materializationMultiplicity ? { materializationMultiplicity } : {}),
    ...(isNonEmptyString(value.materializedInstanceId)
      ? { materializedInstanceId: value.materializedInstanceId }
      : {}),
    ...(materializationOutcome ? { materializationOutcome } : {}),
    ...(isNonEmptyString(value.repeatedMaterializedInstanceId)
      ? { repeatedMaterializedInstanceId: value.repeatedMaterializedInstanceId }
      : {}),
    ...(repeatedMaterializationOutcome ? { repeatedMaterializationOutcome } : {}),
  };
}

function normalizePendingBlackHoleDestruction(value: unknown): AncientPendingBlackHoleDestruction | null {
  if (
    !isObject(value) ||
    !isNonEmptyString(value.pendingDestructionId) ||
    !isNonEmptyString(value.declarationId) ||
    !isNonEmptyString(value.ownerPlayerId) ||
    !isNonEmptyString(value.targetPlayerId) ||
    !['committed', 'resolved'].includes(value.status)
  ) {
    return null;
  }
  return {
    pendingDestructionId: value.pendingDestructionId,
    declarationId: value.declarationId,
    ownerPlayerId: value.ownerPlayerId,
    targetPlayerId: value.targetPlayerId,
    targetInstanceIds: normalizeStringList(value.targetInstanceIds),
    battleTurnNumber: normalizeAncientNumber(value.battleTurnNumber),
    lockedDamage: normalizeAncientNumber(value.lockedDamage),
    status: value.status,
  };
}

function normalizeRecordMap<T>(args: {
  raw: unknown;
  requiredPlayerIds?: string[];
  path: string;
  risks: AncientCompatibilityRisk[];
  createEmpty?: () => T;
  normalize: (value: unknown, playerId: string, path: string) => T | null;
}): Record<string, T> {
  const source = isObject(args.raw) ? args.raw : {};
  if (!isObject(args.raw) && typeof args.raw !== 'undefined') pushMalformedRisk(args.risks, args.path);
  const keys = new Set<string>([
    ...Object.keys(source).filter(isNonEmptyString),
    ...(args.requiredPlayerIds ?? []),
  ]);
  const result: Record<string, T> = {};
  for (const playerId of [...keys].sort((a, b) => a.localeCompare(b))) {
    const entryPath = `${args.path}.${playerId}`;
    const normalized = args.normalize(source[playerId], playerId, entryPath);
    if (normalized) {
      result[playerId] = normalized;
    } else if (args.createEmpty && (args.requiredPlayerIds ?? []).includes(playerId)) {
      result[playerId] = args.createEmpty();
    } else if (typeof source[playerId] !== 'undefined') {
      pushMalformedRisk(args.risks, entryPath);
    }
  }
  return result;
}

function sortRisks(risks: AncientCompatibilityRisk[]): AncientCompatibilityRisk[] {
  return risks.sort((a, b) =>
    a.path.localeCompare(b.path) ||
    a.code.localeCompare(b.code) ||
    (a.stableId ?? '').localeCompare(b.stableId ?? '') ||
    (a.actualVersion ?? -1) - (b.actualVersion ?? -1)
  );
}

export function normalizeAncientGameState<T = any>(state: T): AncientNormalizationResult<T> {
  if (!isObject(state)) {
    return { state, changed: false, compatibilityRisks: [] };
  }

  const compatibilityRisks: AncientCompatibilityRisk[] = [];
  const players = Array.isArray(state.players)
    ? state.players.map((player: any) => {
        if (!isObject(player)) return player;
        const { energy: _obsoleteEnergy, ...normalizedPlayer } = player;
        return normalizedPlayer;
      })
    : state.players;
  const playerSeatIds = getPlayerSeatIds(players);
  const rawGameData = isObject(state.gameData) ? state.gameData : {};
  const hasAncientFamily = Object.hasOwn(rawGameData, 'ancient');
  const rawAncientValue = rawGameData.ancient;
  const rawAncient = isObject(rawAncientValue) ? rawAncientValue : {};
  if (hasAncientFamily && !isObject(rawAncientValue)) {
    pushMalformedRisk(compatibilityRisks, 'gameData.ancient');
  } else if (isObject(rawAncientValue)) {
    const schemaVersion = rawAncientValue.schemaVersion;
    if (!Object.hasOwn(rawAncientValue, 'schemaVersion') || typeof schemaVersion === 'undefined') {
      compatibilityRisks.push({
        code: 'missing_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
      });
    } else if (schemaVersion === ANCIENT_STATE_SCHEMA_VERSION) {
      // Current canonical version.
    } else if (
      typeof schemaVersion === 'number' &&
      Number.isInteger(schemaVersion) &&
      schemaVersion > ANCIENT_STATE_SCHEMA_VERSION
    ) {
      compatibilityRisks.push({
        code: 'unsupported_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
        actualVersion: schemaVersion,
      });
    } else {
      compatibilityRisks.push({
        code: 'invalid_ancient_schema_version',
        path: 'gameData.ancient.schemaVersion',
      });
    }
  }

  const energyByPlayerId = normalizeRecordMap({
    raw: rawAncient.energyByPlayerId,
    requiredPlayerIds: playerSeatIds,
    path: 'gameData.ancient.energyByPlayerId',
    risks: compatibilityRisks,
    createEmpty: createEmptyAncientPlayerEnergyState,
    normalize: (value, _playerId, path) => normalizePlayerEnergyState(value, path, compatibilityRisks),
  });
  const solarLedgerByPlayerId = normalizeRecordMap({
    raw: rawAncient.solarLedgerByPlayerId,
    requiredPlayerIds: playerSeatIds,
    path: 'gameData.ancient.solarLedgerByPlayerId',
    risks: compatibilityRisks,
    createEmpty: createEmptyAncientSolarLedgerState,
    normalize: (value, _playerId, path) => normalizeSolarLedgerState(value, path, compatibilityRisks),
  });
  const acceptedDeclarationByPlayerId = normalizeRecordMap({
    raw: rawAncient.acceptedDeclarationByPlayerId,
    path: 'gameData.ancient.acceptedDeclarationByPlayerId',
    risks: compatibilityRisks,
    normalize: (value, playerId, path) =>
      normalizeAcceptedDeclaration(value, playerId, path, compatibilityRisks),
  });
  const pendingSimulacrumCopies = normalizeUniqueEntries({
    raw: rawAncient.pendingSimulacrumCopies,
    path: 'gameData.ancient.pendingSimulacrumCopies',
    risks: compatibilityRisks,
    normalize(candidate, index) {
      const normalized = normalizePendingSimulacrumCopy(candidate, index);
      return normalized
        ? {
            value: normalized,
            stableId: normalized.pendingCopyId,
            order: normalized.queueOrder,
          }
        : null;
    },
  });
  const pendingBlackHoleDestructions = normalizeUniqueEntries({
    raw: rawAncient.pendingBlackHoleDestructions,
    path: 'gameData.ancient.pendingBlackHoleDestructions',
    risks: compatibilityRisks,
    normalize(candidate) {
      const normalized = normalizePendingBlackHoleDestruction(candidate);
      return normalized ? { value: normalized, stableId: normalized.pendingDestructionId } : null;
    },
  });

  const rawTurnData = isObject(rawGameData.turnData) ? rawGameData.turnData : rawGameData.turnData;
  let turnData = rawTurnData;
  if (isObject(rawTurnData) && Object.hasOwn(rawTurnData, 'pendingSOLARPowerDeclarations')) {
    const { pendingSOLARPowerDeclarations: _obsoleteSolarDeclarations, ...cleanTurnData } = rawTurnData;
    turnData = cleanTurnData;
  }

  const normalizedState = {
    ...state,
    ...(Array.isArray(players) ? { players } : {}),
    gameData: {
      ...rawGameData,
      ...(typeof turnData !== 'undefined' ? { turnData } : {}),
      ancient: {
        schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
        energyByPlayerId,
        acceptedDeclarationByPlayerId,
        solarLedgerByPlayerId,
        pendingSimulacrumCopies,
        pendingBlackHoleDestructions,
      },
    },
  } as T;

  return {
    state: normalizedState,
    changed: JSON.stringify(state) !== JSON.stringify(normalizedState),
    compatibilityRisks: sortRisks(compatibilityRisks),
  };
}

function getPlayerSpecies(player: any): unknown {
  return player?.faction ?? player?.species;
}

const ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID = {
  PLU: {
    rank: 0,
    amounts: { green: 1, red: 0, blue: 0 },
  },
  MER: {
    rank: 1,
    amounts: { green: 0, red: 1, blue: 0 },
  },
  NEP: {
    rank: 2,
    amounts: { green: 0, red: 0, blue: 1 },
  },
} as const;

type AncientCoreShipDefId = keyof typeof ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID;

function isAncientCoreShipDefId(value: unknown): value is AncientCoreShipDefId {
  return typeof value === 'string' && Object.hasOwn(ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID, value);
}

function getValidSelectedNumber(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 6
    ? value as number
    : null;
}

export function applyAncientBattleRevealPreparation<T = any>(state: T): T {
  let canonicalState = state as any;
  const battleTurnNumber = normalizeAncientNumber(
    canonicalState.gameData.turnNumber ??
      canonicalState.gameData.turnData?.turnNumber ??
      canonicalState.turnNumber ??
      0,
  );
  if (
    canonicalState.gameData.turnData?.ancientBattleRevealPreparedTurnNumber ===
      battleTurnNumber
  ) {
    return state;
  }
  pruneCompletedSimulacrumCopiesAtBattleReveal(
    canonicalState as GameState,
    battleTurnNumber,
  );

  const solarGridCandidates = getPlayerSeatIds(canonicalState.players)
    .flatMap((playerId) => {
      const fleet = Array.isArray(canonicalState.gameData.ships?.[playerId])
        ? canonicalState.gameData.ships[playerId]
        : [];
      return fleet
        .filter((ship: any) =>
          ship?.shipDefId === 'SOL' &&
          isNonEmptyString(ship?.instanceId) &&
          normalizeAncientNumber(ship?.chargesCurrent) > 0
        )
        .map((ship: any) => ({ playerId, ship }));
    })
    .sort((a, b) =>
      a.ship.instanceId.localeCompare(b.ship.instanceId) ||
      a.playerId.localeCompare(b.playerId)
    );
  const solarChargeEffects: Effect[] = solarGridCandidates.map(({ playerId, ship }) => ({
    id: `solar_grid_reveal_charge:${battleTurnNumber}:${playerId}:${ship.instanceId}`,
    ownerPlayerId: playerId,
    source: { type: 'ship', instanceId: ship.instanceId, shipDefId: 'SOL' },
    timing: 'battle.reveal',
    activationTag: EffectTiming.Automatic,
    survivability: SurvivabilityRule.DiesWithSource,
    target: { playerId, shipInstanceId: ship.instanceId },
    kind: EffectKind.SpendCharge,
    amount: 1,
  }));
  const appliedSolarCharges = solarChargeEffects.length > 0
    ? applyEffects(canonicalState as GameState, solarChargeEffects)
    : { state: canonicalState as GameState, events: [] };
  canonicalState = appliedSolarCharges.state;
  const appliedSolarEffectIds = new Set(
    appliedSolarCharges.events.map((event) => event.effectId),
  );
  const spentSolarGridIdsByPlayerId = new Map<string, Set<string>>();
  for (const { playerId, ship } of solarGridCandidates) {
    const effectId = `solar_grid_reveal_charge:${battleTurnNumber}:${playerId}:${ship.instanceId}`;
    if (!appliedSolarEffectIds.has(effectId)) continue;
    const playerSources = spentSolarGridIdsByPlayerId.get(playerId) ?? new Set<string>();
    playerSources.add(ship.instanceId);
    spentSolarGridIdsByPlayerId.set(playerId, playerSources);
  }
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const solarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};
  const quantumMysticRevealByInstanceId: Record<string, {
    battleTurnNumber: number;
    controllerPlayerId: string;
  }> = {};

  for (const playerId of getPlayerSeatIds(canonicalState.players)) {
    solarLedgerByPlayerId[playerId] = {
      battleTurnNumber,
      entries: [],
    };
    const player = canonicalState.players.find((candidate: any) => candidate?.id === playerId);
    const sources: AncientEnergySource[] = [];
    const fleet = Array.isArray(canonicalState.gameData.ships?.[playerId])
      ? canonicalState.gameData.ships[playerId]
      : [];
    const isAncientController = getPlayerSpecies(player) === 'ancient';

    if (isAncientController) {
      const coreShips = fleet
        .filter((ship: any) =>
          isNonEmptyString(ship?.instanceId) && isAncientCoreShipDefId(ship?.shipDefId)
        )
        .sort((a: any, b: any) => {
          const rankDifference = ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[a.shipDefId as AncientCoreShipDefId].rank -
            ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[b.shipDefId as AncientCoreShipDefId].rank;
          return rankDifference || a.instanceId.localeCompare(b.instanceId);
        });

      for (const [order, ship] of coreShips.entries()) {
        const shipDefId = ship.shipDefId as AncientCoreShipDefId;
        sources.push({
          sourceId:
            `ancient-core-energy:${battleTurnNumber}:${playerId}:${shipDefId}:${ship.instanceId}`,
          sourceInstanceId: ship.instanceId,
          sourceShipDefId: shipDefId,
          battleTurnNumber,
          order,
          amounts: { ...ANCIENT_CORE_ENERGY_BY_SHIP_DEF_ID[shipDefId].amounts },
        });
      }
    }

    const effectiveDiceRoll = getEffectiveDiceRollForPlayer(canonicalState, playerId);
    const matchingQuantumMystics = fleet
      .filter((ship: any) => {
        if (ship?.shipDefId !== 'QUA' || !isNonEmptyString(ship?.instanceId)) return false;
        const selectedNumber = getValidSelectedNumber(
          ship?.permanentConfiguration?.selectedNumber,
        );
        return selectedNumber !== null && selectedNumber === effectiveDiceRoll;
      })
      .sort((a: any, b: any) => a.instanceId.localeCompare(b.instanceId));

    for (const ship of matchingQuantumMystics) {
      quantumMysticRevealByInstanceId[ship.instanceId] = {
        battleTurnNumber,
        controllerPlayerId: playerId,
      };

      if (!isAncientController) continue;
      sources.push({
        sourceId: `ancient-quantum-mystic-energy:${battleTurnNumber}:${playerId}:${ship.instanceId}`,
        sourceInstanceId: ship.instanceId,
        sourceShipDefId: 'QUA',
        battleTurnNumber,
        order: sources.length,
        amounts: { green: 0, red: 0, blue: 2 },
      });
    }

    if (isAncientController) {
      const spentSolarGridIds = spentSolarGridIdsByPlayerId.get(playerId) ?? new Set<string>();
      for (const sourceInstanceId of [...spentSolarGridIds].sort((a, b) => a.localeCompare(b))) {
        sources.push({
          sourceId: `ancient-solar-grid-energy:${battleTurnNumber}:${playerId}:${sourceInstanceId}`,
          sourceInstanceId,
          sourceShipDefId: 'SOL',
          battleTurnNumber,
          order: sources.length,
          amounts: { green: 1, red: 1, blue: 1 },
        });
      }
    }

    const pool = sources.reduce<AncientEnergyPool>(
      (total, source) => ({
        green: total.green + source.amounts.green,
        red: total.red + source.amounts.red,
        blue: total.blue + source.amounts.blue,
      }),
      createEmptyAncientEnergyPool(),
    );

    energyByPlayerId[playerId] = {
      battleTurnNumber,
      pool,
      sources,
    };
  }

  canonicalState.gameData.ancient.energyByPlayerId = energyByPlayerId;
  canonicalState.gameData.ancient.solarLedgerByPlayerId = solarLedgerByPlayerId;
  canonicalState.gameData.powerMemory = {
    ...(canonicalState.gameData.powerMemory ?? {}),
    quantumMysticRevealByInstanceId,
  };
  canonicalState.gameData.turnData.ancientBattleRevealPreparedTurnNumber = battleTurnNumber;
  canonicalState = appendShipActivationCueBatch(canonicalState as GameState, {
    key: `ship-activation:${battleTurnNumber}:battle.reveal:solar-grid-energy`,
    phaseKey: 'battle.reveal',
    sources: getShipActivationSourcesFromAppliedEffects(
      solarChargeEffects,
      appliedSolarCharges.events,
    ),
  });
  return canonicalState as T;
}

export function getAuthoritativeAncientEnergyTotal(state: any, playerId: string): number {
  const player = Array.isArray(state?.players)
    ? state.players.find((candidate: any) => candidate?.id === playerId)
    : undefined;
  if (player?.role !== 'player' || getPlayerSpecies(player) !== 'ancient') return 0;
  const pool = state?.gameData?.ancient?.energyByPlayerId?.[playerId]?.pool;
  return normalizeAncientNumber(pool?.green) +
    normalizeAncientNumber(pool?.red) +
    normalizeAncientNumber(pool?.blue);
}

export function projectPublicAncientState(
  normalizedState: any,
  requestingParticipantId?: string,
): {
  schemaVersion: 1;
  energyByPlayerId: Record<string, AncientPlayerEnergyState>;
  solarLedgerByPlayerId: Record<string, AncientSolarLedgerState>;
  materializedSimulacrumFleetInstanceIdsByPlayerId: Record<string, string[]>;
  materializedSimulacrumLedgerEntryIdsByPlayerId: Record<string, string[]>;
} {
  const ancientProjection = projectChargeDeclarationAncientForViewer(
    normalizedState,
    requestingParticipantId,
  );
  const energyByPlayerId: Record<string, AncientPlayerEnergyState> = {};
  const solarLedgerByPlayerId: Record<string, AncientSolarLedgerState> = {};
  for (const playerId of getPlayerSeatIds(normalizedState?.players)) {
    energyByPlayerId[playerId] = structuredClone(
      ancientProjection.energyByPlayerId[playerId] ?? createEmptyAncientPlayerEnergyState(),
    );
    solarLedgerByPlayerId[playerId] = structuredClone(
      ancientProjection.solarLedgerByPlayerId[playerId] ?? createEmptyAncientSolarLedgerState(),
    );
  }
  return {
    schemaVersion: ANCIENT_STATE_SCHEMA_VERSION,
    energyByPlayerId,
    solarLedgerByPlayerId,
    materializedSimulacrumFleetInstanceIdsByPlayerId:
      deriveMaterializedSimulacrumFleetInstanceIdsByPlayerId(normalizedState),
    materializedSimulacrumLedgerEntryIdsByPlayerId:
      deriveMaterializedSimulacrumLedgerEntryIdsByPlayerId(normalizedState),
  };
}

function isDrawingPhase(state: Readonly<any> | undefined): boolean {
  const gameData = state?.gameData;
  const turnData = gameData?.turnData;
  const majorPhase =
    gameData?.currentPhase ??
    turnData?.currentMajorPhase ??
    state?.currentPhase;
  const subPhase =
    gameData?.currentSubPhase ??
    turnData?.currentSubPhase ??
    state?.currentSubPhase;
  return majorPhase === 'build' && subPhase === 'drawing';
}

function getDrawingPublicSavedResources(
  state: Readonly<any> | undefined,
  playerId: string,
): { savedLines?: number; savedJoiningLines?: number } | null {
  if (!isDrawingPhase(state)) return null;
  const snapshot =
    state?.gameData?.turnData
      ?.buildDrawingPublicSavedResourcesByPlayerId?.[playerId];
  return isObject(snapshot) ? snapshot : null;
}

function sanitizePlayers(
  players: unknown,
  state?: Readonly<any>,
  requestingParticipantId?: string,
  publicOnly = false,
): unknown {
  if (!Array.isArray(players)) return players;
  const requester = Array.isArray(state?.players)
    ? state.players.find((player: any) => player?.id === requestingParticipantId)
    : null;
  const requesterMaySeeOwnResources =
    !publicOnly && requester?.role === 'player';
  return players.map((player) => {
    if (!isObject(player)) return player;
    const { energy: _obsoleteEnergy, ...safePlayer } = player;
    const playerId = typeof safePlayer.id === 'string' ? safePlayer.id : null;
    const publicResources = playerId
      ? getDrawingPublicSavedResources(state, playerId)
      : null;
    if (
      !publicResources ||
      (requesterMaySeeOwnResources && playerId === requestingParticipantId)
    ) {
      return safePlayer;
    }
    return {
      ...safePlayer,
      ...(typeof publicResources.savedLines === 'number'
        ? { lines: publicResources.savedLines }
        : {}),
      ...(typeof publicResources.savedJoiningLines === 'number'
        ? { joiningLines: publicResources.savedJoiningLines }
        : {}),
    };
  });
}

export function projectPublicPlayersForClient(
  state: Readonly<any>,
  requestingParticipantId?: string,
): unknown {
  const projection = projectChargeDeclarationStateForViewer(
    state,
    requestingParticipantId,
  );
  return sanitizePlayers(
    projection.state?.players,
    projection.state,
    undefined,
    true,
  );
}

export function projectPublicShipsForClient(
  state: Readonly<any>,
  requestingParticipantId?: string,
): Record<string, ShipInstance[]> {
  const projection = projectChargeDeclarationStateForViewer(
    state,
    requestingParticipantId,
  );
  const shipsByPlayerId = projection.state?.gameData?.ships;
  if (!isObject(shipsByPlayerId)) return {};
  return projectDrawingPreludeFleetsForViewer(
    projection.state,
    shipsByPlayerId,
    requestingParticipantId,
  );
}

export function sanitizeAncientStateForClient<T = any>(
  state: T,
  requestingParticipantId?: string,
): T {
  if (!isObject(state)) return state;
  const declarationProjection = projectChargeDeclarationStateForViewer(
    state,
    requestingParticipantId,
  );
  if (
    declarationProjection.active &&
    (!declarationProjection.structuralProjectionAvailable ||
      !declarationProjection.acknowledgementsAvailable)
  ) {
    debugLog('[ChargeDeclarationVisibility] Redacted response after projection invariant', {
      requestingParticipantId: requestingParticipantId ?? null,
      reason: declarationProjection.failureReason ?? 'unknown',
    });
  }
  const projectedState = declarationProjection.state as any;
  const responseState = isObject(projectedState.battleLogScratch)
    ? (() => {
        const {
          archiveCheckpoint: _privateArchiveCheckpoint,
          ...safeBattleLogScratch
        } = projectedState.battleLogScratch;
        return {
          ...projectedState,
          battleLogScratch: safeBattleLogScratch,
        };
      })()
    : projectedState;
  const gameData = isObject(responseState.gameData) ? responseState.gameData : null;
  if (!gameData) {
    return {
      ...responseState,
      ...(Array.isArray(responseState.players)
        ? { players: sanitizePlayers(responseState.players) }
        : {}),
    } as T;
  }
  const { ancient: _internalAncient, ...safeGameData } = gameData;
  if (isObject(safeGameData.ships)) {
    safeGameData.ships = projectPublicShipsForClient(
      projectedState,
      requestingParticipantId,
    );
  }
  const turnData = isObject(safeGameData.turnData) ? safeGameData.turnData : null;
  if (turnData) {
    const {
      pendingSOLARPowerDeclarations: _obsoleteSolarDeclarations,
      thirdSpiralFirstStrikeEligibilityByPlayerId: _thirdSpiralFirstStrikeEligibility,
      ancientBattleRevealPreparedTurnNumber: _ancientBattleRevealPreparedTurnNumber,
      ...safeTurnData
    } = turnData;
    const drawingSafeTurnData = redactDrawingPreludeTurnDataForClient(
      safeTurnData,
      projectedState,
      requestingParticipantId,
    ) ?? {};
    safeGameData.turnData = redactChargeDeclarationTurnDataForClient(
      drawingSafeTurnData,
      isChargeDeclarationPrivacyActive(projectedState),
    ) ?? {};
  }
  if (Array.isArray(safeGameData.players)) {
    safeGameData.players = sanitizePlayers(
      safeGameData.players,
      projectedState,
      requestingParticipantId,
    );
  }
  return {
    ...responseState,
    ...(Array.isArray(responseState.players)
      ? {
          players: sanitizePlayers(
            responseState.players,
            responseState,
            requestingParticipantId,
          ),
        }
      : {}),
    gameData: safeGameData,
  } as T;
}
