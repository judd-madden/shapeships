import {
  findPlayerByIdentity, getLastTurnDamageByPlayerId, getLastTurnHealByPlayerId,
  getLastTurnNetByPlayerId, getPhaseHold, getPhaseKey, getPlayerIdentityKey,
  getPlayers, getResultReason, getTurnNumber, getWinnerPlayerId, isGameFinished,
  getLastTurnResolvedHealthFacts,
} from './selectors';
import { deriveViewerSeats } from './viewerSeats';
import type {
  BattleLogHistoryResponse, ResolvedHealthIdentity, ResolvedHealthOutcome,
  ResolvedHealthPresentation, ResolvedHealthSide, ResolvedHealthSnapshot, ResolvedHealthCompletionIdentity,
  ResolvedHealthResolutionMetadata,
} from './types';

const HEALTH_FINISH_REASONS = new Set(['decisive', 'narrow', 'mutual_destruction']);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const turn = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value > 0;

export function getHealthResolutionPresentationKey(gameId: string, resolvedTurnKey: string): string {
  return `${gameId}::health::${resolvedTurnKey}`;
}

export function getResolvedHealthIdentityKey(identity: ResolvedHealthIdentity): string {
  return JSON.stringify([identity.gameId, identity.viewerId, identity.viewerRole,
    identity.leftPlayerId, identity.rightPlayerId]);
}

export function matchesResolvedHealthCompletion(
  snapshot: ResolvedHealthCompletionIdentity, receipt: ResolvedHealthCompletionIdentity | null | undefined,
): boolean {
  return !!receipt && snapshot.continuityKey === receipt.continuityKey &&
    snapshot.presentationKey === receipt.presentationKey && snapshot.resolvedTurnNumber === receipt.resolvedTurnNumber &&
    getResolvedHealthIdentityKey(snapshot.identity) === getResolvedHealthIdentityKey(receipt.identity);
}

/** This gate is deliberately separate from next-turn input/overlay locking. */
export function isTerminalHealthBarPresentationPending(args: {
  enabled: boolean;
  continuityKey: string | null;
  snapshot: ResolvedHealthSnapshot | null | undefined;
  completion: ResolvedHealthCompletionIdentity | null | undefined;
}): boolean {
  const { snapshot } = args;
  return args.enabled && !!snapshot && snapshot.continuityKey === args.continuityKey &&
    snapshot.outcome.isTerminal && HEALTH_FINISH_REASONS.has(snapshot.outcome.resultReason ?? '') &&
    !matchesResolvedHealthCompletion(snapshot, args.completion);
}

function validIdentity(identity: ResolvedHealthIdentity): boolean {
  return [identity.gameId, identity.viewerId, identity.leftPlayerId, identity.rightPlayerId]
    .every((id) => typeof id === 'string' && id.length > 0) &&
    identity.leftPlayerId !== identity.rightPlayerId &&
    (identity.viewerRole === 'spectator' || identity.viewerRole === 'player');
}

function matchesIdentity(state: any, identity: ResolvedHealthIdentity): boolean {
  if (!validIdentity(identity) || state?.gameId !== identity.gameId) return false;
  const seats = deriveViewerSeats(state, identity.viewerId);
  const left = seats.isViewerSpectator ? seats.p1 : seats.me;
  const right = seats.isViewerSpectator ? seats.p2 : seats.opponent;
  return (identity.viewerRole === 'spectator' ? seats.isViewerSpectator : seats.isViewerPlayer) &&
    getPlayerIdentityKey(left) === identity.leftPlayerId && getPlayerIdentityKey(right) === identity.rightPlayerId &&
    [identity.leftPlayerId, identity.rightPlayerId].every((id) =>
      getPlayers(state).filter((player) => getPlayerIdentityKey(player) === id).length === 1);
}

