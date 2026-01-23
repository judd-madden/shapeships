/**
 * ON-ENTER PHASE HOOKS
 * 
 * Automatic effects triggered when entering specific phases.
 * 
 * Called after phase advancement but before returning state to client.
 * Returns updated state and any events generated.
 * 
 * AUTO-ADVANCE:
 * Automatically chains through phases that require no player input,
 * bounded by MAX_AUTO_ADVANCES to prevent infinite loops.
 */

import { syncPhaseFields } from './syncPhaseFields.ts';
import { advancePhase } from './advancePhase.ts';
import { fleetHasAvailablePowers } from './fleetHasAvailablePowers.ts';
import { hasCommitted, hasRevealed, allCommittedPlayersRevealed } from '../intent/CommitStore.ts';
import { getBuildCommitKey } from '../intent/IntentTypes.ts';
import { computeLineBonusForPlayer } from '../lines/computeLineBonusForPlayer.ts';
import { resolvePhase } from '../../engine_shared/resolve/resolvePhase.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { isPhaseKey, type PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';

export interface OnEnterResult {
  state: any;
  events: any[];
}

const MAX_AUTO_ADVANCES = 10;

function getCurrentPhaseKey(state: any): PhaseKey | null {
  const gd: any = state.gameData || {};

  const major = gd.currentPhase as string | undefined;
  const sub = gd.currentSubPhase as string | undefined;
  if (major && sub) {
    const key = `${major}.${sub}` as PhaseKey;
    return isPhaseKey(key) ? key : null;
  }

  const td: any = gd.turnData || {};
  const major2 = td.currentMajorPhase as string | undefined;
  const sub2 = td.currentSubPhase as string | undefined;
  if (major2 && sub2) {
    const key = `${major2}.${sub2}` as PhaseKey;
    return isPhaseKey(key) ? key : null;
  }

  return null;
}

// ============================================================================
// PHASE-TO-SUBPHASE MAPPING
// ============================================================================

/**
 * Maps PhaseKey to canonical ship power subphase labels.
 * Used to determine if a phase has fleet powers that require player input.
 * 
 * NOTE: Charge-capable ships are identified via powers with subphase "Charge Declaration",
 * which qualifies them for both Charge Declaration and Charge Response phases.
 * Solar Powers are considered charges and require energy to declare.
 * battle.charge_response does not use this map - it has dedicated availability logic.
 */
const PHASE_TO_SUBPHASE_MAP: Record<PhaseKey, string[]> = {
  'setup.species_selection': [],
  'build.dice_roll': ['Dice Roll'], // Reserved for future dice-mod powers
  'build.line_generation': ['Line Generation'],
  'build.ships_that_build': ['Ships That Build'],
  'build.drawing': [], // Handled separately (lines > 0)
  'build.end_of_build': [],
  'battle.reveal': [], // Handled separately (commit/reveal gating)
  'battle.first_strike': ['First Strike'], // Declarable (e.g., Guardian)
  'battle.charge_declaration': [], // Uses dedicated charge/solar gating
  'battle.charge_response': [], // Uses dedicated charge/solar gating
  'battle.end_of_turn_resolution': [],
};

// ============================================================================
// FLEET-BASED INPUT GATING
// ============================================================================

/**
 * Check if any player has ships with powers relevant to this phase.
 * 
 * @param state - Game state
 * @param phaseKey - Phase to check
 * @returns true if at least one player has powers for this phase
 */
function phaseHasAvailableFleetPowers(state: any, phaseKey: PhaseKey): boolean {
  const subphases = PHASE_TO_SUBPHASE_MAP[phaseKey] || [];
  
  if (subphases.length === 0) {
    return false; // No powers defined for this phase
  }
  
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  
  for (const player of activePlayers) {
    if (fleetHasAvailablePowers(state, phaseKey, player.id, subphases)) {
      return true; // Found a player with matching powers
    }
  }
  
  return false;
}

/**
 * Check if a specific player has any available charge or solar power option.
 * 
 * Rules:
 * - Charge ships require chargesCurrent > 0
 * - Solar Power ships require player.energy > 0
 * - Both use "Charge Declaration" subphase (no separate "Charge Response")
 * 
 * @param state - Game state
 * @param player - Player to check
 * @returns true if player can declare at least one charge or solar power
 */
