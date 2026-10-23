import type { Effect } from '../../engine_shared/effects/Effect.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import type { EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import { debugLog } from '../../utils/serverLogger.ts';
import type {
  GameState,
  ResolvedActivationOutcome,
  ShipActivationCueBatch,
  ShipActivationCueSource,
} from './GameStateTypes.ts';

const MAX_SHIP_ACTIVATION_CUE_BATCHES = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function normalizeOutcome(value: unknown): ResolvedActivationOutcome | null {
  if (!isRecord(value) || !isId(value.playerId) || !isRecord(value.source)) return null;
  const raw = value.source;
  let source: ResolvedActivationOutcome['source'];
  if (
    raw.type === 'ship' && (value.kind === 'destroy' || value.kind === 'steal') &&
    isId(raw.instanceId) && isId(raw.shipDefId) && isId(raw.effectId)
  ) {
    source = { type: 'ship', instanceId: raw.instanceId, shipDefId: raw.shipDefId, effectId: raw.effectId };
  } else if (
    raw.type === 'solar' && raw.solarPowerId === 'SBLA' && value.kind === 'destroy' &&
    isId(raw.ledgerEntryId) && isId(raw.effectId)
  ) {
    source = { type: 'solar', solarPowerId: 'SBLA', ledgerEntryId: raw.ledgerEntryId, effectId: raw.effectId };
  } else if (
    raw.type === 'solar' && raw.solarPowerId === 'SSIM' && value.kind === 'copy' &&
    isId(raw.ledgerEntryId) && isId(raw.pendingCopyId)
  ) {
    const trigger = raw.trigger;
    if (trigger !== undefined && (
      !isRecord(trigger) || trigger.kind !== 'cube_destruction' ||
      !isId(trigger.sourceShipInstanceId) || !isId(trigger.sourceEffectId)
    )) return null;
    source = {
      type: 'solar', solarPowerId: 'SSIM', ledgerEntryId: raw.ledgerEntryId,
      pendingCopyId: raw.pendingCopyId,
      ...(isRecord(trigger) ? { trigger: {
        kind: 'cube_destruction' as const,
        sourceShipInstanceId: trigger.sourceShipInstanceId as string,
        sourceEffectId: trigger.sourceEffectId as string,
      } } : {}),
    };
  } else return null;

  if (!Array.isArray(value.targets) || value.targets.length === 0) return null;
  const targets: ResolvedActivationOutcome['targets'] = [];
  for (const target of value.targets) {
    if (!isRecord(target) || !isId(target.playerId) || !isId(target.shipInstanceId)) return null;
    if (value.kind === 'steal' && !isId(target.destinationPlayerId)) return null;
    targets.push({
      playerId: target.playerId, shipInstanceId: target.shipInstanceId,
      ...(value.kind === 'steal' ? { destinationPlayerId: target.destinationPlayerId as string } : {}),
    });
  }
  return { playerId: value.playerId, kind: value.kind as ResolvedActivationOutcome['kind'], source, targets };
}

function normalizeOutcomes(value: unknown): ResolvedActivationOutcome[] {
  if (!Array.isArray(value)) return [];
  const outcomes: ResolvedActivationOutcome[] = [];
  const seen = new Set<string>();
  for (const raw of value) {
    const outcome = normalizeOutcome(raw);
    if (!outcome) continue;
    const source = outcome.source;
    const identity = source.type === 'solar' && source.solarPowerId === 'SSIM'
      ? source.pendingCopyId : source.effectId;
    const key = JSON.stringify([outcome.playerId, outcome.kind, source.type, identity]);
    if (seen.has(key)) continue;
    seen.add(key);
    outcomes.push(outcome);
  }
  return outcomes;
}