export function readResolvedHealthOutcome(state: any): Readonly<ResolvedHealthOutcome> {
  const winner = getWinnerPlayerId(state);
  const reason = getResultReason(state);
  // Full-state responses use an object envelope without a win/draw scalar.
  // Direct canonical states can carry the scalar; never derive it from health.
  const hasResult = Object.prototype.hasOwnProperty.call(state ?? {}, 'result') &&
    state.result !== undefined && (state.result === null || typeof state.result !== 'object');
  return Object.freeze({
    isTerminal: isGameFinished(state),
    winnerPlayerId: typeof winner === 'string' ? winner : null,
    resultReason: typeof reason === 'string' ? reason : null,
    ...(hasResult ? { result: state.result === 'win' || state.result === 'draw' ? state.result : null } : {}),
  });
}

function compatibleHealthOutcomes(left: ResolvedHealthOutcome, right: ResolvedHealthOutcome) {
  return left.isTerminal === right.isTerminal && left.winnerPlayerId === right.winnerPlayerId &&
    left.resultReason === right.resultReason &&
    (left.result === undefined || right.result === undefined || left.result === right.result);
}

function ownNumber(map: any, playerId: string): number | undefined {
  const value = map != null && Object.prototype.hasOwnProperty.call(map, playerId)
    ? map[playerId] : undefined;
  return finite(value) ? value : undefined;
}

function resolutionMetadata(value: unknown, ids: string[], resolvedTurnNumber: number): Readonly<ResolvedHealthResolutionMetadata> | null {
  const raw = value as Partial<ResolvedHealthResolutionMetadata> | null | undefined;
  if (!raw || raw.resolvedTurnNumber !== resolvedTurnNumber ||
      ![raw.finalHealthByPlayerId, raw.maxHealthByPlayerId].every((map) =>
        map && Object.keys(map).length === ids.length && ids.every((id) => ownNumber(map, id) !== undefined)) ||
      !ids.every((id) => positive(ownNumber(raw.maxHealthByPlayerId, id)))) return null;
  return Object.freeze({ resolvedTurnNumber,
    finalHealthByPlayerId: Object.freeze(Object.fromEntries(ids.map((id) => [id, ownNumber(raw.finalHealthByPlayerId, id)!]))),
    maxHealthByPlayerId: Object.freeze(Object.fromEntries(ids.map((id) => [id, ownNumber(raw.maxHealthByPlayerId, id)!]))),
  });
}

function buildSide(args: {
  playerId: string; finalHealth: unknown; actualNetDelta: unknown;
  damageTaken: unknown; grossHealingReceived: unknown; maxHealth: unknown;
}): Readonly<ResolvedHealthSide> | null {
  const { playerId, finalHealth, actualNetDelta, damageTaken, grossHealingReceived, maxHealth } = args;
  if (!finite(finalHealth) || !finite(actualNetDelta) || !finite(damageTaken) || damageTaken < 0 ||
      !finite(grossHealingReceived) || grossHealingReceived < 0 || !positive(maxHealth)) return null;
  const startHealth = finalHealth - actualNetDelta;
  const damageStageHealth = startHealth - damageTaken;
  const beforeClamp = damageStageHealth + grossHealingReceived;
  // Validate the authoritative aggregate contract; never use this as canonical health.
  if (![startHealth, damageStageHealth, beforeClamp].every(finite) ||
      Math.abs(Math.min(beforeClamp, maxHealth) - finalHealth) > 1e-8) return null;
  return Object.freeze({ playerId, startHealth, damageTaken, grossHealingReceived,
    finalHealth, actualNetDelta, maxHealth, damageStageHealth });
}

/** A next-turn DTO may include new fleets/materialisation, even in dice_roll. */
export function isResolvedHealthBoundary(state: any, resolvedTurnNumber: number): boolean {
  if (!turn(resolvedTurnNumber)) return false;
  const currentTurn = getTurnNumber(state);
  if (isGameFinished(state)) {
    return currentTurn === resolvedTurnNumber && HEALTH_FINISH_REASONS.has(getResultReason(state));
  }
  const hold = getPhaseHold(state);
  return currentTurn === resolvedTurnNumber && getPhaseKey(state) === 'battle.end_of_turn_resolution' &&
    hold?.holdReason === 'end_of_turn_health';
}

