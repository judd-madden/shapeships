import type { GameState } from '../../engine/state/GameStateTypes.ts';
import { getShipById } from '../defs/ShipDefinitions.core.ts';
import { getShipDefinition } from '../defs/ShipDefinitions.withStructuredPowers.ts';
import { EffectKind } from '../effects/Effect.ts';
import { canControlAdditionalSpirals } from '../maximumHealth.ts';

const PROTECTED_ANCIENT_CORE_IDS = new Set(['PLU', 'MER', 'NEP']);

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

function normalizeSelectionTargetInstanceIds(selection: unknown): string[] {
  if (selection == null || typeof selection !== 'object' || Array.isArray(selection)) {
    return [];
  }

  const record = selection as Record<string, unknown>;
  const candidates = [
    record.targetInstanceId,
    ...(Array.isArray(record.targetInstanceIds) ? record.targetInstanceIds : []),
  ];

  return Array.from(new Set(
    candidates.filter(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.length > 0,
    ),
  )).sort((left, right) => left.localeCompare(right));
}

function isReservedFirstStrikeTargetSelection(selection: unknown): boolean {
  if (selection == null || typeof selection !== 'object' || Array.isArray(selection)) {
    return false;
  }

  const record = selection as Record<string, unknown>;
  if (typeof record.actionId !== 'string' || typeof record.choiceId !== 'string') {
    return false;
  }
  const [shipDefId, powerIndexText] = record.actionId.split('#');
  const powerIndex = Number(powerIndexText);
  if (!shipDefId || !Number.isInteger(powerIndex) || powerIndex < 0) return false;
  const power = getShipDefinition(shipDefId)?.structuredPowers?.[powerIndex];
  if (power?.type !== 'choice') return false;
  const option = power.options.find((candidate) => candidate.choiceId === record.choiceId);
  return option?.effects?.some(
    (effect) =>
      effect.kind === EffectKind.Destroy ||
      effect.kind === EffectKind.TransferShip,
  ) === true;
}

export function getReservedFirstStrikeTargetInstanceIds(
  state: GameState | any,
  playerId: string,
  excludeSourceInstanceId?: string,
): string[] {
  const selections =
    state?.gameData?.turnData?.pendingFirstStrikeSelectionsByPlayerId?.[playerId];
  if (selections == null || typeof selections !== 'object' || Array.isArray(selections)) {
    return [];
  }

  const reserved = new Set<string>();
  for (const sourceInstanceId of Object.keys(selections).sort((left, right) => left.localeCompare(right))) {
    if (sourceInstanceId === excludeSourceInstanceId) continue;
    const selection = selections[sourceInstanceId];
    if (!isReservedFirstStrikeTargetSelection(selection)) continue;
    for (const targetInstanceId of normalizeSelectionTargetInstanceIds(selection)) {
      reserved.add(targetInstanceId);
    }
  }

  return [...reserved].sort((left, right) => left.localeCompare(right));
}

export function getReservedShipOfEqualityTargetInstanceIds(
  state: GameState | any,
  playerId: string,
): string[] {
  const accepted =
    state?.gameData?.turnData?.acceptedShipOfEqualityTargetsByPlayerId?.[playerId];
  if (accepted == null || typeof accepted !== 'object' || Array.isArray(accepted)) {
    return [];
  }

  const reserved = new Set<string>();
  for (const sourceInstanceId of Object.keys(accepted).sort((left, right) => left.localeCompare(right))) {
    const record = accepted[sourceInstanceId];
    if (record == null || typeof record !== 'object' || Array.isArray(record)) continue;
    for (const candidate of [record.ownTargetInstanceId, record.opponentTargetInstanceId]) {
      if (typeof candidate === 'string' && candidate.length > 0) {
        reserved.add(candidate);
      }
    }
  }

  return [...reserved].sort((left, right) => left.localeCompare(right));
}

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

export function isCanonicalBasicOnlyTargetShip(shipDefId: string): boolean {
  const shipDef = getShipById(shipDefId);
  return shipDef?.shipType === 'Basic' || shipDef?.shipType === 'Basic - Evolved';
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
  if (restriction === 'basic_only') return isCanonicalBasicOnlyTargetShip(shipDefId);
  if (restriction === 'upgraded_only') return isCanonicalUpgradedShip(shipDefId);
  return false;
}

// v1.2 SAC - no longer used, kept for self-targeting and targeting within Ships That Build reference
export function hasSacDestroyProtection(state: GameState | any, playerId: string): boolean {
  const fleet = state?.gameData?.ships?.[playerId] ?? [];
  return Array.isArray(fleet) && fleet.some((ship: any) => ship?.shipDefId === 'SAC');
}

// v1.2 SAC - no longer used, kept for self-targeting and targeting within Ships That Build reference
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
    // v1.2 SAC - no longer used, kept for self-targeting and targeting within Ships That Build reference
    minimumFullLineCost?: number;
    // v1.2 SAC - no longer used, kept for self-targeting and targeting within Ships That Build reference
    applyOpponentSacProtection?: boolean;
  }
): DestroyTargetDescriptor[] {
  const {
    sourcePlayerId,
    targetScope,
    restriction,
  } = args;

  const targetPlayerId = getDestroyTargetPlayerId(state, sourcePlayerId, targetScope);
  if (!targetPlayerId) return [];

  const targetFleet = state?.gameData?.ships?.[targetPlayerId] ?? [];
  if (!Array.isArray(targetFleet)) return [];

  return targetFleet
    .filter((ship: any) => {
      const shipDefId = ship?.shipDefId;
      const instanceId = ship?.instanceId;
      if (typeof shipDefId !== 'string' || typeof instanceId !== 'string') return false;
      if (PROTECTED_ANCIENT_CORE_IDS.has(shipDefId)) return false;
      const fullLineCost = getAuthoritativeFullLineCostForShipDef(shipDefId);
      if (fullLineCost == null) return false;
      if (!matchesDestroyRestriction(shipDefId, restriction)) return false;

      return true;
    })
    .map((ship: any) => ({
      instanceId: ship.instanceId,
      shipDefId: ship.shipDefId,
      ownerPlayerId: targetPlayerId,
      totalLineCost: getAuthoritativeFullLineCostForShipDef(ship.shipDefId) ?? 0,
    }));
}

export function getValidTransferTargets(
  state: GameState | any,
  args: {
    sourcePlayerId: string;
    targetScope: DestroyTargetScope;
    restriction: DestroyRestriction;
  }
): DestroyTargetDescriptor[] {
  const validTargets = getValidDestroyTargets(state, args);
  if (canControlAdditionalSpirals(state, args.sourcePlayerId, 1)) {
    return validTargets;
  }
  return validTargets.filter((target) => target.shipDefId !== 'SPI');
}

export function getValidShipOfEqualityTargets(
  state: GameState | any,
  sourcePlayerId: string
): ShipOfEqualityTargetSets {
  const reservedTargetInstanceIds = new Set(
    getReservedShipOfEqualityTargetInstanceIds(state, sourcePlayerId),
  );
  const validOwnTargets = getValidDestroyTargets(state, {
    sourcePlayerId,
    targetScope: 'self',
    restriction: 'basic_only',
  }).filter(
    (target) =>
      target.shipDefId !== 'EQU' &&
      !reservedTargetInstanceIds.has(target.instanceId),
  );

  const validOpponentTargets = getValidDestroyTargets(state, {
    sourcePlayerId,
    targetScope: 'opponent',
    restriction: 'basic_only',
  }).filter(
    (target) =>
      target.shipDefId !== 'EQU' &&
      !reservedTargetInstanceIds.has(target.instanceId),
  );

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