/** Read existing successful results; never apply rules or publish from previews. */
export function getResolvedActivationOutcomes(args: {
  stateBeforeResolution: GameState;
  stateAfterResolution: GameState;
  effects: readonly Effect[];
  effectEvents: readonly EffectEvent[];
}): ResolvedActivationOutcome[] {
  const beforeAncient = args.stateBeforeResolution.gameData.ancient;
  const afterAncient = args.stateAfterResolution.gameData.ancient;
  const priorCopyIds = new Set((beforeAncient?.pendingSimulacrumCopies ?? []).map((copy) => copy.pendingCopyId));
  const copies: ResolvedActivationOutcome[] = [];
  for (const [playerId, ledger] of Object.entries(afterAncient?.solarLedgerByPlayerId ?? {})) {
    for (const entry of ledger.entries) {
      if (entry.solarPowerId !== 'SSIM') continue;
      const copy = afterAncient?.pendingSimulacrumCopies.find((record) =>
        !priorCopyIds.has(record.pendingCopyId) && record.status === 'queued' &&
        record.ownerPlayerId === playerId && record.queuedTurnNumber === ledger.battleTurnNumber &&
        record.pendingCopyId === `${entry.entryId}:simulacrum-copy:${record.sourceMode}` &&
        record.sourceTargetInstanceId === entry.simulacrum?.sourceTargetInstanceId
      );
      const target = entry.targets?.find((target) => target.shipInstanceId === copy?.sourceTargetInstanceId);
      if (!copy || !target?.shipInstanceId) continue;
      copies.push({
        playerId, kind: 'copy',
        source: {
          type: 'solar', solarPowerId: 'SSIM', ledgerEntryId: entry.entryId,
          pendingCopyId: copy.pendingCopyId,
          ...(entry.trigger ? { trigger: entry.trigger } : {}),
        },
        targets: [{ playerId: target.playerId, shipInstanceId: target.shipInstanceId }],
      });
    }
  }

  const effectsById = new Map(args.effects.map((effect) => [effect.id, effect]));
  const outcomes: ResolvedActivationOutcome[] = [];
  for (const event of args.effectEvents) {
    if (event.type !== 'EFFECT_APPLIED') continue;
    const effect = effectsById.get(event.effectId);
    if (!effect) continue;
    let source: ResolvedActivationOutcome['source'] | undefined;
    if (effect.source.type === 'ship') {
      source = { ...effect.source, effectId: effect.id };
    } else if (effect.source.reason === 'ancient-solar:SBLA' && effect.kind === EffectKind.Destroy) {
      const ledger = beforeAncient?.solarLedgerByPlayerId[effect.ownerPlayerId];
      const entry = ledger?.entries.find((entry) => entry.solarPowerId === 'SBLA' &&
        beforeAncient?.pendingBlackHoleDestructions.some((record) =>
          record.ownerPlayerId === effect.ownerPlayerId && record.battleTurnNumber === ledger.battleTurnNumber &&
          record.pendingDestructionId === `${entry.entryId}:black-hole-destruction` &&
          record.targetInstanceIds.some((id) => `${record.pendingDestructionId}:destroy:${id}` === effect.id)
        )
      );
      if (entry) source = { type: 'solar', solarPowerId: 'SBLA', ledgerEntryId: entry.entryId, effectId: effect.id };
    }
    if (source && effect.kind === EffectKind.Destroy && event.kind === 'DestroyShip') {
      outcomes.push({ playerId: effect.ownerPlayerId, kind: 'destroy', source,
        targets: [{ playerId: event.targetPlayerId, shipInstanceId: event.details?.shipInstanceId }] });
    } else if (source?.type === 'ship' && effect.kind === EffectKind.TransferShip && event.kind === 'TransferShip') {
      outcomes.push({ playerId: effect.ownerPlayerId, kind: 'steal', source,
        targets: (event.details?.shipInstanceIds ?? []).map((shipInstanceId: string) => ({
          playerId: event.details.fromPlayerId, shipInstanceId, destinationPlayerId: event.details.toPlayerId,
        })) });
    }
    // Keep a successful Cube-triggered copy next to the destruction that queued it.
    outcomes.push(...copies.filter((copy) => copy.source.type === 'solar' &&
      copy.source.solarPowerId === 'SSIM' && copy.source.trigger?.sourceEffectId === effect.id));
  }
  return normalizeOutcomes([...outcomes, ...copies]);
}