export interface PendingResolvedHealthCapture {
  readonly state: any;
  readonly identity: ResolvedHealthIdentity;
  readonly continuityKey: string;
  readonly resolvedTurnNumber: number;
  readonly source: 'intent' | 'poll';
}

/** Called only for an observed live completion, never by history/bootstrap loading.
 * Own exact aggregate facts immediately; history never supplies next-turn caps. */
export function prepareResolvedHealthCapture(args: PendingResolvedHealthCapture): PendingResolvedHealthCapture | null {
  const { state, identity, resolvedTurnNumber } = args;
  if (!matchesIdentity(state, identity) || !turn(resolvedTurnNumber)) return null;
  const outcome = readResolvedHealthOutcome(state);
  if (outcome.isTerminal ? !isResolvedHealthBoundary(state, resolvedTurnNumber)
    : getTurnNumber(state) !== resolvedTurnNumber + 1 && !isResolvedHealthBoundary(state, resolvedTurnNumber)) return null;
  const ids = [identity.leftPlayerId, identity.rightPlayerId];
  const facts = getLastTurnResolvedHealthFacts(state);
  const metadata = resolutionMetadata(facts.healthResolution, ids, resolvedTurnNumber);
  // Explicit malformed/mismatched provenance must never fall back to legacy caps.
  if (facts.healthResolution !== undefined && !metadata) return null;
  if (!metadata && !isResolvedHealthBoundary(state, resolvedTurnNumber)) return null;
  const maps = [facts.damage, facts.healing, facts.net];
  if (!ids.every((id) => finite(metadata?.finalHealthByPlayerId[id] ?? findPlayerByIdentity(state, id)?.health) &&
      maps.every((map) => ownNumber(map, id) !== undefined) &&
      ownNumber(maps[0], id)! >= 0 && ownNumber(maps[1], id)! >= 0)) return null;
  if (metadata && !ids.every((playerId) => buildSide({ playerId,
    finalHealth: metadata.finalHealthByPlayerId[playerId], maxHealth: metadata.maxHealthByPlayerId[playerId],
    damageTaken: ownNumber(maps[0], playerId), grossHealingReceived: ownNumber(maps[1], playerId),
    actualNetDelta: ownNumber(maps[2], playerId) }))) return null;
  const ownMap = (map: any) => Object.freeze(Object.fromEntries(ids.map((id) => [id, ownNumber(map, id)])));
  const players = Object.freeze(getPlayers(state).map((player) => Object.freeze({
    id: player.id, playerId: player.playerId, sessionId: player.sessionId,
    role: player.role, health: player.health, maxHealth: player.maxHealth,
  })));
  const ownedState = Object.freeze({ gameId: identity.gameId, players,
    turnNumber: getTurnNumber(state), phaseKey: getPhaseKey(state),
    status: outcome.isTerminal ? 'finished' : 'active',
    winnerPlayerId: outcome.winnerPlayerId, resultReason: outcome.resultReason,
    ...(outcome.result !== undefined ? { result: outcome.result } : {}),
    gameData: Object.freeze({ lastTurnDamageByPlayerId: ownMap(maps[0]),
      lastTurnHealByPlayerId: ownMap(maps[1]), lastTurnNetByPlayerId: ownMap(maps[2]),
      ...(metadata ? { lastTurnHealthResolution: metadata } : {}),
      turnData: Object.freeze({ phaseHold: Object.freeze({ holdReason: getPhaseHold(state)?.holdReason }) }) }),
  });
  return Object.freeze({ ...args, identity: Object.freeze({ ...identity }), state: ownedState });
}

export function getIntentResolvedHealthTurn(result: any, submittedTurn?: number): number | null {
  if (result?.ok !== true || !result.state || !Array.isArray(result.events)) return null;
  const finalized = result.events.filter((event: any) => event?.type === 'BATTLE_LOG_FINALIZE_TURN');
  if (finalized.length > 0) {
    // Several finalized turns in one response are recovery, not a replay queue.
    return finalized.length === 1 && turn(finalized[0].finalizedTurnNumber)
      ? finalized[0].finalizedTurnNumber : null;
  }
  return turn(submittedTurn) && result.events.some((event: any) =>
    event?.type === 'EFFECT_APPLIED' && event.kind === 'AggregatedHealthChange') ? submittedTurn : null;
}

