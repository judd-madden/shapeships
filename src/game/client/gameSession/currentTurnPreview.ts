import type { CanonicalBuildSubmitPayload } from './intents';
import {
  getChargeDeclarationFingerprint,
  type ChargeDeclarationPayload,
} from './chargeDeclaration';

export const CURRENT_TURN_PREVIEW_DEBOUNCE_MS = 225;

interface CurrentTurnPreviewCandidateCommon {
  gameId: string;
  playerId: string;
  turnNumber: number;
  safeContextFingerprint: string;
  ownBuildCaptureIdentity?: string;
}

export type CurrentTurnPreviewCandidateInput =
  | (CurrentTurnPreviewCandidateCommon & {
      phaseKey: 'build.drawing';
      draft: CanonicalBuildSubmitPayload;
      declaration?: never;
    })
  | (CurrentTurnPreviewCandidateCommon & {
      phaseKey: 'battle.charge_declaration';
      declaration: ChargeDeclarationPayload;
      draft?: never;
    });

export type CurrentTurnPreviewCandidate = CurrentTurnPreviewCandidateInput & {
  generation: number;
  draftFingerprint: string;
  declarationFingerprint?: string;
  identityKey: string;
  requestToken: string;
};

export interface CurrentTurnPreviewEstimate {
  status: 'estimated';
  requestToken?: string;
  identity: {
    gameId: string;
    turnNumber: number;
    phaseKey: string;
    sourceContextKey: string;
    draftKey: string;
    solarSelectionKey?: string;
    declarationFingerprint?: string;
    ownBuildCaptureIdentity?: string;
  };
  playerId: string;
  damage: { total: number; rows: unknown[] };
  healing: { total: number; rows: unknown[] };
  withAutocast?: {
    damage: { total: number; rows: unknown[] };
    healing: { total: number; rows: unknown[] };
  };
  withSolarSelection?: {
    damage: { total: number; rows: unknown[] };
    healing: { total: number; rows: unknown[] };
    autocastEnabled: boolean;
  };
  withChargeDeclaration?: {
    damage: { total: number; rows: unknown[] };
    healing: { total: number; rows: unknown[] };
    autocastEnabled: boolean;
    declarationFingerprint: string;
  };
  build: {
    lines: string[];
    rows?: Array<{
      line: string;
      groupKey: string;
      appearanceAnchor: number;
      appearanceRank: number;
      kind: 'action' | 'manual' | 'produced';
    }>;
    skipped: unknown[];
    remainingOrdinaryLines: number;
    remainingJoiningLines: number;
  };
}

export type CurrentTurnPreviewState =
  | { kind: 'idle' }
  | { kind: 'paused'; reason: string; candidate: CurrentTurnPreviewCandidate | null }
  | { kind: 'pending'; candidate: CurrentTurnPreviewCandidate }
  | {
      kind: 'estimated';
      candidate: CurrentTurnPreviewCandidate;
      estimate: CurrentTurnPreviewEstimate;
    }
  | {
      kind: 'unavailable';
      candidate: CurrentTurnPreviewCandidate;
      reason: string;
    };

export type CurrentTurnPreviewEnvelope =
  | {
      observed: {
        turnNumber: number;
        phaseKey: 'build.drawing';
        sourceContextKey?: string;
        ownBuildCaptureIdentity?: string;
      };
      draft: CanonicalBuildSubmitPayload;
      requestToken: string;
    }
  | {
      observed: {
        turnNumber: number;
        phaseKey: 'battle.charge_declaration';
        sourceContextKey?: string;
      };
      declaration: ChargeDeclarationPayload;
      requestToken: string;
    };

export interface CurrentTurnPreviewTransportResult {
  status: number;
  body: unknown;
}

export type CurrentTurnPreviewTransport = (
  gameId: string,
  envelope: CurrentTurnPreviewEnvelope,
) => Promise<CurrentTurnPreviewTransportResult>;

