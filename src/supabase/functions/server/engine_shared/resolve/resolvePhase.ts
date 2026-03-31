/**
 * RESOLVE PHASE
 *
 * Single entry point for shared phase resolution.
 * Orchestrates: Ship Powers → Effects → Application
 *
 * WORKFLOW:
 * 1. Collect structured powers from active ships
 * 2. Translate powers to effects for current phase
 * 3. Apply effects to game state
 * 4. Return updated state + events
 *
 * This pass implements only battle.end_of_turn_resolution.
 * Future passes will expand to other phases.
 */

import type {
  GameState,
  LastTurnBreakdownRow,
  PendingTurnBreakdownEntry,
  ShipInstance,
} from '../../engine/state/GameStateTypes.ts';
import { GAME_STATE_TYPES_VERSION } from '../../engine/state/GameStateTypes.ts';
import type { PhaseKey } from '../phase/PhaseTable.ts';
import type { Effect, CreateShipEffect } from '../effects/Effect.ts';
import { EffectTiming, EffectKind, SurvivabilityRule } from '../effects/Effect.ts';
import { translateShipPowers, type TranslateContext } from '../effects/translateShipPowers.ts';
import { applyEffects, type EffectEvent } from '../effects/applyEffects.ts';
import { getCanonicalShipFamilyDisplayName } from '../defs/ShipDefinitionNames.ts';
import { getShipDefinition } from '../defs/ShipDefinitions.withStructuredPowers.ts';
import {
  computePhaseComputedEffects,
  applyComputedEffectModifiers,
  getEffectiveDiceRollForPlayer,
  getCopyTierFromFleet,
} from './phaseComputedEffects.ts';

function countCreatedShipsByTargetPlayerId(
  effects: Effect[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const effect of effects) {
    if (effect.kind !== EffectKind.CreateShip) continue;

    const playerId = effect.target.playerId;
    counts[playerId] = (counts[playerId] || 0) + 1;
  }

  return counts;
}

function incrementShipsMadeThisTurnCounter(
  state: GameState,
  countsByPlayerId: Record<string, number>
): GameState {
  const entries = Object.entries(countsByPlayerId).filter(([, amount]) =>
    Number.isInteger(amount) && amount > 0
  );

  if (entries.length === 0) return state;

  const priorTurnData = state.gameData.turnData || {};
  const priorCounts = priorTurnData.shipsMadeThisTurnByPlayerId || {};
  const nextCounts = { ...priorCounts };

  for (const [playerId, amount] of entries) {
    nextCounts[playerId] = (nextCounts[playerId] || 0) + amount;
  }

  return {
    ...state,
    gameData: {
      ...state.gameData,
      turnData: {
        ...priorTurnData,
        shipsMadeThisTurnByPlayerId: nextCounts,
      },
    },
  };
}

function getShipsThatBuildPassIndex(state: GameState): 1 | 2 {
  return state.gameData?.turnData?.shipsThatBuildPassIndex === 2 ? 2 : 1;
}

function getChronoswarmCountForPlayer(state: GameState, playerId: string): number {
  const raw = state.gameData?.turnData?.chronoswarmCountByPlayerId?.[playerId];
  const value = typeof raw === 'number' ? raw : 0;
  return Number.isInteger(value) && value > 0 ? value : 0;
}

function playerParticipatesInShipsThatBuildPass(
  state: GameState,
  playerId: string
): boolean {
  const passIndex = getShipsThatBuildPassIndex(state);
  return passIndex === 1 || getChronoswarmCountForPlayer(state, playerId) > 0;
}

