/**
 * CLIENT / SIMULATION PHASE ENTRY HOOK
 *
 * This file orchestrates local game simulation when entering a new phase.
 * It is NOT authoritative and must not enforce rules, security, or validation.
 *
 * Responsibilities:
 * - React to canonical gameData.phaseKey: PhaseKey
 * - Orchestrate pure engine modules (intent → effect → reducer)
 * - Apply simulation results to local game state
 * - Emit debug / UI-facing events
 *
 * Non-responsibilities:
 * - NO rule enforcement
 * - NO security checks
 * - NO player authentication
 * - NO server-side validation
 *
 * CANONICAL PHASE IDENTIFIER:
 * - gameData.phaseKey is the ONLY source (lowercase dot-separated: "major.subphase")
 * - Client expects server to provide phaseKey; this file will not derive it
 * - Missing or invalid phaseKey causes immediate early return with debug logs
 * - No fallback to legacy fields (currentPhase/currentSubPhase/turnData)
 *
 * ARCHITECTURAL NOTES:
 * - This file handles CLIENT/SIMULATION orchestration
 * - Server file /server/engine/phase/onEnterPhase.ts handles AUTHORITATIVE logic
 * - These files intentionally share a name but NOT a role
 * - Server enforces rules; client provides UI preview/responsiveness
 * - DO NOT duplicate server validation logic here
 *
 * DO NOT import from /server.
 */

import type { GameData } from '../../types/GameTypes';
import { translateBattleIntentsToEffects, type TranslationInput, type ShipReference } from '../battle/translateBattleIntentsToEffects';
import { resolveBattle, type BattleState, type BattleResult } from '../battle/BattleReducer';
import { type PhaseKey, isValidPhaseKey } from '/engine/phase/PhaseTable';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Context provided to phase entry handler.
 * Contains the current game state and metadata needed for simulation.
 */
export type PhaseEntryContext = {
  gameData: GameData;
  localPlayerId: string;
  timestamp: number;
};

/**
 * Result of phase entry processing.
 * May contain state updates, logs, or UI events.
 */
export type PhaseEntryResult = {
  updatedGameData?: GameData;
  debugLog?: string[];
  uiEvents?: UIEvent[];
};

/**
 * UI-facing events that may be emitted during phase processing.
 */
export type UIEvent = {
  type: 'battle-resolved' | 'phase-entered' | 'debug';
  payload: any;
  timestamp: number;
};

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Called when entering a new phase to orchestrate client-side simulation.
 * 
 * IMPORTANT:
 * - This function is NOT authoritative
 * - It does NOT enforce rules or validate legality
 * - It orchestrates pure engine modules for local simulation only
 * - Server is source of truth; this is for UI responsiveness
 * 
 * @param context - Current game state and metadata
 * @returns Result containing potential state updates and events
 */
export function onEnterPhase(context: PhaseEntryContext): PhaseEntryResult {
  const { gameData, localPlayerId, timestamp } = context;
  
  const debugLog: string[] = [];
  const uiEvents: UIEvent[] = [];
  
  // Extract canonical phase key from game data
  const phaseKey = gameData.phaseKey;
  
  // ============================================================================
  // PHASE KEY DRIFT GUARD
  // ============================================================================
  
  if (!phaseKey || !isValidPhaseKey(phaseKey)) {
    debugLog.push('[onEnterPhase] Missing or invalid gameData.phaseKey');
    debugLog.push('[onEnterPhase] Expected canonical PhaseKey (lowercase major.subphase from PHASE_SEQUENCE)');
    debugLog.push(`[onEnterPhase] Received: ${String(gameData.phaseKey ?? 'undefined')}`);
    
    uiEvents.push({
      type: 'debug',
      payload: {
        error: 'Missing/invalid phaseKey',
        phaseKey: gameData.phaseKey
      },
      timestamp
    });
    
    return { debugLog, uiEvents };
  }
  
  debugLog.push(`[onEnterPhase] Entering phase: ${phaseKey}`);
  debugLog.push(`[onEnterPhase] Local player: ${localPlayerId}`);
  
  // Emit phase entry event for UI
  uiEvents.push({
    type: 'phase-entered',
    payload: { phaseKey },
    timestamp
  });
  
  // ============================================================================
  // PHASE-SPECIFIC HANDLERS
  // ============================================================================
  
  // Route to appropriate handler based on canonical phase key
  switch (phaseKey) {
    case 'battle.end_of_turn_resolution':
      return handleBattleEndOfTurnResolution(context, debugLog, uiEvents);
      
    case 'setup.species_selection':
      debugLog.push('[onEnterPhase] setup.species_selection - No client action needed');
      break;
      
    case 'build.dice_roll':
      debugLog.push('[onEnterPhase] build.dice_roll - No client action needed');
      break;
      
    case 'build.line_generation':
      debugLog.push('[onEnterPhase] build.line_generation - No client action needed');
      break;
      
    case 'build.ships_that_build':
      debugLog.push('[onEnterPhase] build.ships_that_build - No client action needed');
      break;
      
    case 'build.drawing':
      debugLog.push('[onEnterPhase] build.drawing - No client action needed');
      break;
      
    case 'build.end_of_build':
      debugLog.push('[onEnterPhase] build.end_of_build - No client action needed');
      break;
      
    case 'battle.first_strike':
      debugLog.push('[onEnterPhase] battle.first_strike - No client action needed');
      break;
      
    case 'battle.charge_declaration':
      debugLog.push('[onEnterPhase] battle.charge_declaration - No client action needed');
      break;
      
    case 'battle.charge_response':
      debugLog.push('[onEnterPhase] battle.charge_response - No client action needed');
      break;
      
    default:
      debugLog.push(`[onEnterPhase] Phase '${phaseKey}' has no registered handler`);
      break;
  }
  
  return {
    debugLog,
    uiEvents
  };
}

