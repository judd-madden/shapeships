import {
  findPlayerByIdentity, getLastTurnDamageByPlayerId, getLastTurnHealByPlayerId,
  getLastTurnNetByPlayerId, getPhaseHold, getPhaseKey, getPlayerIdentityKey,
  getPlayers, getResultReason, getTurnNumber, getWinnerPlayerId, isGameFinished,
  getMaterializedSimulacrumFleetInstanceIdsByPlayerId, getShipsByPlayerId, isPlayerReadyForPhase,
} from './selectors';
import { deriveViewerSeats } from './viewerSeats';
import type {
  BattleLogHistoryResponse, ResolvedHealthIdentity, ResolvedHealthOutcome,
  ResolvedHealthPresentation, ResolvedHealthSide, ResolvedHealthSnapshot,
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
  return Object.freeze({
    isTerminal: isGameFinished(state),
    winnerPlayerId: typeof winner === 'string' ? winner : null,
    resultReason: typeof reason === 'string' ? reason : null,
  });
}

function ownNumber(map: any, playerId: string): number | undefined {
  const value = map != null && Object.prototype.hasOwnProperty.call(map, playerId)
    ? map[playerId] : undefined;
  return finite(value) ? value : undefined;
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
  readonly postResolutionFleetWork?: boolean;
}

/** Called only for an observed live completion, never by history/bootstrap loading.
 * Own aggregate facts immediately, even when the response omits finalized caps. */