function collectQueenAutoBuildEffects(
  state: GameState,
  phaseKey: PhaseKey
): CreateShipEffect[] {
  const currentTurn =
    state.gameData?.turnData?.turnNumber ??
    state.gameData?.turnNumber ??
    1;

  const activePlayers = state.players.filter((player) => player.role === 'player');
  const effects: CreateShipEffect[] = [];

  for (const player of activePlayers) {
    if (!playerParticipatesInShipsThatBuildPass(state, player.id)) continue;

    const fleet = state.gameData.ships?.[player.id] || [];
    const eligibleQueens = fleet.filter(
      (ship) => ship.shipDefId === 'QUE' && (ship.createdTurn ?? 0) < currentTurn
    );

    for (const queen of eligibleQueens) {
      effects.push({
        id: `queen_build_${currentTurn}_${queen.instanceId}`,
        ownerPlayerId: player.id,
        source: {
          type: 'ship',
          instanceId: queen.instanceId,
          shipDefId: queen.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        target: { playerId: player.id },
        survivability: SurvivabilityRule.DiesWithSource,
        kind: EffectKind.CreateShip,
        shipDefId: 'XEN',
      });
    }
  }

  return effects;
}

function collectBugBreederAutoBuildEffects(
  state: GameState,
  phaseKey: PhaseKey
): Effect[] {
  const currentTurn =
    state.gameData?.turnData?.turnNumber ??
    state.gameData?.turnNumber ??
    1;

  const activePlayers = state.players.filter((player) => player.role === 'player');
  const effects: Effect[] = [];

  for (const player of activePlayers) {
    if (!playerParticipatesInShipsThatBuildPass(state, player.id)) continue;

    const fleet = state.gameData.ships?.[player.id] || [];
    const eligibleBugBreeders = fleet.filter(
      (ship) =>
        ship.shipDefId === 'BUG' &&
        (ship.createdTurn ?? 0) < currentTurn &&
        (ship.chargesCurrent ?? 0) >= 1
    );

    for (const bugBreeder of eligibleBugBreeders) {
      effects.push({
        id: `bug_build_${currentTurn}_${bugBreeder.instanceId}_charge`,
        ownerPlayerId: player.id,
        source: {
          type: 'ship',
          instanceId: bugBreeder.instanceId,
          shipDefId: bugBreeder.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        target: { playerId: player.id },
        survivability: SurvivabilityRule.DiesWithSource,
        kind: EffectKind.SpendCharge,
        amount: 1,
      });

      effects.push({
        id: `bug_build_${currentTurn}_${bugBreeder.instanceId}_xenite`,
        ownerPlayerId: player.id,
        source: {
          type: 'ship',
          instanceId: bugBreeder.instanceId,
          shipDefId: bugBreeder.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        target: { playerId: player.id },
        survivability: SurvivabilityRule.DiesWithSource,
        kind: EffectKind.CreateShip,
        shipDefId: 'XEN',
      });
    }
  }

  return effects;
}

function collectZenithAutoBuildEffects(
  state: GameState,
  phaseKey: PhaseKey
): CreateShipEffect[] {
  const currentTurn =
    state.gameData?.turnData?.turnNumber ??
    state.gameData?.turnNumber ??
    1;

  const activePlayers = state.players.filter((player) => player.role === 'player');
  const effects: CreateShipEffect[] = [];
  const passIndex = getShipsThatBuildPassIndex(state);

  for (const player of activePlayers) {
    if (!playerParticipatesInShipsThatBuildPass(state, player.id)) continue;

    const fleet = state.gameData.ships?.[player.id] || [];
    const eligibleZeniths = fleet.filter(
      (ship) => ship.shipDefId === 'ZEN' && (ship.createdTurn ?? 0) < currentTurn
    );
    const roll = passIndex === 2
      ? state.gameData?.turnData?.chronoswarmRolls?.[0]
      : getEffectiveDiceRollForPlayer(state, player.id);

    for (const zenith of eligibleZeniths) {
      if (roll === 2) {
        effects.push({
          id: `zenith_build_${currentTurn}_${zenith.instanceId}_xen_0`,
          ownerPlayerId: player.id,
          source: {
            type: 'ship',
            instanceId: zenith.instanceId,
            shipDefId: zenith.shipDefId,
          },
          timing: phaseKey,
          activationTag: EffectTiming.Automatic,
          target: { playerId: player.id },
          survivability: SurvivabilityRule.DiesWithSource,
          kind: EffectKind.CreateShip,
          shipDefId: 'XEN',
        });
        continue;
      }

      if (roll === 3) {
        effects.push({
          id: `zenith_build_${currentTurn}_${zenith.instanceId}_ant_0`,
          ownerPlayerId: player.id,
          source: {
            type: 'ship',
            instanceId: zenith.instanceId,
            shipDefId: zenith.shipDefId,
          },
          timing: phaseKey,
          activationTag: EffectTiming.Automatic,
          target: { playerId: player.id },
          survivability: SurvivabilityRule.DiesWithSource,
          kind: EffectKind.CreateShip,
          shipDefId: 'ANT',
        });
        continue;
      }

      if (roll === 4) {
        for (let i = 0; i < 2; i++) {
          effects.push({
            id: `zenith_build_${currentTurn}_${zenith.instanceId}_xen_${i}`,
            ownerPlayerId: player.id,
            source: {
              type: 'ship',
              instanceId: zenith.instanceId,
              shipDefId: zenith.shipDefId,
            },
            timing: phaseKey,
            activationTag: EffectTiming.Automatic,
            target: { playerId: player.id },
            survivability: SurvivabilityRule.DiesWithSource,
            kind: EffectKind.CreateShip,
            shipDefId: 'XEN',
          });
        }
      }
    }
  }

  return effects;
}

function getPlayerMaxHealth(): number {
  return 35;
}

type TurnTotals = {
  damageByPlayerId: Record<string, number>;
  healByPlayerId: Record<string, number>;
};

type LastTurnBreakdownSnapshots = {
  damageDealtByPlayerId: Record<string, LastTurnBreakdownRow[]>;
  healingReceivedByPlayerId: Record<string, LastTurnBreakdownRow[]>;
};

function buildBaseAmountByEffectId(effects: Effect[]): Record<string, number> {
  const baseAmountByEffectId: Record<string, number> = {};

  for (const effect of effects) {
    if (effect.kind !== EffectKind.Damage && effect.kind !== EffectKind.Heal) continue;
    baseAmountByEffectId[effect.id] = effect.amount;
  }

  return baseAmountByEffectId;
}

function formatAmountText(amount: number): string {
  return String(amount);
}

function sortBreakdownRows(rows: LastTurnBreakdownRow[]): LastTurnBreakdownRow[] {
  return [...rows].sort((a, b) => {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.label.localeCompare(b.label);
  });
}

function playerHasKnoTierThree(state: GameState, playerId: string): boolean {
  const ships = state.gameData.ships?.[playerId] || [];
  return getCopyTierFromFleet(ships, 'KNO', 3) >= 3;
}

function buildRowsForPendingEntries(
  entries: PendingTurnBreakdownEntry[],
  sciLabel: string,
  displayedTotal: number,
  allowKnoAdjustment: boolean
): LastTurnBreakdownRow[] {
  const shipBuckets = new Map<string, { shipDefId: string; instanceIds: Set<string>; amount: number }>();
  const syntheticBuckets = new Map<string, number>();
  let sciAdjustmentAmount = 0;

  for (const entry of entries) {
    const baseAmount = Number.isFinite(entry.baseAmount) ? entry.baseAmount : 0;
    const finalAmount = Number.isFinite(entry.finalAmount) ? entry.finalAmount : baseAmount;
    const sciDelta = Math.max(0, finalAmount - baseAmount);
    sciAdjustmentAmount += sciDelta;

    if (baseAmount <= 0) continue;

    if (entry.sourceShipDefId) {
      const existing = shipBuckets.get(entry.sourceShipDefId) ?? {
        shipDefId: entry.sourceShipDefId,
        instanceIds: new Set<string>(),
        amount: 0,
      };

      if (entry.sourceInstanceId) {
        existing.instanceIds.add(entry.sourceInstanceId);
      }

      existing.amount += baseAmount;
      shipBuckets.set(entry.sourceShipDefId, existing);
      continue;
    }

    const syntheticLabel = entry.sourceLabel || 'System';
    syntheticBuckets.set(syntheticLabel, (syntheticBuckets.get(syntheticLabel) || 0) + baseAmount);
  }

  const rows: LastTurnBreakdownRow[] = [];

  for (const bucket of shipBuckets.values()) {
    if (bucket.amount <= 0) continue;
    const count = Math.max(bucket.instanceIds.size, 1);
    rows.push({
      rowKind: 'ship',
      label: getCanonicalShipFamilyDisplayName(bucket.shipDefId, count),
      count,
      amount: bucket.amount,
      amountText: formatAmountText(bucket.amount),
    });
  }

  for (const [label, amount] of syntheticBuckets.entries()) {
    if (amount <= 0) continue;
    rows.push({
      rowKind: 'adjustment',
      label,
      amount,
      amountText: formatAmountText(amount),
    });
  }

  if (sciAdjustmentAmount > 0) {
    rows.push({
      rowKind: 'adjustment',
      label: sciLabel,
      amount: sciAdjustmentAmount,
      amountText: formatAmountText(sciAdjustmentAmount),
    });
  }

  const currentSum = rows.reduce((sum, row) => sum + row.amount, 0);
  const knoAdjustmentAmount = displayedTotal - currentSum;

  if (allowKnoAdjustment && knoAdjustmentAmount > 0) {
    rows.push({
      rowKind: 'adjustment',
      label: 'Ark of Knowledge',
      amount: knoAdjustmentAmount,
      amountText: formatAmountText(knoAdjustmentAmount),
    });
  }

  return sortBreakdownRows(rows.filter((row) => row.amount > 0));
}

function buildLastTurnBreakdownSnapshots(
  state: GameState,
  totals: TurnTotals
): LastTurnBreakdownSnapshots {
  const activePlayers = state.players.filter((player) => player.role === 'player');
  const damageDealtByPlayerId: Record<string, LastTurnBreakdownRow[]> = {};
  const healingReceivedByPlayerId: Record<string, LastTurnBreakdownRow[]> = {};
  const opponentIdByPlayerId = new Map<string, string>();

  if (activePlayers.length === 2) {
    opponentIdByPlayerId.set(activePlayers[0].id, activePlayers[1].id);
    opponentIdByPlayerId.set(activePlayers[1].id, activePlayers[0].id);
  }

  const pendingEntries = state.gameData.pendingTurn?.breakdownEntries || [];

  for (const player of activePlayers) {
    const opponentId = opponentIdByPlayerId.get(player.id);
    const damageEntries = pendingEntries.filter(
      (entry) => entry.kind === 'Damage' && entry.ownerPlayerId === player.id
    );
    const healEntries = pendingEntries.filter(
      (entry) => entry.kind === 'Heal' && entry.targetPlayerId === player.id
    );
    const displayedDamageTotal = opponentId ? totals.damageByPlayerId[opponentId] || 0 : 0;
    const displayedHealTotal = totals.healByPlayerId[player.id] || 0;
    const hasKnoTierThree = playerHasKnoTierThree(state, player.id);

    damageDealtByPlayerId[player.id] = buildRowsForPendingEntries(
      damageEntries,
      'Science Vessel',
      displayedDamageTotal,
      hasKnoTierThree
    );
    healingReceivedByPlayerId[player.id] = buildRowsForPendingEntries(
      healEntries,
      'Science Vessel',
      displayedHealTotal,
      hasKnoTierThree
    );
  }

  return {
    damageDealtByPlayerId,
    healingReceivedByPlayerId,
  };
}

// ============================================================================
// RESOLVE PHASE
// ============================================================================

/**
 * Resolve a phase by processing all ship powers and applying effects
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
export function resolvePhase(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolvePhase] Resolving phase: ${phaseKey}`);
  console.log(`[resolvePhase] GameStateTypes version: ${GAME_STATE_TYPES_VERSION}`);

  // Handle ships_that_build phase (create ships from ship-building powers)
  if (phaseKey === 'build.ships_that_build') {
    return resolveShipsThatBuild(state, phaseKey);
  }

  // Handle end-of-build automatic ship creation
  if (phaseKey === 'build.end_of_build') {
    return resolveBuildEndOfBuild(state, phaseKey);
  }

  // Handle battle end-of-turn resolution (damage/heal effects)
  if (phaseKey === 'battle.end_of_turn_resolution') {
    return resolveBattleEndOfTurn(state, phaseKey);
  }

  // No resolution logic for other phases
  console.log(`[resolvePhase] No resolution logic for phase: ${phaseKey}`);
  return { state, events: [] };
}

// ============================================================================
// SHIPS THAT BUILD RESOLUTION
// ============================================================================

/**
 * Resolve the ships_that_build phase by creating ships from ship-building powers
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
function resolveShipsThatBuild(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolveShipsThatBuild] Resolving phase: ${phaseKey}`);

  // Collect all effects from all ships
  const effects = [
    ...collectEffectsForPhase(state, phaseKey),
    ...collectBugBreederAutoBuildEffects(state, phaseKey),
    ...collectQueenAutoBuildEffects(state, phaseKey),
    ...collectZenithAutoBuildEffects(state, phaseKey),
  ];

  console.log(`[resolveShipsThatBuild] Collected ${effects.length} effects for ${phaseKey}`);

  // Apply effects to state
  let result = applyEffects(state, effects);
  const createdShipsByPlayerId = countCreatedShipsByTargetPlayerId(effects);
  result = {
    ...result,
    state: incrementShipsMadeThisTurnCounter(
      result.state,
      createdShipsByPlayerId
    ),
  };

  console.log(`[resolveShipsThatBuild] Applied effects, generated ${result.events.length} events`);

  return result;
}

// ============================================================================
// BUILD END-OF-BUILD RESOLUTION
// ============================================================================

function resolveBuildEndOfBuild(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolveBuildEndOfBuild] Resolving phase: ${phaseKey}`);

  const currentTurn =
    state.gameData?.turnData?.turnNumber ??
    state.gameData?.turnNumber ??
    1;

  const priorTurnData = state.gameData.turnData || {};
  if (priorTurnData.buildEndOfBuildAppliedTurnNumber === currentTurn) {
    console.log(`[resolveBuildEndOfBuild] Already applied for turn ${currentTurn}, skipping`);
    return { state, events: [] };
  }

  let workingState: GameState = {
    ...state,
    gameData: {
      ...state.gameData,
      turnData: {
        ...priorTurnData,
        buildEndOfBuildAppliedTurnNumber: currentTurn,
      },
    },
  };

  const activePlayers = workingState.players.filter((player) => player.role === 'player');

  workingState = {
    ...workingState,
    players: workingState.players.map((player) => {
      if (player.role !== 'player') return player;

      const fleet = workingState.gameData.ships?.[player.id] || [];
      const builtRedThisTurn = fleet.some(
        (ship) =>
          ship.shipDefId === 'RED' &&
          (ship.createdTurn ?? 0) === currentTurn
      );

      if (!builtRedThisTurn) return player;

      // RED sets health directly during build.end_of_build; this is not healing.
      return {
        ...player,
        health: getPlayerMaxHealth(),
      };
    }),
  };

  const fighterEffects: CreateShipEffect[] = [];

  for (const player of activePlayers) {
    const fleet = workingState.gameData.ships?.[player.id] || [];
    const dreadnoughts = fleet.filter((ship) => ship.shipDefId === 'DRE');
    const totalShipsMadeThisTurn =
      workingState.gameData.turnData?.shipsMadeThisTurnByPlayerId?.[player.id] ?? 0;

    if (dreadnoughts.length <= 0 || totalShipsMadeThisTurn <= 0) continue;

    for (const dreadnought of dreadnoughts) {
      const shipsMade =
        (dreadnought.createdTurn ?? 0) === currentTurn
          ? Math.max(totalShipsMadeThisTurn - 1, 0)
          : totalShipsMadeThisTurn;

      if (shipsMade <= 0) continue;

      for (let i = 0; i < shipsMade; i++) {
        fighterEffects.push({
          id: `dreadnought_build_${currentTurn}_${dreadnought.instanceId}_${i}`,
          ownerPlayerId: player.id,
          source: {
            type: 'ship',
            instanceId: dreadnought.instanceId,
            shipDefId: dreadnought.shipDefId,
          },
          timing: phaseKey,
          activationTag: EffectTiming.Automatic,
          target: { playerId: player.id },
          survivability: SurvivabilityRule.DiesWithSource,
          kind: EffectKind.CreateShip,
          shipDefId: 'FIG',
          free: true,
          createdBy: 'dreadnought',
        });
      }

      console.log(
        `[resolveBuildEndOfBuild] Dreadnought ${dreadnought.instanceId} spawning ${shipsMade} fighter(s) for player ${player.id}`
      );
    }
  }

  if (fighterEffects.length === 0) {
    console.log('[resolveBuildEndOfBuild] No Dreadnought fighters to spawn');
    return { state: workingState, events: [] };
  }

  const applied = applyEffects(workingState, fighterEffects);

  console.log(
    `[resolveBuildEndOfBuild] Spawned ${fighterEffects.length} fighter(s), generated ${applied.events.length} events`
  );

  return applied;
}

// ============================================================================
// BATTLE END-OF-TURN RESOLUTION
// ============================================================================

/**
 * Resolve the battle.end_of_turn_resolution phase by applying damage/heal effects
 *
 * PHASE 3.0A: Deterministic aggregation via single pipeline
 * - applyEffects() accumulates Damage/Heal into state.gameData.pendingTurn
 * - Read totals from pendingTurn (no manual aggregation)
 * - Apply health mutations simultaneously (no order dependence)
 * - Store last turn deltas for UI/debug
 * - Clear pendingTurn for next turn
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to resolve
 * @returns Updated state and events
 */
function resolveBattleEndOfTurn(
  state: GameState,
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  console.log(`[resolveBattleEndOfTurn] Resolving phase: ${phaseKey}`);

  // Initialize pendingTurn if not present
  if (!state.gameData.pendingTurn) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        pendingTurn: {
          damageByPlayerId: {},
          healByPlayerId: {},
          breakdownEntries: [],
        },
      },
    };
  }

  // Initialize powerMemory if not present
  if (!state.gameData.powerMemory) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        powerMemory: {
          onceOnlyFired: {},
        },
      },
    };
  }

  const powerMemory = state.gameData.powerMemory;
  if (!powerMemory?.onceOnlyFired) {
    state = {
      ...state,
      gameData: {
        ...state.gameData,
        powerMemory: {
          ...powerMemory,
          onceOnlyFired: {},
        },
      },
    };
  }

  // Step 1: Compute all computed effects for this phase (once-only, tiered, triggers, etc.)
  const computed = computePhaseComputedEffects(state, phaseKey);
  state = computed.state;
  const computedEffects = computed.effects;

  // Step 2: Collect all effects from ship powers
  const shipEffects = collectEffectsForPhase(state, phaseKey);

  console.log(`[resolveBattleEndOfTurn] Collected ${shipEffects.length} ship effects + ${computedEffects.length} computed effects for ${phaseKey}`);

  // Step 3: Merge computed effects with ship effects
  const baseEffects = [...computedEffects, ...shipEffects];
  const baseAmountByEffectId = buildBaseAmountByEffectId(baseEffects);
  let effects = [...baseEffects];

  // Step 3.1: Apply computed effect modifiers (tiered multipliers, etc.)
  effects = applyComputedEffectModifiers(state, phaseKey, effects);

  // Step 4: Apply effects (accumulates Damage/Heal into pendingTurn)
  const applied = applyEffects(state, effects, { baseAmountByEffectId });

  console.log(`[resolveBattleEndOfTurn] Applied effects, generated ${applied.events.length} events`);

  // Step 5: Extract totals from pendingTurn (canonical accumulation source)
  const totals = {
    damageByPlayerId: { ...(applied.state.gameData.pendingTurn?.damageByPlayerId || {}) },
    healByPlayerId: { ...(applied.state.gameData.pendingTurn?.healByPlayerId || {}) },
  };

  applyKnoTierThreeTurnTotalModifiers(applied.state, totals);
  const lastTurnBreakdowns = buildLastTurnBreakdownSnapshots(applied.state, totals);

  console.log(`[resolveBattleEndOfTurn] Pending turn totals:`, totals);

  // Step 6: Apply aggregated health changes simultaneously
  const healthResult = applyAggregatedHealth(applied.state, totals);
  const stateWithBreakdowns: GameState = {
    ...healthResult.state,
    gameData: {
      ...healthResult.state.gameData,
      lastTurnDamageDealtBreakdownByPlayerId: lastTurnBreakdowns.damageDealtByPlayerId,
      lastTurnHealingReceivedBreakdownByPlayerId: lastTurnBreakdowns.healingReceivedByPlayerId,
    },
  };

  console.log(`[resolveBattleEndOfTurn] Applied aggregated health, generated ${healthResult.events.length} events`);

  // Step 7: Health clamping, victory evaluation, and terminal state
  const victoryResult = evaluateVictoryConditions(stateWithBreakdowns, [], phaseKey);

  // Step 8: Clear pendingTurn for next turn
  const clearedState = {
    ...victoryResult.state,
    gameData: {
      ...victoryResult.state.gameData,
      pendingTurn: {
        damageByPlayerId: {},
        healByPlayerId: {},
        breakdownEntries: [],
      },
    },
  };

  // Combine events: accumulation events + health change events + game over event (if any)
  const allEvents = [
    ...applied.events,
    ...healthResult.events,
    ...victoryResult.events,
  ];

  return { state: clearedState, events: allEvents };
}

