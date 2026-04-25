/**
 * FLEET POWER AVAILABILITY CHECK
 * 
 * Server-authoritative helper to determine if a player has any fleet powers
 * that can act in the current phase.
 * 
 * Used by onEnterPhase to determine whether a phase should pause for player
 * input or auto-advance.
 * 
 * ARCHITECTURE:
 * - Phase owns the question "do we pause or auto-advance?"
 * - Fleet is just data; phase decides flow control
 * - Prevents future path churn when fleet logic evolves
 * 
 * GUARDRAILS:
 * - No client code imports
 * - No raw text parsing
 * - Uses canonical ship definitions
 * - Pure function (no mutation, no side effects)
 */

import type { PhaseKey } from '../../engine_shared/phase/PhaseTable.ts';
import { getShipById } from '../../engine_shared/defs/ShipDefinitions.core.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../../engine_shared/effects/Effect.ts';
import { getValidDestroyTargets } from '../../engine_shared/resolve/destroyRules.ts';

type KnoRerollPassIndex = 1 | 2 | 3;

function getTargetedChoiceEffect(option: any) {
  return option?.effects?.find(
    (effect: any) =>
      effect?.kind === EffectKind.Destroy ||
      effect?.kind === EffectKind.TransferShip
  ) ?? null;
}

function getShipsThatBuildPassIndex(state: any): 1 | 2 {
  return state?.gameData?.turnData?.shipsThatBuildPassIndex === 2 ? 2 : 1;
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

function getKnoMaxRerollPassCountForPlayer(state: any, playerId: string): KnoRerollPassIndex | 0 {
  return Math.min(3, getKnoCountForPlayer(state, playerId)) as KnoRerollPassIndex | 0;
}

function playerHasKnoRerollForPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): boolean {
  return getKnoMaxRerollPassCountForPlayer(state, playerId) >= passIndex;
}

function playerIsKnoRerollStopped(state: any, playerId: string): boolean {
  return state?.gameData?.turnData?.knoRerollStoppedByPlayerId?.[playerId] === true;
}

function playerCanActInKnoRerollPass(state: any, playerId: string, passIndex: KnoRerollPassIndex): boolean {
  return playerHasKnoRerollForPass(state, playerId, passIndex) && !playerIsKnoRerollStopped(state, playerId);
}

function anyPlayerHasKnoRerollForCurrentPass(state: any): boolean {
  const passIndex = getKnoRerollPassIndex(state);
  const activePlayers = state?.players?.filter((p: any) => p.role === 'player') ?? [];
  return activePlayers.some((player: any) => playerCanActInKnoRerollPass(state, player.id, passIndex));
}

function getChronoswarmCountForPlayer(state: any, playerId: string): number {
  const raw = state?.gameData?.turnData?.chronoswarmCountByPlayerId?.[playerId];
  return Number.isInteger(raw) && raw > 0 ? raw : 0;
}

function playerParticipatesInShipsThatBuildPass(state: any, playerId: string): boolean {
  const passIndex = getShipsThatBuildPassIndex(state);
  return passIndex === 1 || getChronoswarmCountForPlayer(state, playerId) > 0;
}

function shipAlreadyUsedInShipsThatBuildPass(state: any, sourceInstanceId: string): boolean {
  const passIndex = getShipsThatBuildPassIndex(state);
  return state?.gameData?.turnData?.shipsThatBuildPassUsageByInstanceId?.[sourceInstanceId]?.[passIndex] === true;
}

function isTargetedChoicePowerAvailableForShip(state: any, ship: any, actionId: string, power: any): boolean {
  if (power?.onceOnly === 'on_build_turn') {
    const currentTurnNumber: number = state?.gameData?.turnNumber ?? 1;
    if (ship?.createdTurn !== currentTurnNumber) {
      return false;
    }
  }

  if (power?.onceOnly) {
    const onceOnlyFired = state?.gameData?.powerMemory?.onceOnlyFired ?? {};
    if (onceOnlyFired[`${ship.instanceId}::${actionId}`] === true) {
      return false;
    }
  }

  return true;
}

function shipHasInteractiveShipsThatBuildChoice(
  state: any,
  playerId: string,
  ship: any,
  phaseKey: PhaseKey
): boolean {
  if (phaseKey !== 'build.ships_that_build') return false;
  if (!playerParticipatesInShipsThatBuildPass(state, playerId)) return false;
  if (shipAlreadyUsedInShipsThatBuildPass(state, ship?.instanceId)) return false;

  const shipDef = getShipDefinition(ship?.shipDefId);
  if (!shipDef?.structuredPowers) return false;

  for (const power of shipDef.structuredPowers) {
    if (power.type !== 'choice') continue;
    if (!power.timings.includes(phaseKey)) continue;

    const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
    const eligibleChoices = power.options.filter((option) => {
      if (option.choiceId === 'hold') return true;

      const requiresCharge = (option.requiresCharge ?? false) || (power.requiresCharge ?? false);
      if (!requiresCharge) return true;

      const chargeCost = option.chargeCost ?? power.chargeCost ?? 1;
      return chargesCurrent >= chargeCost;
    });

    const nonHoldChoices = eligibleChoices.filter((option) => option.choiceId !== 'hold');
    if (nonHoldChoices.length === 0) continue;

    const destroyOption = nonHoldChoices.find((option) => getTargetedChoiceEffect(option) != null);

    if (!destroyOption) {
      return true;
    }

    const destroyEffect = getTargetedChoiceEffect(destroyOption);
    if (!destroyEffect) continue;

    const validTargets = getValidDestroyTargets(state, {
      sourcePlayerId: playerId,
      targetScope: destroyEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: destroyEffect.restriction ?? 'any',
    });

    if (validTargets.length > 0) {
      return true;
    }
  }

  return false;
}

