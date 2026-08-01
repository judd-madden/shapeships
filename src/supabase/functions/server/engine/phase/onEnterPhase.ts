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
import { isPhaseKey, type PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { rollD6 } from '../util/rollD6.ts';
import { debugLog } from '../../utils/serverLogger.ts';
import type {
  ShipActivationCueSource,
  ShipInstance,
} from '../state/GameStateTypes.ts';
import { appendShipActivationCueBatch } from '../state/shipActivationCues.ts';
import {
  applyAncientBattleRevealPreparation,
} from '../state/ancientState.ts';
import {
  clearChargeDeclarationVisibilityState,
  replaceChargeDeclarationVisibilityState,
} from '../state/chargeDeclarationVisibility.ts';
import {
  getEligibleOrdinaryChargeSourceIdsAtDeclarationStart,
  getRelevantSolarGridSourceIdsAtDeclarationStart,
  playerHasOrdinaryChargeResponseOption,
  playerRequiresChargeDeclarationInput,
} from '../intent/chargeDeclarationEligibility.ts';
import {
  materializeQueuedSimulacrumCopiesAtTurnStart,
} from '../ancient/simulacrumSolarPower.ts';
import {
  anyPlayerIsCubeEligible,
  getCubeEligiblePlayerIds,
  playerIsCubeEligible,
  rollLockedCubeDiceByPlayerId,
} from './cubeDiceManipulation.ts';

type KnoRerollPassIndex = 1 | 2 | 3;

export interface OnEnterResult {
  state: any;
  events: any[];
}

const MAX_AUTO_ADVANCES = 10;
const BATTLE_REVEAL_HOLD_DURATION_MS = 25;

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

function getPhaseHoldForPhase(state: any, phaseKey: PhaseKey) {
  const phaseHold = state?.gameData?.turnData?.phaseHold;
  if (!phaseHold || typeof phaseHold !== 'object') {
    return null;
  }

  if (phaseHold.phaseKey !== phaseKey) {
    return null;
  }

  return phaseHold;
}

function clearLegacyEndOfTurnPhaseHoldForPhase(state: any, phaseKey: PhaseKey): boolean {
  if (phaseKey !== 'battle.end_of_turn_resolution') {
    return false;
  }

  const phaseHold = state?.gameData?.turnData?.phaseHold;
  if (!phaseHold || typeof phaseHold !== 'object') {
    return false;
  }

  if (phaseHold.phaseKey !== phaseKey) {
    return false;
  }

  delete state.gameData.turnData.phaseHold;
  debugLog('[OnEnterPhase] Cleared legacy end-of-turn phase hold during auto-advance', phaseHold);
  return true;
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

function getKnoRerollPassIndex(state: any): KnoRerollPassIndex {
  const passIndex = state?.gameData?.turnData?.knoRerollPassIndex;
  return passIndex === 2 || passIndex === 3 ? passIndex : 1;
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

function getKnoMaxRerollPassCountForPlayer(state: any, playerId: string): KnoRerollPassIndex | 0 {
  return Math.min(3, getKnoCountForPlayer(state, playerId)) as KnoRerollPassIndex | 0;
}

function playerHasKnoRerollForPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): boolean {
  return getKnoMaxRerollPassCountForPlayer(state, playerId) >= passIndex;
}

function playerIsKnoRerollStopped(state: any, playerId: string): boolean {
  return state?.gameData?.turnData?.knoRerollStoppedByPlayerId?.[playerId] === true;
}

function anyPlayerHasKnoRerollForCurrentPass(state: any): boolean {
  const passIndex = getKnoRerollPassIndex(state);
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) => (
    playerHasKnoRerollForPass(state, player.id, passIndex) &&
    !playerIsKnoRerollStopped(state, player.id)
  ));
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
 * NOTE: Charge Declaration and Charge Response use dedicated ordinary/SOL eligibility logic.
 * Solar posture never contributes to Charge Response.
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

function anyPlayerRequiresChargeDeclarationInput(state: any): boolean {
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) =>
    playerRequiresChargeDeclarationInput(state, player.id)
  );
}