export interface PreviewSchedulerClock {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface CurrentTurnPreviewScheduler {
  setCandidate(candidate: CurrentTurnPreviewCandidateInput | null): void;
  pause(reason: string): void;
  resume(candidate: CurrentTurnPreviewCandidateInput | null): void;
  getState(): CurrentTurnPreviewState;
  dispose(): void;
}

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function stableSerialize(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function fingerprintValue(value: unknown): string {
  const serialized = stableSerialize(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= BigInt(serialized.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}

export function getCanonicalDraftFingerprint(draft: CanonicalBuildSubmitPayload): string {
  return fingerprintValue(draft);
}

export function getCurrentTurnPreviewCandidateIdentity(
  input: CurrentTurnPreviewCandidateInput,
): {
  draftFingerprint: string;
  declarationFingerprint?: string;
  identityKey: string;
} {
  const draftFingerprint = input.phaseKey === 'build.drawing'
    ? getCanonicalDraftFingerprint(input.draft ?? { builds: [] })
    : fingerprintValue(null);
  const declarationFingerprint = input.phaseKey === 'battle.charge_declaration'
    ? getChargeDeclarationFingerprint(input.declaration)
    : undefined;
  return {
    draftFingerprint,
    ...(declarationFingerprint ? { declarationFingerprint } : {}),
    identityKey: stableSerialize({
      gameId: input.gameId,
      playerId: input.playerId,
      turnNumber: input.turnNumber,
      phaseKey: input.phaseKey,
      safeContextFingerprint: input.safeContextFingerprint,
      ownBuildCaptureIdentity: input.ownBuildCaptureIdentity ?? 'capture:unknown',
      draftFingerprint,
      declarationFingerprint,
    }),
  };
}

function getPlayerId(player: any): string | null {
  const value = player?.id ?? player?.playerId ?? player?.sessionId;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function selectPlayer(player: any): unknown {
  return player
    ? {
        id: getPlayerId(player),
        role: player.role,
        faction: player.faction,
        species: player.species,
        health: player.health,
        maxHealth: player.maxHealth,
      }
    : null;
}

function selectOwnEntries(value: unknown, playerId: string): unknown {
  if (!isRecord(value)) return undefined;
  return value[playerId];
}

/**
 * Fingerprints only Drawing-safe estimator inputs visible in the accepted full
 * DTO. Battle-log rows, public thisTurn identity, clocks, readiness and root
 * stateRevision are deliberately absent.
 */
export function buildDrawingPreviewSafeContextFingerprint(args: {
  state: any;
  requesterPlayerId: string;
  eligible: boolean;
}): string {
  const { state, requesterPlayerId, eligible } = args;
  const publicState = state?.publicState ?? {};
  const gameData = state?.gameData ?? {};
  const turnData = gameData?.turnData ?? {};
  const publicPlayers = Array.isArray(publicState.players)
    ? publicState.players.map(selectPlayer)
    : [];
  const publicShips = isRecord(publicState.ships) ? publicState.ships : {};
  const requesterVoidFleet = selectOwnEntries(
    publicState.voidShipsByPlayerId,
    requesterPlayerId,
  );
  const requesterRemovedShips = selectOwnEntries(
    turnData.buildPhaseNonDestroyRemovedShipsByPlayerId,
    requesterPlayerId,
  );
  const ownShipIds = new Set<string>(
    [
      ...(Array.isArray(publicShips[requesterPlayerId]) ? publicShips[requesterPlayerId] : []),
      ...(Array.isArray(requesterVoidFleet) ? requesterVoidFleet : []),
      ...(isRecord(requesterRemovedShips) ? Object.values(requesterRemovedShips) : []),
    ]
      .map((ship: any) => ship?.instanceId)
      .filter((id: unknown): id is string => typeof id === 'string'),
  );
  const onceOnlyFired = gameData?.powerMemory?.onceOnlyFired;
  const frigateTriggerByInstanceId = gameData?.powerMemory?.frigateTriggerByInstanceId;
  const ownOnceOnly = isRecord(onceOnlyFired)
    ? Object.fromEntries(
        Object.entries(onceOnlyFired).filter(([key, fired]) =>
          fired === true && [...ownShipIds].some((id) => key.startsWith(`${id}::`)),
        ),
      )
    : {};
  const ownFrigateMemory = isRecord(frigateTriggerByInstanceId)
    ? Object.fromEntries(
        Object.entries(frigateTriggerByInstanceId).filter(([id]) => ownShipIds.has(id)),
      )
    : {};
  const ownDreadnoughtFacts = isRecord(
    turnData.dreadnoughtConsumedCurrentTurnComponentsByInstanceId,
  )
    ? Object.fromEntries(
        Object.entries(turnData.dreadnoughtConsumedCurrentTurnComponentsByInstanceId)
          .filter(([id]) => ownShipIds.has(id)),
      )
    : {};

  return fingerprintValue({
    eligible,
    gameId: state?.gameId ?? null,
    requesterPlayerId,
    turnNumber: state?.meta?.turnNumber ?? gameData?.turnNumber ?? turnData?.turnNumber ?? null,
    phaseKey: state?.meta?.phaseKey ?? null,
    drawingPrelude: state?.requester?.drawingPrelude ?? null,
    players: publicPlayers,
    requesterBuildEconomy: state?.requester?.buildEconomy ?? null,
    fleets: publicShips,
    requesterVoidFleet,
    visibleDice: publicState.visibleDice ?? null,
    publicDiceOverrides: {
      diceOverrideSourceByPlayerId: turnData.diceOverrideSourceByPlayerId ?? null,
      requesterCubeDiceSelection: selectOwnEntries(
        turnData.cubeDiceSelectionByPlayerId,
        requesterPlayerId,
      ),
    },
    requesterMemory: {
      onceOnlyFired: ownOnceOnly,
      frigateTriggerByInstanceId: ownFrigateMemory,
    },
    requesterTurnFacts: {
      shipsMadeThisTurn: selectOwnEntries(turnData.shipsMadeThisTurnByPlayerId, requesterPlayerId),
      queenCreatedXenitesThisTurn: selectOwnEntries(
        turnData.queenCreatedXenitesThisTurnByPlayerId,
        requesterPlayerId,
      ),
      removedShips: requesterRemovedShips,
      dreadnoughtComponents: ownDreadnoughtFacts,
    },
  });
}

function asEstimate(
  value: unknown,
  phaseKey: CurrentTurnPreviewCandidateInput['phaseKey'],
): CurrentTurnPreviewEstimate | null {
  if (!isRecord(value) || value.status !== 'estimated' || !isRecord(value.identity)) {
    return null;
  }
  if (
    typeof value.identity.gameId !== 'string' ||
    !Number.isInteger(value.identity.turnNumber) ||
    typeof value.identity.phaseKey !== 'string' ||
    typeof value.identity.sourceContextKey !== 'string' ||
    typeof value.identity.draftKey !== 'string' ||
    (value.identity.solarSelectionKey !== undefined &&
      typeof value.identity.solarSelectionKey !== 'string') ||
    (value.identity.declarationFingerprint !== undefined &&
      typeof value.identity.declarationFingerprint !== 'string') ||
    (value.identity.ownBuildCaptureIdentity !== undefined &&
      typeof value.identity.ownBuildCaptureIdentity !== 'string') ||
    typeof value.playerId !== 'string' ||
    !isRecord(value.damage) ||
    !isRecord(value.healing) ||
    typeof value.damage.total !== 'number' ||
    typeof value.healing.total !== 'number' ||
    !Array.isArray(value.damage.rows) ||
    !Array.isArray(value.healing.rows) ||
    !isRecord(value.build) ||
    !Array.isArray(value.build.lines) ||
    (value.withAutocast !== undefined && (
      !isRecord(value.withAutocast) ||
      !isRecord(value.withAutocast.damage) ||
      !isRecord(value.withAutocast.healing) ||
      typeof value.withAutocast.damage.total !== 'number' ||
      typeof value.withAutocast.healing.total !== 'number' ||
      !Array.isArray(value.withAutocast.damage.rows) ||
      !Array.isArray(value.withAutocast.healing.rows)
    )) ||
    (value.withSolarSelection !== undefined && (
      !isRecord(value.withSolarSelection) ||
      !isRecord(value.withSolarSelection.damage) ||
      !isRecord(value.withSolarSelection.healing) ||
      typeof value.withSolarSelection.damage.total !== 'number' ||
      typeof value.withSolarSelection.healing.total !== 'number' ||
      !Array.isArray(value.withSolarSelection.damage.rows) ||
      !Array.isArray(value.withSolarSelection.healing.rows) ||
      typeof value.withSolarSelection.autocastEnabled !== 'boolean'
    )) ||
    (value.withChargeDeclaration !== undefined && (
      !isRecord(value.withChargeDeclaration) ||
      !isRecord(value.withChargeDeclaration.damage) ||
      !isRecord(value.withChargeDeclaration.healing) ||
      typeof value.withChargeDeclaration.damage.total !== 'number' ||
      typeof value.withChargeDeclaration.healing.total !== 'number' ||
      !Array.isArray(value.withChargeDeclaration.damage.rows) ||
      !Array.isArray(value.withChargeDeclaration.healing.rows) ||
      typeof value.withChargeDeclaration.autocastEnabled !== 'boolean' ||
      typeof value.withChargeDeclaration.declarationFingerprint !== 'string'
    )) ||
    (phaseKey === 'battle.charge_declaration' && (
      typeof value.identity.declarationFingerprint !== 'string' ||
      !isRecord(value.withChargeDeclaration)
    ))
  ) {
    return null;
  }
  return value as CurrentTurnPreviewEstimate;
}

export function createCurrentTurnPreviewScheduler(args: {
  transport: CurrentTurnPreviewTransport;
  onStateChange: (state: CurrentTurnPreviewState) => void;
  clock?: PreviewSchedulerClock;
  debounceMs?: number;
}): CurrentTurnPreviewScheduler {
  const clock: PreviewSchedulerClock = args.clock ?? {
    setTimeout: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
    clearTimeout: (handle) => globalThis.clearTimeout(handle as number),
  };
  const debounceMs = args.debounceMs ?? CURRENT_TURN_PREVIEW_DEBOUNCE_MS;
  let state: CurrentTurnPreviewState = { kind: 'idle' };
  let generation = 0;
  let disposed = false;
  let pausedReason: string | null = null;
  let timer: unknown = null;
  let current: CurrentTurnPreviewCandidate | null = null;
  let queued: CurrentTurnPreviewCandidate | null = null;
  let inFlight: CurrentTurnPreviewCandidate | null = null;
  let invalidationEpoch = 0;
  const routeKeyByScope = new Map<string, string>();
  const acceptedByIdentity = new Map<
    string,
    { candidate: CurrentTurnPreviewCandidate; estimate: CurrentTurnPreviewEstimate }
  >();

  const publish = (next: CurrentTurnPreviewState): void => {
    state = next;
    if (!disposed) args.onStateChange(next);
  };
  const clearTimer = (): void => {
    if (timer !== null) clock.clearTimeout(timer);
    timer = null;
  };
  const scopeKey = (candidate: CurrentTurnPreviewCandidate): string =>
    `${candidate.gameId}::${candidate.playerId}::${candidate.turnNumber}::${candidate.phaseKey}`;
  const remainsCurrent = (candidate: CurrentTurnPreviewCandidate, epoch: number): boolean =>
    !disposed &&
    pausedReason === null &&
    invalidationEpoch === epoch &&
    current?.identityKey === candidate.identityKey &&
    current.generation === candidate.generation;

  const buildEnvelope = (
    candidate: CurrentTurnPreviewCandidate,
    sourceContextKey?: string,
  ): CurrentTurnPreviewEnvelope => candidate.phaseKey === 'build.drawing'
    ? {
        observed: {
          turnNumber: candidate.turnNumber,
          phaseKey: candidate.phaseKey,
          ...(candidate.ownBuildCaptureIdentity
            ? { ownBuildCaptureIdentity: candidate.ownBuildCaptureIdentity }
            : {}),
          ...(sourceContextKey ? { sourceContextKey } : {}),
        },
        draft: candidate.draft ?? { builds: [] },
        requestToken: candidate.requestToken,
      }
    : {
        observed: {
          turnNumber: candidate.turnNumber,
          phaseKey: candidate.phaseKey,
          ...(sourceContextKey ? { sourceContextKey } : {}),
        },
        declaration: candidate.declaration,
        requestToken: candidate.requestToken,
      };

  const launch = async (candidate: CurrentTurnPreviewCandidate): Promise<void> => {
    if (disposed || pausedReason !== null || inFlight !== null) return;
    inFlight = candidate;
    const epoch = invalidationEpoch;
    const scope = scopeKey(candidate);
    let sourceContextKey = routeKeyByScope.get(scope);
    let staleRetryUsed = false;

    try {
      while (true) {
        let result: CurrentTurnPreviewTransportResult;
        try {
          result = await args.transport(
            candidate.gameId,
            buildEnvelope(candidate, sourceContextKey),
          );
        } catch (error) {
          if (remainsCurrent(candidate, epoch)) {
            publish({
              kind: 'unavailable',
              candidate,
              reason: error instanceof Error ? error.message : 'network_error',
            });
          }
          break;
        }

        const body = isRecord(result.body) ? result.body : {};
        const retry = isRecord(body.retry) ? body.retry : null;
        if (
          result.status === 409 &&
          body.reason === 'source_context_changed' &&
          retry?.allowed === true &&
          typeof retry.sourceContextKey === 'string' &&
          !staleRetryUsed &&
          remainsCurrent(candidate, epoch)
        ) {
          staleRetryUsed = true;
          sourceContextKey = retry.sourceContextKey;
          routeKeyByScope.set(scope, sourceContextKey);
          continue;
        }

        if (!remainsCurrent(candidate, epoch)) break;
        const estimate = asEstimate(body, candidate.phaseKey);
        if (
          result.status >= 200 &&
          result.status < 300 &&
          estimate &&
          estimate.requestToken === candidate.requestToken &&
          estimate.identity.gameId === candidate.gameId &&
          estimate.identity.turnNumber === candidate.turnNumber &&
          estimate.identity.phaseKey === candidate.phaseKey &&
          (candidate.ownBuildCaptureIdentity === undefined ||
            estimate.identity.ownBuildCaptureIdentity === candidate.ownBuildCaptureIdentity) &&
          (candidate.phaseKey !== 'battle.charge_declaration' ||
            (
              estimate.identity.declarationFingerprint ===
                candidate.declarationFingerprint &&
              estimate.withChargeDeclaration?.declarationFingerprint ===
                candidate.declarationFingerprint
            )) &&
          estimate.playerId === candidate.playerId
        ) {
          routeKeyByScope.set(scope, estimate.identity.sourceContextKey);
          acceptedByIdentity.set(candidate.identityKey, { candidate, estimate });
          publish({ kind: 'estimated', candidate, estimate });
        } else {
          publish({
            kind: 'unavailable',
            candidate,
            reason: typeof body.reason === 'string' ? body.reason : 'invalid_preview_response',
          });
        }
        break;
      }
    } finally {
      if (inFlight?.generation === candidate.generation) inFlight = null;
      const next = queued;
      queued = null;
      if (next && remainsCurrent(next, invalidationEpoch)) {
        void launch(next);
      }
    }
  };

  const settle = (candidate: CurrentTurnPreviewCandidate): void => {
    timer = null;
    if (
      disposed ||
      pausedReason !== null ||
      current?.generation !== candidate.generation ||
      current.identityKey !== candidate.identityKey
    ) {
      return;
    }
    if (inFlight) {
      queued = candidate;
      return;
    }
    void launch(candidate);
  };

  const scheduleInput = (input: CurrentTurnPreviewCandidateInput | null, force = false): void => {
    if (input === null) {
      clearTimer();
      generation += 1;
      invalidationEpoch += 1;
      current = null;
      queued = null;
      if (pausedReason === null) publish({ kind: 'idle' });
      return;
    }
    const { draftFingerprint, declarationFingerprint, identityKey } =
      getCurrentTurnPreviewCandidateIdentity(input);
    if (!force && current?.identityKey === identityKey) return;
    clearTimer();
    generation += 1;
    invalidationEpoch += 1;
    current = {
      ...input,
      generation,
      draftFingerprint,
      ...(declarationFingerprint ? { declarationFingerprint } : {}),
      identityKey,
      requestToken: `${input.turnNumber}.${generation}`,
    };
    queued = null;
    if (pausedReason !== null) {
      publish({ kind: 'paused', reason: pausedReason, candidate: current });
      return;
    }
    const accepted = acceptedByIdentity.get(identityKey);
    if (accepted) {
      publish({ kind: 'estimated', candidate: current, estimate: accepted.estimate });
      return;
    }
    publish({ kind: 'pending', candidate: current });
    timer = clock.setTimeout(() => settle(current!), debounceMs);
  };

  return {
    setCandidate(candidate) {
      if (!disposed) scheduleInput(candidate);
    },
    pause(reason) {
      if (disposed) return;
      pausedReason = reason;
      invalidationEpoch += 1;
      clearTimer();
      queued = null;
      publish({ kind: 'paused', reason, candidate: current });
    },
    resume(candidate) {
      if (disposed) return;
      pausedReason = null;
      scheduleInput(candidate, true);
    },
    getState() {
      return state;
    },
    dispose() {
      disposed = true;
      invalidationEpoch += 1;
      clearTimer();
      current = null;
      queued = null;
    },
  };
}