function applyKnoTierThreeTurnTotalModifiers(
  state: GameState,
  totals: { damageByPlayerId: Record<string, number>; healByPlayerId: Record<string, number> }
): void {
  const activePlayers = state.players.filter((player) => player.role === 'player');
  const opponentIdByPlayerId = new Map<string, string>();

  if (activePlayers.length === 2) {
    opponentIdByPlayerId.set(activePlayers[0].id, activePlayers[1].id);
    opponentIdByPlayerId.set(activePlayers[1].id, activePlayers[0].id);
  }

  for (const player of activePlayers) {
    const ships = state.gameData.ships?.[player.id] || [];
    const knoTier = getCopyTierFromFleet(ships, 'KNO', 3);
    const opponentId = opponentIdByPlayerId.get(player.id);

    if (knoTier < 3 || !opponentId) continue;

    const currentDamage = totals.damageByPlayerId[opponentId] || 0;
    const currentHeal = totals.healByPlayerId[player.id] || 0;
    const equalizedTotal = Math.max(currentDamage, currentHeal);

    totals.damageByPlayerId[opponentId] = equalizedTotal;
    totals.healByPlayerId[player.id] = equalizedTotal;

    console.log(
      `[applyKnoTierThreeTurnTotalModifiers] Player ${player.id}: tier=${knoTier} opponent=${opponentId} damageDealt=${currentDamage} heal=${currentHeal} equalized=${equalizedTotal}`
    );
  }
}