function normalizeSource(value: unknown): ShipActivationCueSource | null {
  if (!value || typeof value !== 'object') return null;

  const source = value as Partial<ShipActivationCueSource>;
  if (
    typeof source.playerId !== 'string' ||
    source.playerId.length === 0 ||
    typeof source.sourceInstanceId !== 'string' ||
    source.sourceInstanceId.length === 0
  ) {
    return null;
  }

  return {
    playerId: source.playerId,
    sourceInstanceId: source.sourceInstanceId,
  };
}

export function dedupeShipActivationCueSources(
  values: readonly unknown[]
): ShipActivationCueSource[] {
  const sources: ShipActivationCueSource[] = [];
  const seen = new Set<string>();

  for (const value of values) {
    const source = normalizeSource(value);
    if (!source) continue;

    const key = `${source.playerId}\u0000${source.sourceInstanceId}`;
    if (seen.has(key)) continue;

    seen.add(key);
    sources.push(source);
  }

  return sources;
}

function normalizeBatch(value: unknown): ShipActivationCueBatch | null {
  if (!value || typeof value !== 'object') return null;

  const batch = value as Partial<ShipActivationCueBatch>;
  if (
    typeof batch.key !== 'string' ||
    batch.key.length === 0 ||
    typeof batch.turnNumber !== 'number' ||
    !Number.isFinite(batch.turnNumber) ||
    typeof batch.phaseKey !== 'string' ||
    batch.phaseKey.length === 0 ||
    typeof batch.seq !== 'number' ||
    !Number.isFinite(batch.seq) ||
    !Array.isArray(batch.sources)
  ) {
    return null;
  }

  const sources = dedupeShipActivationCueSources(batch.sources);
  const resolvedOutcomes = normalizeOutcomes(batch.resolvedOutcomes);
  if (sources.length === 0 && resolvedOutcomes.length === 0) return null;

  return {
    key: batch.key,
    turnNumber: batch.turnNumber,
    phaseKey: batch.phaseKey,
    seq: batch.seq,
    sources,
    ...(resolvedOutcomes.length > 0 ? { resolvedOutcomes } : {}),
  };
}

export function getShipActivationCueBatches(value: unknown): ShipActivationCueBatch[] {
  if (!Array.isArray(value)) return [];

  return value
    .map(normalizeBatch)
    .filter((batch): batch is ShipActivationCueBatch => batch !== null)
    .slice(-MAX_SHIP_ACTIVATION_CUE_BATCHES);
}

export function getShipActivationSourcesFromAppliedEffects(
  effects: readonly Effect[],
  effectEvents: readonly EffectEvent[]
): ShipActivationCueSource[] {
  const appliedEffectIds = new Set(
    effectEvents
      .filter((event) => event.type === 'EFFECT_APPLIED' && typeof event.effectId === 'string')
      .map((event) => event.effectId)
  );

  return dedupeShipActivationCueSources(
    effects
      .filter(
        (effect) =>
          appliedEffectIds.has(effect.id) &&
          effect.source.type === 'ship'
      )
      .map((effect) => ({
        playerId: effect.ownerPlayerId,
        sourceInstanceId:
          effect.source.type === 'ship' ? effect.source.instanceId : '',
      }))
  );
}

export function appendShipActivationCueBatch(
  state: GameState,
  args: {
    phaseKey: string;
    sources: readonly unknown[];
    resolvedOutcomes?: readonly ResolvedActivationOutcome[];
    key?: string;
  }
): GameState {
  try {
    const sources = dedupeShipActivationCueSources(args.sources);
    const resolvedOutcomes = normalizeOutcomes(args.resolvedOutcomes);
    if (sources.length === 0 && resolvedOutcomes.length === 0) return state;

    const turnData = state.gameData?.turnData ?? {};
    const existingBatches = getShipActivationCueBatches(
      turnData.shipActivationCueBatches
    );
    const stableKey =
      typeof args.key === 'string' && args.key.length > 0
        ? args.key
        : null;

    if (stableKey && existingBatches.some((batch) => batch.key === stableKey)) {
      return state;
    }

    const turnNumber =
      turnData.turnNumber ??
      state.gameData?.turnNumber ??
      0;
    const seq =
      existingBatches.reduce(
        (highest, batch) => Math.max(highest, batch.seq),
        0
      ) + 1;
    const key =
      stableKey ??
      `ship-activation:${turnNumber}:${args.phaseKey}:${seq}`;
    const nextBatches = [
      ...existingBatches,
      {
        key,
        turnNumber,
        phaseKey: args.phaseKey,
        seq,
        sources,
        ...(resolvedOutcomes.length > 0 ? { resolvedOutcomes } : {}),
      },
    ].slice(-MAX_SHIP_ACTIVATION_CUE_BATCHES);

    return {
      ...state,
      gameData: {
        ...state.gameData,
        turnData: {
          ...turnData,
          shipActivationCueBatches: nextBatches,
        },
      },
    };
  } catch (error) {
    debugLog('[shipActivationCues] Failed to append presentation cue batch', error);
    return state;
  }
}

