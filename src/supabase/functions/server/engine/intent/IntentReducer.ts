/**
 * INTENT REDUCER
 * 
 * Deterministic intent application with commit/reveal protocol.
 * 
 * Rules:
 * - Always use sessionPlayerId (ignore client-sent playerId)
 * - Validate player participation and role
 * - Enforce turn number matching
 * - Call syncPhaseFields after mutations
 * - Return ok/state/events or rejection
 * 
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ARCHITECTURAL BOUNDARY:
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 
 * IntentReducer handles commit/reveal enforcement and state mutation only.
 * Battle/effect resolution is triggered by phase entry via onEnterPhase → engine_shared resolvePhase.
 * Authoritative rules/effects live in engine_shared (not /game/**).
 * 
 * This reducer focuses on:
 *   ✓ Commit/reveal protocol enforcement
 *   ✓ State mutation (ships, health, resources)
 *   ✓ Phase advancement and readiness tracking
 *   ✓ Turn order and player validation
 * 
 * This reducer DOES NOT:
 *   ✗ Calculate damage/healing values
 *   ✗ Apply survivability rules
 *   ✗ Process battle phases (FirstStrike, Resolution, etc.)
 *   ✗ Interpret ship power definitions
 */

import { advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import { syncPhaseFields } from '../phase/syncPhaseFields.ts';
import { accrueClocks } from '../clock/clock.ts';
import { buildPhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { resolvePowerAction } from '../../engine_shared/resolve/resolvePowerAction.ts';
import { applyEffects, type EffectEvent } from '../../engine_shared/effects/applyEffects.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { rollD6 } from '../util/rollD6.ts';
import { resolveBuildSubmitAuthoritatively } from './buildSubmitResolution.ts';
import {
  createBattleLogBattleCaptureEventsFromResolution,
  createBattleLogBuildCaptureEventsFromResolution,
  createBattleLogBuildRerollCaptureEvents,
} from '../state/battleLogHistory.ts';

import {
  type IntentType,
  type SpeciesRevealPayload,
  type BuildRevealPayload,
  type BuildSubmitPayload,
  type EvolverBuildChoiceEntry,
  type BattleRevealPayload,
  type ActionPayload,
  type ActionsBatchPayload,
  type BattleWindow,
  RejectionCode,
  getSpeciesCommitKey,
  getBuildCommitKey,
  getBattleCommitKey,
} from './IntentTypes.ts';
import { validateReveal } from './Hash.ts';
import {
  storeCommit,
  storeReveal,
  getCommitRecord,
  hasCommitted,
  hasRevealed,
  allPlayersRevealed,
  allCommittedPlayersRevealed,
} from './CommitStore.ts';
import type { ShipInstance } from '../state/GameStateTypes.ts';

export interface IntentRequest {
  gameId: string;
  intentType: IntentType;
  turnNumber: number;
  
  // Commit fields
  commitHash?: string;
  
  // Reveal fields
  payload?: any;
  nonce?: string;
}

export interface IntentResult {
  ok: boolean;
  state: any;
  events: any[];
  rejected?: {
    code: string;
    message: string;
  };
}

function countCreatedShipsFromEffects(effects: any[] | undefined): number {
  if (!Array.isArray(effects)) return 0;
  return effects.filter((effect: any) => effect?.kind === 'CreateShip').length;
}

function getEffectEventsFromOutcomeEvents(events: any[] | undefined): EffectEvent[] {
  if (!Array.isArray(events)) return [];
  return events.filter((event: any): event is EffectEvent => event?.type === 'EFFECT_APPLIED');
}

function incrementShipsMadeThisTurnCounter(
  state: any,
  playerId: string,
  amount: number
) {
  if (!Number.isInteger(amount) || amount <= 0) return;

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const currentMap = state.gameData.turnData.shipsMadeThisTurnByPlayerId || {};
  const currentCount = currentMap[playerId] || 0;

  state.gameData.turnData.shipsMadeThisTurnByPlayerId = {
    ...currentMap,
    [playerId]: currentCount + amount,
  };
}

function countFleetShipsByDefId(state: any, playerId: string, shipDefId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  let count = 0;
  for (const ship of fleet) {
    if (ship?.shipDefId === shipDefId) count++;
  }
  return count;
}

function clearPendingDrawOfferState(state: any) {
  if (!state.gameData) state.gameData = {};
  state.gameData.pendingDrawOffer = null;

  if ('drawAgreement' in state.gameData) {
    state.gameData.drawAgreement = null;
  }
}

function getLegacyCompatiblePendingDrawOffer(state: any) {
  const pendingDrawOffer = state?.gameData?.pendingDrawOffer;
  if (
    pendingDrawOffer &&
    typeof pendingDrawOffer.offererPlayerId === 'string' &&
    typeof pendingDrawOffer.offereePlayerId === 'string'
  ) {
    return pendingDrawOffer;
  }

  const offeredBy = state?.gameData?.drawAgreement?.offeredBy;
  if (typeof offeredBy !== 'string' || offeredBy.length === 0) {
    return null;
  }

  const activePlayers = Array.isArray(state?.players)
    ? state.players.filter((player: any) => player?.role === 'player')
    : [];
  const offeree = activePlayers.find((player: any) => player?.id !== offeredBy);

  if (!offeree?.id) {
    return null;
  }

  return {
    offererPlayerId: offeredBy,
    offereePlayerId: offeree.id,
    offeredTurnNumber: state?.gameData?.turnNumber ?? state?.turnNumber ?? 0,
  };
}

function finishGameWithCanonicalResult(args: {
  state: any;
  result: 'win' | 'draw';
  winnerPlayerId: string | null;
  resultReason: 'resignation' | 'agreement';
  nowMs: number;
  events: any[];
}): IntentResult {
  const { state, result, winnerPlayerId, resultReason, nowMs, events } = args;

  state.status = 'finished';
  state.winnerPlayerId = winnerPlayerId;
  state.result = result;
  state.resultReason = resultReason;
  clearPendingDrawOfferState(state);

  events.push({
    type: 'GAME_OVER',
    result,
    resultReason,
    winnerPlayerId,
    atMs: nowMs,
  });

  const syncedState = syncPhaseFields(state);

  return {
    ok: true,
    state: syncedState,
    events,
  };
}

function getKnoRerollPassIndex(state: any): 1 | 2 {
  return state?.gameData?.turnData?.knoRerollPassIndex === 2 ? 2 : 1;
}

function getKnoCountForPlayer(state: any, playerId: string): number {
  return countFleetShipsByDefId(state, playerId, 'KNO');
}

function playerHasKnoRerollForPass(state: any, playerId: string, passIndex: 1 | 2): boolean {
  return getKnoCountForPlayer(state, playerId) >= passIndex;
}

function hasAnyKnoSecondPass(state: any): boolean {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) => getKnoCountForPlayer(state, player.id) >= 2);
}

function getRepresentativeKnoInstanceIdForPass(
  state: any,
  playerId: string,
  passIndex: 1 | 2
): string | null {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  const knoInstanceIds = Array.isArray(fleet)
    ? fleet
      .filter((ship: any) => ship?.shipDefId === 'KNO' && typeof ship?.instanceId === 'string')
      .map((ship: any) => ship.instanceId)
      .sort((a: string, b: string) => a.localeCompare(b))
    : [];

  if (knoInstanceIds.length === 0) return null;
  return knoInstanceIds[passIndex - 1] ?? knoInstanceIds[0];
}

function recomputeDiceReadState(state: any, baseDice: number) {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  const effectiveByPlayerId: Record<string, number> = {};
  const overrideSourceByPlayerId: Record<string, string> = {};

  for (const player of activePlayers) {
    const fleet = state?.gameData?.ships?.[player.id] ?? [];
    const hasLeviathan = Array.isArray(fleet) && fleet.some((ship: any) => ship?.shipDefId === 'LEV');

    if (hasLeviathan) {
      effectiveByPlayerId[player.id] = 6;
      overrideSourceByPlayerId[player.id] = 'LEV';
    } else {
      effectiveByPlayerId[player.id] = baseDice;
    }
  }

  return { effectiveByPlayerId, overrideSourceByPlayerId };
}

