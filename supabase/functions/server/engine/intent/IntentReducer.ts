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

import {
  type IntentType,
  type SpeciesRevealPayload,
  type BuildRevealPayload,
  type BuildSubmitPayload,
  type BattleRevealPayload,
  type ActionPayload,
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
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';

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
    'SPECIES_SELECT',
    'BUILD_COMMIT',
    'BUILD_REVEAL',
    'BUILD_SUBMIT',
    'BATTLE_COMMIT',
    'BATTLE_REVEAL',
    'DECLARE_READY'
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
      'SPECIES_SELECT',
      'SPECIES_COMMIT',
      'SPECIES_REVEAL',
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
          message: `Intent ${intent.intentType} not allowed during setup.species_selection. Allowed: SPECIES_SELECT, SPECIES_COMMIT, SPECIES_REVEAL, SPECIES_SUBMIT, ACTION, SURRENDER`
        }
      };
    }
  }
  
  // ============================================================================
  // ROUTE BY INTENT TYPE
  // ============================================================================
  
  switch (intent.intentType) {
    case 'SPECIES_SELECT':
      return await handleSpeciesSelect(state, sessionPlayerId, intent, nowMs, events);
      
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
      
    case 'SURRENDER':
      return handleSurrender(state, sessionPlayerId, intent, nowMs, events);
      
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
    const advanceResult = advancePhaseCore(state);
    
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
  
  // Completion check: if all active players have submitted
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const allSubmitted = activePlayers.every((p: any) => hasRevealed(state, commitKey, p.id));
  
  if (allSubmitted) {
    console.log('[SPECIES_SUBMIT] All players submitted, resolving species and advancing phase...');
    
    // Resolve species for all players
    for (const p of activePlayers) {
      const pRecord = getCommitRecord(state, commitKey, p.id);
      if (pRecord && pRecord.revealPayload) {
        const pPayload = pRecord.revealPayload as SpeciesRevealPayload;
        p.faction = pPayload.species;
        console.log(`[SPECIES_RESOLUTION] Player ${p.id} → faction: ${pPayload.species}`);
      }
    }
    
    events.push({
      type: 'SPECIES_RESOLVED',
      turnNumber: intent.turnNumber,
      atMs: nowMs
    });
    
    // Advance phase
    const fromKey = phaseKey;
    
    const advanceResult = advancePhaseCore(state);
    
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
const MAX_BUILD_COUNT = 20;

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
            const shipInstance: ShipInstance = {
              instanceId: crypto.randomUUID(),
              shipDefId: buildEntry.shipDefId,
              createdTurn: state.gameData.turnNumber
            };
            
            // Note: chargesCurrent will be set later if needed by ship def logic
            
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
    
    const alreadyApplied = state.gameData.turnData.buildAppliedTurnNumber === turnNumber;
    
    // Ensure ships map exists before any possible apply
    if (!state.gameData.ships) state.gameData.ships = {};
    
    if (!alreadyApplied) {
      // B5) Apply builds for all players
      // Initialize ships storage if needed
      if (!state.gameData.ships) {
        state.gameData.ships = {};
      }
      
      for (const p of activePlayers) {
        const pRecord = getCommitRecord(state, commitKey, p.id);
        if (pRecord && pRecord.revealPayload) {
          const pPayload = pRecord.revealPayload as BuildSubmitPayload;
          
          // Ensure player has a ship array
          if (!state.gameData.ships[p.id]) {
            state.gameData.ships[p.id] = [];
          }
          
          // Create ship instances for each build
          for (const buildEntry of pPayload.builds) {
            const count = buildEntry.count;
            
            for (let i = 0; i < count; i++) {
              // TODO (upgrades): if shipDef has componentShips, consume component instances from fleet before adding upgraded ship.
              
              const shipInstance: ShipInstance = {
                instanceId: crypto.randomUUID(),
                shipDefId: buildEntry.shipDefId,
                createdTurn: state.gameData.turnNumber
              };
              
              state.gameData.ships[p.id].push(shipInstance);
            }
          }
        }
      }
      
      // Mark applied so this turn can't double-apply (even if we reconcile later)
      state.gameData.turnData.buildAppliedTurnNumber = turnNumber;
    } else {
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
    
    // Store current phase key for onEnterPhase
    const fromKey = phaseKey;
    
    // Advance phase using canonical phase engine
    const advanceResult = advancePhaseCore(state);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // FIX 3: Clear readiness on successful phase advance
      state.gameData.phaseReadiness = [];
      
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
// ACTION (message only)
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
  
  if (payload.actionType !== 'message') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.BAD_PAYLOAD,
        message: `Unsupported action type: ${payload.actionType}`
      }
    };
  }
  
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
  
  // Mark game as finished
  state.status = 'finished';
  
  // Set winner to the other player
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const opponent = activePlayers.find((p: any) => p.id !== playerId);
  
  if (opponent) {
    state.winner = opponent.id;
  }
  
  events.push({
    type: 'GAME_SURRENDERED',
    playerId,
    winner: state.winner,
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
// HELPERS
// ============================================================================

/**
 * Get canonical phase key using buildPhaseKey
 */
function getPhaseKey(state: any): string | null {
  const major = state.gameData?.currentPhase;
  const sub = state.gameData?.currentSubPhase;
  
  if (!major || !sub) {
    return null;
  }
  
  return buildPhaseKey(major, sub);
}