export type StrictShipActivationCueMergeResult =
  | { ok: true; state: GameState }
  | { ok: false; error: { code: string; message: string } };

export function mergePrivateDrawingPreludeCueBatchStrict(
  state: GameState,
  args: {
    key: string;
    turnNumber: number;
    playerId: string;
    sources: readonly unknown[];
  },
): StrictShipActivationCueMergeResult {
  const fail = (code: string, message: string): StrictShipActivationCueMergeResult => ({
    ok: false,
    error: { code, message },
  });
  if (!args.key || !Number.isInteger(args.turnNumber) || !args.playerId) {
    return fail('INVALID_CUE_REQUEST', 'Private Drawing-prelude cue request is malformed');
  }

  const normalizedSources = dedupeShipActivationCueSources(args.sources);
  if (
    normalizedSources.length === 0 ||
    args.sources.some((source) => normalizeSource(source) === null) ||
    normalizedSources.some((source) => source.playerId !== args.playerId)
  ) {
    return fail('INVALID_CUE_SOURCES', 'Private Drawing-prelude cue sources are malformed, duplicated, or mixed-owner');
  }

  const turnData = state.gameData.turnData ?? {};
  const rawBatches = turnData.shipActivationCueBatches;
  if (rawBatches !== undefined && !Array.isArray(rawBatches)) {
    return fail('MALFORMED_CUE_STORE', 'Ship activation cue storage is malformed');
  }
  const matchingRaw = (rawBatches ?? []).filter(
    (value: unknown) => value && typeof value === 'object' &&
      (value as { key?: unknown }).key === args.key,
  );
  if (matchingRaw.length > 1) {
    return fail('DUPLICATE_CUE_KEY', `Multiple private cue batches use ${args.key}`);
  }

  const existingBatches = getShipActivationCueBatches(rawBatches);
  const existing = matchingRaw.length === 1 ? normalizeBatch(matchingRaw[0]) : null;
  if (matchingRaw.length === 1 && !existing) {
    return fail('MALFORMED_MATCHING_CUE', `Private cue batch ${args.key} is malformed`);
  }
  if (existing) {
    if (
      existing.turnNumber !== args.turnNumber ||
      existing.phaseKey !== 'build.drawing' ||
      existing.sources.some((source) => source.playerId !== args.playerId)
    ) {
      return fail('CONFLICTING_CUE', `Private cue batch ${args.key} conflicts with the accepted transaction`);
    }
    const mergedSources = dedupeShipActivationCueSources([
      ...existing.sources,
      ...normalizedSources,
    ]);
    const nextBatches = existingBatches.map((batch) =>
      batch.key === args.key ? { ...batch, sources: mergedSources } : batch
    );
    return {
      ok: true,
      state: {
        ...state,
        gameData: {
          ...state.gameData,
          turnData: { ...turnData, shipActivationCueBatches: nextBatches },
        },
      },
    };
  }

  const seq = existingBatches.reduce((highest, batch) => Math.max(highest, batch.seq), 0) + 1;
  return {
    ok: true,
    state: {
      ...state,
      gameData: {
        ...state.gameData,
        turnData: {
          ...turnData,
          shipActivationCueBatches: [
            ...existingBatches,
            {
              key: args.key,
              turnNumber: args.turnNumber,
              phaseKey: 'build.drawing',
              seq,
              sources: normalizedSources,
            },
          ].slice(-MAX_SHIP_ACTIVATION_CUE_BATCHES),
        },
      },
    },
  };
}
