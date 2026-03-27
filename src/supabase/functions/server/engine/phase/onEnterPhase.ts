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

function getKnoRerollPassIndex(state: any): 1 | 2 {
  return state?.gameData?.turnData?.knoRerollPassIndex === 2 ? 2 : 1;
}

function getKnoCountForPlayer(state: any, playerId: string): number {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return Array.isArray(fleet)
    ? fleet.filter((ship: any) => ship?.shipDefId === 'KNO').length
    : 0;
}

function anyPlayerHasKno(state: any): boolean {
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) => getKnoCountForPlayer(state, player.id) > 0);
}

function playerHasKnoRerollForPass(state: any, playerId: string, passIndex: 1 | 2): boolean {
  return getKnoCountForPlayer(state, playerId) >= passIndex;
}

function anyPlayerHasKnoRerollForCurrentPass(state: any): boolean {
  const passIndex = getKnoRerollPassIndex(state);
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) => playerHasKnoRerollForPass(state, player.id, passIndex));
}

function computeEffectiveDiceStateForPlayers(state: any, baseDice: number) {
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
function getSnappedChargeResponseSourceIds(state: any, playerId: string): string[] {
  const rawSourceIds = state?.gameData?.turnData?.chargeDeclarationEligibleSourceIdsByPlayerId?.[playerId];
  if (!Array.isArray(rawSourceIds)) {
    return [];
  }

  const sourceIds: string[] = [];
  const seen = new Set<string>();

  for (const sourceId of rawSourceIds) {
    if (typeof sourceId !== 'string' || sourceId.length === 0 || seen.has(sourceId)) continue;
    seen.add(sourceId);
    sourceIds.push(sourceId);
  }

  return sourceIds;
}

function resolveChargeResponseSource(state: any, playerId: string, sourceInstanceId: string): any | null {
  const liveFleet = state?.gameData?.ships?.[playerId] ?? [];
  const liveShip = liveFleet.find((ship: any) => ship?.instanceId === sourceInstanceId);
  if (liveShip) {
    return liveShip;
  }

  const voidFleet = state?.gameData?.voidShipsByPlayerId?.[playerId] ?? [];
  return voidFleet.find((ship: any) => ship?.instanceId === sourceInstanceId) ?? null;
}

function getChargePhaseSourceShips(
  state: any,
  playerId: string,
  phaseKey: 'battle.charge_declaration' | 'battle.charge_response'
): any[] {
  if (phaseKey === 'battle.charge_declaration') {
    return state?.gameData?.ships?.[playerId] ?? [];
  }

  const sourceShips: any[] = [];

  for (const sourceInstanceId of getSnappedChargeResponseSourceIds(state, playerId)) {
    const ship = resolveChargeResponseSource(state, playerId, sourceInstanceId);
    if (!ship) continue;
    sourceShips.push(ship);
  }

  return sourceShips;
}

function getEligibleChargeOrSolarSourceIds(
  state: any,
  playerId: string,
  phaseKey: 'battle.charge_declaration' | 'battle.charge_response'
): string[] {
  const players = state?.players ?? state?.gameData?.players ?? [];
  const player = players.find((candidate: any) => candidate?.id === playerId);
  const playerEnergy = player?.energy ?? 0;
  const turnNumber: number = state?.gameData?.turnNumber ?? 1;
  const usedMap: Record<string, number> =
    state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};
  let cachedShipOfEqualityTargets:
    | ReturnType<typeof getValidShipOfEqualityTargets>
    | null = null;

  const eligibleSourceIds: string[] = [];

  for (const shipInstance of getChargePhaseSourceShips(state, playerId, phaseKey)) {
    const sourceInstanceId = shipInstance?.instanceId;
    const shipDefId = shipInstance?.shipDefId;
    if (typeof sourceInstanceId !== 'string' || typeof shipDefId !== 'string') continue;

    const shipDef = getShipDefinition(shipDefId);
    if (!shipDef || !Array.isArray((shipDef as any).structuredPowers)) continue;

    const structuredPowers: StructuredShipPower[] = (shipDef as any).structuredPowers;
    let sourceHasEligibleChoice = false;

    for (const power of structuredPowers) {
      if (power?.type !== 'choice') continue;
      if (!Array.isArray((power as any).timings) || !(power as any).timings.includes(phaseKey)) continue;

      if ((shipDef as any).shipType === 'Solar Power') {
        if (playerEnergy > 0) {
          sourceHasEligibleChoice = true;
          break;
        }
        continue;
      }

      const actionRequiresCharge =
        (power.requiresCharge ?? false) ||
        (Array.isArray(power.options) && power.options.some((option: any) => option?.requiresCharge === true));

      if (!actionRequiresCharge) continue;
      if (usedMap[sourceInstanceId] === turnNumber) continue;

      const chargesCurrent = shipInstance.chargesCurrent ?? 0;
      const chargeCost = power.chargeCost ?? 1;
      if (chargesCurrent < chargeCost) continue;

      if (shipDefId === 'EQU') {
        if (cachedShipOfEqualityTargets == null) {
          cachedShipOfEqualityTargets = getValidShipOfEqualityTargets(state, playerId);
        }

        if (
          cachedShipOfEqualityTargets.validOwnTargets.length === 0 ||
          cachedShipOfEqualityTargets.validOpponentTargets.length === 0
        ) {
          continue;
        }
      }

      sourceHasEligibleChoice = true;
      break;
    }

    if (sourceHasEligibleChoice) {
      eligibleSourceIds.push(sourceInstanceId);
    }
  }

  return eligibleSourceIds;
}

