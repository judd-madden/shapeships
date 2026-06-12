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