// ============================================================================
// AGGREGATION STAGE
// ============================================================================

/**
 * Apply aggregated health changes simultaneously to all players
 *
 * @param state - Current game state
 * @param totals - Aggregated damage/heal totals
 * @returns Updated state with health applied and events generated
 */
function applyAggregatedHealth(
  state: GameState,
  totals: { damageByPlayerId: Record<string, number>; healByPlayerId: Record<string, number> }
): { state: GameState; events: EffectEvent[] } {
  const MAX_HEALTH = 35;
  const events: EffectEvent[] = [];
  const nowMs = Date.now();

  // Clone state
  const newState: GameState = { ...state };
  newState.players = [...state.players];
  newState.gameData = { ...state.gameData };

  // Track last turn deltas
  const lastTurnDamage: Record<string, number> = {};
  const lastTurnHeal: Record<string, number> = {};
  const lastTurnNet: Record<string, number> = {};

  // Apply aggregated health changes simultaneously
  for (let i = 0; i < newState.players.length; i++) {
    const player = { ...newState.players[i] };
    const playerId = player.id;

    const damage = totals.damageByPlayerId[playerId] || 0;
    const heal = totals.healByPlayerId[playerId] || 0;

    const previousHealth = player.health;
    const rawNewHealth = previousHealth - damage + heal;
    const newHealth = Math.min(rawNewHealth, MAX_HEALTH); // Clamp to max

    player.health = newHealth;
    newState.players[i] = player;

    // Store deltas
    lastTurnDamage[playerId] = damage;
    lastTurnHeal[playerId] = heal;
    lastTurnNet[playerId] = newHealth - previousHealth;

    console.log(
      `[applyAggregatedHealth] Player ${playerId}: ${previousHealth} - ${damage} + ${heal} = ${rawNewHealth} (clamped to ${newHealth})`
    );

    // Generate event if there was a change
    if (damage > 0 || heal > 0) {
      events.push({
        type: 'EFFECT_APPLIED',
        effectId: `aggregated_${playerId}`,
        kind: 'AggregatedHealthChange',
        targetPlayerId: playerId,
        details: {
          damage,
          heal,
          previousHealth,
          newHealth,
          net: newHealth - previousHealth,
        },
        atMs: nowMs,
      });
    }
  }

  // Store last turn deltas on state
  newState.gameData = {
    ...newState.gameData,
    lastTurnDamageByPlayerId: lastTurnDamage,
    lastTurnHealByPlayerId: lastTurnHeal,
    lastTurnNetByPlayerId: lastTurnNet,
  };

  return { state: newState, events };
}