export function prepareResolvedHealthCapture(args: PendingResolvedHealthCapture): PendingResolvedHealthCapture | null {
  const { state, identity, resolvedTurnNumber } = args;
  if (!matchesIdentity(state, identity) || !turn(resolvedTurnNumber)) return null;
  const outcome = readResolvedHealthOutcome(state);
  if (outcome.isTerminal ? !isResolvedHealthBoundary(state, resolvedTurnNumber)
    : getTurnNumber(state) !== resolvedTurnNumber + 1 && !isResolvedHealthBoundary(state, resolvedTurnNumber)) return null;
  const ids = [identity.leftPlayerId, identity.rightPlayerId];
  if (!outcome.isTerminal && getTurnNumber(state) === resolvedTurnNumber + 1) {
    // Current history summaries are built from the post-advance state. Fleet work
    // after N can change that cap before it is archived. Do not guess N's cap.
    const materialized = getMaterializedSimulacrumFleetInstanceIdsByPlayerId(state);
    const fleets = getShipsByPlayerId(state);
    const made = state?.gameData?.turnData?.shipsMadeThisTurnByPlayerId;
    if (args.postResolutionFleetWork || ids.some((id) =>
      materialized[id]?.length > 0 || (finite(made?.[id]) && made[id] > 0) ||
      fleets[id]?.some((ship) => ship.createdTurn === resolvedTurnNumber + 1) ||
      (getPhaseKey(state) === 'build.drawing' && isPlayerReadyForPhase(state, id)))) return null;
  }
  const maps = [getLastTurnDamageByPlayerId(state), getLastTurnHealByPlayerId(state), getLastTurnNetByPlayerId(state)];
  if (!ids.every((id) => finite(findPlayerByIdentity(state, id)?.health) &&
      maps.every((map) => ownNumber(map, id) !== undefined) &&
      ownNumber(maps[0], id)! >= 0 && ownNumber(maps[1], id)! >= 0)) return null;
  const ownMap = (map: any) => Object.freeze(Object.fromEntries(ids.map((id) => [id, ownNumber(map, id)])));
  const players = Object.freeze(getPlayers(state).map((player) => Object.freeze({
    id: player.id, playerId: player.playerId, sessionId: player.sessionId,
    role: player.role, health: player.health, maxHealth: player.maxHealth,
  })));
  const ownedState = Object.freeze({ gameId: identity.gameId, players,
    turnNumber: getTurnNumber(state), phaseKey: getPhaseKey(state),
    status: outcome.isTerminal ? 'finished' : 'active',
    winnerPlayerId: outcome.winnerPlayerId, resultReason: outcome.resultReason,
    gameData: Object.freeze({ lastTurnDamageByPlayerId: ownMap(maps[0]),
      lastTurnHealByPlayerId: ownMap(maps[1]), lastTurnNetByPlayerId: ownMap(maps[2]),
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
  history?: BattleLogHistoryResponse | null;
  /** A subsequent poll can supply missing caps at the SAME finalized boundary. */
  boundaryState?: any;
  /** An owned capture prepared from a live event/adjacent observation, never historical loading. */
  liveCapture?: PendingResolvedHealthCapture | null;
}): ResolvedHealthSnapshot | null {
  const { state, identity, continuityKey, resolvedTurnNumber, source, history, boundaryState } = args;
  if (!matchesIdentity(state, identity) || !turn(resolvedTurnNumber)) return null;
  const outcome = readResolvedHealthOutcome(state);
  if (outcome.isTerminal && (!HEALTH_FINISH_REASONS.has(outcome.resultReason ?? '') ||
      (outcome.winnerPlayerId != null && ![identity.leftPlayerId, identity.rightPlayerId].includes(outcome.winnerPlayerId)))) return null;
  const atBoundary = isResolvedHealthBoundary(state, resolvedTurnNumber);
  const ids = [identity.leftPlayerId, identity.rightPlayerId];
  const boundaryMatches = boundaryState && matchesIdentity(boundaryState, identity) &&
    isResolvedHealthBoundary(boundaryState, resolvedTurnNumber) &&
    JSON.stringify(readResolvedHealthOutcome(boundaryState)) === JSON.stringify(outcome) &&
    ids.every((id) => findPlayerByIdentity(boundaryState, id)?.health === findPlayerByIdentity(state, id)?.health &&
      ownNumber(getLastTurnNetByPlayerId(boundaryState), id) === ownNumber(getLastTurnNetByPlayerId(state), id) &&
      ownNumber(getLastTurnDamageByPlayerId(boundaryState), id) === ownNumber(getLastTurnDamageByPlayerId(state), id) &&
      ownNumber(getLastTurnHealByPlayerId(boundaryState), id) === ownNumber(getLastTurnHealByPlayerId(state), id));
  const boundaryCap = (id: string): unknown => atBoundary && positive(findPlayerByIdentity(state, id)?.maxHealth)
    ? findPlayerByIdentity(state, id).maxHealth
    : boundaryMatches ? findPlayerByIdentity(boundaryState, id)?.maxHealth : undefined;
  const live = args.liveCapture;
  const liveHistory = live && live.state === state && live.continuityKey === continuityKey &&
    live.resolvedTurnNumber === resolvedTurnNumber && history?.gameId === identity.gameId &&
    getResolvedHealthIdentityKey(live.identity) === getResolvedHealthIdentityKey(identity)
      ? history.turns.filter((row) => row.turnNumber === resolvedTurnNumber) : [];
  // Complete direct boundary facts do not depend on archive availability/detail.
  const matchingHistory = ids.every((id) => positive(boundaryCap(id))) ? null
    : liveHistory.length === 1 ? liveHistory[0] : null;
  if (!atBoundary && !boundaryMatches && !matchingHistory) return null;
  // History may corroborate a cap for an identified resolution, but never a later turn's totals.
  if (!atBoundary && getTurnNumber(state) !== resolvedTurnNumber + 1) return null;
  const damage = getLastTurnDamageByPlayerId(state);
  const healing = getLastTurnHealByPlayerId(state);
  const net = getLastTurnNetByPlayerId(state);
  const side = (playerId: string) => {
    const player = findPlayerByIdentity(state, playerId);
    if (!player || getPlayerIdentityKey(player) !== playerId || player.role !== 'player') return null;
    const historyPlayers = matchingHistory?.players.filter((row) => row.playerId === playerId);
    const summary = historyPlayers?.length === 1 ? historyPlayers[0] : null;
    const analysis = matchingHistory?.analysisByPlayerId?.[playerId];
    if (matchingHistory && (!summary || summary.healthEnd !== player.health ||
        summary.healthDelta !== ownNumber(net, playerId) || analysis?.netHealthDelta !== summary.healthDelta ||
        analysis?.damageTaken !== ownNumber(damage, playerId) || analysis?.healReceived !== ownNumber(healing, playerId))) return null;
    return buildSide({ playerId, finalHealth: player.health,
      actualNetDelta: ownNumber(net, playerId), damageTaken: ownNumber(damage, playerId),
      grossHealingReceived: ownNumber(healing, playerId),
      maxHealth: positive(boundaryCap(playerId)) ? boundaryCap(playerId) : summary?.maxHealthEnd });
  };
  const left = side(identity.leftPlayerId);
  const right = side(identity.rightPlayerId);
  if (!left || !right) return null;
  return Object.freeze({ identity: Object.freeze({ ...identity }), continuityKey,
    presentationKey: getHealthResolutionPresentationKey(identity.gameId, String(resolvedTurnNumber)), resolvedTurnNumber,
    source, eligibility: 'live', left, right, outcome });
}

export function buildSettledHealthPresentation(state: any, identity: ResolvedHealthIdentity | null): ResolvedHealthPresentation | null {
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
