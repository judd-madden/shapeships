/**
 * PHASE COMPUTED EFFECTS
 *
 * This file is the single home for "computed effects":
 * effects that must be derived by inspecting the current GameState
 * (count/type/tier/once-only/trigger), not purely from structured powers.
 *
 * Normative rules:
 * - Used for (a) end-of-turn resolution and (b) build-phase preview projection.
 * - Keep ALL computed-effect generation in ONE place.
 * - If more helpers are needed, add them inside this file (no extra files).
 */

import type { GameState, ShipInstance } from '../../engine/state/GameStateTypes.ts';
import type { PhaseKey } from '../phase/PhaseTable.ts';
import type { Effect } from '../effects/Effect.ts';
import { EffectTiming, EffectKind, SurvivabilityRule } from '../effects/Effect.ts';

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED EFFECTS AUDIT (from ShipDefinitionsJSON text)
// Keep this list updated as ship defs evolve. This is NOT used by logic; it is
// a working map to ensure we cover every computed-mechanic across species.
// ─────────────────────────────────────────────────────────────────────────────
export const COMPUTED_EFFECTS_AUDIT = [
  // Human
  { shipDefId: 'STA', mechanic: 'once-only on build turn (8 dmg)' },
  { shipDefId: 'COM', mechanic: 'grouped-count: per 3 Fighters' },
  { shipDefId: 'EAR', mechanic: 'count-by-defId: per Carrier' },
  { shipDefId: 'TAC', mechanic: 'distinct-type count (self)' },
  { shipDefId: 'FRI', mechanic: 'per-ship trigger number + dice match' },
  { shipDefId: 'SCI', mechanic: 'tiered thresholds (1/2/3) -> multipliers + dice mods' },
  { shipDefId: 'LEV', mechanic: 'dice override: reads as 6' },

  // Xenite
  { shipDefId: 'XEN', mechanic: 'once-only on build turn' },
  { shipDefId: 'HEL', mechanic: 'once-only on build turn + grouped-count: per 2 Xenites' },
  { shipDefId: 'MAN', mechanic: 'grouped-count: per 2 Xenites' },
  { shipDefId: 'HVE', mechanic: 'count-your-ships' },
  { shipDefId: 'OXF', mechanic: 'distinct-type count (opponent)' },
  { shipDefId: 'ASF', mechanic: 'distinct-type count (opponent)' },
  { shipDefId: 'QUE', mechanic: 'turn-event count: ships built this turn' },
  { shipDefId: 'AAR', mechanic: 'phase-start conditional (state compare)' },
  { shipDefId: 'DSW', mechanic: 'phase-start conditional (state compare)' },
  { shipDefId: 'CHR', mechanic: 'tiered thresholds -> extra-build dice count' },
  { shipDefId: 'ZEN', mechanic: 'dice-conditioned branching + on-destroy spawn' },

  // Centaur
  { shipDefId: 'ANG', mechanic: 'once-only on build turn' },
  { shipDefId: 'FEA', mechanic: 'once-only on build turn' },
  { shipDefId: 'DES', mechanic: 'count-your-other-ships' },
  { shipDefId: 'DOM', mechanic: 'count-your-ships' },
  { shipDefId: 'FAM', mechanic: 'distinct-type count (self)' },
  { shipDefId: 'FUR', mechanic: 'dice scaling: dmg = dice roll' },
  { shipDefId: 'TER', mechanic: 'dice scaling: heal = dice roll' },
  { shipDefId: 'POW', mechanic: 'dice-conditioned recurring in future build phases' },
  { shipDefId: 'KNO', mechanic: 'tiered thresholds + dice manipulation + global multipliers' },

  // Ancient (many need energy ledger not present yet)
  { shipDefId: 'CUB', mechanic: 'once-per-turn: repeat last solar power (free)' },
  { shipDefId: 'QUA', mechanic: 'dice-conditioned energy/heal' },
  { shipDefId: 'SPI', mechanic: 'tiered thresholds + energy-spent scaling + max-health mod' },
  { shipDefId: 'SSIM', mechanic: 'computed variable X (lines) + copy enemy basic ship' },
  { shipDefId: 'SSIP', mechanic: 'count-by-category: per Core you have' },
  { shipDefId: 'SSTA', mechanic: 'dice scaling: heal = dice + 5' },
  { shipDefId: 'SSUP', mechanic: 'dice scaling: dmg = dice + 4' },
  { shipDefId: 'SVOR', mechanic: 'distinct-type count (self)' },
  { shipDefId: 'MER', mechanic: 'energy gain each battle phase' },
  { shipDefId: 'PLU', mechanic: 'energy gain each battle phase' },
  { shipDefId: 'URA', mechanic: 'energy gain each battle phase' },
  { shipDefId: 'SOL', mechanic: 'energy gain/spend via charges' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// Keep helper surface area here (single file). No new modules.
// ─────────────────────────────────────────────────────────────────────────────

function getTurnNumber(state: GameState): number {
  return state.gameData.turnNumber;
}

/**
 * Prefer turnData.effectiveDiceRoll (post-modifiers) when present.
 * Fallbacks keep compatibility with older state shapes.
 */
function getEffectiveDiceRoll(state: GameState): number | undefined {
  const td = state.gameData.turnData;
  return td?.effectiveDiceRoll ?? td?.baseDiceRoll ?? td?.diceRoll ?? state.gameData.diceRoll;
}

function diceIsEven(roll: number | undefined): boolean {
  return typeof roll === 'number' && roll % 2 === 0;
}

function diceMatches(roll: number | undefined, trigger: number): boolean {
  return typeof roll === 'number' && roll === trigger;
}

function getActivePlayers(state: GameState) {
  return state.players.filter(p => p.role === 'player');
}

function getOpponentIdMap(state: GameState): Map<string, string> {
  const active = getActivePlayers(state).map(p => p.id);
  const m = new Map<string, string>();
  if (active.length === 2) {
    m.set(active[0], active[1]);
    m.set(active[1], active[0]);
  }
  return m;
}

function getShips(state: GameState, playerId: string): ShipInstance[] {
  return state.gameData.ships?.[playerId] ?? [];
}

function countTotalShips(ships: ShipInstance[]): number {
  return ships.length;
}

function countByDefId(ships: ShipInstance[], shipDefId: string): number {
  let n = 0;
  for (const s of ships) if (s.shipDefId === shipDefId) n++;
  return n;
}

/**
 * TYPE of ship = distinct shipDefId in fleet (per rules text).
 */
function countDistinctTypes(ships: ShipInstance[]): number {
  const set = new Set<string>();
  for (const s of ships) set.add(s.shipDefId);
  return set.size;
}

function countOtherShips(ships: ShipInstance[], excludeInstanceId: string): number {
  let n = 0;
  for (const s of ships) if (s.instanceId !== excludeInstanceId) n++;
  return n;
}

/**
 * "for every TWO/THREE/etc" => floor(count / groupSize)
 */
function groupedCount(count: number, groupSize: number): number {
  if (groupSize <= 0) return 0;
  return Math.floor(count / groupSize);
}

/**
 * Tier helpers:
 * - thresholds is ascending, e.g. [1,2,3]
 * - returns 0 if below first threshold, else 1..thresholds.length
 */
function tierFromCount(count: number, thresholds: number[]): number {
  let tier = 0;
  for (const t of thresholds) if (count >= t) tier++;
  return tier;
}

function countShipsBuiltThisTurn(ships: ShipInstance[], turnNumber: number): number {
  let n = 0;
  for (const s of ships) if (s.createdTurn === turnNumber) n++;
  return n;
}

function countShipsBuiltThisTurnByDefId(ships: ShipInstance[], turnNumber: number, shipDefId: string): number {
  let n = 0;
  for (const s of ships) if (s.createdTurn === turnNumber && s.shipDefId === shipDefId) n++;
  return n;
}

/**
 * Power memory helpers (once-only and future per-turn/per-ship memories).
 * Keep key formats stable to avoid migrations.
 */
function ensurePowerMemory(state: GameState): GameState {
  const pm = state.gameData.powerMemory;

  const onceOnly = pm?.onceOnlyFired;
  const frigMap = pm?.frigateTriggerByInstanceId;

  const hasOnce = !!onceOnly;
  const hasFrig = !!frigMap;

  if (pm && hasOnce && hasFrig) return state;

  return {
    ...state,
    gameData: {
      ...state.gameData,
      powerMemory: {
        ...(pm ?? {}),
        onceOnlyFired: { ...(onceOnly ?? {}) },
        frigateTriggerByInstanceId: { ...(frigMap ?? {}) },
      },
    },
  };
}

function wasOnceOnlyFired(state: GameState, key: string): boolean {
  return state.gameData.powerMemory?.onceOnlyFired?.[key] === true;
}

function getFrigateTrigger(state: GameState, instanceId: string): number {
  const t = state.gameData.powerMemory?.frigateTriggerByInstanceId?.[instanceId];
  return typeof t === 'number' && Number.isInteger(t) && t >= 1 && t <= 6 ? t : 1;
}

function markOnceOnlyFired(state: GameState, keys: string[]): GameState {
  if (keys.length === 0) return state;
  const current = { ...(state.gameData.powerMemory?.onceOnlyFired ?? {}) };
  for (const k of keys) current[k] = true;
  return {
    ...state,
    gameData: {
      ...state.gameData,
      powerMemory: {
        ...(state.gameData.powerMemory ?? {}),
        onceOnlyFired: current,
      },
    },
  };
}

/**
 * Placeholder for future Ancient energy mechanics.
 * No energy ledger exists yet in GameStateTypes; return 0 safely for now.
 */
function getEnergySpentThisTurn(_state: GameState, _playerId: string): number {
  // TODO(energy-ledger): implement when energy spend tracking lands in gameData.turnData.
  return 0;
}

export type ComputedEffectsResult = { state: GameState; effects: Effect[] };

/**
 * Compute all computed effects for a given phase.
 *
 * IMPORTANT:
 * - This function may update state (e.g. powerMemory onceOnlyFired) idempotently.
 * - Keep this function deterministic and server-authoritative.
 */
export function computePhaseComputedEffects(
  state: GameState,
  phaseKey: PhaseKey
): ComputedEffectsResult {
  // For now, computed effects are only emitted during battle.end_of_turn_resolution.
  // Future computed effects (count/tier/trigger) can be added with additional phase checks.
  if (phaseKey !== 'battle.end_of_turn_resolution') {
    return { state, effects: [] };
  }

  // Ensure powerMemory exists before any operations
  state = ensurePowerMemory(state);

  // ---- Computed effects collection ----
  const computedEffects: Effect[] = [];

  // Active players only (role === 'player')
  const activePlayers = getActivePlayers(state);
  const opponentMap = getOpponentIdMap(state);

  // Track fired powers for idempotent memory update
  const firedKeys: string[] = [];
  const currentTurn = getTurnNumber(state);

  // === STARSHIP (STA) once-only: 8 damage on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'STA') continue;
      if (ship.createdTurn !== currentTurn) continue;

      // Keep the exact legacy key format to avoid migrations
      const onceKey = `${ship.instanceId}::STA#0`;

      if (wasOnceOnlyFired(state, onceKey)) continue;

      const effect: Effect = {
        id: `starship_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: {
          type: 'ship',
          instanceId: ship.instanceId,
          shipDefId: ship.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.OnceOnly,
        survivability: SurvivabilityRule.ResolvesIfDestroyed,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: 8,
      };

      computedEffects.push(effect);
      firedKeys.push(onceKey);

      console.log(
        `[computePhaseComputedEffects] Starship fired once-only: owner=${ownerPlayerId} instance=${ship.instanceId} turn=${currentTurn} dmg=8 target=${opponentId}`
      );
    }
  }
  
  // === COMMANDER (COM) automatic: Deal 1 damage for every THREE of your Fighters ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const fighters = countByDefId(ships, 'FIG');
    const dmgPerCommander = groupedCount(fighters, 3); // 1 damage per 3 fighters

    if (dmgPerCommander <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'COM') continue;

      computedEffects.push({
        id: `commander_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: dmgPerCommander,
      });

      console.log(
        `[computePhaseComputedEffects] Commander automatic: owner=${ownerPlayerId} instance=${ship.instanceId} fighters=${fighters} dmg=${dmgPerCommander} target=${opponentId}`
      );
    }
  }

  // === TACTICAL CRUISER (TAC) automatic: Deal 1 damage for each TYPE of ship you have ===
  // Types are distinct shipDefIds in your current fleet. Includes TAC itself as a type automatically.
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const typeCount = countDistinctTypes(ships);
    const dmgPerTac = typeCount;

    if (dmgPerTac <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'TAC') continue;

      computedEffects.push({
        id: `tactical_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: dmgPerTac,
      });

      console.log(
        `[computePhaseComputedEffects] TacticalCruiser automatic: owner=${ownerPlayerId} instance=${ship.instanceId} types=${typeCount} dmg=${dmgPerTac} target=${opponentId}`
      );
    }
  }

  // === EARTH SHIP (EAR) automatic: Deal 3 damage for each of your Carriers ===
  // Counts CAR ship instances only (does not count Carriers embedded as components in upgraded ships).
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const carriers = countByDefId(ships, 'CAR');
    const dmgPerEarth = carriers * 3;

    if (dmgPerEarth <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'EAR') continue;

      computedEffects.push({
        id: `earth_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: dmgPerEarth,
      });

      console.log(
        `[computePhaseComputedEffects] EarthShip automatic: owner=${ownerPlayerId} instance=${ship.instanceId} carriers=${carriers} dmg=${dmgPerEarth} target=${opponentId}`
      );
    }
  }

  // === FRIGATE (FRI) conditional: If dice roll matches chosen trigger (1..6), deal 6 damage ===
  const roll = getEffectiveDiceRoll(state);

  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'FRI') continue;

      const trigger = getFrigateTrigger(state, ship.instanceId);
      if (!diceMatches(roll, trigger)) continue;

      computedEffects.push({
        id: `frigate_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: 6,
      });

      console.log(
        `[computePhaseComputedEffects] Frigate conditional: owner=${ownerPlayerId} instance=${ship.instanceId} roll=${roll} trigger=${trigger} dmg=6 target=${opponentId}`
      );
    }
  }
  
  // Mark all fired powers in state (idempotent)
  state = markOnceOnlyFired(state, firedKeys);

  return { state, effects: computedEffects };
}