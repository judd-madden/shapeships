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
import { SHIP_DEFINITIONS_CORE_SERVER } from '../defs/ShipDefinitions.core.ts';
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

export function getEffectiveDiceRollForPlayer(
  state: GameState,
  playerId: string
): number | undefined {
  const td = state.gameData.turnData;
  const perPlayer = td?.effectiveDiceRollByPlayerId?.[playerId];
  return typeof perPlayer === 'number' ? perPlayer : getEffectiveDiceRoll(state);
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

const XENITE_FAMILY_DEF_IDS = new Set(['XEN', 'OXI', 'AST']);
const shipDefinitionsById = new Map(
  SHIP_DEFINITIONS_CORE_SERVER.map((shipDef) => [shipDef.id, shipDef])
);
const xeniteContributionByShipDefId = new Map<string, number>();

function normalizeComponentShipDefId(componentShipDefId: string): string {
  const suffixStart = componentShipDefId.indexOf('(');
  return suffixStart >= 0 ? componentShipDefId.slice(0, suffixStart) : componentShipDefId;
}

/**
 * Canonical easy-mapper Xenite count for MAN/HEL:
 * - literal XEN/OXI/AST each contribute 1
 * - upgraded ships contribute the Xenite-family requirements encoded in the
 *   canonical server ship definitions
 *
 * This intentionally does NOT implement later global counting-rule overrides
 * such as Hive behavior; it is only the local count input for MAN/HEL.
 */
function getXeniteContributionForShipDefId(shipDefId: string, visiting = new Set<string>()): number {
  const cached = xeniteContributionByShipDefId.get(shipDefId);
  if (typeof cached === 'number') return cached;

  if (XENITE_FAMILY_DEF_IDS.has(shipDefId)) {
    xeniteContributionByShipDefId.set(shipDefId, 1);
    return 1;
  }

  if (visiting.has(shipDefId)) {
    throw new Error(
      `[computePhaseComputedEffects] Circular ship component dependency while counting Xenites for "${shipDefId}".`
    );
  }

  const shipDef = shipDefinitionsById.get(shipDefId);
  if (!shipDef) {
    throw new Error(
      `[computePhaseComputedEffects] Missing canonical ship definition for "${shipDefId}" while counting Xenites.`
    );
  }

  visiting.add(shipDefId);

  let total = 0;
  for (const componentShipDefId of shipDef.componentShips) {
    total += getXeniteContributionForShipDefId(
      normalizeComponentShipDefId(componentShipDefId),
      visiting
    );
  }

  visiting.delete(shipDefId);
  xeniteContributionByShipDefId.set(shipDefId, total);
  return total;
}

function countEffectiveXenites(ships: ShipInstance[]): number {
  let total = 0;
  for (const ship of ships) total += getXeniteContributionForShipDefId(ship.shipDefId);
  return total;
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
 * During end-of-turn resolution, computed effects are generated before pending
 * turn totals are applied to player health, so current player.health still
 * reflects the unresolved turn health used by DSW/AAR for this comparison.
 */
function getPhaseStartHealthConditionalAmount(ownerHealth: number, opponentHealth: number): number {
  return ownerHealth < opponentHealth ? 7 : 3;
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

/**
 * Copy-tier helper (a.k.a. "tiered ship counter"):
 * tier is derived from how many copies of a shipDefId you have, clamped to maxTier.
 *
 * This is intentionally shallow-typed so it can be reused by non-resolve subsystems
 * (e.g. line generation) without importing GameState types.
 */
export function getCopyTierFromFleet(
    ships: Array<{ shipDefId: string }>,
    shipDefId: string,
    maxTier = 3
): number {
    let n = 0;
    for (const s of ships) if (s.shipDefId === shipDefId) n++;
    return Math.min(n, maxTier);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPUTED EFFECT MODIFIERS
// Some tiered/conditional ships don't emit "new" effects; they *modify* existing
// structured/computed effects before application (e.g. SCI doubling Automatic heal/dmg).
// Keep these modifiers centralized here so resolvePhase only calls ONE hook.
// ─────────────────────────────────────────────────────────────────────────────

export function applyComputedEffectModifiers(
  state: GameState,
  phaseKey: PhaseKey,
  effects: Effect[]
): Effect[] {
  // Currently only needed for battle.end_of_turn_resolution.
  if (phaseKey !== 'battle.end_of_turn_resolution') return effects;

  const activePlayers = getActivePlayers(state);

  // Precompute any modifier tiers/counters we need.
  const sciTierByPlayerId: Record<string, number> = {};
  for (const p of activePlayers) {
    const ships = getShips(state, p.id);
    const tier = getCopyTierFromFleet(ships, 'SCI', 3);
    if (tier > 0) sciTierByPlayerId[p.id] = tier;
  }

  // Fast exit if no modifiers present.
  if (Object.keys(sciTierByPlayerId).length === 0) return effects;

  let changed = false;
  const out: Effect[] = new Array(effects.length);

  for (let i = 0; i < effects.length; i++) {
    const e = effects[i];

    // --- SCIENCE VESSEL (SCI) tiers ---
    // Tier 1+: double your Automatic healing (excludes Charge + OnceOnly)
    // Tier 2+: also double your Automatic damage (excludes Charge + OnceOnly)
    //
    // "Your" is keyed off ownerPlayerId (source owner), not target.
    const sciTier = sciTierByPlayerId[e.ownerPlayerId] ?? 0;

    if (sciTier > 0 && e.activationTag === EffectTiming.Automatic) {
      if (e.kind === EffectKind.Heal && sciTier >= 1) {
        changed = true;
        out[i] = { ...e, amount: e.amount * 2 };
        continue;
      }
      if (e.kind === EffectKind.Damage && sciTier >= 2) {
        changed = true;
        out[i] = { ...e, amount: e.amount * 2 };
        continue;
      }
    }

    out[i] = e;
  }

  return changed ? out : effects;
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

function getShipsMadeThisBuildPhase(state: GameState, playerId: string): number {
  return state.gameData.turnData?.shipsMadeThisBuildPhaseByPlayerId?.[playerId] ?? 0;
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
  const playerById = new Map(activePlayers.map((player) => [player.id, player]));

  // Track fired powers for idempotent memory update
  const firedKeys: string[] = [];
  const currentTurn = getTurnNumber(state);

  // === STARSHIP (STA) once-only: 8 damage on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const roll = getEffectiveDiceRollForPlayer(state, ownerPlayerId);

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

  // === XENITE (XEN) once-only: heal 1 on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'XEN') continue;
      if (ship.createdTurn !== currentTurn) continue;

      const onceKey = `${ship.instanceId}::XEN#0`;
      if (wasOnceOnlyFired(state, onceKey)) continue;

      computedEffects.push({
        id: `xenite_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: {
          type: 'ship',
          instanceId: ship.instanceId,
          shipDefId: ship.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.OnceOnly,
        survivability: SurvivabilityRule.ResolvesIfDestroyed,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: 1,
      });

      firedKeys.push(onceKey);

      console.log(
        `[computePhaseComputedEffects] Xenite fired once-only: owner=${ownerPlayerId} instance=${ship.instanceId} turn=${currentTurn} heal=1`
      );
    }
  }

  // === HELL HORNET (HEL) once-only: deal 3 damage on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'HEL') continue;
      if (ship.createdTurn !== currentTurn) continue;

      const onceKey = `${ship.instanceId}::HEL#0`;
      if (wasOnceOnlyFired(state, onceKey)) continue;

      computedEffects.push({
        id: `hellhornet_once_${currentTurn}_${ship.instanceId}`,
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
        amount: 3,
      });

      firedKeys.push(onceKey);

      console.log(
        `[computePhaseComputedEffects] HellHornet fired once-only: owner=${ownerPlayerId} instance=${ship.instanceId} turn=${currentTurn} dmg=3 target=${opponentId}`
      );
    }
  }

  // === SHIP OF FEAR (FEA) once-only: heal 4 on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'FEA') continue;
      if (ship.createdTurn !== currentTurn) continue;

      const onceKey = `${ship.instanceId}::FEA#0`;
      if (wasOnceOnlyFired(state, onceKey)) continue;

      computedEffects.push({
        id: `fear_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: {
          type: 'ship',
          instanceId: ship.instanceId,
          shipDefId: ship.shipDefId,
        },
        timing: phaseKey,
        activationTag: EffectTiming.OnceOnly,
        survivability: SurvivabilityRule.ResolvesIfDestroyed,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: 4,
      });

      firedKeys.push(onceKey);

      console.log(
        `[computePhaseComputedEffects] ShipOfFear fired once-only: owner=${ownerPlayerId} instance=${ship.instanceId} turn=${currentTurn} heal=4`
      );
    }
  }

  // === SHIP OF ANGER (ANG) once-only: deal 4 damage on the turn it is built ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'ANG') continue;
      if (ship.createdTurn !== currentTurn) continue;

      const onceKey = `${ship.instanceId}::ANG#0`;
      if (wasOnceOnlyFired(state, onceKey)) continue;

      computedEffects.push({
        id: `anger_${currentTurn}_${ship.instanceId}`,
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
        amount: 4,
      });

      firedKeys.push(onceKey);

      console.log(
        `[computePhaseComputedEffects] ShipOfAnger fired once-only: owner=${ownerPlayerId} instance=${ship.instanceId} turn=${currentTurn} dmg=4 target=${opponentId}`
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

  // === MANTIS (MAN) automatic: Heal 1 for every TWO of your Xenites (cap 10 per MAN) ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const ships = getShips(state, ownerPlayerId);
    const effectiveXenites = countEffectiveXenites(ships);
    const healPerMantis = Math.min(groupedCount(effectiveXenites, 2), 10);

    if (healPerMantis <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'MAN') continue;

      computedEffects.push({
        id: `mantis_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: healPerMantis,
      });

      console.log(
        `[computePhaseComputedEffects] Mantis automatic: owner=${ownerPlayerId} instance=${ship.instanceId} effectiveXenites=${effectiveXenites} heal=${healPerMantis}`
      );
    }
  }

  // === HELL HORNET (HEL) automatic: Deal 1 damage for every TWO of your Xenites ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const effectiveXenites = countEffectiveXenites(ships);
    const dmgPerHellHornet = groupedCount(effectiveXenites, 2);

    if (dmgPerHellHornet <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'HEL') continue;

      computedEffects.push({
        id: `hellhornet_grouped_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: dmgPerHellHornet,
      });

      console.log(
        `[computePhaseComputedEffects] HellHornet automatic: owner=${ownerPlayerId} instance=${ship.instanceId} effectiveXenites=${effectiveXenites} dmg=${dmgPerHellHornet} target=${opponentId}`
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

  // === OXITE FACE (OXF) automatic: Heal 1 for each TYPE of ship your opponent has ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const opponentShips = getShips(state, opponentId);
    const healPerOxiteFace = countDistinctTypes(opponentShips);

    if (healPerOxiteFace <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'OXF') continue;

      computedEffects.push({
        id: `oxiteface_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: healPerOxiteFace,
      });

      console.log(
        `[computePhaseComputedEffects] OxiteFace automatic: owner=${ownerPlayerId} instance=${ship.instanceId} opponentTypes=${healPerOxiteFace} heal=${healPerOxiteFace}`
      );
    }
  }

  // === ASTERITE FACE (ASF) automatic: Deal 1 damage for each TYPE of ship your opponent has ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const opponentShips = getShips(state, opponentId);
    const dmgPerAsteriteFace = countDistinctTypes(opponentShips);

    if (dmgPerAsteriteFace <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'ASF') continue;

      computedEffects.push({
        id: `asteriteface_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: dmgPerAsteriteFace,
      });

      console.log(
        `[computePhaseComputedEffects] AsteriteFace automatic: owner=${ownerPlayerId} instance=${ship.instanceId} opponentTypes=${dmgPerAsteriteFace} dmg=${dmgPerAsteriteFace} target=${opponentId}`
      );
    }
  }

  // === DEFENSE SWARM (DSW) automatic: Heal 3, or Heal 7 if your health is lower than your opponent's ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const opponent = playerById.get(opponentId);
    if (!opponent) continue;

    const ships = getShips(state, ownerPlayerId);
    const healPerDefenseSwarm = getPhaseStartHealthConditionalAmount(player.health, opponent.health);

    for (const ship of ships) {
      if (ship.shipDefId !== 'DSW') continue;

      computedEffects.push({
        id: `defenseswarm_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: healPerDefenseSwarm,
      });

      console.log(
        `[computePhaseComputedEffects] DefenseSwarm automatic: owner=${ownerPlayerId} instance=${ship.instanceId} ownerHealth=${player.health} opponentHealth=${opponent.health} heal=${healPerDefenseSwarm}`
      );
    }
  }

  // === ANTLION ARRAY (AAR) automatic: Deal 3 damage, or Deal 7 if your health is lower than your opponent's ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const opponent = playerById.get(opponentId);
    if (!opponent) continue;

    const ships = getShips(state, ownerPlayerId);
    const damagePerAntlionArray = getPhaseStartHealthConditionalAmount(player.health, opponent.health);

    for (const ship of ships) {
      if (ship.shipDefId !== 'AAR') continue;

      computedEffects.push({
        id: `antlionarray_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: damagePerAntlionArray,
      });

      console.log(
        `[computePhaseComputedEffects] AntlionArray automatic: owner=${ownerPlayerId} instance=${ship.instanceId} ownerHealth=${player.health} opponentHealth=${opponent.health} dmg=${damagePerAntlionArray} target=${opponentId}`
      );
    }
  }

  // === QUEEN (QUE) automatic: Deal 3 damage per eligible ship you made this turn ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const shipsMadeThisTurn = getShipsMadeThisBuildPhase(state, ownerPlayerId);

    if (shipsMadeThisTurn <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'QUE') continue;

      const countedShips =
        ship.createdTurn === currentTurn
          ? shipsMadeThisTurn
          : Math.max(shipsMadeThisTurn - 1, 0);
      const damage = countedShips * 3;

      if (damage <= 0) continue;

      computedEffects.push({
        id: `queen_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: damage,
      });

      console.log(
        `[computePhaseComputedEffects] Queen automatic: owner=${ownerPlayerId} instance=${ship.instanceId} shipsMade=${shipsMadeThisTurn} countedShips=${countedShips} dmg=${damage} target=${opponentId}`
      );
    }
  }

  // === ARK OF TERROR (TER) automatic: Heal equal to your effective dice roll ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const ships = getShips(state, ownerPlayerId);
    const roll = getEffectiveDiceRollForPlayer(state, ownerPlayerId);

    if (typeof roll !== 'number' || roll <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'TER') continue;

      computedEffects.push({
        id: `terror_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: ownerPlayerId },
        kind: EffectKind.Heal,
        amount: roll,
      });

      console.log(
        `[computePhaseComputedEffects] ArkOfTerror automatic: owner=${ownerPlayerId} instance=${ship.instanceId} roll=${roll} heal=${roll}`
      );
    }
  }

  // === ARK OF FURY (FUR) automatic: Deal damage equal to your effective dice roll ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const roll = getEffectiveDiceRollForPlayer(state, ownerPlayerId);

    if (typeof roll !== 'number' || roll <= 0) continue;

    for (const ship of ships) {
      if (ship.shipDefId !== 'FUR') continue;

      computedEffects.push({
        id: `fury_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: roll,
      });

      console.log(
        `[computePhaseComputedEffects] ArkOfFury automatic: owner=${ownerPlayerId} instance=${ship.instanceId} roll=${roll} dmg=${roll} target=${opponentId}`
      );
    }
  }

  // === ARK OF DESTRUCTION (DES) automatic: Deal 3 damage for each of your other ships ===
  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);

    for (const ship of ships) {
      if (ship.shipDefId !== 'DES') continue;

      const otherShips = countOtherShips(ships, ship.instanceId);
      const damage = otherShips * 3;
      if (damage <= 0) continue;

      computedEffects.push({
        id: `destruction_${currentTurn}_${ship.instanceId}`,
        ownerPlayerId,
        source: { type: 'ship', instanceId: ship.instanceId, shipDefId: ship.shipDefId },
        timing: phaseKey,
        activationTag: EffectTiming.Automatic,
        survivability: SurvivabilityRule.DiesWithSource,
        target: { playerId: opponentId },
        kind: EffectKind.Damage,
        amount: damage,
      });

      console.log(
        `[computePhaseComputedEffects] ArkOfDestruction automatic: owner=${ownerPlayerId} instance=${ship.instanceId} otherShips=${otherShips} dmg=${damage} target=${opponentId}`
      );
    }
  }

  // === FRIGATE (FRI) conditional: If dice roll matches chosen trigger (1..6), deal 6 damage ===

  for (const player of activePlayers) {
    const ownerPlayerId = player.id;
    const opponentId = opponentMap.get(ownerPlayerId);
    if (!opponentId) continue;

    const ships = getShips(state, ownerPlayerId);
    const roll = getEffectiveDiceRollForPlayer(state, ownerPlayerId);

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