function playerHasAvailableChargeOrSolarOption(state: any, player: any): boolean {
  const fleet = state?.ships?.[player.id] ?? state?.gameData?.ships?.[player.id] ?? [];
  
  for (const shipInstance of fleet) {
    const shipDef = getShipById(shipInstance.shipDefId);
    if (!shipDef) continue;
    
    // Check if ship has any charge-declarable power
    const hasChargePower = shipDef.powers.some(p => p.subphase === 'Charge Declaration');
    if (!hasChargePower) continue;
    
    // Solar Power ships require energy
    if (shipDef.shipType === 'Solar Power') {
      const playerEnergy = player.energy || 0;
      if (playerEnergy > 0) {
        return true; // Can use solar power
      }
      // No energy, cannot use this ship
      continue;
    }
    
    // Normal charge ships require charges
    const chargesCurrent = shipInstance.chargesCurrent ?? 0;
    if (chargesCurrent > 0) {
      return true; // Can use charge
    }
  }
  
  return false;
}

/**
 * Check if ANY player has available charge or solar power options.
 * \n * @param state - Game state
 * @returns true if at least one player has charge/solar options
 */
function anyPlayerHasAvailableChargeOrSolarOption(state: any): boolean {
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  
  for (const player of activePlayers) {
    if (playerHasAvailableChargeOrSolarOption(state, player)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Check if any player is missing BUILD_REVEAL for the current turn.
 * 
 * A player "needs reveal" if:
 * - They have a commitHash stored for build::<turnNumber> AND
 * - They do NOT have revealPayload stored for that same key
 * 
 * @param state - Game state
 * @returns true if at least one player still needs to reveal
 */
function anyPlayerMissingBuildReveal(state: any): boolean {
  const turnNumber = state.gameData?.turnNumber || 1;
  const commitKey = getBuildCommitKey(turnNumber);
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  
  for (const player of activePlayers) {
    // Check if this player has committed
    const committed = hasCommitted(state, commitKey, player.id);
    if (!committed) {
      continue; // Player didn't commit, no reveal needed
    }
    
    // Player committed - check if they've revealed
    const revealed = hasRevealed(state, commitKey, player.id);
    if (!revealed) {
      return true; // Found a player who committed but hasn't revealed
    }
  }
  
  return false; // All committed players have revealed (or no one committed)
}

/**
 * Check if a phase requires player input based on fleet state.
 * 
 * Returns true if either player has any required action in this phase.
 */
function phaseRequiresPlayerInput(state: any, phaseKey: PhaseKey): boolean {
  // Skip if game is finished
  if (state.status === 'finished') {
    return false;
  }
  
  const turnData = state.gameData?.turnData || {};

  // setup.species_selection: requires input if not all players have selected
  if (phaseKey === 'setup.species_selection') {
    const allSelected = (state.players || []).every((p: any) => !!p.faction);
    return !allSelected;
  }

  // build.dice_roll: requires input only if fleet has dice-mod powers AND dice not finalized
  if (phaseKey === 'build.dice_roll') {
    if (turnData.diceFinalized === true) {
      return false; // Dice already finalized
    }
    // Check if any player has dice-mod powers
    return phaseHasAvailableFleetPowers(state, phaseKey);
  }

  // build.line_generation: no player input (automatic), but block if dice not finalized
  if (phaseKey === 'build.line_generation') {
    // Don't allow entering this phase if dice not finalized
    // This is handled by returning false (no input), but the phase shouldn't be entered
    // until diceFinalized is true. The auto-advance will respect this.
    return false;
  }

  // build.ships_that_build: requires input only if fleet has ship-build powers
  if (phaseKey === 'build.ships_that_build') {
    return phaseHasAvailableFleetPowers(state, phaseKey);
  }

  // build.drawing: requires input if player has lines > 0
  if (phaseKey === 'build.drawing') {
    const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
    for (const player of activePlayers) {
      const lines = player.lines || 0;
      if (lines > 0) {
        return true; // Player has lines, requires build submission
      }
    }
    return false;
  }

  // build.end_of_build: no player input (server processes)
  if (phaseKey === 'build.end_of_build') {
    return false;
  }

  // battle.reveal: requires input if any player has committed but not revealed
  if (phaseKey === 'battle.reveal') {
    const turnNumber = state.gameData?.turnNumber || 1;
    const commitKey = getBuildCommitKey(turnNumber);
    return !allCommittedPlayersRevealed(state, commitKey);
  }

  // battle.first_strike: requires input only if fleet has first strike powers
  if (phaseKey === 'battle.first_strike') {
    return phaseHasAvailableFleetPowers(state, phaseKey);
  }

  // battle.charge_declaration: requires input only if any player can declare charges/solar
  if (phaseKey === 'battle.charge_declaration') {
    return anyPlayerHasAvailableChargeOrSolarOption(state);
  }

  // battle.charge_response: requires input only if:
  //   1. Charges were declared in charge_declaration phase AND
  //   2. Any player can still declare charges/solar (same availability check)
  if (phaseKey === 'battle.charge_response') {
    // Auto-skip if no charges were declared
    if (turnData.anyChargesDeclared !== true) {
      return false; // No charges declared, auto-skip this phase
    }
    // If charges were declared, check if any player can still respond
    return anyPlayerHasAvailableChargeOrSolarOption(state);
  }

  // battle.end_of_turn_resolution: no player input (server resolves)
  if (phaseKey === 'battle.end_of_turn_resolution') {
    return false;
  }

  // Default: assume input required for unknown phases (conservative)
  console.warn(`[phaseRequiresPlayerInput] Unknown phase: ${phaseKey}, assuming input required`);
  return true;
}

/**
 * Execute on-enter hooks for a single phase (non-recursive).
 * 
 * @param state - Current game state
 * @param fromKey - Previous phase key
 * @param toKey - New phase key
 * @param nowMs - Current timestamp
 * @returns Updated state and events
 */
function enterPhaseOnce(
  state: any,
  fromKey: string | null,
  toKey: PhaseKey,
  nowMs: number
): OnEnterResult {
  const events: any[] = [];
  let workingState: any = state;
  
  console.log(`[OnEnterPhase] Entering: ${toKey} (from: ${fromKey || 'initial'})`);
  
  // Ensure gameData and turnData exist
  if (!workingState.gameData) {
    workingState.gameData = {};
  }
  if (!workingState.gameData.turnData) {
    workingState.gameData.turnData = {};
  }
  
  const turnData = workingState.gameData.turnData;
  
  // ============================================================================
  // DICE ROLL - build.dice_roll
  // ============================================================================
  // Responsibilities:
  // 1. Generate base dice roll if not yet rolled
  // 2. Set diceRolled flag
  // 3. Finalize dice if no dice-mod powers available
  // 4. DO NOT grant lines here (that happens in line_generation)
  
  if (toKey === 'build.dice_roll') {
    // Check if dice already rolled this turn
    if (!turnData.diceRolled) {
      const diceRoll = Math.floor(Math.random() * 6) + 1; // 1-6
      
      turnData.diceRoll = diceRoll;
      turnData.diceRolled = true;
      turnData.diceFinalized = false; // Initially not finalized
      
      // Mirror to gameData for compatibility
      workingState.gameData.diceRoll = diceRoll;
      
      console.log(`[OnEnterPhase] Rolled dice: ${diceRoll}`);
      
      events.push({
        type: 'DICE_ROLLED',
        value: diceRoll,
        turnNumber: workingState.gameData.turnNumber || 1,
        atMs: nowMs
      });
      
      // Check if dice should be immediately finalized
      // (no dice-mod powers available)
      const hasDiceModPowers = phaseHasAvailableFleetPowers(workingState, 'build.dice_roll');
      
      if (!hasDiceModPowers) {
        turnData.diceFinalized = true;
        console.log(`[OnEnterPhase] Dice finalized automatically (no dice-mod powers)`);
      }
    } else {
      console.log(`[OnEnterPhase] Dice already rolled this turn (${turnData.diceRoll})`);
    }
  }
  
  // ============================================================================
  // LINE GENERATION - build.line_generation
  // ============================================================================
  // Responsibilities:
  // 1. Grant lines exactly once per turn
  // 2. Require dice to be rolled and finalized
  // 3. Apply base lines + bonus lines (Orbitals)
  
  if (toKey === 'build.line_generation') {
    // Idempotency check
    if (turnData.linesDistributed === true) {
      console.log(`[OnEnterPhase] Lines already distributed this turn, skipping`);
    } else {
      // Validation: dice must be rolled
      if (!turnData.diceRolled || turnData.diceRoll == null) {
        console.warn(`[OnEnterPhase] Cannot distribute lines: dice not yet rolled`);
      }
      // Validation: dice must be finalized
      else if (turnData.diceFinalized !== true) {
        console.warn(`[OnEnterPhase] Cannot distribute lines: dice not yet finalized`);
      }
      // Proceed with line distribution
      else {
        const baseLines = turnData.diceRoll;
        const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
        
        for (const player of activePlayers) {
          const bonusLines = computeLineBonusForPlayer(workingState, player.id);
          const totalLines = baseLines + bonusLines;
          
          const currentLines = player.lines || 0;
          player.lines = currentLines + totalLines;
          
          console.log(
            `[OnEnterPhase] Granted ${totalLines} lines to player ${player.id} ` +
            `(base: ${baseLines}, bonus: ${bonusLines}, total: ${player.lines})`
          );
          
          events.push({
            type: 'LINES_GRANTED',
            playerId: player.id,
            baseLines,
            bonusLines,
            totalGranted: totalLines,
            newTotal: player.lines,
            atMs: nowMs
          });
        }
        
        // Mark lines as distributed
        turnData.linesDistributed = true;
      }
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
  
  return { state: workingState, events };
}

/**
 * Execute on-enter hooks with auto-advance loop.
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
  if (!isPhaseKey(toKey)) {
    console.warn(`[OnEnterPhase] Invalid phase key: ${toKey}`);
    return { state, events: [] };
  }
  
  let workingState = state;
  const allEvents: any[] = [];
  let currentKey: PhaseKey = toKey as PhaseKey;
  let advanceCount = 0;
  
  // Loop: enter phase -> check if input required -> auto-advance if not
  while (advanceCount < MAX_AUTO_ADVANCES) {
    // Execute on-enter hooks for current phase
    const enterResult = enterPhaseOnce(workingState, fromKey, currentKey, nowMs);
    workingState = enterResult.state;
    allEvents.push(...enterResult.events);
    
    // Check if game is finished (victory conditions)
    if (workingState.status === 'finished') {
      console.log(`[OnEnterPhase] Game finished, stopping auto-advance`);
      break;
    }
    
    // Special case: build.line_generation must wait for dice finalization
    if (currentKey === 'build.line_generation') {
      const turnData = workingState.gameData?.turnData || {};
      if (turnData.diceFinalized !== true) {
        console.log(`[OnEnterPhase] Stopping at line_generation: dice not finalized yet`);
        break;
      }
    }
    
    // Re-evaluate if phase requires input (after on-enter work may have changed state)
    const requiresInput = phaseRequiresPlayerInput(workingState, currentKey);
    
    if (requiresInput) {
      console.log(`[OnEnterPhase] Phase ${currentKey} requires player input, stopping auto-advance`);
      break;
    }
    
    // Phase requires no input -> auto-advance
    console.log(`[OnEnterPhase] Phase ${currentKey} requires no input, auto-advancing...`);
    
    const advanceResult = advancePhase(workingState, { ignoreReadiness: true });
    
    if (!advanceResult.ok) {
      console.log(`[OnEnterPhase] Auto-advance blocked: ${advanceResult.error}`);
      break;
    }
    
    // Update state and sync fields
    workingState = advanceResult.state;
    workingState = syncPhaseFields(workingState);
    
    // Update current key for next iteration
    const nextKey = getCurrentPhaseKey(workingState);
    
    if (!nextKey || !isPhaseKey(nextKey)) {
      console.warn(`[OnEnterPhase] Auto-advance failed: invalid next phase key`);
      break;
    }
    
    console.log(`[OnEnterPhase] Auto-advanced: ${currentKey} → ${nextKey}`);
    
    allEvents.push({
      type: 'PHASE_ADVANCED',
      from: currentKey,
      to: nextKey,
      atMs: nowMs,
      autoAdvance: true
    });
    
    fromKey = currentKey;
    currentKey = nextKey;
    advanceCount++;
  }
  
  if (advanceCount >= MAX_AUTO_ADVANCES) {
    console.warn(`[OnEnterPhase] Hit MAX_AUTO_ADVANCES (${MAX_AUTO_ADVANCES}), stopping`);
    allEvents.push({
      type: 'AUTO_ADVANCE_LIMIT_REACHED',
      maxAdvances: MAX_AUTO_ADVANCES,
      currentPhase: currentKey,
      atMs: nowMs
    });
  }
  
  return { state: workingState, events: allEvents };
}