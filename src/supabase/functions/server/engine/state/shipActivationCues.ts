import type { Effect } from '../../engine_shared/effects/Effect.ts';
import type { EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import { debugLog } from '../../utils/serverLogger.ts';
import type {
  GameState,
  ShipActivationCueBatch,
  ShipActivationCueSource,
} from './GameStateTypes.ts';

const MAX_SHIP_ACTIVATION_CUE_BATCHES = 8;

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
  if (sources.length === 0) return null;

  return {
    key: batch.key,
    turnNumber: batch.turnNumber,
    phaseKey: batch.phaseKey,
    seq: batch.seq,
    sources,
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
    key?: string;
  }
): GameState {
  try {
    const sources = dedupeShipActivationCueSources(args.sources);
    if (sources.length === 0) return state;

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
