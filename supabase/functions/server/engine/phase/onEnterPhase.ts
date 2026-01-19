/**
 * ON-ENTER PHASE HOOKS
 * 
 * Automatic effects triggered when entering specific phases.
 * 
 * Called after phase advancement but before returning state to client.
 * Returns updated state and any events generated.
 */

import { PHASE_SEQUENCE, type PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { resolvePhase } from '../../engine_shared/resolve/resolvePhase.ts';

export interface OnEnterResult {
  state: any;
  events: any[];
}

function isPhaseKey(value: string): value is PhaseKey {
  return (PHASE_SEQUENCE as readonly string[]).includes(value);
}

/**
 * Execute on-enter hooks for a phase transition.
 * 
 * @param state - Current game state
 * @param fromKey - Previous phase key (format: "major.sub")
 * @param toKey - New phase key (format: "major.sub")
 * @param nowMs - Current timestamp
 * @returns Updated state and events
 */
export function onEnterPhase(
  state: any,
  fromKey: string | null,
  toKey: string,
  nowMs: number
): OnEnterResult {
  const events: any[] = [];
  // Always treat state as mutable local variable; we will return the final reference.
  let workingState: any = state;
  
  console.log(`[OnEnterPhase] Entering: ${toKey} (from: ${fromKey || 'initial'})`);
  
  // ============================================================================
  // DICE ROLL - build.dice_roll
  // ============================================================================
  
  if (toKey === 'build.dice_roll') {
    const diceRoll = Math.floor(Math.random() * 6) + 1; // 1-6
    
    // Store in both locations for compatibility
    if (!workingState.gameData) {
      workingState.gameData = {};
    }
    if (!workingState.gameData.turnData) {
      workingState.gameData.turnData = {};
    }
    
    workingState.gameData.diceRoll = diceRoll;
    workingState.gameData.turnData.diceRoll = diceRoll;
    
    console.log(`[OnEnterPhase] Rolled dice: ${diceRoll}`);
    
    events.push({
      type: 'DICE_ROLLED',
      value: diceRoll,
      turnNumber: workingState.gameData.turnNumber || 1,
      atMs: nowMs
    });
  }
  
  // ============================================================================
  // LINE GENERATION - build.line_generation
  // ============================================================================
  
  if (toKey === 'build.line_generation') {
    const diceRoll = workingState.gameData?.diceRoll || workingState.gameData?.turnData?.diceRoll || 0;
    
    if (diceRoll > 0) {
      // Authoritative resolution — outcomes applied here are final and irreversible
      // Grant lines to all active players
      const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
      
      for (const player of activePlayers) {
        const currentLines = player.lines || 0;
        player.lines = currentLines + diceRoll;
        
        console.log(`[OnEnterPhase] Granted ${diceRoll} lines to player ${player.id} (total: ${player.lines})`);
        
        events.push({
          type: 'LINES_GRANTED',
          playerId: player.id,
          amount: diceRoll,
          total: player.lines,
          atMs: nowMs
        });
      }
      
      // Mark lines as distributed
      if (!workingState.gameData.turnData) {
        workingState.gameData.turnData = {};
      }
      workingState.gameData.turnData.linesDistributed = true;
    } else {
      console.log(`[OnEnterPhase] Warning: No dice roll found for line generation`);
    }
  }
  
  // ============================================================================
  // STRUCTURED POWERS RESOLUTION (PhaseKey-Based)
  // ============================================================================
  
  // Call resolvePhase for all phase entries to process structured powers
  // resolvePhase will handle phase-specific logic internally
  try {
    if (!isPhaseKey(toKey)) {
      console.warn(`[OnEnterPhase] Skipping resolvePhase: toKey is not a valid PhaseKey: ${toKey}`);
    } else {
      const resolutionResult = resolvePhase(workingState, toKey);

      // resolvePhase returns a new state object reference
      workingState = resolutionResult.state;

      if (resolutionResult.events && resolutionResult.events.length > 0) {
        events.push(...resolutionResult.events);
        console.log(
          `[OnEnterPhase] Structured powers resolution for ${toKey} generated ${resolutionResult.events.length} events`
        );
      }
    }
  } catch (error) {
    console.error(`[OnEnterPhase] Error during structured powers resolution:`, error);
  }
  
  // ============================================================================
  // FUTURE HOOKS
  // ============================================================================
  
  // Add more on-enter effects here as needed:
  // - Clock tick updates
  // - Automatic charge restoration
  // - etc.
  
  return { state: workingState, events };
}