// ============================================================================
// battle.end_of_turn_resolution HANDLER
// ============================================================================

/**
 * Handles entry into battle.end_of_turn_resolution phase.
 * 
 * Responsibilities:
 * 1. Gather stored battle intents from game state
 * 2. Build ship references from current fleets
 * 3. Translate intents → effects
 * 4. Execute BattleReducer
 * 5. Apply results to local state (for UI preview)
 * 
 * NOTE: This is simulation only. Server will also run resolution and is authoritative.
 */
function handleBattleEndOfTurnResolution(
  context: PhaseEntryContext,
  debugLog: string[],
  uiEvents: UIEvent[]
): PhaseEntryResult {
  const { gameData, localPlayerId, timestamp } = context;
  
  debugLog.push('[handleBattleEndOfTurnResolution] Starting battle resolution simulation');
  
  // ============================================================================
  // STEP 1: Gather Battle Intents
  // ============================================================================
  
  // TODO: Extract battle intents from gameData
  // Expected location: gameData.battleIntents (array of Intent objects)
  const battleIntents = gameData.battleIntents || [];
  
  debugLog.push(`[handleBattleEndOfTurnResolution] Found ${battleIntents.length} battle intents`);
  
  if (battleIntents.length === 0) {
    debugLog.push('[handleBattleEndOfTurnResolution] No intents to resolve');
    return { debugLog, uiEvents };
  }
  
  // ============================================================================
  // STEP 2: Build BattleState from Current Game State
  // ============================================================================
  
  const battleState: BattleState = buildBattleStateFromGameData(gameData);
  
  // Gate: If BattleState builder is still stubbed, don't proceed
  if (Object.keys(battleState.players).length === 0) {
    debugLog.push('[handleBattleEndOfTurnResolution] BattleState builder is stubbed - skipping resolution');
    debugLog.push('[handleBattleEndOfTurnResolution] Implement buildBattleStateFromGameData to enable client simulation');
    return { debugLog, uiEvents };
  }
  
  debugLog.push('[handleBattleEndOfTurnResolution] Built initial BattleState');
  debugLog.push(`  - Players: ${Object.keys(battleState.players).join(', ')}`);
  debugLog.push(`  - Total ships: ${Object.values(battleState.players).reduce((sum, p) => sum + p.ships.length, 0)}`);
  
  // ============================================================================
  // STEP 3: Build Ship References by Player
  // ============================================================================
  
  const shipsByPlayer: Record<string, ShipReference[]> = {};
  
  for (const [playerId, playerState] of Object.entries(battleState.players)) {
    shipsByPlayer[playerId] = playerState.ships.map(ship => ({
      instanceId: ship.instanceId,
      shipDefId: ship.shipDefId
    }));
  }
  
  debugLog.push('[handleBattleEndOfTurnResolution] Built ship references for translator');
  
  // ============================================================================
  // STEP 4: Translate Intents → Effects
  // ============================================================================
  
  try {
    const translationInput: TranslationInput = {
      turnNumber: gameData.turnNumber || 1,
      intents: battleIntents,
      shipsByPlayer
    };
    
    const translation = translateBattleIntentsToEffects(translationInput);
    
    debugLog.push(`[handleBattleEndOfTurnResolution] Translated to ${translation.effects.length} effects`);
    debugLog.push(...translation.debugLog);
    
    if (translation.rejected.length > 0) {
      debugLog.push(`[handleBattleEndOfTurnResolution] ${translation.rejected.length} intents rejected:`);
      translation.rejected.forEach(r => {
        debugLog.push(`  - Intent ${r.intentIndex}: ${r.reason}`);
      });
      
      // Emit rejected intents as debug event (non-fatal)
      uiEvents.push({
        type: 'debug',
        payload: { rejectedIntents: translation.rejected },
        timestamp
      });
    }
    
    // ============================================================================
    // STEP 5: Execute BattleReducer
    // ============================================================================
    
    const battleResult: BattleResult = resolveBattle(battleState, translation.effects, timestamp);
    
    debugLog.push('[handleBattleEndOfTurnResolution] BattleReducer execution complete');
    debugLog.push(`  - Destroyed ships: ${battleResult.destroyedShips.length}`);
    debugLog.push(`  - Health deltas: ${battleResult.healthDeltas.length}`);
    debugLog.push(`  - Battle log entries: ${battleResult.battleLog.length}`);
    
    if (battleResult.victory) {
      debugLog.push(`  - Victory: ${battleResult.victory.winnerId} (${battleResult.victory.reason})`);
    }
    
    // ============================================================================
    // STEP 6: Apply Results to Local State (UI Preview)
    // ============================================================================
    
    // TODO: Apply battleResult to gameData for local UI preview
    // This is non-authoritative; server will send canonical result
    const updatedGameData = applyBattleResultToGameData(gameData, battleResult);
    
    debugLog.push('[handleBattleEndOfTurnResolution] Applied battle results to local state');
    
    // Emit battle resolved event for UI
    uiEvents.push({
      type: 'battle-resolved',
      payload: {
        destroyedShips: battleResult.destroyedShips,
        healthDeltas: battleResult.healthDeltas,
        victory: battleResult.victory,
        battleLog: battleResult.battleLog
      },
      timestamp
    });
    
    return {
      updatedGameData,
      debugLog,
      uiEvents
    };
    
  } catch (error) {
    debugLog.push(`[handleBattleEndOfTurnResolution] ERROR: ${error instanceof Error ? error.message : String(error)}`);
    
    uiEvents.push({
      type: 'debug',
      payload: { error: String(error) },
      timestamp
    });
    
    return { debugLog, uiEvents };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Builds BattleState from GameData for reducer input.
 * 
 * TODO: This is a stub. Implement full conversion:
 * - Extract player health from gameData.players
 * - Convert fleet arrays to ShipBattleInstance[]
 * - Initialize destroyedShips and queuedEffects arrays
 * - Set turnNumber from gameData
 */
function buildBattleStateFromGameData(gameData: GameData): BattleState {
  // Stub implementation
  const battleState: BattleState = {
    players: {},
    destroyedShips: [],
    queuedEffects: [],
    turnNumber: gameData.turnNumber || 1
  };
  
  // TODO: Iterate over gameData.players and build proper BattleState
  // For now, return minimal structure
  
  return battleState;
}

/**
 * Applies BattleResult back to GameData for local UI preview.
 * 
 * TODO: This is a stub. Implement full application:
 * - Update player health values
 * - Remove destroyed ships from fleets
 * - Append battle log to game history
 * - Update victory state if applicable
 * 
 * IMPORTANT: This is non-authoritative. Server result takes precedence.
 */
function applyBattleResultToGameData(
  gameData: GameData,
  battleResult: BattleResult
): GameData {
  // Stub implementation - return unchanged for now
  // TODO: Clone gameData and apply battle result mutations
  return gameData;
}

// ============================================================================
// FUTURE EXPANSION POINTS
// ============================================================================

/**
 * TODO: Add handlers for other phase entries as needed:
 * 
 * - setup.species_selection
 *   - Initialize species selection UI
 *   - Load available species and starting conditions
 * 
 * - build.dice_roll
 *   - Animate dice roll visualization
 *   - Show dice result prominently
 * 
 * - build.line_generation
 *   - Update lines display with new resources
 *   - Show breakdown: saved + bonus + dice
 * 
 * - build.ships_that_build
 *   - Highlight ships with "builds ship" powers
 *   - Enable ship-building-ship power UI
 * 
 * - build.drawing
 *   - Initialize ship selection UI
 *   - Load available ships for current species
 *   - Calculate and display ship costs
 * 
 * - build.end_of_build
 *   - Show end-of-build effects activation
 *   - Display build phase summary
 * 
 * - battle.first_strike
 *   - Highlight ships with first strike powers
 *   - Enable first strike power UI
 *   - Show first strike targeting
 * 
 * - battle.charge_declaration
 *   - Highlight ships with available charges
 *   - Enable charge declaration UI
 *   - Show charge targets
 * 
 * - battle.charge_response
 *   - Show opponent's declared charges
 *   - Enable interceptor response UI
 *   - Calculate potential outcomes
 * 
 * - battle.end_of_turn_resolution (implemented above)
 *   - Simulate battle resolution locally
 *   - Show damage/healing preview
 *   - Display ship destruction animations
 */