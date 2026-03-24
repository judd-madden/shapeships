import type { GameState } from '../../engine/state/GameStateTypes.ts';
import { getShipById } from '../defs/ShipDefinitions.core.ts';

export type DestroyRestriction = 'basic_only' | 'upgraded_only' | 'any';
export type DestroyTargetScope = 'self' | 'opponent';

export type DestroyTargetDescriptor = {
  instanceId: string;
  shipDefId: string;
  ownerPlayerId: string;
  totalLineCost: number;
};

export type ShipOfEqualityTargetSets = {
  validOwnTargets: DestroyTargetDescriptor[];
  validOpponentTargets: DestroyTargetDescriptor[];
};

export function getAuthoritativeFullLineCostForShipDef(shipDefId: string): number | null {
  const shipDef = getShipById(shipDefId);
  const totalLineCost = shipDef?.totalLineCost;
  return Number.isInteger(totalLineCost) ? Number(totalLineCost) : null;
}

export function calculateSacSpawnCountFromFullLineCost(lineCost: number): number {
  if (!Number.isInteger(lineCost) || lineCost < 3) return 0;
  return Math.floor(lineCost / 3);
}

export function getSacSpawnCountForShipDef(shipDefId: string): number {
  const lineCost = getAuthoritativeFullLineCostForShipDef(shipDefId);
  if (lineCost == null) return 0;
  return calculateSacSpawnCountFromFullLineCost(lineCost);
}

export function isCanonicalTrueBasicShip(shipDefId: string): boolean {
  const shipDef = getShipById(shipDefId);
  return shipDef?.shipType === 'Basic';
}

function isCanonicalUpgradedShip(shipDefId: string): boolean {
  const shipDef = getShipById(shipDefId);
  return shipDef?.shipType === 'Upgraded';
}

function matchesDestroyRestriction(
  shipDefId: string,
  restriction: DestroyRestriction
): boolean {
  if (restriction === 'any') return true;
  if (restriction === 'basic_only') return isCanonicalTrueBasicShip(shipDefId);
  if (restriction === 'upgraded_only') return isCanonicalUpgradedShip(shipDefId);
  return false;
}

export function hasSacDestroyProtection(state: GameState | any, playerId: string): boolean {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return Array.isArray(fleet) && fleet.some((ship: any) => ship?.shipDefId === 'SAC');
}

export function isOpponentDestroyBlockedBySacProtection(
  state: GameState | any,
  sourcePlayerId: string,
  targetPlayerId: string
): boolean {
  return sourcePlayerId !== targetPlayerId && hasSacDestroyProtection(state, targetPlayerId);
}

export function getDestroyTargetPlayerId(
  state: GameState | any,
  sourcePlayerId: string,
  targetScope: DestroyTargetScope
): string | null {
  if (targetScope === 'self') return sourcePlayerId;

  const activePlayers = state?.players?.filter((player: any) => player?.role === 'player') ?? [];
  return activePlayers.find((player: any) => player?.id !== sourcePlayerId)?.id ?? null;
}

export function getValidDestroyTargets(
  state: GameState | any,
  args: {
    sourcePlayerId: string;
    targetScope: DestroyTargetScope;
    restriction: DestroyRestriction;
    minimumFullLineCost?: number;
    applyOpponentSacProtection?: boolean;
  }
): DestroyTargetDescriptor[] {
  const {
    sourcePlayerId,
    targetScope,
    restriction,
    minimumFullLineCost,
    applyOpponentSacProtection = true,
  } = args;

  const targetPlayerId = getDestroyTargetPlayerId(state, sourcePlayerId, targetScope);
  if (!targetPlayerId) return [];

  if (
    applyOpponentSacProtection &&
    isOpponentDestroyBlockedBySacProtection(state, sourcePlayerId, targetPlayerId)
  ) {
    return [];
  }

  const targetFleet = state?.gameData?.ships?.[targetPlayerId] ?? [];
  if (!Array.isArray(targetFleet)) return [];

  return targetFleet
    .filter((ship: any) => {
      const shipDefId = ship?.shipDefId;
      const instanceId = ship?.instanceId;
      if (typeof shipDefId !== 'string' || typeof instanceId !== 'string') return false;
      const fullLineCost = getAuthoritativeFullLineCostForShipDef(shipDefId);
      if (fullLineCost == null) return false;
      if (!matchesDestroyRestriction(shipDefId, restriction)) return false;

      if (minimumFullLineCost != null) {
        if (fullLineCost < minimumFullLineCost) {
          return false;
        }
      }

      return true;
    })
    .map((ship: any) => ({
      instanceId: ship.instanceId,
      shipDefId: ship.shipDefId,
      ownerPlayerId: targetPlayerId,
      totalLineCost: getAuthoritativeFullLineCostForShipDef(ship.shipDefId) ?? 0,
    }));
}

export function getValidShipOfEqualityTargets(
  state: GameState | any,
  sourcePlayerId: string
): ShipOfEqualityTargetSets {
  const validOwnTargets = getValidDestroyTargets(state, {
    sourcePlayerId,
    targetScope: 'self',
    restriction: 'basic_only',
    applyOpponentSacProtection: false,
  }).filter((target) => target.shipDefId !== 'EQU');

  const validOpponentTargets = getValidDestroyTargets(state, {
    sourcePlayerId,
    targetScope: 'opponent',
    restriction: 'basic_only',
    applyOpponentSacProtection: true,
  }).filter((target) => target.shipDefId !== 'EQU');

  if (validOwnTargets.length === 0 || validOpponentTargets.length === 0) {
    return { validOwnTargets: [], validOpponentTargets: [] };
  }

  const sharedLineCosts = new Set<number>();
  const ownLineCosts = new Set(validOwnTargets.map((target) => target.totalLineCost));

  for (const target of validOpponentTargets) {
    if (ownLineCosts.has(target.totalLineCost)) {
      sharedLineCosts.add(target.totalLineCost);
    }
  }

  if (sharedLineCosts.size === 0) {
    return { validOwnTargets: [], validOpponentTargets: [] };
  }

  return {
    validOwnTargets: validOwnTargets.filter((target) => sharedLineCosts.has(target.totalLineCost)),
    validOpponentTargets: validOpponentTargets.filter((target) => sharedLineCosts.has(target.totalLineCost)),
  };
}