function shipHasInteractiveTargetedDestroyChoice(
  state: any,
  playerId: string,
  ship: any,
  phaseKey: PhaseKey
): boolean | null {
  const shipDef = getShipDefinition(ship?.shipDefId);
  if (!shipDef?.structuredPowers) return null;

  let foundTargetedDestroyChoice = false;

  for (let powerIndex = 0; powerIndex < shipDef.structuredPowers.length; powerIndex++) {
    const power = shipDef.structuredPowers[powerIndex];
    if (power.type !== 'choice') continue;
    if (!power.timings.includes(phaseKey)) continue;

    const targetedOption = power.options.find((option) => getTargetedChoiceEffect(option) != null);
    if (!targetedOption) continue;

    foundTargetedDestroyChoice = true;

    const actionId = `${ship.shipDefId}#${powerIndex}`;
    if (!isTargetedChoicePowerAvailableForShip(state, ship, actionId, power)) continue;

    const chargesCurrent = Number(ship?.chargesCurrent ?? 0);
    const eligibleChoices = power.options.filter((option) => {
      if (option.choiceId === 'hold') return true;

      const requiresCharge = (option.requiresCharge ?? false) || (power.requiresCharge ?? false);
      if (!requiresCharge) return true;

      const chargeCost = option.chargeCost ?? power.chargeCost ?? 1;
      return chargesCurrent >= chargeCost;
    });

    const nonHoldChoices = eligibleChoices.filter((option) => option.choiceId !== 'hold');
    if (nonHoldChoices.length === 0) continue;

    const destroyOption = nonHoldChoices.find((option) => option === targetedOption);

    if (!destroyOption) continue;

    const destroyEffect = getTargetedChoiceEffect(destroyOption);
    if (!destroyEffect) continue;

    const validTargets = getValidDestroyTargets(state, {
      sourcePlayerId: playerId,
      targetScope: destroyEffect.targetPlayer === 'self' ? 'self' : 'opponent',
      restriction: destroyEffect.restriction ?? 'any',
    });

    if (validTargets.length > 0) {
      return true;
    }
  }

  return foundTargetedDestroyChoice ? false : null;
}

/**
 * Returns true if the given player has at least one fleet power
 * that is eligible to act in the current phase.
 *
 * This is used by onEnterPhase to determine whether a phase
 * should pause for player input or auto-advance.
 * 
 * @param state - Current game state
 * @param phaseKey - Phase to check (format: "major.sub")
 * @param playerId - Player ID to check
 * @param allowedSubphases - Optional list of subphase strings to match against
 * @returns true if player has any eligible powers in this phase
 */
export function fleetHasAvailablePowers(
  state: any,
  phaseKey: PhaseKey,
  playerId: string,
  allowedSubphases?: string[]
): boolean {
  if (phaseKey === 'build.dice_roll') {
    const passIndex = getKnoRerollPassIndex(state);
    if (!playerCanActInKnoRerollPass(state, playerId, passIndex)) {
      return false;
    }
    return anyPlayerHasKnoRerollForCurrentPass(state);
  }

  const ships = state?.gameData?.ships?.[playerId] ?? [];

  for (const ship of ships) {
    if (phaseKey === 'build.ships_that_build') {
      if (shipHasInteractiveShipsThatBuildChoice(state, playerId, ship, phaseKey)) {
        return true;
      }
      continue;
    }

    if (phaseKey === 'battle.first_strike') {
      const targetedDestroyAvailability = shipHasInteractiveTargetedDestroyChoice(
        state,
        playerId,
        ship,
        phaseKey
      );

      if (targetedDestroyAvailability === true) {
        return true;
      }

      if (targetedDestroyAvailability === false) {
        continue;
      }
    }

    const def = getShipById(ship.shipDefId);
    if (!def?.powers || def.powers.length === 0) continue;

    // Charge-awareness: ships with charges only count if they have charges remaining
    const maxCharges = Number((def as any)?.charges ?? 0);
    const chargesCurrent = Number((ship as any)?.chargesCurrent ?? 0);
    
    // Skip depleted charge ships (they cannot use their powers)
    if (maxCharges > 0 && chargesCurrent <= 0) {
      continue;
    }

    for (const power of def.powers) {
      // If allowedSubphases provided, check if power.subphase is in that list
      if (allowedSubphases && allowedSubphases.length > 0) {
        if (power.subphase && allowedSubphases.includes(power.subphase)) {
          return true;
        }
        continue; // Skip fallback matching if allowedSubphases was provided
      }
      
      // Derive subphase from phaseKey (deterministic, no state dependency)
      const phaseSub = String(phaseKey).split('.')[1];

      if (power.subphase && power.subphase === phaseSub) {
        return true;
      }
    }
  }

  return false;
}