// ============================================================================
// EFFECT COLLECTION
// ============================================================================

/**
 * Collect all effects from all ships for a specific phase
 *
 * @param state - Current game state
 * @param phaseKey - Phase key to collect effects for
 * @returns Array of effects
 */
function collectEffectsForPhase(
  state: GameState,
  phaseKey: PhaseKey
): Effect[] {
  const effects: Effect[] = [];

  // Get active players (role === 'player')
  const activePlayers = state.players.filter(p => p.role === 'player');

  if (activePlayers.length !== 2) {
    console.warn(`[collectEffectsForPhase] Expected 2 active players, found ${activePlayers.length}`);
  }

  // Determine opponent for each player
  const playerIds = activePlayers.map(p => p.id);
  const opponentMap = new Map<string, string>();

  if (playerIds.length === 2) {
    opponentMap.set(playerIds[0], playerIds[1]);
    opponentMap.set(playerIds[1], playerIds[0]);
  }

  // Process each player's fleet
  for (const player of activePlayers) {
    const playerId = player.id;
    const opponentId = opponentMap.get(playerId);

    if (!opponentId) {
      console.warn(`[collectEffectsForPhase] No opponent found for player ${playerId}`);
      continue;
    }

    // Get player's ships
    const ships = state.gameData.ships?.[playerId] || [];

    console.log(`[collectEffectsForPhase] Processing ${ships.length} ships for player ${playerId}`);

    // Process each ship
    for (const ship of ships) {
      const shipEffects = collectEffectsFromShip(
        ship,
        playerId,
        opponentId,
        phaseKey
      );

      effects.push(...shipEffects);
    }
  }

  return effects;
}

