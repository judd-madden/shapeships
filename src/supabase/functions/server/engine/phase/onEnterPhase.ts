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
import { computeLineBonusesForPlayer } from '../lines/computeLineBonusForPlayer.ts';
import { resolvePhase } from '../../engine_shared/resolve/resolvePhase.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import type { StructuredShipPower } from '../../engine_shared/effects/translateShipPowers.ts';
import { isPhaseKey, type PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getValidShipOfEqualityTargets } from '../../engine_shared/resolve/destroyRules.ts';
import { rollD6 } from '../util/rollD6.ts';

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

function getChronoswarmCountByPlayerId(state: any): Record<string, number> {
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  const counts: Record<string, number> = {};

  for (const player of activePlayers) {
    const fleet = state?.gameData?.ships?.[player.id] ?? [];
    counts[player.id] = Array.isArray(fleet)
      ? fleet.filter((ship: any) => ship?.shipDefId === 'CHR').length
      : 0;
  }

  return counts;
}

function getChronoswarmBonusLinesForPlayer(state: any, playerId: string): number {
  const rolls = Array.isArray(state?.gameData?.turnData?.chronoswarmRolls)
    ? state.gameData.turnData.chronoswarmRolls
    : [];
  const countRaw = state?.gameData?.turnData?.chronoswarmCountByPlayerId?.[playerId];
  const count = Number.isInteger(countRaw) && countRaw > 0
    ? Math.min(countRaw, rolls.length)
    : 0;

  let total = 0;
  for (let i = 0; i < count; i++) {
    total += rolls[i] ?? 0;
  }
  return total;
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
  const phaseKey = getCurrentPhaseKey(state);
  if (phaseKey !== 'battle.charge_declaration' && phaseKey !== 'battle.charge_response') {
    return false;
  }

  const fleet = state?.gameData?.ships?.[player.id] ?? [];

  const turnNumber: number = state?.gameData?.turnNumber ?? 1;
  const usedMap: Record<string, number> =
    state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};

  const playerEnergy = player?.energy ?? 0;
  let cachedShipOfEqualityTargets:
    | ReturnType<typeof getValidShipOfEqualityTargets>
    | null = null;

  for (const shipInstance of fleet) {
    const sourceInstanceId = shipInstance.instanceId;
    const shipDefId = shipInstance.shipDefId;

    // Use structured powers (authoritative)
    const shipDef = getShipDefinition(shipDefId);
    if (!shipDef || !Array.isArray((shipDef as any).structuredPowers)) continue;

    const structuredPowers: StructuredShipPower[] = (shipDef as any).structuredPowers;

    // Find any choice power that is timed for this charge phase
    const timedChoicePowers = structuredPowers.filter((p) => {
      return p?.type === 'choice' && Array.isArray((p as any).timings) && (p as any).timings.includes(phaseKey);
    });

    if (timedChoicePowers.length === 0) continue;

    // Solar Power: eligible if timed choice exists and player has energy > 0
    if ((shipDef as any).shipType === 'Solar Power') {
      if (playerEnergy > 0) return true;
      continue;
    }

    // For charge ships, require that at least one timed choice actually requires charge
    const hasChargeTimedChoice = timedChoicePowers.some((p: any) => {
      const actionRequiresCharge =
        (p.requiresCharge ?? false) ||
        (Array.isArray(p.options) && p.options.some((o: any) => o?.requiresCharge === true));
      return actionRequiresCharge === true;
    });

    if (!hasChargeTimedChoice) continue;

    // Patch D/E: cannot act if this ship already used a charge this turn
    if (usedMap[sourceInstanceId] === turnNumber) continue;

    // Must have charges available
    const chargesCurrent = shipInstance.chargesCurrent ?? 0;
    if (chargesCurrent <= 0) continue;

    if (shipDefId !== 'EQU') {
      return true;
    }

    if (cachedShipOfEqualityTargets == null) {
      cachedShipOfEqualityTargets = getValidShipOfEqualityTargets(state, player.id);
    }

    if (
      cachedShipOfEqualityTargets.validOwnTargets.length > 0 &&
      cachedShipOfEqualityTargets.validOpponentTargets.length > 0
    ) {
      return true;
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

  // ═════════════════════════════════════════════════════════════════════════
  // BUILD PHASES
  // ═════════════════════════════════════════════════════════════════════════

  // build.dice_roll: auto-advance (dice-mod powers not yet implemented)
  if (phaseKey === 'build.dice_roll') {
    return false;
  }

  // build.line_generation: auto-advance (server-driven calculation)
  if (phaseKey === 'build.line_generation') {
    return false;
  }

  // build.ships_that_build: pause only if at least one player has eligible powers
  if (phaseKey === 'build.ships_that_build') {
    return phaseHasAvailableFleetPowers(state, phaseKey);
  }

  // build.drawing: ONLY manual phase - always requires READY
  if (phaseKey === 'build.drawing') {
    return true;
  }

  // build.end_of_build: auto-advance (server processes)
  if (phaseKey === 'build.end_of_build') {
    return false;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // BATTLE PHASES
  // ═════════════════════════════════════════════════════════════════════════

  // battle.reveal: auto-advance always (Build reveal removed in favor of BUILD_SUBMIT applied in build.drawing)
  if (phaseKey === 'battle.reveal') {
    return false;
  }

  // battle.first_strike: pause only if at least one player has eligible powers
  if (phaseKey === 'battle.first_strike') {
    return phaseHasAvailableFleetPowers(state, phaseKey);
  }

  // battle.charge_declaration: requires input only if charge/solar options exist
  if (phaseKey === 'battle.charge_declaration') {
    return anyPlayerHasAvailableChargeOrSolarOption(state);
  }

  // battle.charge_response: requires input only if charges declared AND options exist
  if (phaseKey === 'battle.charge_response') {
    // THREE-CONDITION GATE (paper-play accurate):
    // 1. At least one charge/solar was spent during declaration
    if (turnData.anyChargesSpentInDeclaration !== true) {
      return false;
    }
    
    // 2. Both players were eligible at declaration start (snapshot check)
    const snapshot = turnData.chargeDeclarationEligibleByPlayerId || {};
    const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
    
    // Conservative: require exactly 2 active players for 1v1 gating
    if (activePlayers.length !== 2) {
      return false;
    }
    
    const bothEligible = activePlayers.every((p: any) => snapshot[p.id] === true);
    if (!bothEligible) {
      return false; // At least one player was ineligible at declaration start
    }
    
    // 3. After declaration, someone still has charge/solar available
    return anyPlayerHasAvailableChargeOrSolarOption(state);
  }

  // battle.end_of_turn_resolution: auto-advance (server resolves)
  if (phaseKey === 'battle.end_of_turn_resolution') {
    return false;
  }

  // ═════════════════════════════════════════════════════════════════════════
  // DEFAULT: AUTO-ADVANCE ALL UNKNOWN PHASES
  // ═════════════════════════════════════════════════════════════════════════
  
  return false;
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
  // CHARGE DECLARATION SNAPSHOT - battle.charge_declaration
  // ============================================================================
  // Snapshot which players had available charge/solar options at declaration start.
  // This snapshot gates battle.charge_response later.
  
  if (toKey === 'battle.charge_declaration') {
    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
    const snapshot: Record<string, boolean> = {};
    
    for (const player of activePlayers) {
      snapshot[player.id] = playerHasAvailableChargeOrSolarOption(workingState, player);
    }
    
    turnData.chargeDeclarationEligibleByPlayerId = snapshot;
    
    console.log(`[OnEnterPhase] Charge declaration snapshot:`, snapshot);
  }
  
  // ============================================================================
  // DICE ROLL - build.dice_roll
  // ============================================================================
  // Responsibilities:
  // 1. Generate base dice roll if not yet rolled
  // 2. Set canonical dice fields (baseDiceRoll, effectiveDiceRoll)
  // 3. Set diceRolled flag
  // 4. Finalize dice if no dice-mod powers available
  // 5. DO NOT grant lines here (that happens in line_generation)
  
  if (toKey === 'build.dice_roll') {
    // Check if dice already rolled this turn
    if (!turnData.diceRolled) {
      const base = rollD6();
      
      // Set canonical dice fields
      turnData.baseDiceRoll = base;
      turnData.effectiveDiceRoll = base;
      turnData.diceRoll = base; // Compatibility mirror
      turnData.diceRolled = true;
      turnData.diceFinalized = false; // Initially not finalized

      // Compute per-player effective dice read values (e.g., Leviathan)
      const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
      const effectiveByPlayerId: Record<string, number> = {};
      const overrideSourceByPlayerId: Record<string, string> = {};

      for (const player of activePlayers) {
        const fleet = workingState.gameData?.ships?.[player.id] ?? [];
        const hasLeviathan = Array.isArray(fleet) && fleet.some((s: any) => s?.shipDefId === 'LEV');

        if (hasLeviathan) {
          effectiveByPlayerId[player.id] = 6;
          overrideSourceByPlayerId[player.id] = 'LEV';
        } else {
          effectiveByPlayerId[player.id] = base;
        }
      }

      turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
      if (Object.keys(overrideSourceByPlayerId).length > 0) {
        turnData.diceOverrideSourceByPlayerId = overrideSourceByPlayerId;
      } else {
        delete turnData.diceOverrideSourceByPlayerId;
      }
      
      // Mirror effectiveDiceRoll to gameData for compatibility
      workingState.gameData.diceRoll = base;
      
      console.log(`[OnEnterPhase] Rolled dice: ${base}`);
      
      events.push({
        type: 'DICE_ROLLED',
        value: base,
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
      // Dice already rolled - use canonical value
      const canonicalDice = turnData.effectiveDiceRoll ?? turnData.baseDiceRoll ?? turnData.diceRoll;
      
      // Ensure gameData mirror is synced
      workingState.gameData.diceRoll = canonicalDice;
      
      // Ensure per-player effective dice map exists (backfill for older states)
      if (!turnData.effectiveDiceRollByPlayerId) {
        const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
        const effectiveByPlayerId: Record<string, number> = {};
        const overrideSourceByPlayerId: Record<string, string> = {};

        for (const player of activePlayers) {
          const fleet = workingState.gameData?.ships?.[player.id] ?? [];
          const hasLeviathan = Array.isArray(fleet) && fleet.some((s: any) => s?.shipDefId === 'LEV');

          if (hasLeviathan) {
            effectiveByPlayerId[player.id] = 6;
            overrideSourceByPlayerId[player.id] = 'LEV';
          } else {
            effectiveByPlayerId[player.id] = canonicalDice;
          }
        }

        turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
        if (Object.keys(overrideSourceByPlayerId).length > 0) {
          turnData.diceOverrideSourceByPlayerId = overrideSourceByPlayerId;
        }
      }

      console.log(`[OnEnterPhase] Dice already rolled this turn (${canonicalDice})`);
    }

    const chronoswarmCountByPlayerId = getChronoswarmCountByPlayerId(workingState);
    const sharedRollCount = Math.min(
      3,
      Math.max(0, ...Object.values(chronoswarmCountByPlayerId))
    );
    const existingChronoswarmRolls = Array.isArray(turnData.chronoswarmRolls)
      ? turnData.chronoswarmRolls.filter((roll: unknown): roll is number => typeof roll === 'number')
      : [];

    turnData.chronoswarmCountByPlayerId = chronoswarmCountByPlayerId;

    if (existingChronoswarmRolls.length === 0 && sharedRollCount > 0) {
      const chronoswarmRolls = Array.from({ length: sharedRollCount }, () => rollD6());
      turnData.chronoswarmRolls = chronoswarmRolls;
      turnData.chronoswarmSharedRollCount = chronoswarmRolls.length;

      console.log(`[OnEnterPhase] Rolled Chronoswarm dice: ${chronoswarmRolls.join(', ')}`);

      events.push({
        type: 'CHRONOSWARM_ROLLED',
        rolls: [...chronoswarmRolls],
        chronoswarmCountByPlayerId,
        sharedRollCount: chronoswarmRolls.length,
        turnNumber: workingState.gameData.turnNumber || 1,
        atMs: nowMs,
      });
    } else {
      turnData.chronoswarmRolls = existingChronoswarmRolls;
      turnData.chronoswarmSharedRollCount = existingChronoswarmRolls.length;
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
      if (!turnData.diceRolled) {
        console.warn(`[OnEnterPhase] Cannot distribute lines: dice not yet rolled`);
      }
      // Validation: dice must be finalized
      else if (turnData.diceFinalized !== true) {
        console.warn(`[OnEnterPhase] Cannot distribute lines: dice not yet finalized`);
      }
      // Proceed with line distribution
      else {
        // Use canonical dice value; if per-player dice read values exist, use those.
        const canonicalBaseLines = turnData.effectiveDiceRoll ?? turnData.baseDiceRoll ?? turnData.diceRoll;
        const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
        
        for (const player of activePlayers) {
          const baseLines = turnData.effectiveDiceRollByPlayerId?.[player.id] ?? canonicalBaseLines;
          const { bonusLines } = computeLineBonusesForPlayer(workingState, player.id);
          const chronoswarmBonusLines = getChronoswarmBonusLinesForPlayer(workingState, player.id);
          const totalLines = baseLines + bonusLines + chronoswarmBonusLines;
          
          const currentLines = player.lines || 0;
          player.lines = currentLines + totalLines;
          
          console.log(
            `[OnEnterPhase] Granted ${totalLines} lines to player ${player.id} ` +
            `(base: ${baseLines}, bonus: ${bonusLines}, chronoswarm: ${chronoswarmBonusLines}, total: ${player.lines})`
          );
          
          events.push({
            type: 'LINES_GRANTED',
            playerId: player.id,
            baseLines,
            bonusLines,
            chronoswarmBonusLines,
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
  // SHIPS THAT BUILD - build.ships_that_build
  // ============================================================================
  // Responsibilities:
  // 1. Auto-ready all ineligible players (no ships with "Ships That Build" powers)
  // 2. Only eligible players must click Ready to advance
  
  if (toKey === 'build.ships_that_build') {
    if (turnData.shipsThatBuildPassIndex !== 1 && turnData.shipsThatBuildPassIndex !== 2) {
      turnData.shipsThatBuildPassIndex = 1;
    }

    // Ensure phaseReadiness array exists
    if (!workingState.gameData.phaseReadiness) {
      workingState.gameData.phaseReadiness = [];
    }
    
    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
    
    for (const player of activePlayers) {
      // Check if player has eligible fleet powers for this phase
      const eligible = fleetHasAvailablePowers(
        workingState,
        'build.ships_that_build',
        player.id,
        ['Ships That Build']
      );
      
      if (!eligible) {
        // Player is ineligible - auto-ready them
        const existingIndex = workingState.gameData.phaseReadiness.findIndex(
          (r: any) => r.playerId === player.id && r.currentStep === 'build.ships_that_build'
        );
        
        if (existingIndex >= 0) {
          // Update existing record
          workingState.gameData.phaseReadiness[existingIndex].isReady = true;
        } else {
          // Add new readiness record
          workingState.gameData.phaseReadiness.push({
            playerId: player.id,
            isReady: true,
            currentStep: 'build.ships_that_build'
          });
        }
        
        console.log(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);
        
        events.push({
          type: 'PLAYER_AUTO_READY',
          playerId: player.id,
          step: 'build.ships_that_build',
          reason: 'no_available_powers',
          atMs: nowMs
        });
      }
    }
  }
  
  // ============================================================================
  // FIRST STRIKE - battle.first_strike
  // ============================================================================
  // Responsibilities:
  // 1. Auto-ready all ineligible players (no ships with "First Strike" powers)
  // 2. Only eligible players must click Ready to advance

  if (toKey === 'battle.first_strike') {
    if (!workingState.gameData.phaseReadiness) {
      workingState.gameData.phaseReadiness = [];
    }

    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];

    for (const player of activePlayers) {
      const eligible = fleetHasAvailablePowers(
        workingState,
        'battle.first_strike',
        player.id,
        ['First Strike']
      );

      if (!eligible) {
        const existingIndex = workingState.gameData.phaseReadiness.findIndex(
          (r: any) => r.playerId === player.id && r.currentStep === 'battle.first_strike'
        );

        if (existingIndex >= 0) {
          workingState.gameData.phaseReadiness[existingIndex].isReady = true;
        } else {
          workingState.gameData.phaseReadiness.push({
            playerId: player.id,
            isReady: true,
            currentStep: 'battle.first_strike'
          });
        }

        console.log(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);

        events.push({
          type: 'PLAYER_AUTO_READY',
          playerId: player.id,
          step: 'battle.first_strike',
          reason: 'no_available_powers',
          atMs: nowMs
        });
      }
    }
  }

  // ============================================================================
  // AUTO-READY INELIGIBLE PLAYERS - battle.charge_declaration / battle.charge_response
  // ============================================================================
  // Responsibilities:
  // 1. Auto-ready players who have no available charge/solar options this phase
  // 2. Only eligible players must click Ready to advance

  if (toKey === 'battle.charge_declaration' || toKey === 'battle.charge_response') {
    // Ensure phaseReadiness array exists
    if (!workingState.gameData.phaseReadiness) {
      workingState.gameData.phaseReadiness = [];
    }

    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];

    for (const player of activePlayers) {
      const eligible = playerHasAvailableChargeOrSolarOption(workingState, player);

      if (!eligible) {
        const existingIndex = workingState.gameData.phaseReadiness.findIndex(
          (r: any) => r.playerId === player.id && r.currentStep === toKey
        );

        if (existingIndex >= 0) {
          workingState.gameData.phaseReadiness[existingIndex].isReady = true;
        } else {
          workingState.gameData.phaseReadiness.push({
            playerId: player.id,
            isReady: true,
            currentStep: toKey
          });
        }

        console.log(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);

        events.push({
          type: 'PLAYER_AUTO_READY',
          playerId: player.id,
          step: toKey,
          reason: 'no_available_charge_or_solar',
          atMs: nowMs
        });
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
    
    const advanceResult = advancePhase(workingState, { ignoreReadiness: true }, nowMs);
    
    if (!advanceResult.ok) {
      console.log(`[OnEnterPhase] Auto-advance blocked: ${advanceResult.error}`);
      break;
    }
    
    // Update state and sync fields
    workingState = advanceResult.state;
    allEvents.push(...advanceResult.events);
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
