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
 */

import { syncPhaseFields } from '../phase/syncPhaseFields.ts';
import { advancePhase } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import {
  type IntentType,
  type SpeciesRevealPayload,
  type BuildRevealPayload,
  type ActionPayload,
  RejectionCode,
  getSpeciesCommitKey,
  getBuildCommitKey,
} from './IntentTypes.ts';
import { validateReveal } from './Hash.ts';
import {
  storeCommit,
  storeReveal,
  getCommitRecord,
  hasCommitted,
  hasRevealed,
  allPlayersRevealed,
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
  // VALIDATION: Turn number
  // ============================================================================
  
  const currentTurn = state.gameData?.turnNumber ?? 1;
  
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
  // ROUTE BY INTENT TYPE
  // ============================================================================
  
  switch (intent.intentType) {
    case 'SPECIES_COMMIT':
      return await handleSpeciesCommit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'SPECIES_REVEAL':
      return await handleSpeciesReveal(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BUILD_COMMIT':
      return await handleBuildCommit(state, sessionPlayerId, intent, nowMs, events);
      
    case 'BUILD_REVEAL':
      return await handleBuildReveal(state, sessionPlayerId, intent, nowMs, events);
      
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
// SPECIES_COMMIT
// ============================================================================

async function handleSpeciesCommit(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can commit species
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot commit species'
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
  
  const commitKey = getSpeciesCommitKey(intent.turnNumber);
  
  // Check for duplicate commit
  if (hasCommitted(state, commitKey, playerId)) {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.DUPLICATE_COMMIT,
        message: 'Species already committed for this turn'
      }
    };
  }
  
  // Store commit
  storeCommit(state, commitKey, playerId, intent.commitHash, nowMs);
  
  events.push({
    type: 'SPECIES_COMMITTED',
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
// SPECIES_REVEAL
// ============================================================================

async function handleSpeciesReveal(
  state: any,
  playerId: string,
  intent: IntentRequest,
  nowMs: number,
  events: any[]
): Promise<IntentResult> {
  const player = state.players.find((p: any) => p.id === playerId);
  
  // Only players can reveal species
  if (player.role !== 'player') {
    return {
      ok: false,
      state,
      events: [],
      rejected: {
        code: RejectionCode.SPECTATOR_RESTRICTED,
        message: 'Spectators cannot reveal species'
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
  
  const commitKey = getSpeciesCommitKey(intent.turnNumber);
  
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
        message: 'Species already revealed'
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
  
  // Store reveal
  storeReveal(state, commitKey, playerId, intent.payload, intent.nonce, nowMs);
  
  events.push({
    type: 'SPECIES_REVEALED',
    playerId,
    turnNumber: intent.turnNumber,
    atMs: nowMs
  });
  
  // Check if all players have revealed
  if (allPlayersRevealed(state, commitKey)) {
    // Resolve species for all players
    const activePlayers = state.players.filter((p: any) => p.role === 'player');
    
    for (const p of activePlayers) {
      const pRecord = getCommitRecord(state, commitKey, p.id);
      if (pRecord && pRecord.revealPayload) {
        const pPayload = pRecord.revealPayload as SpeciesRevealPayload;
        p.faction = pPayload.species;
      }
    }
    
    events.push({
      type: 'SPECIES_RESOLVED',
      turnNumber: intent.turnNumber,
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
  if (allPlayersRevealed(state, commitKey)) {
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
  }
  
  state = syncPhaseFields(state);
  
  return {
    ok: true,
    state,
    events
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
    const advanceResult = advancePhase(state);
    
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
  
  // Append to actions log
  if (!state.actions) {
    state.actions = [];
  }
  
  const player = state.players.find((p: any) => p.id === playerId);
  
  state.actions.push({
    type: 'message',
    playerId,
    playerName: player?.name || 'Unknown',
    content: payload.content,
    timestamp: nowMs
  });
  
  events.push({
    type: 'MESSAGE_SENT',
    playerId,
    content: payload.content,
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
 * Get stable phase key: ${currentPhase}:${currentSubPhase}
 */
function getPhaseKey(state: any): string | null {
  const currentPhase = state.gameData?.currentPhase;
  const currentSubPhase = state.gameData?.currentSubPhase;
  
  if (!currentPhase || !currentSubPhase) {
    return null;
  }
  
  return `${currentPhase}:${currentSubPhase}`;
}