// ============================================================================
// SHIP EFFECT COLLECTION
// ============================================================================

/**
 * Collect effects from a single ship for a specific phase
 *
 * @param ship - Ship instance
 * @param ownerPlayerId - Owner player ID
 * @param opponentPlayerId - Opponent player ID
 * @param phaseKey - Phase key
 * @returns Array of effects
 */
function collectEffectsFromShip(
  ship: ShipInstance,
  ownerPlayerId: string,
  opponentPlayerId: string,
  phaseKey: PhaseKey
): Effect[] {
  // Get ship definition (joined view with structured powers)
  const shipDef = getShipDefinition(ship.shipDefId);

  if (!shipDef) {
    console.warn(`[collectEffectsFromShip] Ship definition not found: ${ship.shipDefId}`);
    return [];
  }

  // Use ship-level flattened structured powers (deterministic join output)
  const allStructuredPowers = shipDef.structuredPowers;

  if (!allStructuredPowers || allStructuredPowers.length === 0) {
    // No structured powers for this ship (expected for ships not yet implemented)
    return [];
  }

  // Create translation context
  const ctx: TranslateContext = {
    shipInstanceId: ship.instanceId,
    shipDefId: ship.shipDefId,
    ownerPlayerId,
    opponentPlayerId
  };

  // Translate structured powers to effects
  const effects = translateShipPowers(allStructuredPowers, phaseKey, ctx);

  if (effects.length > 0) {
    console.log(
      `[collectEffectsFromShip] Ship ${ship.shipDefId} (${ship.instanceId}) ` +
      `produced ${effects.length} effects for ${phaseKey}`
    );
  }

  return effects;
}