function playerHasAvailableChargeOrSolarOption(state: any, player: any): boolean {
  const phaseKey = getCurrentPhaseKey(state);
  if (phaseKey !== 'battle.charge_declaration' && phaseKey !== 'battle.charge_response') {
    return false;
  }

  return getEligibleChargeOrSolarSourceIds(state, player.id, phaseKey).length > 0;
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

  // build.dice_roll: pause only for Ark of Knowledge reroll windows
  if (phaseKey === 'build.dice_roll') {
    return phaseHasAvailableFleetPowers(state, phaseKey);
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
    const snapshotSourceIdsByPlayerId: Record<string, string[]> = {};
    
    for (const player of activePlayers) {
      const eligibleSourceIds = getEligibleChargeOrSolarSourceIds(
        workingState,
        player.id,
        'battle.charge_declaration'
      );
      snapshotSourceIdsByPlayerId[player.id] = eligibleSourceIds;
      snapshot[player.id] = eligibleSourceIds.length > 0;
    }
    
    turnData.chargeDeclarationEligibleSourceIdsByPlayerId = snapshotSourceIdsByPlayerId;
    turnData.chargeDeclarationEligibleByPlayerId = snapshot;
    
    console.log(`[OnEnterPhase] Charge declaration snapshot:`, {
      eligibleByPlayerId: snapshot,
      eligibleSourceIdsByPlayerId: snapshotSourceIdsByPlayerId,
    });
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
    if (anyPlayerHasKno(workingState)) {
      if (turnData.knoRerollPassIndex !== 1 && turnData.knoRerollPassIndex !== 2) {
        turnData.knoRerollPassIndex = 1;
      }
    }

    // Check if dice already rolled this turn
    if (!turnData.diceRolled) {
      const base = rollD6();
      
      // Set canonical dice fields
      turnData.baseDiceRoll = base;
      turnData.effectiveDiceRoll = base;
      turnData.diceRoll = base; // Compatibility mirror
      turnData.diceRolled = true;
      turnData.diceFinalized = false; // Initially not finalized

      const { effectiveByPlayerId, overrideSourceByPlayerId } =
        computeEffectiveDiceStateForPlayers(workingState, base);

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
      
      const hasKnoRerollWindow = anyPlayerHasKnoRerollForCurrentPass(workingState);

      if (!hasKnoRerollWindow) {
        turnData.diceFinalized = true;
        console.log('[OnEnterPhase] Dice finalized automatically (no KNO reroll window)');
      }
    } else {
      // Dice already rolled - use canonical value
      const canonicalDice = turnData.effectiveDiceRoll ?? turnData.baseDiceRoll ?? turnData.diceRoll;
      
      // Ensure gameData mirror is synced
      workingState.gameData.diceRoll = canonicalDice;
      
      // Ensure per-player effective dice map exists (backfill for older states)
      if (!turnData.effectiveDiceRollByPlayerId) {
        const { effectiveByPlayerId, overrideSourceByPlayerId } =
          computeEffectiveDiceStateForPlayers(workingState, canonicalDice);

        turnData.effectiveDiceRollByPlayerId = effectiveByPlayerId;
        if (Object.keys(overrideSourceByPlayerId).length > 0) {
          turnData.diceOverrideSourceByPlayerId = overrideSourceByPlayerId;
        }
      }

      if (anyPlayerHasKnoRerollForCurrentPass(workingState)) {
        turnData.diceFinalized = false;
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

    if (anyPlayerHasKnoRerollForCurrentPass(workingState)) {
      if (!workingState.gameData.phaseReadiness) {
        workingState.gameData.phaseReadiness = [];
      }

      const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
      const passIndex = getKnoRerollPassIndex(workingState);

      for (const player of activePlayers) {
        const eligible = playerHasKnoRerollForPass(workingState, player.id, passIndex);
        if (eligible) continue;

        const existingIndex = workingState.gameData.phaseReadiness.findIndex(
          (r: any) => r.playerId === player.id && r.currentStep === 'build.dice_roll'
        );

        if (existingIndex >= 0) {
          workingState.gameData.phaseReadiness[existingIndex].isReady = true;
        } else {
          workingState.gameData.phaseReadiness.push({
            playerId: player.id,
            isReady: true,
            currentStep: 'build.dice_roll'
          });
        }

        events.push({
          type: 'PLAYER_AUTO_READY',
          playerId: player.id,
          step: 'build.dice_roll',
          reason: 'no_available_kno_reroll',
          atMs: nowMs
        });
      }
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
          const { bonusLines, joiningBonusLines } = computeLineBonusesForPlayer(workingState, player.id);
          const chronoswarmBonusLines = getChronoswarmBonusLinesForPlayer(workingState, player.id);
          const totalLines = baseLines + bonusLines + chronoswarmBonusLines;
          
          const currentLines = player.lines || 0;
          const currentJoiningLines = player.joiningLines || 0;
          player.lines = currentLines + totalLines;
          player.joiningLines = currentJoiningLines + joiningBonusLines;
          
          console.log(
            `[OnEnterPhase] Granted ${totalLines} lines to player ${player.id} ` +
            `(base: ${baseLines}, bonus: ${bonusLines}, chronoswarm: ${chronoswarmBonusLines}, total: ${player.lines}, joiningBonus: ${joiningBonusLines}, joiningTotal: ${player.joiningLines})`
          );
          
          events.push({
            type: 'LINES_GRANTED',
            playerId: player.id,
            baseLines,
            bonusLines,
            joiningBonusLines,
            chronoswarmBonusLines,
            totalGranted: totalLines,
            newTotal: player.lines,
            newJoiningTotal: player.joiningLines,
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
  // BUILD DRAWING PUBLIC SAVED-RESOURCE SNAPSHOT - build.drawing
  // ============================================================================
  // Capture the public Saved Lines view exactly once per turn on the first
  // authoritative entry into build.drawing. Re-entry paths in the same turn
  // must preserve the original drawing-start totals.
  if (toKey === 'build.drawing') {
    const existingSnapshot = turnData.buildDrawingPublicSavedResourcesByPlayerId;
    const hasExistingSnapshot =
      existingSnapshot != null &&
      Object.keys(existingSnapshot).length > 0;

    if (!hasExistingSnapshot) {
      const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
      const snapshot: Record<string, { savedLines: number; savedJoiningLines: number }> = {};

      for (const player of activePlayers) {
        snapshot[player.id] = {
          savedLines: player.lines ?? 0,
          savedJoiningLines: player.joiningLines ?? 0,
        };
      }

      turnData.buildDrawingPublicSavedResourcesByPlayerId = snapshot;

      console.log('[OnEnterPhase] Captured build.drawing public saved-resource snapshot:', snapshot);
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
