import type { ShipInstance } from '../state/GameStateTypes.ts';
import { getAuthoritativeAncientEnergyTotal } from '../state/ancientState.ts';
import { getShipDefinition } from '../../engine_shared/defs/ShipDefinitions.withStructuredPowers.ts';
import type { StructuredShipPower } from '../../engine_shared/effects/translateShipPowers.ts';
import { getValidShipOfEqualityTargets } from '../../engine_shared/resolve/destroyRules.ts';
import {
  requireChargeDeclarationLegalityState,
} from '../state/chargeDeclarationVisibility.ts';

export type ChargePhaseKey = 'battle.charge_declaration' | 'battle.charge_response';

export function getChargeDeclarationLegalityState<T = any>(state: T): T {
  return requireChargeDeclarationLegalityState(state);
}

export function getChargeDeclarationBattleTurnNumber(state: any): number {
  const value = state?.gameData?.turnNumber ?? state?.gameData?.turnData?.turnNumber ?? state?.turnNumber ?? 0;
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

export function isAncientPlayer(state: any, playerId: string): boolean {
  const player = state?.players?.find((candidate: any) => candidate?.id === playerId);
  return player?.role === 'player' && (player?.faction ?? player?.species) === 'ancient';
}

export function getAcceptedDeclarationForCurrentBattle(state: any, playerId: string): any | null {
  const accepted = state?.gameData?.ancient?.acceptedDeclarationByPlayerId?.[playerId];
  if (!accepted || typeof accepted !== 'object') return null;
  return accepted?.context?.battleTurnNumber === getChargeDeclarationBattleTurnNumber(state)
    ? accepted
    : null;
}

function normalizeSourceIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0
  ))].sort((a, b) => a.localeCompare(b));
}

export function getSnappedOrdinaryChargeSourceIds(state: any, playerId: string): string[] {
  return normalizeSourceIds(
    state?.gameData?.turnData?.chargeDeclarationEligibleSourceIdsByPlayerId?.[playerId]
  );
}

export function getSnappedSolarGridSourceIds(state: any, playerId: string): string[] {
  return normalizeSourceIds(
    state?.gameData?.turnData?.solarGridDeclarationSourceIdsByPlayerId?.[playerId]
  );
}

export function resolveChargeDeclarationSource(
  state: any,
  playerId: string,
  sourceInstanceId: string,
): ShipInstance | null {
  const liveFleet = state?.gameData?.ships?.[playerId] ?? [];
  const live = liveFleet.find((ship: ShipInstance) => ship?.instanceId === sourceInstanceId);
  if (live) return live;
  const voidFleet = state?.gameData?.voidShipsByPlayerId?.[playerId] ?? [];
  return voidFleet.find((ship: ShipInstance) => ship?.instanceId === sourceInstanceId) ?? null;
}

export function getChargeDeclarationFleetSnapshot(state: any, playerId: string): ShipInstance[] {
  const snapshot = state?.gameData?.turnData?.chargeDeclarationFleetSnapshotByPlayerId?.[playerId];
  return Array.isArray(snapshot) ? snapshot : [];
}

export function resolveSnapshottedSolarGridSource(
  state: any,
  playerId: string,
  sourceInstanceId: string,
): { snapshot: ShipInstance; current: ShipInstance } | null {
  if (!getSnappedSolarGridSourceIds(state, playerId).includes(sourceInstanceId)) return null;
  const snapshot = getChargeDeclarationFleetSnapshot(state, playerId).find(
    (ship) => ship.instanceId === sourceInstanceId && ship.shipDefId === 'SOL'
  );
  const current = resolveChargeDeclarationSource(state, playerId, sourceInstanceId);
  return snapshot && current?.shipDefId === 'SOL' ? { snapshot, current } : null;
}