// ============================================================================
// VICTORY EVALUATION
// ============================================================================

/**
 * Evaluate victory conditions after end-of-turn resolution
 *
 * Order:
 * 1. Clamp health to [no minimum, max 35]
 * 2. Evaluate victory conditions (player health, not ship health)
 * 3. Emit GAME_OVER if terminal
 *
 * @param state - Current game state after effects
 * @param events - Events generated during effect application
 * @param phaseKey - Phase key
 * @returns Updated state and events
 */
function evaluateVictoryConditions(
  state: GameState,
  events: EffectEvent[],
  phaseKey: PhaseKey
): { state: GameState; events: EffectEvent[] } {
  // Only apply victory evaluation for end-of-turn resolution
  if (phaseKey !== 'battle.end_of_turn_resolution') {
    return { state, events };
  }

  // Skip if game is already finished (idempotent)
  if (state.status === 'finished') {
    return { state, events };
  }

  // Step 1: Clamp health to maximum 35 (no minimum clamp)
  let updatedState = clampPlayerHealth(state);

  // Step 2: Evaluate victory conditions
  const victoryResult = checkVictoryConditions(updatedState);

  // Step 3: If terminal, apply terminal state and emit GAME_OVER
  if (victoryResult.isTerminal) {
    updatedState = {
      ...updatedState,
      status: 'finished',
      winnerPlayerId: victoryResult.winnerPlayerId,
      result: victoryResult.result,
      resultReason: victoryResult.reason,
      gameData: {
        ...updatedState.gameData,
        pendingDrawOffer: null,
        drawAgreement: null,
      },
    };

    const gameOverEvent: any = {
      type: 'GAME_OVER',
      phaseKey,
      winnerPlayerId: victoryResult.winnerPlayerId,
      result: victoryResult.result,
      finalHealth: victoryResult.finalHealth,
    };

    console.log(
      `[Victory] Game over: ${victoryResult.result}, winner=${victoryResult.winnerPlayerId || 'null'}, ` +
      `health=${JSON.stringify(victoryResult.finalHealth)}`
    );

    return {
      state: updatedState,
      events: [...events, gameOverEvent],
    };
  }

  return { state: updatedState, events };
}