function stageKnoRerollChoice(
  state: any,
  playerId: string,
  sourceInstanceId: string,
  actionId: string,
  choiceId: string
) {
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'build.dice_roll') {
    throw new Error('WRONG_PHASE');
  }
  if (actionId !== 'KNO#0') {
    throw new Error('INVALID_KNO_ACTION');
  }
  if (choiceId !== 'reroll' && choiceId !== 'hold') {
    throw new Error('INVALID_KNO_CHOICE');
  }

  const passIndex = getKnoRerollPassIndex(state);
  if (!playerHasKnoRerollForPass(state, playerId, passIndex)) {
    throw new Error('KNO_REROLL_NOT_AVAILABLE');
  }

  const representativeSourceInstanceId = getRepresentativeKnoInstanceIdForPass(state, playerId, passIndex);
  if (!representativeSourceInstanceId || representativeSourceInstanceId !== sourceInstanceId) {
    throw new Error('INVALID_KNO_SOURCE');
  }

  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const pendingByPlayerId = state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId || {};
  const playerPending = pendingByPlayerId[playerId] || {};
  state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId = {
    ...pendingByPlayerId,
    [playerId]: {
      ...playerPending,
      [passIndex]: choiceId,
    },
  };
}

function clearResolvedKnoPassChoices(state: any, passIndex: 1 | 2) {
  const pendingByPlayerId = state?.gameData?.turnData?.pendingKnoRerollChoiceByPassByPlayerId;
  if (!pendingByPlayerId) return;

  const nextPendingByPlayerId: Record<string, Partial<Record<1 | 2, 'reroll' | 'hold'>>> = {};
  for (const [playerId, choicesByPass] of Object.entries(pendingByPlayerId)) {
    const nextChoicesByPass = { ...(choicesByPass as Partial<Record<1 | 2, 'reroll' | 'hold'>>) };
    delete nextChoicesByPass[passIndex];
    if (Object.keys(nextChoicesByPass).length > 0) {
      nextPendingByPlayerId[playerId] = nextChoicesByPass;
    }
  }

  state.gameData.turnData.pendingKnoRerollChoiceByPassByPlayerId = nextPendingByPlayerId;
}

function resolvePendingKnoRerollPass(state: any, nowMs: number, events: any[]) {
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const turnData = state.gameData.turnData;
  const passIndex = getKnoRerollPassIndex(state);
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const eligiblePlayerIds = activePlayers
    .map((player: any) => player.id)
    .filter((currentPlayerId: string) => playerHasKnoRerollForPass(state, currentPlayerId, passIndex));

  if (eligiblePlayerIds.length === 0) {
    turnData.diceFinalized = passIndex === 2 || !hasAnyKnoSecondPass(state);
    return state;
  }

  const pendingByPlayerId = turnData.pendingKnoRerollChoiceByPassByPlayerId || {};
  const rerollingPlayerIds = eligiblePlayerIds.filter((currentPlayerId: string) => {
    const playerChoices = pendingByPlayerId[currentPlayerId] || {};
    return playerChoices[passIndex] === 'reroll';
  });
  const anyReroll = eligiblePlayerIds.some((currentPlayerId: string) => {
    const playerChoices = pendingByPlayerId[currentPlayerId] || {};
    return playerChoices[passIndex] === 'reroll';
  });

  if (anyReroll) {
    const baseValueBeforeReroll = turnData.baseDiceRoll ?? turnData.effectiveDiceRoll ?? turnData.diceRoll ?? 0;
    const nextBaseDice = rollD6();
    const { effectiveByPlayerId, overrideSourceByPlayerId } = recomputeDiceReadState(state, nextBaseDice);

    turnData.baseDiceRoll = nextBaseDice;
    turnData.effectiveDiceRoll = nextBaseDice;
    turnData.diceRoll = nextBaseDice;
    turnData.diceRolled = true;
    turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
    if (Object.keys(overrideSourceByPlayerId).length > 0) {
      turnData.diceOverrideSourceByPlayerId = overrideSourceByPlayerId;
    } else {
      delete turnData.diceOverrideSourceByPlayerId;
    }
    state.gameData.diceRoll = nextBaseDice;

    events.push({
      type: 'DICE_ROLLED',
      value: nextBaseDice,
      turnNumber: state.gameData.turnNumber || 1,
      atMs: nowMs
    });
    events.push(
      ...createBattleLogBuildRerollCaptureEvents({
        turnNumber: state.gameData.turnNumber || 1,
        baseValueBeforeReroll,
        rerollingPlayerIds,
        newValue: nextBaseDice,
      }),
    );
  }

  clearResolvedKnoPassChoices(state, passIndex);
  turnData.diceFinalized = passIndex === 2 || !hasAnyKnoSecondPass(state);

  return state;
}

function validateEvolverChoicesPayload(
  payload: BuildSubmitPayload,
  totalEvolverCount: number,
  totalXenCount: number
): { ok: true; choices: EvolverBuildChoiceEntry[] } | { ok: false; message: string } {
  if (payload.evolverChoices === undefined) {
    return { ok: true, choices: [] };
  }

  if (!Array.isArray(payload.evolverChoices)) {
    return { ok: false, message: 'Invalid build payload: evolverChoices must be an array' };
  }

  if (payload.evolverChoices.length > totalEvolverCount) {
    return {
      ok: false,
      message: `Invalid evolverChoices length: expected at most ${totalEvolverCount}, got ${payload.evolverChoices.length}`,
    };
  }

  const seenSourceKeys = new Set<string>();
  let nonHoldCount = 0;

  for (const entry of payload.evolverChoices) {
    if (!entry || typeof entry !== 'object') {
      return { ok: false, message: 'Invalid evolverChoices entry: expected object' };
    }

    if (typeof entry.sourceKey !== 'string' || entry.sourceKey.trim() === '') {
      return { ok: false, message: 'Invalid evolverChoices entry: sourceKey must be a non-empty string' };
    }

    if (seenSourceKeys.has(entry.sourceKey)) {
      return { ok: false, message: `Duplicate evolverChoices sourceKey: ${entry.sourceKey}` };
    }
    seenSourceKeys.add(entry.sourceKey);

    if (entry.choiceId !== 'hold' && entry.choiceId !== 'oxite' && entry.choiceId !== 'asterite') {
      return {
        ok: false,
        message: `Invalid evolver choiceId: ${String((entry as any).choiceId)}. Must be hold, oxite, or asterite.`,
      };
    }

    if (entry.choiceId !== 'hold') {
      nonHoldCount++;
    }
  }

  if (nonHoldCount > totalXenCount) {
    return {
      ok: false,
      message: `Invalid evolverChoices: requested ${nonHoldCount} conversions but only ${totalXenCount} Xenite(s) are available.`,
    };
  }

  return { ok: true, choices: payload.evolverChoices };
}

/**
 * Apply an intent to game state.
 * 
 * @param state - Current game state
 * @param sessionPlayerId - Authenticated player ID (from session)
 * @param intent - Intent request
 * @param nowMs - Current timestamp
 * @returns Result with updated state, events, or rejection
 */