function sourceHasEligibleOrdinaryChargeChoice(
  state: any,
  playerId: string,
  ship: ShipInstance,
  phaseKey: ChargePhaseKey,
): boolean {
  const sourceInstanceId = ship?.instanceId;
  const shipDefId = ship?.shipDefId;
  if (!sourceInstanceId || !shipDefId || shipDefId === 'SOL') return false;

  const definition = getShipDefinition(shipDefId);
  if (!definition || definition.shipType === 'Solar Power' || !Array.isArray(definition.structuredPowers)) {
    return false;
  }

  const turnNumber = getChargeDeclarationBattleTurnNumber(state);
  const usedMap = state?.gameData?.turnData?.chargePowerUsedByInstanceId ?? {};

  for (const power of definition.structuredPowers as StructuredShipPower[]) {
    if (power?.type !== 'choice' || !power.timings.includes(phaseKey)) continue;
    const requiresCharge = (power.requiresCharge ?? false) ||
      power.options.some((option: any) => option?.requiresCharge === true);
    if (!requiresCharge || usedMap[sourceInstanceId] === turnNumber) continue;
    const chargeCost = power.chargeCost ?? 1;
    if ((ship.chargesCurrent ?? 0) < chargeCost) continue;

    if (shipDefId === 'EQU') {
      const targets = getValidShipOfEqualityTargets(state, playerId);
      if (targets.validOwnTargets.length === 0 || targets.validOpponentTargets.length === 0) {
        continue;
      }
    }
    return true;
  }
  return false;
}

export function getEligibleOrdinaryChargeSourceIdsAtDeclarationStart(
  state: any,
  playerId: string,
): string[] {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return (Array.isArray(fleet) ? fleet : [])
    .filter((ship: ShipInstance) =>
      sourceHasEligibleOrdinaryChargeChoice(state, playerId, ship, 'battle.charge_declaration')
    )
    .map((ship: ShipInstance) => ship.instanceId)
    .sort((a: string, b: string) => a.localeCompare(b));
}

export function getRelevantSolarGridSourceIdsAtDeclarationStart(
  state: any,
  playerId: string,
): string[] {
  if (!isAncientPlayer(state, playerId)) return [];
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return (Array.isArray(fleet) ? fleet : [])
    .filter((ship: ShipInstance) =>
      ship?.shipDefId === 'SOL' &&
      typeof ship?.instanceId === 'string' &&
      (ship.chargesCurrent ?? 0) > 0
    )
    .map((ship: ShipInstance) => ship.instanceId)
    .sort((a: string, b: string) => a.localeCompare(b));
}

function hasSnapshotEntry(state: any, field: string, playerId: string): boolean {
  const map = state?.gameData?.turnData?.[field];
  return !!map && typeof map === 'object' && Object.hasOwn(map, playerId);
}

function getOrdinaryDeclarationSourceIds(state: any, playerId: string): string[] {
  return hasSnapshotEntry(state, 'chargeDeclarationEligibleSourceIdsByPlayerId', playerId)
    ? getSnappedOrdinaryChargeSourceIds(state, playerId)
    : getEligibleOrdinaryChargeSourceIdsAtDeclarationStart(state, playerId);
}

function getSolarDeclarationSourceIds(state: any, playerId: string): string[] {
  return hasSnapshotEntry(state, 'solarGridDeclarationSourceIdsByPlayerId', playerId)
    ? getSnappedSolarGridSourceIds(state, playerId)
    : getRelevantSolarGridSourceIdsAtDeclarationStart(state, playerId);
}

export function playerRequiresChargeDeclarationInput(state: any, playerId: string): boolean {
  if (getAcceptedDeclarationForCurrentBattle(state, playerId)) return false;
  const hasOrdinarySource = getOrdinaryDeclarationSourceIds(state, playerId).length > 0;
  if (!isAncientPlayer(state, playerId)) return hasOrdinarySource;
  return getAuthoritativeAncientEnergyTotal(state, playerId) > 0 ||
    getSolarDeclarationSourceIds(state, playerId).length > 0 ||
    hasOrdinarySource;
}

export function ancientAtomicDeclarationContractApplies(state: any, playerId: string): boolean {
  if (!isAncientPlayer(state, playerId)) return false;
  return getAcceptedDeclarationForCurrentBattle(state, playerId) !== null ||
    playerRequiresChargeDeclarationInput(state, playerId);
}

export function getAvailableOrdinaryChargeResponseSourceIds(state: any, playerId: string): string[] {
  return getSnappedOrdinaryChargeSourceIds(state, playerId).filter((sourceInstanceId) => {
    const source = resolveChargeDeclarationSource(state, playerId, sourceInstanceId);
    return !!source && sourceHasEligibleOrdinaryChargeChoice(
      state,
      playerId,
      source,
      'battle.charge_response',
    );
  });
}

export function playerHasOrdinaryChargeResponseOption(state: any, playerId: string): boolean {
  return getAvailableOrdinaryChargeResponseSourceIds(state, playerId).length > 0;
}
