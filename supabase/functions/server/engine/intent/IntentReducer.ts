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

import { syncPhaseFields } from '../phase/syncPhaseFields.ts';
import { advancePhase, advancePhaseCore } from '../phase/advancePhase.ts';
import { onEnterPhase } from '../phase/onEnterPhase.ts';
import { buildPhaseKey } from '../phase/PhaseTable.ts';
import {
  type IntentType,
  type SpeciesRevealPayload,
  type BuildRevealPayload,
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
    const allowedInSpeciesSelection = new Set(['SPECIES_COMMIT', 'SPECIES_REVEAL']);
    
    if (!allowedInSpeciesSelection.has(intent.intentType)) {
      return {
        ok: false,
        state,
        events: [],
        rejected: {
          code: RejectionCode.PHASE_NOT_ALLOWED,
          message: `Intent ${intent.intentType} not allowed during setup.species_selection. Allowed: SPECIES_COMMIT, SPECIES_REVEAL`
        }
      };
    }
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
  
  // ============================================================================
  // DEBUG + EXPLICIT ALL-REVEALED CHECK
  // ============================================================================
  
  // Compute active players and revealed count
  const activePlayers = state.players.filter((p: any) => p.role === 'player');
  const revealedCount = activePlayers.filter((p: any) => hasRevealed(state, commitKey, p.id)).length;
  const phaseKeyBefore = state.phaseKey ?? 
    (state.gameData?.currentPhase && state.gameData?.currentSubPhase
      ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
      : 'UNKNOWN');
  
  // DEBUG EVENT: Log reveal status
  events.push({
    type: 'DEBUG_SPECIES_REVEAL_STATUS',
    activePlayers: activePlayers.length,
    revealedCount,
    phaseKeyBefore,
    atMs: nowMs
  });
  
  console.log('[SPECIES_REVEAL_STATUS]', {
    activePlayers: activePlayers.length,
    revealedCount,
    phaseKeyBefore,
    allPlayerIds: activePlayers.map(p => p.id),
    revealedPlayerIds: activePlayers.filter(p => hasRevealed(state, commitKey, p.id)).map(p => p.id)
  });
  
  // Explicit all-revealed check (replace allPlayersRevealed helper)
  const allRevealed = activePlayers.every((p: any) => hasRevealed(state, commitKey, p.id));
  
  console.log('[SPECIES_ALL_REVEALED_CHECK]', { allRevealed });
  
  // Check if all players have revealed
  if (allRevealed) {
    console.log('[SPECIES_RESOLUTION] All players revealed, resolving species and auto-advancing...');
    
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
    
    // --- AUTO-ADVANCE OUT OF SPECIES SELECTION ---
    const from = state.phaseKey ?? 
      (state.gameData?.currentPhase && state.gameData?.currentSubPhase
        ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
        : 'UNKNOWN');
    
    console.log('[SPECIES_AUTO_ADVANCE] Starting auto-advance from:', from);
    
    // Advance phase using core (system-driven) advancement - NO readiness check
    const advanceResult = advancePhaseCore(state);
    
    if (advanceResult.ok) {
      state = advanceResult.state;
      
      // Sync phase fields after advancement
      state = syncPhaseFields(state);
      
      // Get new phase key
      const to = state.phaseKey ?? 
        (state.gameData?.currentPhase && state.gameData?.currentSubPhase
          ? `${state.gameData.currentPhase}.${state.gameData.currentSubPhase}`
          : 'UNKNOWN');
      
      console.log('[SPECIES_AUTO_ADVANCE] Phase advanced:', { from, to });
      
      // DEBUG EVENT: Log auto-advance result
      events.push({
        type: 'DEBUG_SPECIES_AUTO_ADVANCE',
        from,
        to,
        atMs: nowMs
      });
      
      events.push({
        type: 'PHASE_ADVANCED',
        from,
        to,
        atMs: nowMs
      });
      
      // Trigger on-enter hooks for new phase
      const toKey = getPhaseKey(state);
      if (toKey) {
        console.log('[SPECIES_AUTO_ADVANCE] Calling onEnterPhase for:', toKey);
        const onEnterResult = onEnterPhase(state, from, toKey, nowMs);
        state = onEnterResult.state;
        events.push(...onEnterResult.events);
        console.log('[SPECIES_AUTO_ADVANCE] onEnterPhase complete, events:', onEnterResult.events.length);
      }
      
      // Verify phase actually changed
      if (to === from || to === 'setup.species_selection') {
        console.error('[SPECIES_AUTO_ADVANCE] ❌ CRITICAL: Phase did not advance! Still at:', to);
        events.push({
          type: 'DEBUG_SPECIES_AUTO_ADVANCE_FAILED',
          from,
          to,
          reason: 'Phase did not change',
          atMs: nowMs
        });
      } else {
        console.log('[SPECIES_AUTO_ADVANCE] ✓ Phase successfully advanced to:', to);
      }
    } else {
      console.error('[SPECIES_AUTO_ADVANCE] ❌ advancePhase failed:', advanceResult.error);
      
      events.push({
        type: 'DEBUG_SPECIES_AUTO_ADVANCE_FAILED',
        from,
        to: from,
        reason: advanceResult.error,
        atMs: nowMs
      });
      
      events.push({
        type: 'PHASE_ADVANCE_BLOCKED',
        from,
        reason: advanceResult.error,
        atMs: nowMs
      });
    }
  } else {
    console.log('[SPECIES_REVEAL] Not all players revealed yet, waiting...');
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