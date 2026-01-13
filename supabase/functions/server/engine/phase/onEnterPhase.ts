/**
 * ON-ENTER PHASE HOOKS
 * 
 * Automatic effects triggered when entering specific phases.
 * 
 * Called after phase advancement but before returning state to client.
 * Returns updated state and any events generated.
 */

import type { PhaseKey } from './PhaseTable.ts';

export interface OnEnterResult {
  state: any;
  events: any[];
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
  
  console.log(`[OnEnterPhase] Entering: ${toKey} (from: ${fromKey || 'initial'})`);
  
  // ============================================================================
  // DICE ROLL - build.dice_roll
  // ============================================================================
  
  if (toKey === 'build.dice_roll') {
    const diceRoll = Math.floor(Math.random() * 6) + 1; // 1-6
    
    // Store in both locations for compatibility
    if (!state.gameData) {
      state.gameData = {};
    }
    if (!state.gameData.turnData) {
      state.gameData.turnData = {};
    }
    
    state.gameData.diceRoll = diceRoll;
    state.gameData.turnData.diceRoll = diceRoll;
    
    console.log(`[OnEnterPhase] Rolled dice: ${diceRoll}`);
    
    events.push({
      type: 'DICE_ROLLED',
      value: diceRoll,
      turnNumber: state.gameData.turnNumber || 1,
      atMs: nowMs
    });
  }
  
  // ============================================================================
  // LINE GENERATION - build.line_generation
  // ============================================================================
  
  if (toKey === 'build.line_generation') {
    const diceRoll = state.gameData?.diceRoll || state.gameData?.turnData?.diceRoll || 0;
    
    if (diceRoll > 0) {
      // Grant lines to all active players
      const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
      
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
      if (!state.gameData.turnData) {
        state.gameData.turnData = {};
      }
      state.gameData.turnData.linesDistributed = true;
    } else {
      console.log(`[OnEnterPhase] Warning: No dice roll found for line generation`);
    }
  }
  
  // ============================================================================
  // FUTURE HOOKS
  // ============================================================================
  
  // Add more on-enter effects here as needed:
  // - Clock tick updates
  // - Automatic charge restoration
  // - End of turn damage/healing resolution
  // - etc.
  
  return { state, events };
}