function anyPlayerHasOrdinaryChargeResponseOption(state: any): boolean {
  const activePlayers = state.players?.filter((p: any) => p.role === 'player') || [];
  return activePlayers.some((player: any) =>
    playerHasOrdinaryChargeResponseOption(state, player.id)
  );
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

  // battle.charge_declaration: ordinary charge, Ancient Energy, or charged SOL input
  if (phaseKey === 'battle.charge_declaration') {
    return anyPlayerRequiresChargeDeclarationInput(state);
  }

  // battle.charge_response: requires input only if charges declared AND options exist
  if (phaseKey === 'battle.charge_response') {
    // THREE-CONDITION GATE (paper-play accurate):
    // 1. At least one ordinary response-capable charge was spent during declaration
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
    
    // 3. After declaration, someone still has an ordinary charge response available
    return anyPlayerHasOrdinaryChargeResponseOption(state);
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
  
  debugLog(`[OnEnterPhase] Entering: ${toKey} (from: ${fromKey || 'initial'})`);
  
  // Ensure gameData and turnData exist
  if (!workingState.gameData) {
    workingState.gameData = {};
  }
  if (!workingState.gameData.turnData) {
    workingState.gameData.turnData = {};
  }

  if (toKey === 'build.drawing') {
    workingState = structuredClone(workingState);
    const existingSnapshot =
      workingState.gameData.turnData.buildDrawingPublicSavedResourcesByPlayerId;
    const hasExistingSnapshot =
      existingSnapshot != null &&
      Object.keys(existingSnapshot).length > 0;
    if (!hasExistingSnapshot) {
      const activePlayers =
        workingState.players?.filter((player: any) => player.role === 'player') || [];
      const snapshot: Record<string, {
        savedLines: number;
        savedJoiningLines: number;
      }> = {};
      for (const player of activePlayers) {
        snapshot[player.id] = {
          savedLines: player.lines ?? 0,
          savedJoiningLines: player.joiningLines ?? 0,
        };
      }
      workingState.gameData.turnData.buildDrawingPublicSavedResourcesByPlayerId =
        snapshot;
      debugLog(
        '[OnEnterPhase] Captured build.drawing public saved-resource snapshot:',
        snapshot,
      );
    }

  }

  if (toKey === 'build.dice_roll') {
    // Materialization is the first Dice Roll transition work. Validate and
    // reconcile against an isolated candidate before any dice-phase state is
    // mutated or any fleet-dependent setup scans the fleet.
    const transitionCandidate = structuredClone(workingState);
    const materializationTurnNumber =
      transitionCandidate.gameData.turnNumber ??
      transitionCandidate.gameData.turnData?.turnNumber ??
      transitionCandidate.turnNumber ??
      0;
    const materialized = materializeQueuedSimulacrumCopiesAtTurnStart(
      transitionCandidate,
      materializationTurnNumber,
      nowMs,
    );
    workingState = materialized.state;
    events.push(...materialized.events);
  }

  const turnData = workingState.gameData.turnData;

  if (
    fromKey === 'battle.charge_declaration' &&
    toKey !== 'battle.charge_declaration'
  ) {
    clearChargeDeclarationVisibilityState(workingState);
  }

  // ============================================================================
  // BATTLE REVEAL VISIBILITY BARRIER - battle.reveal
  // ============================================================================
  // Persist battle.reveal as a real current phase before later battle auto-advance.
  // This is presentation/visibility barrier state, not a gameplay rule.
  if (toKey === 'battle.reveal') {
    workingState = applyAncientBattleRevealPreparation(workingState);

    const turnNumber =
      workingState.gameData?.turnNumber ??
      turnData.turnNumber ??
      workingState.turnNumber ??
      0;

    if (turnData.battleRevealHoldPresentedTurnNumber !== turnNumber) {
      turnData.battleRevealHoldPresentedTurnNumber = turnNumber;
      turnData.phaseHold = {
        phaseKey: 'battle.reveal',
        holdReason: 'battle_reveal',
        holdUntilMs: nowMs + BATTLE_REVEAL_HOLD_DURATION_MS,
      };

      debugLog('[OnEnterPhase] Created battle.reveal visibility phase hold', {
        turnNumber,
        holdUntilMs: turnData.phaseHold.holdUntilMs,
      });
    }
  }
  
  // ============================================================================
  // CHARGE DECLARATION SNAPSHOT - battle.charge_declaration
  // ============================================================================
  // Snapshot ordinary response-capable sources separately from Ancient SOL choices.
  // Only the ordinary snapshot gates battle.charge_response later.
  
  if (toKey === 'battle.charge_declaration') {
    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
    const snapshot: Record<string, boolean> = {};
    const snapshotSourceIdsByPlayerId: Record<string, string[]> = {};
    const solarSnapshotSourceIdsByPlayerId: Record<string, string[]> = {};
    const snapshotFleetByPlayerId: Record<string, ShipInstance[]> = {};
    
    for (const player of activePlayers) {
      const eligibleSourceIds = getEligibleOrdinaryChargeSourceIdsAtDeclarationStart(
        workingState,
        player.id,
      );
      const solarSourceIds = getRelevantSolarGridSourceIdsAtDeclarationStart(
        workingState,
        player.id,
      );
      const liveFleet = workingState?.gameData?.ships?.[player.id] ?? [];
      snapshotSourceIdsByPlayerId[player.id] = eligibleSourceIds;
      solarSnapshotSourceIdsByPlayerId[player.id] = solarSourceIds;
      snapshotFleetByPlayerId[player.id] = Array.isArray(liveFleet)
        ? liveFleet.map((ship: ShipInstance) => structuredClone(ship))
        : [];
      snapshot[player.id] = eligibleSourceIds.length > 0;
    }
    
    turnData.chargeDeclarationEligibleSourceIdsByPlayerId = snapshotSourceIdsByPlayerId;
    turnData.solarGridDeclarationSourceIdsByPlayerId = solarSnapshotSourceIdsByPlayerId;
    turnData.chargeDeclarationEligibleByPlayerId = snapshot;
    turnData.chargeDeclarationFleetSnapshotByPlayerId = snapshotFleetByPlayerId;
    replaceChargeDeclarationVisibilityState(workingState);
    
    debugLog(`[OnEnterPhase] Charge declaration snapshot:`, {
      eligibleByPlayerId: snapshot,
      eligibleSourceIdsByPlayerId: snapshotSourceIdsByPlayerId,
      solarGridSourceIdsByPlayerId: solarSnapshotSourceIdsByPlayerId,
      fleetSnapshotSizesByPlayerId: Object.fromEntries(
        Object.entries(snapshotFleetByPlayerId).map(([playerId, fleet]) => [playerId, fleet.length])
      ),
      visibilitySnapshotBattleTurnNumber:
        turnData.chargeDeclarationVisibilitySnapshot?.battleTurnNumber,
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
    const diceActivationSources: ShipActivationCueSource[] = [];

    if (
      turnData.diceManipulationStage !== 'kno' &&
      turnData.diceManipulationStage !== 'cube' &&
      anyPlayerHasKno(workingState)
    ) {
      if (
        turnData.knoRerollPassIndex !== 1 &&
        turnData.knoRerollPassIndex !== 2 &&
        turnData.knoRerollPassIndex !== 3
      ) {
        turnData.knoRerollPassIndex = 1;
        turnData.knoRerollStoppedByPlayerId = {};
      }
    }

    if (
      turnData.diceManipulationStage !== 'kno' &&
      turnData.diceManipulationStage !== 'cube'
    ) {
      if (anyPlayerHasKnoRerollForCurrentPass(workingState)) {
        turnData.diceManipulationStage = 'kno';
      } else if (anyPlayerIsCubeEligible(workingState)) {
        turnData.diceManipulationStage = 'cube';
        delete turnData.knoRerollPassIndex;
        turnData.pendingKnoRerollChoiceByPassByPlayerId = {};
        turnData.knoRerollStoppedByPlayerId = {};
      } else {
        delete turnData.diceManipulationStage;
      }
    }

    // Check if dice already rolled this turn
    if (!turnData.diceRolled) {
      turnData.knoRerollStoppedByPlayerId = {};
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

      if (base !== 6) {
        const activePlayers =
          workingState.players?.filter((player: any) => player.role === 'player') || [];
        for (const player of activePlayers) {
          if (overrideSourceByPlayerId[player.id] !== 'LEV') continue;

          const fleet = workingState.gameData?.ships?.[player.id] ?? [];
          for (const ship of fleet) {
            if (
              ship?.shipDefId === 'LEV' &&
              typeof ship?.instanceId === 'string'
            ) {
              diceActivationSources.push({
                playerId: player.id,
                sourceInstanceId: ship.instanceId,
              });
            }
          }
        }
      }
      
      debugLog(`[OnEnterPhase] Rolled dice: ${base}`);
      
      events.push({
        type: 'DICE_ROLLED',
        value: base,
        turnNumber: workingState.gameData.turnNumber || 1,
        atMs: nowMs
      });
      
      if (!turnData.diceManipulationStage) {
        turnData.diceFinalized = true;
        debugLog('[OnEnterPhase] Dice finalized automatically (no Dice Manipulation input)');
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

      turnData.diceFinalized = turnData.diceManipulationStage ? false : true;

      debugLog(`[OnEnterPhase] Dice already rolled this turn (${canonicalDice})`);
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

      debugLog(`[OnEnterPhase] Rolled Chronoswarm dice: ${chronoswarmRolls.join(', ')}`);

      events.push({
        type: 'CHRONOSWARM_ROLLED',
        rolls: [...chronoswarmRolls],
        chronoswarmCountByPlayerId,
        sharedRollCount: chronoswarmRolls.length,
        turnNumber: workingState.gameData.turnNumber || 1,
        atMs: nowMs,
      });

      const activePlayers =
        workingState.players?.filter((player: any) => player.role === 'player') || [];
      for (const player of activePlayers) {
        const fleet = workingState.gameData?.ships?.[player.id] ?? [];
        const contributingChronoswarms = fleet
          .filter(
            (ship: any) =>
              ship?.shipDefId === 'CHR' &&
              typeof ship?.instanceId === 'string'
          )
          .slice(0, Math.min(chronoswarmCountByPlayerId[player.id] ?? 0, chronoswarmRolls.length));

        for (const ship of contributingChronoswarms) {
          diceActivationSources.push({
            playerId: player.id,
            sourceInstanceId: ship.instanceId,
          });
        }
      }
    } else {
      turnData.chronoswarmRolls = existingChronoswarmRolls;
      turnData.chronoswarmSharedRollCount = existingChronoswarmRolls.length;
    }

    if (turnData.diceManipulationStage === 'cube') {
      if (turnData.cubeDiceRollsByPlayerId === undefined) {
        const cubeDiceRollsByPlayerId = rollLockedCubeDiceByPlayerId(
          workingState,
          rollD6,
        );
        turnData.cubeDiceRollsByPlayerId = cubeDiceRollsByPlayerId;
        turnData.visibleCubeDiceValueByPlayerId = Object.fromEntries(
          Object.entries(cubeDiceRollsByPlayerId)
            .filter(([, rolls]) => rolls.length > 0)
            .map(([playerId, rolls]) => [playerId, rolls[0].value]),
        );
      }
      turnData.diceFinalized = false;
    }

    if (
      turnData.diceManipulationStage === 'kno' &&
      anyPlayerHasKnoRerollForCurrentPass(workingState)
    ) {
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
    } else if (turnData.diceManipulationStage === 'cube') {
      if (!workingState.gameData.phaseReadiness) {
        workingState.gameData.phaseReadiness = [];
      }

      const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];
      const eligiblePlayerIds = new Set(getCubeEligiblePlayerIds(workingState));

      for (const player of activePlayers) {
        if (eligiblePlayerIds.has(player.id) && playerIsCubeEligible(workingState, player.id)) {
          continue;
        }

        const existingIndex = workingState.gameData.phaseReadiness.findIndex(
          (r: any) => r.playerId === player.id && r.currentStep === 'build.dice_roll'
        );
        if (existingIndex >= 0) {
          workingState.gameData.phaseReadiness[existingIndex].isReady = true;
        } else {
          workingState.gameData.phaseReadiness.push({
            playerId: player.id,
            isReady: true,
            currentStep: 'build.dice_roll',
          });
        }

        events.push({
          type: 'PLAYER_AUTO_READY',
          playerId: player.id,
          step: 'build.dice_roll',
          reason: 'no_available_cube_choice',
          atMs: nowMs,
        });
      }
    }

    workingState = appendShipActivationCueBatch(workingState, {
      key: `ship-activation:${
        turnData.turnNumber ??
        workingState.gameData?.turnNumber ??
        workingState.turnNumber ??
        0
      }:build.dice_roll:initial`,
      phaseKey: 'build.dice_roll',
      sources: diceActivationSources,
    });
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
      debugLog(`[OnEnterPhase] Lines already distributed this turn, skipping`);
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
        const lineActivationSources: ShipActivationCueSource[] = [];
        
        for (const player of activePlayers) {
          const baseLines = turnData.effectiveDiceRollByPlayerId?.[player.id] ?? canonicalBaseLines;
          const {
            bonusLines,
            joiningBonusLines,
            contributingSourceInstanceIds,
          } = computeLineBonusesForPlayer(workingState, player.id);
          const chronoswarmBonusLines = getChronoswarmBonusLinesForPlayer(workingState, player.id);
          const totalLines = baseLines + bonusLines + chronoswarmBonusLines;

          for (const sourceInstanceId of contributingSourceInstanceIds) {
            lineActivationSources.push({
              playerId: player.id,
              sourceInstanceId,
            });
          }
          
          const currentLines = player.lines || 0;
          const currentJoiningLines = player.joiningLines || 0;
          player.lines = currentLines + totalLines;
          player.joiningLines = currentJoiningLines + joiningBonusLines;
          
          debugLog(
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
        workingState = appendShipActivationCueBatch(workingState, {
          key: `ship-activation:${
            turnData.turnNumber ??
            workingState.gameData?.turnNumber ??
            workingState.turnNumber ??
            0
          }:build.line_generation`,
          phaseKey: 'build.line_generation',
          sources: lineActivationSources,
        });
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
        
        debugLog(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);
        
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

        debugLog(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);

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
  // 1. Auto-ready players who have no declaration input or ordinary response input
  // 2. Only eligible players must click Ready to advance

  if (toKey === 'battle.charge_declaration' || toKey === 'battle.charge_response') {
    // Ensure phaseReadiness array exists
    if (!workingState.gameData.phaseReadiness) {
      workingState.gameData.phaseReadiness = [];
    }

    const activePlayers = workingState.players?.filter((p: any) => p.role === 'player') || [];

    for (const player of activePlayers) {
      const eligible = toKey === 'battle.charge_declaration'
        ? playerRequiresChargeDeclarationInput(workingState, player.id)
        : playerHasOrdinaryChargeResponseOption(workingState, player.id);

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

        debugLog(`[OnEnterPhase] Auto-readied ineligible player: ${player.id}`);

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
        debugLog(
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
    clearLegacyEndOfTurnPhaseHoldForPhase(workingState, currentKey);

    const existingPhaseHold = getPhaseHoldForPhase(workingState, currentKey);
    if (existingPhaseHold) {
      debugLog(`[OnEnterPhase] Phase ${currentKey} is held authoritatively, stopping auto-advance`, existingPhaseHold);
      break;
    }

    // Execute on-enter hooks for current phase
    const enterResult = enterPhaseOnce(workingState, fromKey, currentKey, nowMs);
    workingState = enterResult.state;
    allEvents.push(...enterResult.events);

    clearLegacyEndOfTurnPhaseHoldForPhase(workingState, currentKey);

    const phaseHold = getPhaseHoldForPhase(workingState, currentKey);
    if (phaseHold) {
      debugLog(`[OnEnterPhase] Phase ${currentKey} created authoritative hold, stopping auto-advance`, phaseHold);
      break;
    }
    
    // Check if game is finished (victory conditions)
    if (workingState.status === 'finished') {
      debugLog(`[OnEnterPhase] Game finished, stopping auto-advance`);
      break;
    }
    
    // Special case: build.line_generation must wait for dice finalization
    if (currentKey === 'build.line_generation') {
      const turnData = workingState.gameData?.turnData || {};
      if (turnData.diceFinalized !== true) {
        debugLog(`[OnEnterPhase] Stopping at line_generation: dice not finalized yet`);
        break;
      }
    }
    
    // Re-evaluate if phase requires input (after on-enter work may have changed state)
    const requiresInput = phaseRequiresPlayerInput(workingState, currentKey);
    
    if (requiresInput) {
      debugLog(`[OnEnterPhase] Phase ${currentKey} requires player input, stopping auto-advance`);
      break;
    }
    
    // Phase requires no input -> auto-advance
    debugLog(`[OnEnterPhase] Phase ${currentKey} requires no input, auto-advancing...`);
    
    const advanceResult = advancePhase(workingState, { ignoreReadiness: true }, nowMs);
    
    if (!advanceResult.ok) {
      debugLog(`[OnEnterPhase] Auto-advance blocked: ${advanceResult.error}`);
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
    
    debugLog(`[OnEnterPhase] Auto-advanced: ${currentKey} → ${nextKey}`);
    
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