export function captureResolvedHealthSnapshot(args: {
  state: any; identity: ResolvedHealthIdentity; continuityKey: string;
  resolvedTurnNumber: number; source: 'intent' | 'poll';
  /** Legacy input only; history cannot establish missing resolution-time provenance. */
  history?: BattleLogHistoryResponse | null;
  /** A subsequent poll can supply missing caps at the SAME finalized boundary. */
  boundaryState?: any;
  /** An owned capture prepared from a live event/adjacent observation, never historical loading. */
  liveCapture?: PendingResolvedHealthCapture | null;
}): ResolvedHealthSnapshot | null {
  const { state, identity, continuityKey, resolvedTurnNumber, source, boundaryState } = args;
  if (!matchesIdentity(state, identity) || !turn(resolvedTurnNumber)) return null;
  const outcome = readResolvedHealthOutcome(state);
  if (outcome.isTerminal && (!HEALTH_FINISH_REASONS.has(outcome.resultReason ?? '') ||
      (outcome.winnerPlayerId != null && ![identity.leftPlayerId, identity.rightPlayerId].includes(outcome.winnerPlayerId)))) return null;
  const atBoundary = isResolvedHealthBoundary(state, resolvedTurnNumber);
  const ids = [identity.leftPlayerId, identity.rightPlayerId];
  const facts = getLastTurnResolvedHealthFacts(state);
  const metadata = resolutionMetadata(facts.healthResolution, ids, resolvedTurnNumber);
  if (facts.healthResolution !== undefined && !metadata) return null;
  const boundaryMatches = boundaryState && matchesIdentity(boundaryState, identity) &&
    isResolvedHealthBoundary(boundaryState, resolvedTurnNumber) &&
    compatibleHealthOutcomes(readResolvedHealthOutcome(boundaryState), outcome) &&
    ids.every((id) => findPlayerByIdentity(boundaryState, id)?.health === findPlayerByIdentity(state, id)?.health &&
      ownNumber(getLastTurnNetByPlayerId(boundaryState), id) === ownNumber(getLastTurnNetByPlayerId(state), id) &&
      ownNumber(getLastTurnDamageByPlayerId(boundaryState), id) === ownNumber(getLastTurnDamageByPlayerId(state), id) &&
      ownNumber(getLastTurnHealByPlayerId(boundaryState), id) === ownNumber(getLastTurnHealByPlayerId(state), id));
  const boundaryCap = (id: string): unknown => atBoundary && positive(findPlayerByIdentity(state, id)?.maxHealth)
    ? findPlayerByIdentity(state, id).maxHealth
    : boundaryMatches ? findPlayerByIdentity(boundaryState, id)?.maxHealth : undefined;
  if (!metadata && !atBoundary && !boundaryMatches) return null;
  if (!atBoundary && getTurnNumber(state) !== resolvedTurnNumber + 1) return null;
  const damage = facts.damage;
  const healing = facts.healing;
  const net = facts.net;
  const side = (playerId: string) => {
    const player = findPlayerByIdentity(state, playerId);
    if (!player || getPlayerIdentityKey(player) !== playerId || player.role !== 'player') return null;
    return buildSide({ playerId, finalHealth: metadata ? metadata.finalHealthByPlayerId[playerId] : player.health,
      actualNetDelta: ownNumber(net, playerId), damageTaken: ownNumber(damage, playerId),
      grossHealingReceived: ownNumber(healing, playerId),
      maxHealth: metadata ? metadata.maxHealthByPlayerId[playerId] : boundaryCap(playerId) });
  };
  const left = side(identity.leftPlayerId);
  const right = side(identity.rightPlayerId);
  if (!left || !right) return null;
  return Object.freeze({ identity: Object.freeze({ ...identity }), continuityKey,
    presentationKey: getHealthResolutionPresentationKey(identity.gameId, String(resolvedTurnNumber)), resolvedTurnNumber,
    source, eligibility: 'live', left, right, outcome });
}