export async function applyIntent(
  state: any,
  sessionPlayerId: string,
  intent: IntentRequest,
  nowMs: number
): Promise<IntentResult> {
  const events: any[] = [];

  if (!state.gameData) state.gameData = {};
  
  // Accrue server-authoritative clocks before applying intent (authoritative timekeeping)
  state = accrueClocks(state, nowMs);
  
  // ============================================================================
  // VALIDATION: Game state
  // ============================================================================
  
  if (!state || state.status === 'finished') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.GAME_FINISHED,
        message: 'Game is finished'
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Player participation
  // ============================================================================
  
  const player = state.players?.find((p: any) => p.id === sessionPlayerId);
  
  if (!player) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.NOT_PARTICIPANT,
        message: 'Player is not a participant in this game'
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Active player guard (PART A - MANDATORY)
  // ============================================================================
  
  // Player-authored intents require active player status
  const playerAuthoredIntents = new Set([
    'SPECIES_SUBMIT',
    'SPECIES_COMMIT',
    'SPECIES_REVEAL',
    'BUILD_COMMIT',
    'BUILD_REVEAL',
    'BUILD_SUBMIT',
    'BATTLE_COMMIT',
    'BATTLE_REVEAL',
    'DECLARE_READY',
    'ACTION',
    'ACTIONS_SUBMIT'
  ]);
  
  if (playerAuthoredIntents.has(intent.intentType)) {
    // Authorization is based on membership/role, not presence.
    // "isActive" is a presence/UI signal and should not wedge gameplay on refresh/reconnect.
    if (player.role !== 'player') {
      console.warn('[IntentReducer] PLAYER_NOT_ACTIVE rejection:', {
        gameId: intent.gameId,
        intentType: intent.intentType,
        sessionId: sessionPlayerId,
        role: player.role,
        isActive: player.isActive,
        reason: 'PLAYER_NOT_ACTIVE'
      });
      
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PLAYER_NOT_ACTIVE,
          message: 'Player is not an active participant in this game'
        }
      };
    }
  }
  
  // ============================================================================
  // VALIDATION: Turn number
  // ============================================================================
  
  const currentTurn = state.gameData?.turnNumber ?? 0;

  // BUILD_SUBMIT is allowed to arrive with a stale client turn due to polling drift.
  // Server is authoritative: normalize to currentTurn before routing.
  if (intent.intentType === 'BUILD_SUBMIT' && intent.turnNumber !== currentTurn) {
    console.warn('[IntentReducer] Normalizing BUILD_SUBMIT turnNumber', {
      provided: intent.turnNumber,
      canonical: currentTurn,
    });
    intent = { ...intent, turnNumber: currentTurn };
  }
  
  if (intent.turnNumber !== currentTurn) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_TURN,
        message: `Expected turn ${currentTurn}, got ${intent.turnNumber}`
      }
    };
  }
  
  // ============================================================================
  // VALIDATION: Phase-based intent gating
  // ============================================================================
  
  // Compute current phase key
  const phaseKey = 
    state.phaseKey ??
    (state.gameData?.currentPhase && state.gameData?.currentSubPhase
      ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
      : null);
  
  // Enforce species selection phase restriction
  if (phaseKey === 'setup.species_selection') {
    const allowedInSpeciesSelection = new Set([
      'SPECIES_SUBMIT',
      'ACTION',        // ✅ allow chat at all times
      'SURRENDER',   // optional, if you want resign to work during setup
    ]);
  
    if (!allowedInSpeciesSelection.has(intent.intentType)) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PHASE_NOT_ALLOWED,
          message: `Intent ${intent.intentType} not allowed during setup.species_selection. Allowed: SPECIES_SUBMIT, ACTION, SURRENDER`
        }
      };
    }
  }
  
  // ============================================================================
  // ROUTE BY INTENT TYPE
  // ============================================================================
  
  switch (intent.intentType) {
    case 'SPECIES_SUBMIT':
      return await handleSpeciesSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'SPECIES_COMMIT':
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DEPRECATED_INTENT,
          message: 'SPECIES_COMMIT is deprecated. Use SPECIES_SUBMIT instead.'
        }
      };
      
    case 'SPECIES_REVEAL':
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DEPRECATED_INTENT,
          message: 'SPECIES_REVEAL is deprecated. Use SPECIES_SUBMIT instead.'
        }
      };
      
    case 'BUILD_COMMIT':
      return await handleBuildCommit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BUILD_REVEAL':
      return await handleBuildReveal(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BUILD_SUBMIT':
      return await handleBuildSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BATTLE_COMMIT':
      return await handleBattleCommit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BATTLE_REVEAL':
      return await handleBattleReveal(state, sessionPlayerId, intent, nowMs, events);
      
    case 'DECLARE_READY':
      return handleDeclareReady(state, sessionPlayerId, intent, nowMs, events);
      
    case 'ACTION':
      return handleAction(state, sessionPlayerId, intent, nowMs, events);
      
    case 'ACTIONS_SUBMIT':
      return handleActionsSubmit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'SURRENDER':
      return handleSurrender(state, sessionPlayerId, intent, nowMs, events);
      
    case 'DRAW_OFFER':
      return handleDrawOffer(state, sessionPlayerId, intent, nowMs, events);
      
    case 'DRAW_ACCEPT':
      return handleDrawAccept(state, sessionPlayerId, intent, nowMs, events);

    case 'DRAW_REFUSE':
      return handleDrawRefuse(state, sessionPlayerId, intent, nowMs, events);
      
    default:
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Unknown intent type: ${intent.intentType}`
        }
      };
  }
}

// ============================================================================
// SPECIES_SELECT (Atomic species selection - no separate commit/reveal)
// ============================================================================

async function handleSpeciesSelect(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can select species
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot select species'
      }
    };
  }
  
  // Must be in setup.species_selection phase
  const currentPhase = state.gameData?.currentPhase ?? state.currentPhase;
  const currentSubPhase = state.gameData?.currentSubPhase ?? state.currentSubPhase;
  
  if (currentPhase !== 'setup' || currentSubPhase !== 'species_selection') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.PHASE_NOT_ALLOWED,
        message: 'Can only select species during setup.species_selection phase'
      }
    };
  }
  
  // Check if player already selected species
  if (player.faction) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Species already selected'
      }
    };
  }
  
  // Validate payload
  if (!intent.payload || typeof intent.payload !== 'object') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as { species: string };
  const validSpecies = ['human', 'xenite', 'centaur', 'ancient'];
  
  if (!payload.species || !validSpecies.includes(payload.species)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.INVALID_SPECIES,
        message: `Invalid species: ${payload.species}`
      }
    };
  }
  
  // Store species selection
  player.faction = payload.species;
  
  events.push({
    type: 'SPECIES_SELECTED',
    playerId,
    species: payload.species,
    atMs: nowMs
  });
  
  // Check if all players have selected species
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const allSelected = activePlayers.every((p: any) => !!p.faction);
  
  if (allSelected) {
    console.log('[SPECIES_SELECT] All players have selected species, auto-advancing...');
    
    const fromKey = state.phaseKey ?? 
      (state.gameData?.currentPhase && state.gameData?.currentSubPhase
        ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
        : 'UNKNOWN');
    
    // Advance phase using core (system-driven) advancement
    const advanceResult = advancePhaseCore(state, nowMs);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      state = syncPhaseFields(state);
      
      const toKey = state.phaseKey ?? 
        (state.gameData?.currentPhase && state.gameData?.currentSubPhase
          ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
          : 'UNKNOWN');
      
      console.log('[SPECIES_SELECT] Phase advanced:', { fromKey, toKey });
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      const phaseKey = getPhaseKey(state);
      if (phaseKey) {
        const onEnterResult = onEnterPhase(state, fromKey, phaseKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      console.error('[SPECIES_SELECT] Phase advance failed:', advanceResult.error);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// SPECIES_SUBMIT
// ============================================================================

async function handleSpeciesSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can submit species
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot submit species'
      }
    };
  }
  
  // Phase gate: SPECIES_SUBMIT only allowed during setup.species_selection
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'setup.species_selection') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'SPECIES_SUBMIT is only allowed during setup.species_selection phase'
      }
    };
  }
  
  if (!intent.payload || !intent.nonce) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload or nonce'
      }
    };
  }
  
  // Validate species payload
  const payload = intent.payload as SpeciesRevealPayload;
  const validSpecies = ['human', 'xenite', 'centaur', 'ancient'];
  
  if (!payload.species || !validSpecies.includes(payload.species)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.INVALID_SPECIES,
        message: `Invalid species: ${payload.species}`
      }
    };
  }
  
  // Idempotent check: if player already has faction set
  if (player.faction) {
    if (player.faction === payload.species) {
      // Same species - treat as no-op success
      console.log('[SPECIES_SUBMIT] applied', { playerId, species: payload.species, idempotent: true });
      
      state = syncPhaseFields(state);
      return {
        ok: true,
        state,
        events: []
      };
    } else {
      // Different species - reject
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.DUPLICATE_COMMIT,
          message: 'Species already selected'
        }
      };
    }
  }
  
  // Immediately set faction on submit (CANONICAL)
  player.faction = payload.species;
  
  console.log('[SPECIES_SUBMIT] applied', { playerId, species: payload.species });
  
  const commitKey = getSpeciesCommitKey(intent.turnNumber);
  
  // Check for duplicate commit
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Species already submitted for this turn'
      }
    };
  }
  
  // Compute commit hash
  const { makeCommitHash } = await import('./Hash.ts');
  const commitHash = await makeCommitHash(intent.payload, intent.nonce);
  
  // Store commit and reveal together (atomic submission)
  storeCommit(state, commitKey, playerId, commitHash, nowMs);
  storeReveal(state, commitKey, playerId, intent.payload, intent.nonce, nowMs);
  
  // Mark player as ready for this phase (stops clock and updates status)
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }
  
  // Upsert readiness entry (one record per player)
  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );
  
  if (existingIndex >= 0) {
    // Update existing record: set ready for current phase
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    // Create new record
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
  
  events.push({
    type: 'SPECIES_SUBMITTED',
    playerId,
    turnNumber: intent.turnNumber,
    atMs: nowMs
  });
  
  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
  
  // Completion check: advance when both players have faction set (not based on commit store)
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const bothChosen = activePlayers.length === 2 && activePlayers.every((p: any) => p.faction != null);
  
  if (bothChosen) {
    console.log('[SPECIES_SUBMIT] both chosen -> advance', { turnNumber: state.gameData.turnNumber });
    
    events.push({
      type: 'SPECIES_RESOLVED',
      turnNumber: intent.turnNumber,
      atMs: nowMs
    });
    
    // Advance phase
    const fromKey = phaseKey;
    
    const advanceResult = advancePhaseCore(state, nowMs);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      state = syncPhaseFields(state);
      
      const toKey = getPhaseKey(state);
      
      console.log(`[SPECIES_SUBMIT] Phase advanced: ${fromKey} → ${toKey}`);
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      if (toKey) {
        const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      console.error(`[SPECIES_SUBMIT] Phase advance blocked: ${advanceResult.error}`);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  } else {
    console.log('[SPECIES_SUBMIT] Waiting for other player(s) to submit...');
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// BUILD_COMMIT
// ============================================================================

async function handleBuildCommit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can commit build
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot commit build'
      }
    };
  }
  
  if (!intent.commitHash) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing commitHash'
      }
    };
  }
  
  const commitKey = getBuildCommitKey(intent.turnNumber);
  
  // Check for duplicate commit
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Build already committed for this turn'
      }
    };
  }
  
  // Store commit
  storeCommit(state, commitKey, playerId, intent.commitHash, nowMs);
  
  events.push({
    type: 'BUILD_COMMITTED',
    playerId,
    turnNumber: intent.turnNumber,
    atMs: nowMs
  });
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// BUILD_REVEAL
// ============================================================================

// Maximum build count per ship type to prevent state bloat
const MAX_BUILD_COUNT = 50;

async function handleBuildReveal(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can reveal build
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot reveal build'
      }
    };
  }
  
  // Phase gate: BUILD_REVEAL only allowed during battle.reveal
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'battle.reveal') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'BUILD_REVEAL is only allowed during battle.reveal phase'
      }
    };
  }
  
  if (!intent.payload || !intent.nonce) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload or nonce'
      }
    };
  }
  
  const commitKey = getBuildCommitKey(intent.turnNumber);
  
  // Check commit exists
  if (!hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.MISSING_COMMIT,
        message: 'No commit found for this player and turn'
      }
    };
  }
  
  // Check not already revealed
  if (hasRevealed(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.ALREADY_REVEALED,
        message: 'Build already revealed'
      }
    };
  }
  
  // Validate hash
  const record = getCommitRecord(state, commitKey, playerId);
  const isValid = await validateReveal(intent.payload, intent.nonce, record!.commitHash!);
  
  if (!isValid) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.HASH_MISMATCH,
        message: 'Reveal hash does not match commit'
      }
    };
  }
  
  // Validate build payload
  const payload = intent.payload as BuildRevealPayload;
  
  if (!payload.builds || !Array.isArray(payload.builds)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Invalid build payload: must have builds array'
      }
    };
  }
  
  // Basic validation of build entries
  for (const build of payload.builds) {
    if (!build.shipDefId || typeof build.shipDefId !== 'string') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: 'Each build must have a valid shipDefId'
        }
      };
    }
    
    // Validate shipDefId exists in authoritative server definitions
    const shipDef = getShipById(build.shipDefId);
    if (!shipDef) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: `Unknown shipDefId: ${build.shipDefId}`
        }
      };
    }
    
    // Validate component ships for Drawing builds (Upgraded ships)
    // Component ships must exist in player's current fleet at time of validation
    if (shipDef.componentShips && shipDef.componentShips.length > 0) {
      const playerFleet = state?.gameData?.ships?.[playerId] || [];
      const fleetShipDefIds = playerFleet.map((s: any) => s.shipDefId);
      
      for (const componentDefId of shipDef.componentShips) {
        const availableCount = fleetShipDefIds.filter((id: string) => id === componentDefId).length;
        const requiredCount = shipDef.componentShips.filter((id: string) => id === componentDefId).length;
        
        if (availableCount < requiredCount) {
          return {
            ok: false,
            state,
            events: [],
            rejected: {
              code: RejectionCode.INVALID_SHIP,
              message: `Cannot build ${build.shipDefId}: requires ${requiredCount}× ${componentDefId}, but only ${availableCount} available in fleet`
            }
          };
        }
      }
    }
    
    // Validate count bounds (FIX 4)
    if (build.count !== undefined) {
      // Check if count is an integer
      if (!Number.isInteger(build.count)) {
        return {
          ok: false,
          state,
          events: [],
          rejected: {
            code: RejectionCode.BAD_PAYLOAD,
            message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be integer 1..${MAX_BUILD_COUNT}`
          }
        };
      }
      
      // Check bounds: 1 <= count <= MAX_BUILD_COUNT
      if (build.count < 1 || build.count > MAX_BUILD_COUNT) {
        return {
          ok: false,
          state,
          events: [],
          rejected: {
            code: RejectionCode.BAD_PAYLOAD,
            message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be integer 1..${MAX_BUILD_COUNT}`
          }
        };
      }
    }
  }
  
  // Store reveal
  storeReveal(state, commitKey, playerId, intent.payload, intent.nonce, nowMs);
  
  events.push({
    type: 'BUILD_REVEALED',
    playerId,
    turnNumber: intent.turnNumber,
    atMs: nowMs
  });
  
  // Check if all players have revealed
  if (allCommittedPlayersRevealed(state, commitKey)) {
    // Resolve builds for all players - create ship instances
    const activePlayers = state.players.filter((p: any) => p.role === 'player');
    
    // Initialize ships storage if needed
    if (!state.gameData) {
      state.gameData = {};
    }
    if (!state.gameData.ships) {
      state.gameData.ships = {};
    }
    
    for (const p of activePlayers) {
      const pRecord = getCommitRecord(state, commitKey, p.id);
      if (pRecord && pRecord.revealPayload) {
        const pPayload = pRecord.revealPayload as BuildRevealPayload;
        
        // Ensure player has a ship array
        if (!state.gameData.ships[p.id]) {
          state.gameData.ships[p.id] = [];
        }
        
        // Create ship instances for each build
        for (const buildEntry of pPayload.builds) {
          const count = buildEntry.count ?? 1;
          
          for (let i = 0; i < count; i++) {
            const shipDef = getShipById(buildEntry.shipDefId);

            const shipInstance: ShipInstance = {
              instanceId: crypto.randomUUID(),
              shipDefId: buildEntry.shipDefId,
              createdTurn: state.gameData.turnNumber
            };
            
            // Initialize charges for ships that have them
            if (shipDef && typeof shipDef.charges === 'number') {
              shipInstance.chargesCurrent = shipDef.charges;
            }
            
            state.gameData.ships[p.id].push(shipInstance);
          }
        }
      }
    }
    
    events.push({
      type: 'BUILD_RESOLVED',
      turnNumber: intent.turnNumber,
      atMs: nowMs
    });
    
    // Auto-advance from battle.reveal once all required reveals are complete
    // IMPORTANT: normalize phase fields first (protects against missing/stale gameData phase fields)
    state = syncPhaseFields(state);

    const currentKey = getPhaseKey(state);
    if (currentKey === 'battle.reveal' && allCommittedPlayersRevealed(state, commitKey)) {
      const fromKey = currentKey;

      const adv = advancePhaseCore(state);

      if (!adv.ok) {
        // Do not silently fail — this is the exact "stuck in battle.reveal" symptom.
        events.push({
          type: 'PHASE_ADVANCE_BLOCKED',
          from: fromKey,
          reason: adv.error,
          atMs: nowMs,
        });

        console.log(`[IntentReducer] BUILD_REVEAL auto-advance blocked: ${adv.error}`);
      } else {
        state = adv.state;

        // Clear readiness on successful phase advance
        state.gameData.phaseReadiness = [];
        state = syncPhaseFields(state);

        const toKey = getPhaseKey(state);

        events.push({
          type: 'PHASE_ADVANCED',
          from: fromKey,
          to: toKey,
          atMs: nowMs
        });

        if (toKey) {
          const onEnter = onEnterPhase(state, fromKey, toKey, nowMs);
          state = onEnter.state;
          events.push(...onEnter.events);
        }
      }
    }
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// BUILD_SUBMIT
// ============================================================================

async function handleBuildSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can submit build
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot submit build'
      }
    };
  }
  
  // B1) Phase gate: BUILD_SUBMIT only allowed during build.drawing
  const phaseKey = getPhaseKey(state);
  if (phaseKey !== 'build.drawing') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'BUILD_SUBMIT is only allowed during build.drawing phase'
      }
    };
  }
  
  // B2) Validate payload
  if (!intent.payload || !intent.nonce) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload or nonce'
      }
    };
  }
  
  const payload = intent.payload as BuildSubmitPayload;
  
  if (!payload.builds || !Array.isArray(payload.builds)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Invalid build payload: must have builds array'
      }
    };
  }
  
  // Basic validation of build entries
  for (const build of payload.builds) {
    if (!build.shipDefId || typeof build.shipDefId !== 'string') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: 'Each build must have a valid shipDefId'
        }
      };
    }
    
    // Validate shipDefId exists in authoritative server definitions
    const shipDef = getShipById(build.shipDefId);
    if (!shipDef) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.INVALID_SHIP,
          message: `Unknown shipDefId: ${build.shipDefId}`
        }
      };
    }
    
    // Validate count is positive integer
    if (!Number.isInteger(build.count) || build.count < 1) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be positive integer.`
        }
      };
    }
    
    // Check bounds: 1 <= count <= MAX_BUILD_COUNT
    if (build.count > MAX_BUILD_COUNT) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Invalid build count for ship ${build.shipDefId}: ${build.count}. Must be 1..${MAX_BUILD_COUNT}`
        }
      };
    }
  }

  // Validate optional Frigate triggers payload
  const frigateBuildCount = payload.builds
    .filter(b => b.shipDefId === 'FRI')
    .reduce((sum, b) => sum + (b.count ?? 0), 0);

  if (payload.frigateTriggers !== undefined) {
    if (!Array.isArray(payload.frigateTriggers)) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Invalid build payload: frigateTriggers must be an array',
        },
      };
    }

    if (payload.frigateTriggers.length !== frigateBuildCount) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: `Invalid frigateTriggers length: expected ${frigateBuildCount}, got ${payload.frigateTriggers.length}`,
        },
      };
    }

    for (const t of payload.frigateTriggers) {
      if (!Number.isInteger(t) || t < 1 || t > 6) {
        return {
          ok: false,
          state,
          events: [],
          rejected: {
            code: RejectionCode.BAD_PAYLOAD,
            message: `Invalid frigateTriggers entry: ${t}. Must be integer 1..6`,
          },
        };
      }
    }
  }

  const existingEvolverCount = countFleetShipsByDefId(state, playerId, 'EVO');
  const existingXenCount = countFleetShipsByDefId(state, playerId, 'XEN');
  const builtEvolverCount = payload.builds
    .filter((build) => build.shipDefId === 'EVO')
    .reduce((sum, build) => sum + build.count, 0);
  const builtXenCount = payload.builds
    .filter((build) => build.shipDefId === 'XEN')
    .reduce((sum, build) => sum + build.count, 0);

  const evolverValidation = validateEvolverChoicesPayload(
    payload,
    existingEvolverCount + builtEvolverCount,
    existingXenCount + builtXenCount
  );

  if (!evolverValidation.ok) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: evolverValidation.message,
      },
    };
  }
  
  // B3) Compute commit hash and store submission
  const turnNumber = intent.turnNumber;
  const commitKey = getBuildCommitKey(turnNumber);
  
  // Check for duplicate commit
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Build already submitted for this turn'
      }
    };
  }
  
  // Compute commit hash
  const { makeCommitHash } = await import('./Hash.ts');
  const commitHash = await makeCommitHash(intent.payload, intent.nonce);
  
  // Store commit and reveal together (atomic submission)
  storeCommit(state, commitKey, playerId, commitHash, nowMs);
  storeReveal(state, commitKey, playerId, intent.payload, intent.nonce, nowMs);
  
  // Mark player as ready for this phase (stops clock and updates status)
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }
  
  // Upsert readiness entry (one record per player)
  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );
  
  if (existingIndex >= 0) {
    // Update existing record: set ready for current phase
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    // Create new record
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
  
  events.push({
    type: 'BUILD_SUBMITTED',
    playerId,
    turnNumber: turnNumber,
    atMs: nowMs
  });
  
  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
  
  // B4) Completion check: if all active players have submitted
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const allSubmitted = activePlayers.every((p: any) => hasRevealed(state, commitKey, p.id));
  
  if (allSubmitted) {
    console.log('[BUILD_SUBMIT] All players submitted, applying builds and advancing phase...');
    
    // Ensure turnData exists (idempotency)
    if (!state.gameData) state.gameData = {};
    if (!state.gameData.turnData) state.gameData.turnData = {};

    const resolution = resolveBuildSubmitAuthoritatively({
      state,
      turnNumber,
      nowMs,
    });
    state = resolution.state;
    events.push(...resolution.events);

    if (resolution.alreadyApplied) {
      console.warn('[BUILD_SUBMIT] Builds already applied for this turn; attempting phase advance only.', {
        turnNumber
      });
    }
    
    events.push({
      type: 'BUILD_RESOLVED',
      turnNumber: turnNumber,
      atMs: nowMs
    });
    
    // B6) Advance phase
    const fromKey = phaseKey;
    
    const advanceResult = advancePhaseCore(state);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      state = syncPhaseFields(state);
      
      const toKey = getPhaseKey(state);
      
      console.log(`[BUILD_SUBMIT] Phase advanced: ${fromKey} → ${toKey}`);
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      if (toKey) {
        const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      console.error(`[BUILD_SUBMIT] Phase advance blocked: ${advanceResult.error}`);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  } else {
    console.log('[BUILD_SUBMIT] Waiting for other player(s) to submit...');
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// BATTLE_COMMIT
// ============================================================================

async function handleBattleCommit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  // TODO: Implement full battle commit/reveal protocol
  // For now, return "not yet implemented"
  return {
    ok: false,
    state,
    events: [],
    rejected: {
      code: RejectionCode.INTERNAL_ERROR,
      message: 'Battle intents not yet implemented'
    }
  };
}

// ============================================================================
// BATTLE_REVEAL
// ============================================================================

async function handleBattleReveal(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  // TODO: Implement full battle reveal protocol
  // When implemented, this should:
  // 1. Validate payload contains declarations array
  // 2. Check if any declarations are present (not empty or all "hold")
  // 3. If ANY player makes declarations, set turnData.anyChargesDeclared = true
  // 4. This flag gates battle.charge_response phase
  // 
  // NOTE: anyChargesDeclared is a turn-scoped gating flag, intentionally unset
  // until battle intents are implemented. Charge Response gating is therefore
  // dormant but correct.
  
  return {
    ok: false,
    state,
    events: [],
    rejected: {
      code: RejectionCode.INTERNAL_ERROR,
      message: 'Battle intents not yet implemented'
    }
  };
}

function stageFirstStrikeSelection(state: any, playerId: string, payload: ActionPayload) {
  if (payload.actionType !== 'power') return;
  if (!state.gameData) state.gameData = {};
  if (!state.gameData.turnData) state.gameData.turnData = {};

  const pending = state.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId || {};
  const playerPending = pending[playerId] || {};

  playerPending[payload.sourceInstanceId!] = {
    actionId: payload.actionId,
    sourceInstanceId: payload.sourceInstanceId!,
    choiceId: payload.choiceId!,
    targetInstanceId: payload.targetInstanceId,
    targetInstanceIds: payload.targetInstanceIds,
  };

  pending[playerId] = playerPending;
  state.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId = pending;
}

function resolvePendingFirstStrikeSelections(state: any, nowMs: number, events: any[]) {
  const pendingByPlayerId = state?.gameData?.turnData?.pendingFirstStrikeSelectionsByPlayerId || {};
  const phaseKey = 'battle.first_strike' as const;
  const stateBeforeResolution = state;
  const selections = Object.entries(pendingByPlayerId)
    .flatMap(([playerId, entries]) => Object.values(entries as Record<string, any>).map((entry: any) => ({ playerId, ...entry })));

  if (selections.length === 0) {
    return state;
  }

  let workingState = state;
  const prepared = selections.map((selection: any) => ({
    selection,
    outcome: resolvePowerAction({
      state,
      playerId: selection.playerId,
      phaseKey,
      actionId: selection.actionId,
      sourceInstanceId: selection.sourceInstanceId,
      choiceId: selection.choiceId,
      targetInstanceId: selection.targetInstanceId,
      targetInstanceIds: selection.targetInstanceIds,
      apply: false,
    })
  }));

  const allEffects = prepared.flatMap((item: any) => item.outcome.effects || []);
  if (allEffects.length > 0) {
    const applied = applyEffects(workingState, allEffects);
    workingState = applied.state;
    events.push(...applied.events);

    const effectEvents = getEffectEventsFromOutcomeEvents(applied.events);
    for (const item of prepared) {
      events.push(
        ...createBattleLogBattleCaptureEventsFromResolution({
          stateBeforeResolution,
          turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
          playerId: item.selection.playerId,
          phaseKey,
          choiceId: item.selection.choiceId,
          effects: item.outcome.effects || [],
          effectEvents,
        }),
      );
    }
  }

  const onceOnlyFiredKeys = prepared.flatMap((item: any) => item.outcome.onceOnlyFiredKeys || []);
  if (onceOnlyFiredKeys.length > 0) {
    if (!workingState.gameData) workingState.gameData = {};
    if (!workingState.gameData.powerMemory) workingState.gameData.powerMemory = {};

    const currentOnceOnlyFired = workingState.gameData.powerMemory.onceOnlyFired || {};
    workingState.gameData.powerMemory.onceOnlyFired = {
      ...currentOnceOnlyFired,
      ...Object.fromEntries(onceOnlyFiredKeys.map((key: string) => [key, true])),
    };
  }

  for (const item of prepared) {
    if (item.outcome.spentCharge) {
      const gd: any = workingState.gameData ?? (workingState.gameData = {});
      const td: any = gd.turnData ?? (gd.turnData = {});
      const turnNumber: number = gd.turnNumber ?? (workingState as any).turnNumber ?? 1;
      const usedMap: Record<string, number> = td.chargePowerUsedByInstanceId || {};
      td.chargePowerUsedByInstanceId = {
        ...usedMap,
        [item.selection.sourceInstanceId]: turnNumber,
      };
    }

    events.push({
      type: 'POWER_USED',
      playerId: item.selection.playerId,
      phaseKey,
      actionId: item.selection.actionId,
      sourceInstanceId: item.selection.sourceInstanceId,
      choiceId: item.selection.choiceId,
      targetInstanceId: item.selection.targetInstanceId,
      targetInstanceIds: item.selection.targetInstanceIds,
      spentCharge: item.outcome.spentCharge,
      atMs: nowMs,
    });
  }

  if (!workingState.gameData) workingState.gameData = {};
  if (!workingState.gameData.turnData) workingState.gameData.turnData = {};
  delete workingState.gameData.turnData.pendingFirstStrikeSelectionsByPlayerId;

  return workingState;
}

// ============================================================================
// DECLARE_READY
// ============================================================================

function handleDeclareReady(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  // Get stable phase key
  const phaseKey = getPhaseKey(state);
  
  if (!phaseKey) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.WRONG_PHASE,
        message: 'Cannot determine current phase'
      }
    };
  }
  
  // Validate turn number matches current server turn (reject stale DECLARE_READY)
  const stateTurnNumber = state?.gameData?.turnData?.turnNumber ?? state?.gameData?.turnNumber ?? state?.turnNumber;
  const intentTurnNumber = intent.turnNumber;
  
  if (intentTurnNumber !== stateTurnNumber) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_TURN,
        message: `Stale DECLARE_READY: intent turn ${intentTurnNumber} but current turn is ${stateTurnNumber}`
      }
    };
  }
  
  // Ensure phaseReadiness array exists
  if (!state.gameData) {
    state.gameData = {};
  }
  if (!state.gameData.phaseReadiness) {
    state.gameData.phaseReadiness = [];
  }
  
  // Upsert readiness entry (FIX 1: one record per player)
  const existingIndex = state.gameData.phaseReadiness.findIndex(
    (r: any) => r.playerId === playerId
  );
  
  if (existingIndex >= 0) {
    // Update existing record: set ready for current phase
    state.gameData.phaseReadiness[existingIndex].isReady = true;
    state.gameData.phaseReadiness[existingIndex].currentStep = phaseKey;
  } else {
    // Create new record
    state.gameData.phaseReadiness.push({
      playerId,
      isReady: true,
      currentStep: phaseKey
    });
  }
  
  events.push({
    type: 'PLAYER_READY',
    playerId,
    step: phaseKey,
    atMs: nowMs
  });
  
  // Check if all active players are ready for current phase
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const readyPlayers = state.gameData.phaseReadiness.filter(
    (r: any) => r.currentStep === phaseKey && r.isReady
  );
  
  const allReady = activePlayers.length > 0 && 
    activePlayers.every((p: any) => 
      readyPlayers.some((r: any) => r.playerId === p.id)
    );
  
  if (allReady) {
    console.log(`[IntentReducer] All players ready for ${phaseKey}, advancing phase...`);

    if (phaseKey === 'battle.first_strike') {
      state = resolvePendingFirstStrikeSelections(state, nowMs, events);
    }
    if (phaseKey === 'build.dice_roll') {
      state = resolvePendingKnoRerollPass(state, nowMs, events);
    }
    
    // Store current phase key for onEnterPhase
    const fromKey = phaseKey;
    
    // Advance phase using canonical phase engine
    const advanceResult = advancePhaseCore(state);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // FIX 3: Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      events.push(...advanceResult.events);
      
      // Sync phase fields
      state = syncPhaseFields(state);
      
      // Get new phase key
      const toKey = getPhaseKey(state);
      
      console.log(`[IntentReducer] Phase advanced: ${fromKey} → ${toKey}`);
      
      events.push({
        type: 'PHASE_ADVANCED',
        from: fromKey,
        to: toKey,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      if (toKey) {
        const onEnterResult = onEnterPhase(state, fromKey, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
      }
    } else {
      // FIX 2: Emit event when phase advance is blocked
      console.log(`[IntentReducer] Phase advance blocked: ${advanceResult.error}`);
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from: fromKey,
        reason: advanceResult.error,
        atMs: nowMs
      });
      
      // Don't fail the DECLARE_READY - just emit event for debugging
    }
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// ACTION (message + power scaffold)
// ============================================================================

function handleAction(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  if (!intent.payload) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as ActionPayload;
  
  // Handle message actions
  if (payload.actionType === 'message') {
    if (!payload.content || typeof payload.content !== 'string') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing or invalid message content'
        }
      };
    }
    
    // Emit CHAT_MESSAGE event for route layer to persist separately
    const player = state.players.find((p: any) => p.id === playerId);
    
    events.push({
      type: 'CHAT_MESSAGE',
      chatEntryType: 'message',
      playerId,
      playerName: player?.name || 'Unknown',
      content: payload.content,
      timestamp: nowMs
    });
    
    state = syncPhaseFields(state);
    
    return {
      ok: true,
      state,
      events
    };
  }
  
  // Handle power actions
  if (payload.actionType === 'power') {
    // ============================================================================
    // VALIDATION: Required fields
    // ============================================================================
    if (!payload.actionId || typeof payload.actionId !== 'string' || payload.actionId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing actionId'
        }
      };
    }
    
    if (!payload.sourceInstanceId || typeof payload.sourceInstanceId !== 'string' || payload.sourceInstanceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing sourceInstanceId'
        }
      };
    }
    
    if (!payload.choiceId || typeof payload.choiceId !== 'string' || payload.choiceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing choiceId'
        }
      };
    }
    
    // ============================================================================
    // DELEGATE TO RESOLVER (timing enforced there)
    // ============================================================================
    const phaseKey = getPhaseKey(state);
    if (!phaseKey) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Cannot determine current phase'
        }
      };
    }
    
    try {
      if (phaseKey === 'build.dice_roll') {
        stageKnoRerollChoice(
          state,
          playerId,
          payload.sourceInstanceId,
          payload.actionId,
          payload.choiceId
        );
        state = syncPhaseFields(state);

        return {
          ok: true,
          state,
          events
        };
      }

      if (phaseKey === 'battle.first_strike') {
        resolvePowerAction({
          state,
          playerId,
          phaseKey,
          actionId: payload.actionId,
          sourceInstanceId: payload.sourceInstanceId,
          choiceId: payload.choiceId,
          targetInstanceId: payload.targetInstanceId,
          targetInstanceIds: payload.targetInstanceIds,
          apply: false,
        });

        stageFirstStrikeSelection(state, playerId, payload);
        state = syncPhaseFields(state);

        return {
          ok: true,
          state,
          events
        };
      }

      const stateBeforeResolution = state;
      const outcome = resolvePowerAction({
        state,
        playerId,
        phaseKey,
        actionId: payload.actionId,
        sourceInstanceId: payload.sourceInstanceId,
        choiceId: payload.choiceId,
        targetInstanceId: payload.targetInstanceId,
        targetInstanceIds: payload.targetInstanceIds,
      });
      
      state = outcome.state;
      const effectEvents = getEffectEventsFromOutcomeEvents(outcome.events);

      if (phaseKey === 'build.ships_that_build') {
        incrementShipsMadeThisTurnCounter(
          state,
          playerId,
          countCreatedShipsFromEffects(outcome.effects)
        );
        events.push(
          ...createBattleLogBuildCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }

      if (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') {
        events.push(
          ...createBattleLogBattleCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            phaseKey,
            choiceId: payload.choiceId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }
      
      // ============================================================================
      // FLIP DECLARATION-SPENT FLAG (only in charge_declaration)
      // ============================================================================
      if (phaseKey === 'battle.charge_declaration' && outcome.spentCharge === true) {
        // Ensure turnData exists
        if (!state.gameData) state.gameData = {};
        if (!state.gameData.turnData) state.gameData.turnData = {};
        
        state.gameData.turnData.anyChargesSpentInDeclaration = true;
      }
      
      // ============================================================================
      // EMIT GENERIC EVENT
      // ============================================================================
      events.push({
        type: 'POWER_USED',
        playerId,
        phaseKey,
        actionId: payload.actionId,
        sourceInstanceId: payload.sourceInstanceId,
        choiceId: payload.choiceId,
        targetInstanceId: payload.targetInstanceId,
        targetInstanceIds: payload.targetInstanceIds,
        spentCharge: outcome.spentCharge,
        atMs: nowMs
      });
      
      state = syncPhaseFields(state);
      
      return {
        ok: true,
        state,
        events
      };
    } catch (err: any) {
      // ============================================================================
      // ERROR → REJECTION MAPPING
      // ============================================================================
      const msg = err?.message ?? String(err);
      
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? RejectionCode.CHARGE_ALREADY_USED_THIS_TURN
            : RejectionCode.BAD_PAYLOAD,
          message: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? 'This ship has already used a charge this turn.'
            : msg
        }
      };
    }
  }
  
  // Unknown action type
  return {
    ok: false,
    state,
    events: [],
    rejected: {
      code: RejectionCode.BAD_PAYLOAD,
      message: 'Unsupported action type'
    }
  };
}

// ============================================================================
// ACTIONS_SUBMIT (batch power actions)
// ============================================================================

function handleActionsSubmit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  // ============================================================================
  // VALIDATION: Payload structure
  // ============================================================================
  if (!intent.payload) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Missing payload'
      }
    };
  }
  
  const payload = intent.payload as ActionsBatchPayload;
  
  if (!Array.isArray(payload.actions)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Payload must have actions array'
      }
    };
  }
  
  // ============================================================================
  // GET CURRENT PHASE
  // ============================================================================
  const phaseKey = getPhaseKey(state);
  if (!phaseKey) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot determine current phase'
      }
    };
  }
  
  // ============================================================================
  // BATCH PROCESSING: Apply each action atomically
  // ============================================================================
  for (const item of payload.actions) {
    // Validate action type
    if (item.actionType !== 'power') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Only power actions are supported in batch'
        }
      };
    }
    
    // Validate required fields
    if (!item.actionId || typeof item.actionId !== 'string' || item.actionId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing actionId'
        }
      };
    }
    
    if (!item.sourceInstanceId || typeof item.sourceInstanceId !== 'string' || item.sourceInstanceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing sourceInstanceId'
        }
      };
    }
    
    if (!item.choiceId || typeof item.choiceId !== 'string' || item.choiceId.trim() === '') {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.BAD_PAYLOAD,
          message: 'Missing choiceId'
        }
      };
    }
    
    try {
      if (phaseKey === 'build.dice_roll') {
        stageKnoRerollChoice(
          state,
          playerId,
          item.sourceInstanceId,
          item.actionId,
          item.choiceId
        );
        continue;
      }

      if (phaseKey === 'battle.first_strike') {
        resolvePowerAction({
          state,
          playerId,
          phaseKey,
          actionId: item.actionId,
          sourceInstanceId: item.sourceInstanceId,
          choiceId: item.choiceId,
          targetInstanceId: item.targetInstanceId,
          targetInstanceIds: item.targetInstanceIds,
          apply: false,
        });

        stageFirstStrikeSelection(state, playerId, item);
        continue;
      }

      const stateBeforeResolution = state;
      const outcome = resolvePowerAction({
        state,
        playerId,
        phaseKey,
        actionId: item.actionId,
        sourceInstanceId: item.sourceInstanceId,
        choiceId: item.choiceId,
        targetInstanceId: item.targetInstanceId,
        targetInstanceIds: item.targetInstanceIds,
      });

      state = outcome.state;
      const effectEvents = getEffectEventsFromOutcomeEvents(outcome.events);

      if (phaseKey === 'build.ships_that_build') {
        incrementShipsMadeThisTurnCounter(
          state,
          playerId,
          countCreatedShipsFromEffects(outcome.effects)
        );
        events.push(
          ...createBattleLogBuildCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }

      if (phaseKey === 'battle.charge_declaration' || phaseKey === 'battle.charge_response') {
        events.push(
          ...createBattleLogBattleCaptureEventsFromResolution({
            stateBeforeResolution,
            turnNumber: stateBeforeResolution?.gameData?.turnNumber || 1,
            playerId,
            phaseKey,
            choiceId: item.choiceId,
            effects: outcome.effects || [],
            effectEvents,
          }),
        );
      }

      if (phaseKey === 'battle.charge_declaration' && outcome.spentCharge === true) {
        if (!state.gameData) state.gameData = {};
        if (!state.gameData.turnData) state.gameData.turnData = {};

        state.gameData.turnData.anyChargesSpentInDeclaration = true;
      }

      events.push({
        type: 'POWER_USED',
        playerId,
        phaseKey,
        actionId: item.actionId,
        sourceInstanceId: item.sourceInstanceId,
        choiceId: item.choiceId,
        targetInstanceId: item.targetInstanceId,
        targetInstanceIds: item.targetInstanceIds,
        spentCharge: outcome.spentCharge,
        atMs: nowMs
      });
    } catch (err: any) {
      // ERROR → Atomic rejection (entire batch fails)
      const msg = err?.message ?? String(err);
      
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? RejectionCode.CHARGE_ALREADY_USED_THIS_TURN
            : RejectionCode.BAD_PAYLOAD,
          message: msg === 'CHARGE_ALREADY_USED_THIS_TURN'
            ? 'This ship has already used a charge this turn.'
            : msg
        }
      };
    }
  }
  
  // ============================================================================
  // BATCH COMPLETION: Emit wrapper event and sync once
  // ============================================================================
  if (phaseKey !== 'build.dice_roll') {
    events.push({
      type: 'POWERS_BATCH_SUBMITTED',
      playerId,
      phaseKey,
      count: payload.actions.length,
      atMs: nowMs
    });
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// SURRENDER
// ============================================================================

function handleSurrender(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can surrender
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot surrender'
      }
    };
  }
  
  // Find opponent
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const opponent = activePlayers.find((p: any) => p.id !== playerId);
  
  if (!opponent) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot surrender: no opponent found'
      }
    };
  }

  return finishGameWithCanonicalResult({
    state,
    result: 'win',
    winnerPlayerId: opponent.id,
    resultReason: 'resignation',
    nowMs,
    events,
  });
}

// ============================================================================
// DRAW_OFFER
// ============================================================================

function handleDrawOffer(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can offer a draw
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot offer a draw'
      }
    };
  }

  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const opponent = activePlayers.find((p: any) => p.id !== playerId);

  if (!opponent) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Cannot offer a draw: no opponent found'
      }
    };
  }

  if (getLegacyCompatiblePendingDrawOffer(state)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'A draw offer is already pending'
      }
    };
  }

  const currentTurn = state.gameData?.turnNumber ?? state.turnNumber ?? 0;
  const lastDrawOfferTurn = state.gameData?.lastDrawOfferTurnByPlayerId?.[playerId];
  if (lastDrawOfferTurn === currentTurn) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'You have already offered a draw this turn'
      }
    };
  }

  if (!state.gameData) {
    state.gameData = {};
  }

  state.gameData.pendingDrawOffer = {
    offererPlayerId: playerId,
    offereePlayerId: opponent.id,
    offeredTurnNumber: currentTurn,
  };
  state.gameData.lastDrawOfferTurnByPlayerId = {
    ...(state.gameData.lastDrawOfferTurnByPlayerId ?? {}),
    [playerId]: currentTurn,
  };
  state.gameData.drawAgreement = {
    offeredBy: playerId,
    acceptedBy: [playerId],
  };

  events.push({
    type: 'DRAW_OFFERED',
    playerId,
    offereePlayerId: opponent.id,
    atMs: nowMs
  });

  state = syncPhaseFields(state);

  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// DRAW_ACCEPT
// ============================================================================

function handleDrawAccept(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can accept a draw
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot accept a draw'
      }
    };
  }

  const pendingDrawOffer = getLegacyCompatiblePendingDrawOffer(state);
  if (!pendingDrawOffer) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'No active draw offer'
      }
    };
  }

  if (pendingDrawOffer.offereePlayerId !== playerId) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Only the offeree may accept the pending draw offer'
      }
    };
  }

  const acceptedBy = state.gameData?.drawAgreement?.acceptedBy || [];
  if (!acceptedBy.includes(playerId)) {
    acceptedBy.push(playerId);
    if (!state.gameData.drawAgreement) {
      state.gameData.drawAgreement = {
        offeredBy: pendingDrawOffer.offererPlayerId,
        acceptedBy,
      };
    } else {
      state.gameData.drawAgreement.acceptedBy = acceptedBy;
    }
  }

  events.push({
    type: 'DRAW_ACCEPTED',
    playerId,
    atMs: nowMs
  });

  return finishGameWithCanonicalResult({
    state,
    result: 'draw',
    winnerPlayerId: null,
    resultReason: 'agreement',
    nowMs,
    events,
  });
}

// ============================================================================
// DRAW_REFUSE
// ============================================================================

function handleDrawRefuse(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): IntentResult {
  const player = state.players.find((p: any) => p.id === playerId);

  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot refuse a draw'
      }
    };
  }

  const pendingDrawOffer = getLegacyCompatiblePendingDrawOffer(state);
  if (!pendingDrawOffer) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'No active draw offer'
      }
    };
  }

  if (pendingDrawOffer.offereePlayerId !== playerId) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: 'Only the offeree may refuse the pending draw offer'
      }
    };
  }

  clearPendingDrawOfferState(state);

  events.push({
    type: 'DRAW_REFUSED',
    playerId,
    atMs: nowMs
  });

  events.push({
    type: 'CHAT_MESSAGE',
    chatEntryType: 'system',
    content: 'Draw offer refused',
    timestamp: nowMs
  });

  state = syncPhaseFields(state);

  return {
    ok: true,
    state,
    events
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Get canonical phase key using buildPhaseKey
 */
function getPhaseKey(state: any) {
  const major = state.gameData?.currentPhase;
  const sub = state.gameData?.currentSubPhase;
  
  if (!major || !sub) {
    return null;
  }
  
  return buildPhaseKey(major, sub);
}