/**
 * Clamp player health to maximum of 35
 * Minimum is not clamped (negative values allowed for victory comparison)
 *
 * @param state - Current game state
 * @returns Updated state with clamped health
 */
function clampPlayerHealth(state: GameState): GameState {
  const MAX_HEALTH = 35;

  const updatedPlayers = state.players.map(player => {
    if (player.health > MAX_HEALTH) {
      return { ...player, health: MAX_HEALTH };
    }
    return player;
  });

  return {
    ...state,
    players: updatedPlayers,
  };
}

/**
 * Check victory conditions based on player health
 *
 * Rules:
 * - Decisive victory: One player health <= 0, other >= 1 (winner = survivor)
 * - Narrow victory: Both health <= 0, winner has higher health
 * - Draw: Both health <= 0 and equal
 * - No result: Game continues
 *
 * @param state - Current game state (after health clamp)
 * @returns Victory result
 */
function checkVictoryConditions(state: GameState): {
  isTerminal: boolean;
  winnerPlayerId: string | null;
  result: 'win' | 'draw';
  reason?: 'decisive' | 'narrow' | 'mutual_destruction';
  finalHealth: Record<string, number>;
} {
  // Get active players (role === 'player')
  const activePlayers = state.players.filter(p => p.role === 'player');

  if (activePlayers.length !== 2) {
    console.warn(`[checkVictoryConditions] Expected 2 active players, found ${activePlayers.length}`);
    return {
      isTerminal: false,
      winnerPlayerId: null,
      result: 'draw',
      finalHealth: {},
    };
  }

  const p1 = activePlayers[0];
  const p2 = activePlayers[1];
  const h1 = p1.health;
  const h2 = p2.health;

  const finalHealth: Record<string, number> = {
    [p1.id]: h1,
    [p2.id]: h2,
  };

  // Case 1: Decisive victory (one survivor)
  if (h1 <= 0 && h2 >= 1) {
    return {
      isTerminal: true,
      winnerPlayerId: p2.id,
      result: 'win',
      reason: 'decisive',
      finalHealth,
    };
  }

  if (h2 <= 0 && h1 >= 1) {
    return {
      isTerminal: true,
      winnerPlayerId: p1.id,
      result: 'win',
      reason: 'decisive',
      finalHealth,
    };
  }

  // Case 2: Both dead - check for narrow victory or draw
  if (h1 <= 0 && h2 <= 0) {
    if (h1 > h2) {
      // P1 has higher (less negative) health
      return {
        isTerminal: true,
        winnerPlayerId: p1.id,
        result: 'win',
        reason: 'narrow',
        finalHealth,
      };
    }

    if (h2 > h1) {
      // P2 has higher (less negative) health
      return {
        isTerminal: true,
        winnerPlayerId: p2.id,
        result: 'win',
        reason: 'narrow',
        finalHealth,
      };
    }

    // Equal health - draw
    return {
      isTerminal: true,
      winnerPlayerId: null,
      result: 'draw',
      reason: 'mutual_destruction',
      finalHealth,
    };
  }

  // Case 3: No terminal condition met - game continues
  return {
    isTerminal: false,
    winnerPlayerId: null,
    result: 'draw',
    finalHealth,
  };
}