export function buildSettledHealthPresentation(state: any, identity: ResolvedHealthIdentity | null): Extract<ResolvedHealthPresentation, { mode: 'settled' }> | null {
  if (!identity || !matchesIdentity(state, identity)) return null;
  const side = (playerId: string) => {
    const player = findPlayerByIdentity(state, playerId);
    return finite(player?.health) ? Object.freeze({ playerId, health: player.health,
      maxHealth: positive(player.maxHealth) ? player.maxHealth : null }) : null;
  };
  const left = side(identity.leftPlayerId);
  const right = side(identity.rightPlayerId);
  return left && right ? Object.freeze({ mode: 'settled', identity: Object.freeze({ ...identity }),
    left, right, outcome: readResolvedHealthOutcome(state) }) : null;
}

export interface HealthResolutionObservation {
  gameId: string;
  identityKey: string;
  resumeToken: number;
  turnNumber: number;
  isFinished: boolean;
  /** A refreshed legacy hold already contains the completed resolution. */
  wasLegacyHealthHold?: boolean;
}

export function observeHealthResolution(previous: HealthResolutionObservation | null, current: HealthResolutionObservation): {
  resolvedTurnNumber: number | null; recovery: boolean;
} {
  if (!previous || previous.gameId !== current.gameId || previous.identityKey !== current.identityKey ||
      previous.resumeToken !== current.resumeToken) return { resolvedTurnNumber: null, recovery: true };
  const gap = current.turnNumber - previous.turnNumber;
  if (gap > 1 || gap < 0 || (gap > 0 && previous.wasLegacyHealthHold)) return { resolvedTurnNumber: null, recovery: true };
  if (gap === 1 && !previous.isFinished) {
    // A terminal N+1 means both N and N+1 resolved since the observation.
    return current.isFinished ? { resolvedTurnNumber: null, recovery: true }
      : { resolvedTurnNumber: previous.turnNumber, recovery: false };
  }
  return { resolvedTurnNumber: !previous.isFinished && current.isFinished ? current.turnNumber : null, recovery: false };
}

export interface ResolvedHealthState {
  readonly continuityKey: string | null;
  readonly snapshot: ResolvedHealthSnapshot | null;
  readonly latestResolvedTurnNumber: number;
  readonly releasedThroughTurn: number;
}

export function createResolvedHealthState(): ResolvedHealthState {
  return { continuityKey: null, snapshot: null, latestResolvedTurnNumber: 0, releasedThroughTurn: 0 };
}

export type ResolvedHealthEvent =
  | { type: 'sync'; continuityKey: string | null; candidate?: ResolvedHealthSnapshot | null; observedResolvedTurnNumber?: number | null }
  | { type: 'turn_start_published'; continuityKey: string | null; gameId: string; turnNumber: number };

export function transitionResolvedHealth(state: ResolvedHealthState, event: ResolvedHealthEvent): ResolvedHealthState {
  if (event.type === 'sync') {
    let current = state.continuityKey === event.continuityKey ? state
      : { ...createResolvedHealthState(), continuityKey: event.continuityKey };
    if (current.snapshot && (event.observedResolvedTurnNumber ?? 0) > current.snapshot.resolvedTurnNumber) {
      current = { ...current, snapshot: null };
    }
    const candidate = event.candidate;
    if (!candidate || candidate.continuityKey !== event.continuityKey ||
        candidate.resolvedTurnNumber <= current.latestResolvedTurnNumber ||
        candidate.resolvedTurnNumber <= current.releasedThroughTurn) return current;
    return { ...current, snapshot: candidate, latestResolvedTurnNumber: candidate.resolvedTurnNumber };
  }
  if (state.continuityKey !== event.continuityKey ||
      (state.snapshot && state.snapshot.identity.gameId !== event.gameId)) return state;
  return { ...state, releasedThroughTurn: Math.max(state.releasedThroughTurn, event.turnNumber - 1),
    snapshot: state.snapshot && !state.snapshot.outcome.isTerminal && event.turnNumber > state.snapshot.resolvedTurnNumber
      ? null : state.snapshot };
}
